/**
 * AI Japanese Teacher - Navigation Types
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { DailyLesson, JLPTLevel } from './domain';

export type RootTabParamList = {
  Learn: undefined;
  History: undefined;
  WordBank: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  LessonStudy: {
    lesson: DailyLesson;
    initialScreen?: 'vocab' | 'dialogue';
  };
  GenerateLessonModal: {
    initialTopic?: string;
    initialLevel?: JLPTLevel;
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
