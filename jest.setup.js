// Jest setup for React Native & Expo
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
  getAvailableVoicesAsync: jest.fn().mockResolvedValue([
    { identifier: 'ja-JP-standard', name: 'Kyoko', language: 'ja-JP', quality: 'Enhanced' },
    { identifier: 'ja-JP-otoya', name: 'Otoya', language: 'ja-JP', quality: 'Default' },
  ]),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props) => React.createElement(Text, props, props.name);
  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    Feather: MockIcon,
    FontAwesome: MockIcon,
  };
});
