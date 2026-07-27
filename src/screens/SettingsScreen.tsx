import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { OptionSheet } from '@/components/ui/OptionSheet';
import type { SheetOption } from '@/components/ui/OptionSheet';
import { Screen } from '@/components/ui/Screen';
import { Divider, Section } from '@/components/ui/Section';
import { SettingRow } from '@/components/ui/SettingRow';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { APP_CONFIG, NOTIFICATION_CONFIG } from '@/constants/config';
import { useSettings } from '@/context/SettingsContext';
import { useAppTheme, useTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { useToast } from '@/context/ToastContext';
import {
  UNSUPPORTED_HOST_MESSAGE,
  areRemindersSupported,
  getScheduledReminderCount,
  sendTestReminder,
} from '@/services/notification.service';
import { SyncService } from '@/services/sync.service';
import type { ServerDiagnosis } from '@/services/sync.service';
import type { ThemePreference } from '@/types';
import { formatDateTime } from '@/utils/date.utils';
import { validateApiBaseUrl } from '@/utils/validation.utils';

const THEME_OPTIONS: SheetOption<ThemePreference>[] = [
  {
    value: 'system',
    label: 'Match system',
    description: 'Follow the phone’s appearance setting',
    icon: 'phone-portrait-outline',
  },
  { value: 'light', label: 'Light', description: 'Best in direct sunlight', icon: 'sunny-outline' },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easier on the eyes at night',
    icon: 'moon-outline',
  },
];

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
};

/**
 * Settings and About.
 *
 * The mock-server URL is editable at runtime on purpose: the release APK is
 * built once, but the reviewer's json-server will be on a different LAN address
 * than the one baked in at build time. Without this the APK could never be
 * pointed at their machine.
 */
