import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { DueRangeFilter } from '@/components/task/DueRangeFilter';
import { Chip } from '@/components/ui/Chip';
import { OptionSheet } from '@/components/ui/OptionSheet';
import type { SheetOption } from '@/components/ui/OptionSheet';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/context/ThemeContext';
import { TASK_STATUSES } from '@/types';
import type { TaskListFilters, TaskSortKey, TaskStatus } from '@/types';
import type { TaskCounts } from '@/utils/task.utils';

interface TaskFilterBarProps {
  filters: TaskListFilters;
  counts: TaskCounts;
  onChange: (patch: Partial<TaskListFilters>) => void;
}

const SORT_OPTIONS: SheetOption<TaskSortKey>[] = [
  {
    value: 'dueDate',
    label: 'Due date',
    description: 'When the work must be done',
    icon: 'time-outline',
  },
  {
    value: 'createdAt',
    label: 'Date added',
    description: 'When the task was created',
    icon: 'add-circle-outline',
  },
  {
    value: 'status',
    label: 'Status',
    description: 'In Progress first, then New, then closed',
    icon: 'flag-outline',
  },
];

const SORT_LABELS: Record<TaskSortKey, string> = {
  dueDate: 'Due date',
  createdAt: 'Date added',
  status: 'Status',
};

/**
 * Search, status filtering and sorting for the task list.
 *
 * The direction control is a separate toggle rather than six combined options
 * ("Due date ascending", "Due date descending", …) — two small controls are
 * quicker to operate one-handed than one long list.
 */
export const TaskFilterBar = ({ filters, counts, onChange }: TaskFilterBarProps) => {
  const theme = useAppTheme();
  const [isSortSheetOpen, setSortSheetOpen] = useState(false);

  const toggleStatus = (status: TaskStatus) => {
    const isActive = filters.statuses.includes(status);
    onChange({
      statuses: isActive
        ? filters.statuses.filter((entry) => entry !== status)
        : [...filters.statuses, status],
    });
  };

  const isAscending = filters.sortDirection === 'asc';

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minHeight: theme.layout.minTapTarget,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Ionicons name="search" size={18} color={theme.colors.textSubtle} />
        <TextInput
          value={filters.query}
          onChangeText={(query) => onChange({ query })}
          placeholder="Search title, description or address"
          placeholderTextColor={theme.colors.textSubtle}
          accessibilityLabel="Search tasks"
          returnKeyType="search"
          maxFontSizeMultiplier={1.4}
          style={{
            flex: 1,
            paddingVertical: theme.spacing.sm,
            color: theme.colors.text,
            fontSize: theme.typography.body.fontSize,
          }}
        />
        {filters.query.length > 0 ? (
          <Pressable
            onPress={() => onChange({ query: '' })}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xs, paddingRight: theme.spacing.md }}
      >
        <Chip
          label={SORT_LABELS[filters.sortKey]}
          selected
          icon="swap-vertical-outline"
          onPress={() => setSortSheetOpen(true)}
        />
        <Chip
          label={isAscending ? 'Ascending' : 'Descending'}
          selected={false}
          icon={isAscending ? 'arrow-up-outline' : 'arrow-down-outline'}
          onPress={() => onChange({ sortDirection: isAscending ? 'desc' : 'asc' })}
        />

        <View style={{ width: 1, backgroundColor: theme.colors.border, marginHorizontal: 2 }} />

        <DueRangeFilter value={filters.dueRange} onChange={(dueRange) => onChange({ dueRange })} />

        <View style={{ width: 1, backgroundColor: theme.colors.border, marginHorizontal: 2 }} />

        {TASK_STATUSES.map((status) => (
          <Chip
            key={status}
            label={status}
            count={counts.byStatus[status]}
            selected={filters.statuses.includes(status)}
            onPress={() => toggleStatus(status)}
          />
        ))}
      </ScrollView>

      {filters.statuses.length > 0 ? (
        <Pressable
          onPress={() => onChange({ statuses: [] })}
          accessibilityRole="button"
          accessibilityLabel="Clear status filters"
          hitSlop={8}
          style={{ alignSelf: 'flex-start' }}
        >
          <Text variant="caption" color="primary">
            Clear {filters.statuses.length} status filter
            {filters.statuses.length === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ) : null}

      <OptionSheet
        visible={isSortSheetOpen}
        title="Sort tasks by"
        subtitle="Applies to the list below"
        options={SORT_OPTIONS}
        selectedValue={filters.sortKey}
        onSelect={(sortKey) => {
          onChange({ sortKey });
          setSortSheetOpen(false);
        }}
        onClose={() => setSortSheetOpen(false)}
      />
    </View>
  );
};
