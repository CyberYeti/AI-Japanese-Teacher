import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LearnScreen } from '../../src/screens/LearnScreen';
import { geminiService, storageService } from '../../src/services';
import { DailyLesson } from '../../src/types/domain';

const mockLesson: DailyLesson = {
  id: 'lesson-new',
  topic: 'Ordering at a Café',
  topicEnglish: 'Ordering at a Café',
  topicJapanese: 'カフェでの注文',
  title: 'カフェでの注文',
  themeDescription: 'Café conversation',
  titleTokens: [],
  sentences: [],
  level: 'N5',
  createdAt: '2026-08-25T12:00:00.000Z',
  isStarred: false,
  targetVocabulary: [
    {
      word: '注文',
      reading: 'ちゅうもん',
      romaji: 'chuumon',
      meaning: 'an order',
      partOfSpeech: 'noun',
      examples: [
        {
          japanese: '注文をお願いします。',
          reading: 'ちゅうもん を おねがい します。',
          english: "I'd like to order, please.",
        },
      ],
    },
  ],
  passage: {
    title: 'カフェでの注文',
    titleEnglish: 'Ordering at a Café',
    speakers: [],
    sentences: [],
  },
};

const mockNavigation: any = {
  navigate: jest.fn(),
};

describe('LearnScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(storageService, 'getApiKey').mockResolvedValue('test-api-key-123');
    jest.spyOn(storageService, 'getUserSettings').mockResolvedValue({
      geminiApiKey: 'test-api-key-123',
      preferredTtsVoice: '',
      ttsPlaybackRate: 1.0,
      defaultJlptLevel: 'N5',
      furiganaMode: 'all',
      englishSubtitles: true,
      historyMaxCapacity: 25,
    });
  });

  it('renders topic options and level selector', async () => {
    render(<LearnScreen navigation={mockNavigation} />);

    expect(await screen.findByText('AI Japanese Teacher')).toBeTruthy();
    expect(screen.getByText('Proficiency Level')).toBeTruthy();
    expect(screen.getByText('Lesson Topic')).toBeTruthy();
    expect(screen.getByText('Ordering at a Café')).toBeTruthy();
    expect(screen.getByText('Train & Subways')).toBeTruthy();
    expect(screen.getByText('Generate Daily Lesson')).toBeTruthy();
  });

  it('selects a suggested topic when clicked', async () => {
    render(<LearnScreen navigation={mockNavigation} />);

    const trainTopic = await screen.findByText('Train & Subways');
    fireEvent.press(trainTopic);

    // Topic is set
    expect(screen.getByDisplayValue('Train & Subways')).toBeTruthy();
  });

  it('triggers lesson generation and navigates to LessonStudy on success', async () => {
    const generateSpy = jest
      .spyOn(geminiService, 'generateDailyLesson')
      .mockResolvedValue(mockLesson);
    const saveSpy = jest.spyOn(storageService, 'saveLesson').mockResolvedValue(mockLesson);

    render(<LearnScreen navigation={mockNavigation} />);

    const generateBtn = await screen.findByTestId('generate-lesson-btn');
    fireEvent.press(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith('Ordering at a Café', 'N5', 'test-api-key-123');
      expect(saveSpy).toHaveBeenCalledWith(mockLesson);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('LessonStudy', {
        lesson: mockLesson,
      });
    });
  });

  it('displays inline error card with retry button on generation failure', async () => {
    jest
      .spyOn(geminiService, 'generateDailyLesson')
      .mockRejectedValue(new Error('API quota exceeded. Please check your Gemini API key.'));

    render(<LearnScreen navigation={mockNavigation} />);

    const generateBtn = await screen.findByTestId('generate-lesson-btn');
    fireEvent.press(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Generation Failed')).toBeTruthy();
      expect(
        screen.getByText('API quota exceeded. Please check your Gemini API key.')
      ).toBeTruthy();
      expect(screen.getByText('🔄 Retry')).toBeTruthy();
    });
  });
});
