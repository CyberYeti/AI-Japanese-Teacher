import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { storageService, geminiService } from '../../src/services';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(storageService, 'getApiKey').mockResolvedValue('test-gemini-key');
    jest.spyOn(storageService, 'getUserSettings').mockResolvedValue({
      geminiApiKey: 'test-gemini-key',
      preferredTtsVoice: '',
      ttsPlaybackRate: 1.0,
      defaultJlptLevel: 'N5',
      furiganaMode: 'all',
      englishSubtitles: true,
      historyMaxCapacity: 25,
    });
    jest.spyOn(storageService, 'getStorageStats').mockResolvedValue({
      lessonCount: 10,
      starredCount: 4,
      wordBankCount: 25,
    });
  });

  it('loads and displays current user settings, API key, and storage stats', async () => {
    render(<SettingsScreen />);

    expect(await screen.findByText('Settings')).toBeTruthy();
    expect(screen.getByText('Google Gemini API Key')).toBeTruthy();
    expect(screen.getByDisplayValue('test-gemini-key')).toBeTruthy();
    expect(screen.getByText('Japanese Speech Synthesis')).toBeTruthy();
    expect(screen.getByText('Study Display Preferences')).toBeTruthy();
    expect(screen.getByText('Local Device Storage')).toBeTruthy();
    expect(screen.getByText('10 Lessons (4 ⭐ Starred) · 25 Word Bank Items')).toBeTruthy();
  });

  it('validates API key when Test Connection is pressed', async () => {
    const validateSpy = jest.spyOn(geminiService, 'validateApiKey').mockResolvedValue(true);
    const saveKeySpy = jest.spyOn(storageService, 'saveApiKey').mockResolvedValue();

    render(<SettingsScreen />);

    await screen.findByText('Settings');

    const testBtn = screen.getByText('Test Connection');
    fireEvent.press(testBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith('test-gemini-key');
      expect(saveKeySpy).toHaveBeenCalledWith('test-gemini-key');
      expect(screen.getByText('Key Verified')).toBeTruthy();
    });
  });

  it('updates default JLPT level preference', async () => {
    const saveSettingsSpy = jest.spyOn(storageService, 'saveUserSettings').mockResolvedValue({
      geminiApiKey: 'test-gemini-key',
      preferredTtsVoice: '',
      ttsPlaybackRate: 1.0,
      defaultJlptLevel: 'N3',
      furiganaMode: 'all',
      englishSubtitles: true,
      historyMaxCapacity: 25,
    });

    render(<SettingsScreen />);

    await screen.findByText('Settings');

    const n3Btn = screen.getByTestId('settings-level-N3');
    fireEvent.press(n3Btn);

    await waitFor(() => {
      expect(saveSettingsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ defaultJlptLevel: 'N3' })
      );
    });
  });

  it('updates playback speed preference', async () => {
    const saveSettingsSpy = jest.spyOn(storageService, 'saveUserSettings').mockResolvedValue({
      geminiApiKey: 'test-gemini-key',
      preferredTtsVoice: '',
      ttsPlaybackRate: 0.75,
      defaultJlptLevel: 'N5',
      furiganaMode: 'all',
      englishSubtitles: true,
      historyMaxCapacity: 25,
    });

    render(<SettingsScreen />);

    await screen.findByText('Settings');

    const speedBtn = screen.getByTestId('settings-speed-0.75');
    fireEvent.press(speedBtn);

    await waitFor(() => {
      expect(saveSettingsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ttsPlaybackRate: 0.75 })
      );
    });
  });
});
