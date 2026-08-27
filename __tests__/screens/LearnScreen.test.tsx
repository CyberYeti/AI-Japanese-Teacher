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

  it('triggers target vocabulary generation and navigates to LessonStudy with pending passage', async () => {
    const vocabResult = {
      topic: 'Ordering at a Café',
      level: 'N5' as const,
      themeDescription: 'Café conversation',
      title: 'カフェでの注文',
      titleTokens: [],
      targetVocabulary: mockLesson.targetVocabulary,
    };

    const generateSpy = jest
      .spyOn(geminiService, 'generateTargetVocabulary')
      .mockResolvedValue(vocabResult);
    const saveSpy = jest.spyOn(storageService, 'saveLesson').mockResolvedValue(mockLesson);
    jest.spyOn(storageService, 'getWordBank').mockResolvedValue([]);

    render(<LearnScreen navigation={mockNavigation} />);

    const generateBtn = await screen.findByTestId('generate-lesson-btn');
    fireEvent.press(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith(
        'Ordering at a Café',
        'N5',
        'test-api-key-123',
        undefined,
        []
      );
      expect(saveSpy).toHaveBeenCalled();
      expect(mockNavigation.navigate).toHaveBeenCalledWith('LessonStudy', expect.objectContaining({
        initialScreen: 'vocab',
        isPassagePending: true,
      }));
    });
  });

  it('displays inline error card with retry button on generation failure', async () => {
    jest
      .spyOn(geminiService, 'generateTargetVocabulary')
      .mockRejectedValue(new Error('API quota exceeded. Please check your Gemini API key.'));
    jest.spyOn(storageService, 'getWordBank').mockResolvedValue([]);

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

  it('switches to Practice Passage mode and displays empty state when Word Bank has 0 words', async () => {
    jest.spyOn(storageService, 'getWordBank').mockResolvedValue([]);

    render(<LearnScreen navigation={mockNavigation} />);

    const practiceTabBtn = await screen.findByTestId('mode-practice-passage-btn');
    fireEvent.press(practiceTabBtn);

    expect(screen.getByText('Word Bank is Empty')).toBeTruthy();
    expect(
      screen.getByText(/Complete your first Daily Lesson or import words from Settings/)
    ).toBeTruthy();
  });

  it('generates a practice passage using Word Bank vocabulary and navigates with isPracticePassage', async () => {
    const mockWordBankWords = [
      {
        id: 'w1',
        word: '注文',
        reading: 'ちゅうもん',
        romaji: 'chuumon',
        meaning: 'order',
        partOfSpeech: 'noun',
        jlptLevel: 'N5' as const,
        firstEncounteredAt: '2026-08-25T10:00:00.000Z',
        sourceLessonId: 'l1',
        sourceLessonTopic: 'Café',
        examples: [],
      },
    ];

    jest.spyOn(storageService, 'getWordBank').mockResolvedValue(mockWordBankWords);
    jest.spyOn(storageService, 'getWordsForPractice').mockResolvedValue(mockWordBankWords);
    const generatePracticeSpy = jest
      .spyOn(geminiService, 'generatePracticePassage')
      .mockResolvedValue(mockLesson);
    const saveSpy = jest.spyOn(storageService, 'saveLesson').mockResolvedValue(mockLesson);
    const recordPracticeSpy = jest.spyOn(storageService, 'recordWordPractice').mockResolvedValue();

    render(<LearnScreen navigation={mockNavigation} />);

    const practiceTabBtn = await screen.findByTestId('mode-practice-passage-btn');
    fireEvent.press(practiceTabBtn);

    const generatePracticeBtn = await screen.findByTestId('generate-practice-btn');
    fireEvent.press(generatePracticeBtn);

    await waitFor(() => {
      expect(generatePracticeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'N5',
          apiKey: 'test-api-key-123',
        })
      );
      expect(saveSpy).toHaveBeenCalled();
      expect(recordPracticeSpy).toHaveBeenCalledWith(['注文']);
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        'LessonStudy',
        expect.objectContaining({
          initialScreen: 'dialogue',
          isPracticePassage: true,
        })
      );
    });
  });
});
