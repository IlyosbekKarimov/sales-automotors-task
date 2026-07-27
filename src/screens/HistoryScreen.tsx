import { useCallback, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { HistoryItem } from '@/components/history/HistoryItem';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import type { TabScreenProps } from '@/navigation/types';
import type { HistoryAction, HistoryLog } from '@/types';
import { formatDayLabel } from '@/utils/date.utils';

type Props = TabScreenProps<'History'>;
type HistoryFilter = 'all' | 'task' | 'status' | 'attachment' | 'sync';

const FILTER_MATCHERS: Record<HistoryFilter, (action: HistoryAction) => boolean> = {
  all: () => true,
  task: (action) => action === 'CREATED' || action === 'UPDATED' || action === 'DELETED',
  status: (action) => action === 'STATUS_CHANGED',
  attachment: (action) => action === 'ATTACHMENT_ADDED' || action === 'ATTACHMENT_REMOVED',
  sync: (action) => action === 'SYNCED' || action === 'SYNC_FAILED',
};

const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: 'Everything',
  task: 'Tasks',
  status: 'Status',
  attachment: 'Files',
  sync: 'Sync',
};

interface DaySection {
  title: string;
  data: HistoryLog[];
}

/**
 * The audit trail, newest first and grouped by day.
 *
 * Grouping is done here rather than stored, so the log itself stays a flat,
 * append-only list — the simplest thing that can be persisted and merged.
 */
export const HistoryScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { historyLogs, tasks } = useTasks();

  const [filter, setFilter] = useState<HistoryFilter>('all');

  const sections = useMemo<DaySection[]>(() => {
    const matches = FILTER_MATCHERS[filter];
    const filtered = historyLogs.filter((log) => matches(log.action));

    const byDay = new Map<string, HistoryLog[]>();
    for (const log of filtered) {
      const key = formatDayLabel(log.timestamp);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(log);
      else byDay.set(key, [log]);
    }

    return [...byDay.entries()].map(([title, data]) => ({ title, data }));
  }, [historyLogs, filter]);

  const existingTaskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);

  const openTask = useCallback(
    (taskId: string) => navigation.navigate('TaskDetail', { taskId }),
    [navigation]
  );

  const totalEntries = historyLogs.length;

  return (
    <Screen>
      <ScreenHeader
        title="History"
        subtitle={
          totalEntries === 0
            ? 'Nothing recorded yet'
            : `${totalEntries} entr${totalEntries === 1 ? 'y' : 'ies'} · stored on this device`
        }
      />

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenPadding,
          paddingVertical: theme.spacing.xs,
        }}
      >
        {(Object.keys(FILTER_LABELS) as HistoryFilter[]).map((key) => (
          <Chip
            key={key}
            label={FILTER_LABELS[key]}
            selected={filter === key}
            onPress={() => setFilter(key)}
          />
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(log) => log.id}
        renderItem={({ item, index, section }) => (
          <HistoryItem
            log={item}
            isLast={index === section.data.length - 1}
            onPress={existingTaskIds.has(item.taskId) ? openTask : undefined}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingVertical: theme.spacing.xs,
              marginBottom: theme.spacing.xs,
              backgroundColor: theme.colors.background,
            }}
          >
            <Text variant="overline" color="textSubtle" style={{ letterSpacing: 0.8 }}>
              {section.title.toUpperCase()} · {section.data.length}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title={totalEntries === 0 ? 'No history yet' : 'Nothing in this category'}
            description={
              totalEntries === 0
                ? 'Creating, editing, closing or syncing a task records a timestamped entry here. The log survives closing the app.'
                : 'Choose a different filter to see other activity.'
            }
            actionLabel={totalEntries === 0 ? undefined : 'Show everything'}
            onAction={totalEntries === 0 ? undefined : () => setFilter('all')}
          />
        }
        stickySectionHeadersEnabled
        contentContainerStyle={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          flexGrow: 1,
        }}
        initialNumToRender={12}
      />
    </Screen>
  );
};
