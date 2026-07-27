import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { navigationRef } from '@/navigation/navigationRef';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { MapScreen } from '@/screens/MapScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TaskDetailScreen } from '@/screens/TaskDetailScreen';
import { TaskFormScreen } from '@/screens/TaskFormScreen';
import { TaskListScreen } from '@/screens/TaskListScreen';
import { formatBadgeCount } from '@/utils/format.utils';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<
  keyof TabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Tasks: { active: 'clipboard', inactive: 'clipboard-outline' },
  Map: { active: 'map', inactive: 'map-outline' },
  History: { active: 'time', inactive: 'time-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

/**
 * Four tabs for the day-to-day surfaces, with the create/edit form and the task
 * detail pushed on the stack above them — so a task opened from the map, from
 * the list or from a history entry lands in exactly the same place.
 *
 * Screens render their own `ScreenHeader`, so the navigators' headers are off:
 * one header implementation means the theme toggle and live subtitles work
 * everywhere without fighting the native header's styling.
 */
const TabNavigator = () => {
  const { theme } = useTheme();
  const { pendingSyncCount } = useTasks();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 62 + theme.spacing.xs,
          paddingTop: 6,
          paddingBottom: theme.spacing.xs,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name].active : TAB_ICONS[route.name].inactive}
            size={size - 2}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Tasks"
        component={TaskListScreen}
        options={{
          title: 'Tasks',
          // Surfaces unsynced work without opening the app's Settings tab.
          tabBarBadge: pendingSyncCount > 0 ? formatBadgeCount(pendingSyncCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.warning,
            color: '#FFFFFF',
            fontSize: 10,
          },
        }}
      />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: 'Map' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

interface RootNavigatorProps {
  /** Lets the app root defer notification handling until routes can be resolved. */
  onReady: () => void;
}

export const RootNavigator = ({ onReady }: RootNavigatorProps) => {
  const { theme, isDark } = useTheme();

  const navigationTheme = useMemo<Theme>(
    () => ({
      dark: isDark,
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' },
        medium: { fontFamily: 'System', fontWeight: '500' },
        bold: { fontFamily: 'System', fontWeight: '700' },
        heavy: { fontFamily: 'System', fontWeight: '800' },
      },
    }),
    [theme, isDark]
  );

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={onReady}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
        <Stack.Screen
          name="TaskForm"
          component={TaskFormScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
