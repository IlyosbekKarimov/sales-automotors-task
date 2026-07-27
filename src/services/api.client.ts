import { APP_CONFIG } from '@/constants/config';

/**
 * Minimal typed `fetch` wrapper for the json-server mock API.
 *
 * A dedicated client exists for two reasons: every request needs a timeout (a
 * phone that has "connectivity" but no route to the dev machine would otherwise
 * hang the sync spinner forever), and the sync service needs to distinguish a
 * 404 from a transport failure so it can turn a failed PUT into a POST.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or `null` when the request never reached the server. */
    readonly status: number | null,
    /** Distinguishes "no route to the server" from "server took too long". */
    readonly isTimeout: boolean = false,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** True when the server was unreachable rather than unhappy. */
  get isNetworkError(): boolean {
    return this.status === null;
  }
}

const normaliseBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '');

const request = async <TResponse>(
  baseUrl: string,
  path: string,
  init: RequestInit
): Promise<TResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS);
  const url = `${normaliseBaseUrl(baseUrl)}${path}`;

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
    });

    if (!response.ok) {
      throw new ApiError(
        `Server responded ${response.status} for ${path}.`,
        response.status,
        false
      );
    }

    // 204 and empty bodies are legitimate for DELETE; don't fail parsing them.
    const text = await response.text();
    return (text.length > 0 ? JSON.parse(text) : null) as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        `No response from ${url} within ${APP_CONFIG.REQUEST_TIMEOUT_MS / 1000}s.`,
        null,
        true,
        error
      );
    }
    // Include the URL: "could not reach the server" is useless without knowing
    // which address was actually tried.
    throw new ApiError(`Could not reach ${url}.`, null, false, error);
  } finally {
    clearTimeout(timeout);
  }
};

export interface ApiClient {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
  delete: (path: string) => Promise<void>;
  /** Cheap reachability probe used before a full sync run. */
  ping: () => Promise<boolean>;
}

export const createApiClient = (baseUrl: string): ApiClient => ({
  get: (path) => request(baseUrl, path, { method: 'GET' }),
  post: (path, body) => request(baseUrl, path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(baseUrl, path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: async (path) => {
    await request(baseUrl, path, { method: 'DELETE' });
  },
  ping: async () => {
    try {
      await request(baseUrl, '/tasks?_limit=1', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  },
});
