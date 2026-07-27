/**
 * Development-only logging.
 *
 * Metro strips nothing on its own, so a bare `console.warn` left in the code
 * still runs on a user's phone: it keeps the logged objects alive for as long as
 * the ring buffer holds them, and leaks internals to anyone with a USB cable and
 * `adb logcat`.
 *
 * `__DEV__` is a Metro *runtime* global (the release prelude sets `__DEV__=false`),
 * not a per-site literal, so the guard is a branch rather than something the
 * minifier can delete. That is enough for the goal here — nothing is ever printed
 * in a release build — at the cost of the message string still being built on the
 * rare paths that log. Every one of those paths is already an error path.
 */

type LogArgs = readonly unknown[];

export const logger = {
  warn: (message: string, ...args: LogArgs): void => {
    if (__DEV__) console.warn(message, ...args);
  },

  error: (message: string, ...args: LogArgs): void => {
    if (__DEV__) console.error(message, ...args);
  },
};
