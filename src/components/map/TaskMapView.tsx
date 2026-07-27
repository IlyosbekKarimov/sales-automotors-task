import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

import { buildMapHtml } from '@/components/map/map-html';
import type { MapMarkerPayload } from '@/components/map/map-html';
import { Text } from '@/components/ui/Text';
import { MAP_CONFIG } from '@/constants/config';
import { getStatusTone } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { Task } from '@/types';
import { formatDateTime } from '@/utils/date.utils';
import { logger } from '@/utils/logger';

interface TaskMapViewProps {
  /** Only tasks that actually carry coordinates. */
  tasks: Task[];
  onMarkerPress: (taskId: string) => void;
  /** Set to recentre the map on one task, e.g. from the detail screen. */
  focusTaskId?: string | null;
}

/**
 * React Native side of the map.
 *
 * State flows one way: tasks are projected into plain marker payloads and pushed
 * into the WebView; the WebView only ever sends back "this pin was tapped". No
 * DOM state leaks into React, and the document is built once per theme rather
 * than per render, so panning is never interrupted by a reload.
 */
export const TaskMapView = ({ tasks, onMarkerPress, focusTaskId }: TaskMapViewProps) => {
  const { theme, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const isReady = useRef(false);

  const markers = useMemo<MapMarkerPayload[]>(
    () =>
      tasks.flatMap((task) => {
        const { latitude, longitude } = task.location;
        if (latitude === null || longitude === null) return [];
        return [
          {
            id: task.id,
            latitude,
            longitude,
            title: task.title,
            subtitle: `${task.status} · ${formatDateTime(task.dueDate)}`,
            color: getStatusTone(task.status, theme.colors).fg,
          },
        ];
      }),
    [tasks, theme.colors]
  );

  const html = useMemo(
    () =>
      buildMapHtml({
        isDark,
        backgroundColor: theme.colors.background,
        surfaceColor: theme.colors.surface,
        textColor: theme.colors.text,
        borderColor: theme.colors.border,
        fallbackLatitude: MAP_CONFIG.FALLBACK_REGION.latitude,
        fallbackLongitude: MAP_CONFIG.FALLBACK_REGION.longitude,
        fallbackZoom: MAP_CONFIG.FALLBACK_REGION.zoom,
      }),
    [isDark, theme.colors]
  );

  const pushMarkers = useCallback(() => {
    if (!isReady.current) return;
    webViewRef.current?.injectJavaScript(`window.__setMarkers(${JSON.stringify(markers)}); true;`);
  }, [markers]);

  useEffect(pushMarkers, [pushMarkers]);

  useEffect(() => {
    if (!focusTaskId || !isReady.current) return;
    webViewRef.current?.injectJavaScript(`window.__focus(${JSON.stringify(focusTaskId)}); true;`);
  }, [focusTaskId]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as { type: string; id?: string };
        if (payload.type === 'ready') {
          isReady.current = true;
          pushMarkers();
          if (focusTaskId) {
            webViewRef.current?.injectJavaScript(
              `window.__focus(${JSON.stringify(focusTaskId)}); true;`
            );
          }
          return;
        }
        if (payload.type === 'marker-press' && payload.id) onMarkerPress(payload.id);
      } catch (error) {
        logger.warn('[map] Unreadable message from the map view.', error);
      }
    },
    [focusTaskId, onMarkerPress, pushMarkers]
  );

  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: theme.colors.surfaceMuted }}>
      <WebView
        ref={webViewRef}
        // Remounting on theme change is intentional: the CSS is baked into the document.
        key={isDark ? 'dark' : 'light'}
        source={{ html, baseUrl: 'https://tile.openstreetmap.org' }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        // The document handles its own gestures; RN scrolling would fight it.
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        startInLoadingState
        renderLoading={() => (
          <View
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
          >
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
        renderError={() => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.xxs,
                padding: theme.spacing.lg,
                backgroundColor: theme.colors.background,
              },
            ]}
          >
            <Text variant="bodyStrong" align="center">
              The map could not be loaded
            </Text>
            <Text variant="caption" color="textMuted" align="center">
              Map tiles need an internet connection. Task locations are still listed below.
            </Text>
          </View>
        )}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
};
