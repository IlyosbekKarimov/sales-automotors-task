import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

/** Route params live in one file so a screen can never be pushed without its data. */

export type TabParamList = {
  Tasks: undefined;
  Map: { focusTaskId?: string } | undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  TaskDetail: { taskId: string };
  /** Omit `taskId` to create; pass it to edit an existing task. */
  TaskForm: { taskId?: string } | undefined;
};

export type RootStackScreenProps<TRoute extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  TRoute
>;

/**
 * Composite, not a bare `BottomTabScreenProps`: tab screens routinely push
 * routes that live on the parent stack (task detail, the create form), and
 * without composing the two the compiler rejects those perfectly valid calls.
 */
export type TabScreenProps<TRoute extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, TRoute>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Types `useNavigation()` where a screen's own props are not threaded through. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
