import { NavigatorScreenParams, CommonActions } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SituationshipList: undefined;
  Profile: { refresh?: number };
  Settings: undefined;
  SituationshipDetail: { id: string };
  Share: { token: string };
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

export type MainStackParamList = {
  SituationshipList: undefined;
  Profile: { refresh?: number };
  Settings: undefined;
  SituationshipDetail: { id: string };
};

export type ShareStackParamList = {
  Share: { token: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Extend NavigationProp to include CommonActions methods
declare module '@react-navigation/native' {
  export interface NavigationProp<
    ParamList extends Record<string, object | undefined>,
    RouteName extends keyof ParamList = string
  > {
    dispatch(action: ReturnType<typeof CommonActions.reset>): void;
    setParams(params: Partial<ParamList[RouteName]>): void;
  }
} 