export const SettingsScreen = () => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();
  const { settings, updateSettings, apiBaseUrl } = useSettings();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { tasks, historyLogs, sync, pendingSyncCount, runSync, clearAllData, isOnline } =
    useTasks();

  const [isThemeSheetOpen, setThemeSheetOpen] = useState(false);
  const [isServerModalOpen, setServerModalOpen] = useState(false);
  const [isClearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [serverDraft, setServerDraft] = useState(apiBaseUrl);
  const [serverError, setServerError] = useState<string | undefined>();
  const [scheduledCount, setScheduledCount] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [lastDiagnosis, setLastDiagnosis] = useState<ServerDiagnosis | null>(null);
  const remindersSupported = areRemindersSupported();

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    const diagnosis = await SyncService.diagnoseServer(apiBaseUrl);
    setLastDiagnosis(diagnosis);
    setIsTesting(false);

    if (diagnosis.ok) showSuccess(diagnosis.message, 'Server reachable');
    else showError(diagnosis.message, 'Cannot reach the server');
  }, [apiBaseUrl, showSuccess, showError]);

  useEffect(() => {
    void getScheduledReminderCount().then(setScheduledCount);
  }, [tasks, settings.remindersEnabled, settings.demoRemindersEnabled]);

  const handleTestReminder = useCallback(async () => {
    const result = await sendTestReminder();
    if (result.status === 'scheduled') showSuccess(result.message, 'Test reminder queued');
    else showWarning(result.message, 'Reminder not sent');
  }, [showSuccess, showWarning]);

  const handleSaveServerUrl = useCallback(async () => {
    const error = validateApiBaseUrl(serverDraft);
    setServerError(error);
    if (error) return;

    await updateSettings({ apiBaseUrl: serverDraft.trim() });
    setServerModalOpen(false);
    showSuccess('Sync server updated. Run a sync to test it.', 'Saved');
  }, [serverDraft, updateSettings, showSuccess]);

  const handleSyncNow = useCallback(async () => {
    if (!isOnline) showInfo('You appear to be offline — trying anyway.');
    const result = await runSync();
    if (result.ok) showSuccess(result.data, 'Sync complete');
    else showError(result.message, 'Sync problem');
  }, [isOnline, runSync, showSuccess, showError, showInfo]);

  const handleClearData = useCallback(async () => {
    setIsClearing(true);
    const result = await clearAllData();
    setIsClearing(false);
    setClearDialogOpen(false);
    if (result.ok) showSuccess('All local tasks, history and files were removed.', 'Data cleared');
    else showError(result.message, 'Could not clear data');
  }, [clearAllData, showSuccess, showError]);

  return (
    <Screen>
      <ScreenHeader title="Settings" subtitle={`${APP_CONFIG.APP_NAME} ${APP_CONFIG.VERSION}`} />

      <ScrollView
        contentContainerStyle={{
          padding: theme.layout.screenPadding,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <Section title="Appearance" grouped>
          <SettingRow
            kind="navigation"
            icon="color-palette-outline"
            title="Theme"
            description="Light, dark, or follow the system"
            value={THEME_LABELS[preference]}
            onPress={() => setThemeSheetOpen(true)}
          />
        </Section>

        <Section title="Reminders" grouped>
          {!remindersSupported ? (
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.xs,
                margin: theme.spacing.xs,
                padding: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.warningSoft,
              }}
            >
              <Ionicons name="information-circle" size={18} color={theme.colors.warning} />
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {UNSUPPORTED_HOST_MESSAGE}
              </Text>
            </View>
          ) : null}
          <SettingRow
            kind="toggle"
            icon="notifications-outline"
            title="Task reminders"
            description={`Fires ${NOTIFICATION_CONFIG.LEAD_TIME_MINUTES} minutes before a task is due`}
            value={settings.remindersEnabled}
            disabled={!remindersSupported}
            onValueChange={(remindersEnabled) => void updateSettings({ remindersEnabled })}
          />
          <Divider />
          <SettingRow
            kind="toggle"
            icon="timer-outline"
            title="Demo mode"
            description={`Reminders fire ${NOTIFICATION_CONFIG.DEMO_DELAY_SECONDS} seconds after saving, for the review video`}
            value={settings.demoRemindersEnabled}
            disabled={!remindersSupported || !settings.remindersEnabled}
            onValueChange={(demoRemindersEnabled) => {
              void updateSettings({ demoRemindersEnabled });
              showInfo(
                demoRemindersEnabled
                  ? `New and rescheduled tasks will notify after ${NOTIFICATION_CONFIG.DEMO_DELAY_SECONDS} seconds.`
                  : 'Back to the standard 30-minute lead time.'
              );
            }}
          />
          <Divider />
          <SettingRow
            kind="navigation"
            icon="send-outline"
            title="Send a test reminder"
            description="Confirms notifications work on this device"
            value={remindersSupported ? `${scheduledCount} queued` : 'Unavailable'}
            disabled={!remindersSupported}
            onPress={() => void handleTestReminder()}
          />
        </Section>

        <Section title="Synchronisation" grouped>
          <SettingRow
            kind="toggle"
            icon="sync-outline"
            title="Sync automatically"
            description="Push local changes as soon as the connection returns"
            value={settings.autoSyncEnabled}
            onValueChange={(autoSyncEnabled) => void updateSettings({ autoSyncEnabled })}
          />
          <Divider />
          <SettingRow
            kind="navigation"
            icon="server-outline"
            title="Mock server URL"
            description="json-server address used for synchronisation"
            value={apiBaseUrl.replace(/^https?:\/\//, '')}
            onPress={() => {
              setServerDraft(apiBaseUrl);
              setServerError(undefined);
              setServerModalOpen(true);
            }}
          />
          <Divider />
          <SettingRow
            kind="navigation"
            icon="pulse-outline"
            title="Test connection"
            description="Checks the server without changing any data"
            value={isTesting ? 'Testing…' : lastDiagnosis?.ok ? 'Reachable' : undefined}
            disabled={isTesting}
            onPress={() => void handleTestConnection()}
          />
          {lastDiagnosis && !lastDiagnosis.ok ? (
            <View
              style={{
                gap: 4,
                marginHorizontal: theme.spacing.xs,
                marginBottom: theme.spacing.xs,
                padding: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.dangerSoft,
              }}
            >
              <Text variant="caption" color="danger">
                {lastDiagnosis.message}
              </Text>
              {lastDiagnosis.hint ? (
                <Text variant="caption" color="textMuted">
                  {lastDiagnosis.hint}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Divider />
          <SettingRow
            kind="navigation"
            icon="cloud-upload-outline"
            title="Sync now"
            description={
              sync.lastSyncedAt
                ? `Last successful sync ${formatDateTime(sync.lastSyncedAt)}`
                : 'No successful sync yet'
            }
            value={pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Up to date'}
            onPress={() => void handleSyncNow()}
          />
        </Section>

        <Section title="Local data" grouped>
          <SettingRow
            kind="navigation"
            icon="trash-outline"
            title="Clear all local data"
            description="Removes tasks, history, attachments and reminders from this device"
            destructive
            onPress={() => setClearDialogOpen(true)}
          />
        </Section>

        <Section title="About">
          <Card style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Ionicons name="construct-outline" size={24} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subheading">{APP_CONFIG.APP_NAME}</Text>
                <Text variant="caption" color="textMuted">
                  {APP_CONFIG.APP_TAGLINE}
                </Text>
              </View>
            </View>

            <View
              style={{
                gap: 4,
                padding: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="overline" color="primary" style={{ letterSpacing: 0.8 }}>
                CANDIDATE CODE
              </Text>
              <Text
                variant="title"
                color="primary"
                accessibilityLabel="Candidate code S A R N 2026 ILYOS"
              >
                {APP_CONFIG.CANDIDATE_CODE}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <AboutRow label="Author" value={APP_CONFIG.AUTHOR} />
              <AboutRow label="Version" value={APP_CONFIG.VERSION} />
              <AboutRow label="Tasks stored" value={String(tasks.length)} />
              <AboutRow label="History entries" value={String(historyLogs.length)} />
              <AboutRow label="Connection" value={isOnline ? 'Online' : 'Offline'} />
            </View>

            <Text variant="caption" color="textSubtle">
              Built with Expo SDK 57 and React Native. Local storage uses AsyncStorage, reminders
              use expo-notifications, and the map draws OpenStreetMap tiles — no API keys are
              required or stored in this project.
            </Text>
          </Card>
        </Section>

        <Text variant="caption" color="textSubtle" align="center">
          {APP_CONFIG.CANDIDATE_CODE} · {APP_CONFIG.AUTHOR}
        </Text>
      </ScrollView>

      <OptionSheet
        visible={isThemeSheetOpen}
        title="Theme"
        subtitle="Applies immediately across the whole app"
        options={THEME_OPTIONS}
        selectedValue={preference}
        onSelect={(next) => {
          setPreference(next);
          setThemeSheetOpen(false);
        }}
        onClose={() => setThemeSheetOpen(false)}
      />

      <Modal
        visible={isServerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'center',
            padding: theme.spacing.lg,
          }}
        >
          <View
            style={{
              gap: theme.spacing.sm,
              padding: theme.spacing.lg,
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.surface,
              ...theme.shadow.floating,
            }}
          >
            <Text variant="heading">Mock server URL</Text>
            <Text variant="caption" color="textMuted">
              Point the app at your json-server. Use 10.0.2.2 for the Android emulator, or your
              computer’s LAN IP for a physical device.
            </Text>

            <TextField
              label="Base URL"
              icon="server-outline"
              value={serverDraft}
              onChangeText={(value) => {
                setServerDraft(value);
                setServerError(undefined);
              }}
              error={serverError}
              placeholder="http://192.168.1.10:3000"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              <Button
                label="Reset"
                variant="ghost"
                onPress={() => {
                  void updateSettings({ apiBaseUrl: null });
                  setServerModalOpen(false);
                  showInfo('Reverted to the built-in default server address.');
                }}
              />
              <View style={{ flex: 1 }} />
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setServerModalOpen(false)}
              />
              <Button label="Save" onPress={() => void handleSaveServerUrl()} />
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={isClearDialogOpen}
        title="Clear all local data?"
        message={`${tasks.length} task${tasks.length === 1 ? '' : 's'}, ${historyLogs.length} history entries, all attached files and all scheduled reminders will be deleted from this device. Records already on the mock server are not touched.`}
        confirmLabel="Clear everything"
        loading={isClearing}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={() => void handleClearData()}
      />
    </Screen>
  );
};

const AboutRow = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Text variant="caption" color="textMuted">
      {label}
    </Text>
    <Text variant="caption" color="text">
      {value}
    </Text>
  </View>
);
