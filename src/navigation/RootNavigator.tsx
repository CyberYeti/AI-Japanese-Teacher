import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, RootTabParamList } from '../types/navigation';
import { LearnScreen } from '../screens/LearnScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { WordBankScreen } from '../screens/WordBankScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LessonStudyScreen } from '../screens/LessonStudyScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Learn"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.secondary,
          borderTopColor: theme.colors.background.cardBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.brand.primary,
        tabBarInactiveTintColor: theme.colors.text.subtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Learn"
        component={LearnScreen}
        options={{
          tabBarLabel: 'Learn',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'school' : 'school-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="WordBank"
        component={WordBankScreen}
        options={{
          tabBarLabel: 'Word Bank',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background.primary },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="LessonStudy" component={LessonStudyScreen} />
    </Stack.Navigator>
  );
};
