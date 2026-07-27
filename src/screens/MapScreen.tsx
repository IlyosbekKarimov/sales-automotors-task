import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { TaskMapView } from '@/components/map/TaskMapView';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useTasks } from '@/context/TaskContext';
import type { TabScreenProps } from '@/navigation/types';
import { tasksWithCoordinates } from '@/utils/task.utils';

type Props = TabScreenProps<'Map'>;

/**
 * Map tab. Only tasks with coordinates are plotted; tapping a pin opens its
 * callout, and tapping the callout pushes the task detail screen.
 *
 * The detail screen can deep-link here with `focusTaskId` to centre on one task.
 * That param is consumed once and cleared, so returning to the tab later shows
 * the whole set rather than snapping back to an old selection.
 */
export const MapScreen = ({ navigation, route }: Props) => {
  const { tasks } = useTasks();
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const locatedTasks = useMemo(() => tasksWithCoordinates(tasks), [tasks]);

  useEffect(() => {
    const requested = route.params?.focusTaskId;
    if (!requested) return;
    setFocusTaskId(requested);
    navigation.setParams({ focusTaskId: undefined });
  }, [route.params?.focusTaskId, navigation]);

  const openTask = useCallback(
    (taskId: string) => navigation.navigate('TaskDetail', { taskId }),
    [navigation]
  );

  const subtitle =
    locatedTasks.length === 0
      ? 'No tasks have coordinates yet'
      : `${locatedTasks.length} of ${tasks.length} task${tasks.length === 1 ? '' : 's'} pinned`;

  return (
    <Screen>
      <ScreenHeader title="Map" subtitle={subtitle} />

      {locatedTasks.length === 0 ? (
        <EmptyState
          icon="map-outline"
          title="Nothing to show on the map"
          description="Tasks appear here once they have coordinates. Add them when creating a task, or tap “Use a saved site” to fill them in automatically."
          actionLabel={tasks.length === 0 ? 'Create a task' : 'Go to tasks'}
          onAction={() =>
            tasks.length === 0 ? navigation.navigate('TaskForm') : navigation.navigate('Tasks')
          }
        />
      ) : (
        <View style={{ flex: 1 }}>
          <TaskMapView tasks={locatedTasks} onMarkerPress={openTask} focusTaskId={focusTaskId} />
        </View>
      )}
    </Screen>
  );
};
