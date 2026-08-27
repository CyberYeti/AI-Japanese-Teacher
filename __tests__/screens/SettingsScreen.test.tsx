import React from 'react';
import { Alert } from 'react-native';
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

  it('opens import word list modal, previews extracted words, and persists confirmed words to Word Bank', async () => {
    const mockEnriched = [
      {
        word: '買います',
        reading: 'かいます',
        romaji: 'kaimasu',
        meaning: 'to buy',
        partOfSpeech: 'verb',
        examples: [],
      },
      {
        word: '店員',
        reading: 'てんいん',
        romaji: 'ten-in',
        meaning: 'store clerk',
        partOfSpeech: 'noun',
        examples: [],
      },
    ];

    const importSpy = jest
      .spyOn(geminiService, 'importWordList')
      .mockImplementation(async (words, level, key, onProgress) => {
        if (onProgress) onProgress(2, 2);
        return mockEnriched;
      });

    const saveWordsSpy = jest.spyOn(storageService, 'saveWords').mockResolvedValue([]);

    render(<SettingsScreen />);

    await screen.findByText('Settings');

    // Open import modal
    const openBtn = screen.getByTestId('open-import-modal-btn');
    fireEvent.press(openBtn);

    // Enter complex line-formatted text in text area
    const input = screen.getByTestId('import-text-input');
    fireEvent.changeText(
      input,
      'かいます 【買います】 (kaimasu) — To buy\n店員 : store clerk\n余分な単語 (unwanted)'
    );

    // Click Preview Extracted Words
    const previewBtn = screen.getByTestId('preview-import-btn');
    fireEvent.press(previewBtn);

    // Check preview screen elements
    expect(screen.getByText('Confirm Parsed Words')).toBeTruthy();
    expect(screen.getByTestId('parsed-chip-買います')).toBeTruthy();
    expect(screen.getByTestId('parsed-chip-店員')).toBeTruthy();
    expect(screen.getByTestId('parsed-chip-余分な単語')).toBeTruthy();
    expect(screen.getByText(/3 Words Extracted/)).toBeTruthy();

    // Remove the unwanted token chip
    const removeUnwantedBtn = screen.getByTestId('remove-chip-余分な単語');
    fireEvent.press(removeUnwantedBtn);

    expect(screen.queryByTestId('parsed-chip-余分な単語')).toBeNull();
    expect(screen.getByText(/2 Words Extracted/)).toBeTruthy();

    // Confirm & Enrich remaining 2 words
    const confirmBtn = screen.getByTestId('submit-import-btn');
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        ['買います', '店員'],
        'N5',
        'test-gemini-key',
        expect.any(Function)
      );
      expect(saveWordsSpy).toHaveBeenCalledWith(mockEnriched, 'Imported Word List', 'N5');
      expect(screen.getByText('Import Successful!')).toBeTruthy();
    });
  });

  it('triggers Alert to clear Word Bank when Clear Word Bank (Dev) button is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const clearWordBankSpy = jest.spyOn(storageService, 'clearWordBank').mockResolvedValue();

    render(<SettingsScreen />);

    await screen.findByText('Settings');

    const clearBtn = screen.getByTestId('clear-word-bank-btn');
    fireEvent.press(clearBtn);

    expect(alertSpy).toHaveBeenCalledWith(
      'Clear Word Bank?',
      expect.stringContaining('This will remove all saved vocabulary'),
      expect.any(Array)
    );

    // Trigger the destructive Clear action
    const buttons = alertSpy.mock.calls[0][2] as any[];
    const confirmAction = buttons.find((b: any) => b.text === 'Clear Word Bank');
    await confirmAction.onPress();

    expect(clearWordBankSpy).toHaveBeenCalled();
  });
});
