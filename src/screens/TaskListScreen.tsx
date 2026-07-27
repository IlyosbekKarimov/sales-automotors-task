import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { TaskCard } from '@/components/task/TaskCard';
import { TaskFilterBar } from '@/components/task/TaskFilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { useToast } from '@/context/ToastContext';
import type { TabScreenProps } from '@/navigation/types';
import type { Task, TaskListFilters } from '@/types';
import { DEFAULT_FILTERS, applyFilters, countTasks } from '@/utils/task.utils';

type Props = TabScreenProps<'Tasks'>;

/**
 * Home screen: sync state, search/sort/filter controls and the task list.
 *
 * Filter state is local rather than global — it is view state, not domain state,
 * and keeping it here means the reducer never re-runs because someone typed in
 * the search box.
 */
export const TaskListScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showInfo } = useToast();
  const { tasks, isHydrating, hydrationError, runSync, sync } = useTasks();

  const [filters, setFilters] = useState<TaskListFilters>(DEFAULT_FILTERS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const counts = useMemo(() => countTasks(tasks), [tasks]);
  const visibleTasks = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const isFiltered =
    filters.query.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.dueRange.preset !== 'any';

  const updateFilters = useCallback(
    (patch: Partial<TaskListFilters>) => setFilters((current) => ({ ...current, ...patch })),
    []
  );

  const openTask = useCallback(
    (taskId: string) => navigation.navigate('TaskDetail', { taskId }),
    [navigation]
  );

  const handleSync = useCallback(async () => {
    const result = await runSync();
    if (result.ok) showSuccess(result.data, 'Sync complete');
    else showError(result.message, 'Sync problem');
  }, [runSync, showSuccess, showError]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await handleSync();
    setIsRefreshing(false);
  }, [handleSync]);

  const renderItem = useCallback(
    ({ item }: { item: Task }) => <TaskCard task={item} onPress={openTask} />,
    [openTask]
  );

  const subtitle = (() => {
    if (isHydrating) return 'Loading saved tasks…';
    if (counts.total === 0) return 'No tasks yet';
    const parts = [`${counts.total} task${counts.total === 1 ? '' : 's'}`];
    if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`);
    if (counts.byStatus['In Progress'] > 0) parts.push(`${counts.byStatus['In Progress']} active`);
    return parts.join(' · ');
  })();

  const listEmpty = () => {
    if (isHydrating) {
      return (
        <View
          style={{
            paddingVertical: theme.spacing.xxxl,
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="caption" color="textMuted">
            Loading your tasks…
          </Text>
        </View>
      );
    }

    if (hydrationError) {
      return (
        <EmptyState
          icon="warning-outline"
          tone="error"
          title="Saved tasks could not be loaded"
          description={hydrationError}
        />
      );
    }

    if (isFiltered) {
      return (
        <EmptyState
          icon="search-outline"
          title="No tasks match"
          description="Try a different search term, or clear the status filters."
          actionLabel="Clear filters"
          onAction={() => setFilters(DEFAULT_FILTERS)}
        />
      );
    }

    return (
      <EmptyState
        icon="clipboard-outline"
        title="No tasks yet"
        description="Create your first field task. It is saved on this device straight away and syncs when a connection is available."
        actionLabel="Create a task"
        onAction={() => navigation.navigate('TaskForm')}
      />
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Field tasks" subtitle={subtitle} />

      <FlatList
        data={visibleTasks}
        keyExtractor={(task) => task.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
            <SyncStatusBar onPress={handleSync} />
            <TaskFilterBar filters={filters} counts={counts} onChange={updateFilters} />
            {isFiltered && visibleTasks.length > 0 ? (
              <Text variant="caption" color="textSubtle">
                Showing {visibleTasks.length} of {counts.total} tasks
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{
          padding: theme.layout.screenPadding,
          gap: theme.spacing.sm,
          // Clear the floating action button and the tab bar.
          paddingBottom: insets.bottom + 96,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={11}
      />

      <Pressable
        onPress={() => {
          if (sync.phase === 'syncing') showInfo('A sync is running — your task will still save.');
          navigation.navigate('TaskForm');
        }}
        accessibilityRole="button"
        accessibilityLabel="Create a new task"
        style={({ pressed }) => ({
          position: 'absolute',
          right: theme.spacing.md,
          bottom: insets.bottom + theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          height: 56,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.pill,
          backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          ...theme.shadow.floating,
        })}
      >
        <Ionicons name="add" size={22} color={theme.colors.onPrimary} />
        <Text variant="bodyStrong" style={{ color: theme.colors.onPrimary }}>
          New task
        </Text>
      </Pressable>
    </Screen>
  );
};
