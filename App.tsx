import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme';

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.brand.primary,
    background: theme.colors.background.primary,
    card: theme.colors.background.secondary,
    text: theme.colors.text.primary,
    border: theme.colors.background.cardBorder,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={appTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
