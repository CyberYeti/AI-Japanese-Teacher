import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { LessonStudyScreen } from '../../src/screens/LessonStudyScreen';
import { DailyLesson } from '../../src/types/domain';
import { storageService } from '../../src/services';
import { audioProvider } from '../../src/services';

const mockLesson: DailyLesson = {
  id: 'lesson-123',
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
      meaning: 'an order (for food/goods)',
      partOfSpeech: 'noun / suru-verb',
      examples: [
        {
          japanese: '注文をお願いします。',
          reading: 'ちゅうもん を おねがい します。',
          english: "I'd like to order, please.",
        },
        {
          japanese: 'コーヒーの注文はまだです。',
          reading: 'こーひー の ちゅうもん は まだ です。',
          english: 'The coffee order is not ready yet.',
        },
        {
          japanese: '注文を変更できますか？',
          reading: 'ちゅうもん を へんこう できます か？',
          english: 'Can I change my order?',
        },
      ],
    },
    {
      word: 'おすすめ',
      reading: 'おすすめ',
      romaji: 'osusume',
      meaning: 'recommendation',
      partOfSpeech: 'noun',
      examples: [
        {
          japanese: 'おすすめの料理は何ですか？',
          reading: 'おすすめ の りょうり は なん です か？',
          english: 'What is your recommended dish?',
        },
      ],
    },
  ],
  passage: {
    title: 'カフェでの注文',
    titleEnglish: 'Ordering at a Café',
    speakers: [
      {
        id: 'A',
        name: '店員 (Staff)',
        gender: 'female',
        colorScheme: {
          badgeBg: 'rgba(59, 130, 246, 0.15)',
          badgeText: '#60a5fa',
          border: 'rgba(59, 130, 246, 0.3)',
        },
      },
      {
        id: 'B',
        name: '客 (Customer)',
        gender: 'male',
        colorScheme: {
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeText: '#34d399',
          border: 'rgba(16, 185, 129, 0.3)',
        },
      },
    ],
    sentences: [
      {
        id: 1,
        speaker: '店員 (Staff)',
        japanese: 'いらっしゃいませ。ご注文はお決まりですか？',
        english: 'Welcome. Are you ready to order?',
        tokens: [
          { surface: 'いらっしゃいませ', reading: '', isTarget: false },
          { surface: '。', reading: '', isTarget: false },
          { surface: 'ご', reading: '', isTarget: false },
          { surface: '注文', reading: 'ちゅうもん', isTarget: true },
          { surface: 'は', reading: '', isTarget: false },
          { surface: 'お', reading: '', isTarget: false },
          { surface: '決まり', reading: 'きまり', isTarget: false },
          { surface: 'ですか', reading: '', isTarget: false },
          { surface: '？', reading: '', isTarget: false },
        ],
      },
      {
        id: 2,
        speaker: '客 (Customer)',
        japanese: 'おすすめは何ですか？',
        english: 'What do you recommend?',
        tokens: [
          { surface: 'おすすめ', reading: '', isTarget: true },
          { surface: 'は', reading: '', isTarget: false },
          { surface: '何', reading: 'なん', isTarget: false },
          { surface: 'ですか', reading: '', isTarget: false },
          { surface: '？', reading: '', isTarget: false },
        ],
      },
    ],
  },
};

const mockNavigation: any = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

describe('LessonStudyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Screen 1 (Daily Target Words) by default with vocab and 3 examples', async () => {
    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'vocab' } } as any}
      />
    );

    // Header info
    expect(screen.getByText('Ordering at a Café')).toBeTruthy();
    expect(screen.getByText('JLPT N5')).toBeTruthy();

    // Screen 1 vocab cards
    expect(screen.getByText('注文')).toBeTruthy();
    expect(screen.getByText('an order (for food/goods)')).toBeTruthy();
    expect(screen.getByText('注文をお願いします。')).toBeTruthy();
    expect(screen.getByText("I'd like to order, please.")).toBeTruthy();
    expect(screen.getByText('コーヒーの注文はまだです。')).toBeTruthy();
    expect(screen.getByText('注文を変更できますか？')).toBeTruthy();

    // CTA button to go to dialogue
    expect(screen.getByText('Practice Conversation Roleplay →')).toBeTruthy();
  });

  it('switches to Screen 2 (Conversation Roleplay) and displays dialogue bubbles', async () => {
    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'vocab' } } as any}
      />
    );

    // Switch to dialogue tab
    const dialogueTab = screen.getByText('Conversation Roleplay');
    fireEvent.press(dialogueTab);

    // Speaker badges & dialogue sentences
    expect(screen.getByText('店員 (Staff)')).toBeTruthy();
    expect(screen.getByText('Welcome. Are you ready to order?')).toBeTruthy();
    expect(screen.getByText('客 (Customer)')).toBeTruthy();
    expect(screen.getByText('What do you recommend?')).toBeTruthy();

    // Back to vocab button
    expect(screen.getByText('← Back to Daily Target Words')).toBeTruthy();
  });

  it('toggles star status and persists to storageService', async () => {
    const toggleSpy = jest
      .spyOn(storageService, 'toggleLessonStar')
      .mockResolvedValue({ ...mockLesson, isStarred: true });

    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'vocab' } } as any}
      />
    );

    const starBtn = screen.getByTestId('lesson-star-toggle-btn');
    fireEvent.press(starBtn);

    await waitFor(() => {
      expect(toggleSpy).toHaveBeenCalledWith('lesson-123');
    });
  });

  it('plays individual word audio when word audio button is pressed', async () => {
    const playSentenceSpy = jest.spyOn(audioProvider, 'playSentence').mockResolvedValue();

    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'vocab' } } as any}
      />
    );

    const wordAudioBtn = screen.getByTestId('play-vocab-注文');
    fireEvent.press(wordAudioBtn);

    expect(playSentenceSpy).toHaveBeenCalledWith('注文', expect.any(Object));
  });

  it('plays individual sentence audio when sentence play button is pressed in dialogue view', async () => {
    const playSentenceSpy = jest.spyOn(audioProvider, 'playSentence').mockResolvedValue();

    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'dialogue' } } as any}
      />
    );

    const sentencePlayBtn = screen.getByTestId('play-sentence-1');
    fireEvent.press(sentencePlayBtn);

    expect(playSentenceSpy).toHaveBeenCalledWith(
      'いらっしゃいませ。ご注文はお決まりですか？',
      expect.any(Object)
    );
  });

  it('renders distinct speaker testIDs and badges on dialogue bubbles', async () => {
    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'dialogue' } } as any}
      />
    );

    const bubble1 = screen.getByTestId('dialogue-bubble-1');
    const bubble2 = screen.getByTestId('dialogue-bubble-2');
    expect(bubble1).toBeTruthy();
    expect(bubble2).toBeTruthy();
    expect(screen.getByText('店員 (Staff)')).toBeTruthy();
    expect(screen.getByText('客 (Customer)')).toBeTruthy();
  });

  it('renders passage loading card when passage is pending and sentences are not yet ready', async () => {
    const pendingLesson: DailyLesson = {
      ...mockLesson,
      sentences: [],
      passage: undefined,
    };

    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{
          params: {
            lesson: pendingLesson,
            initialScreen: 'dialogue',
            isPassagePending: true,
          },
        } as any}
      />
    );

    expect(screen.getByTestId('passage-loading-card')).toBeTruthy();
    expect(screen.getByText('Writing Conversation Dialogue...')).toBeTruthy();
  });

  it('triggers force-save, records word practice, and shows celebration when Lesson Complete is pressed', async () => {
    const saveSpy = jest.spyOn(storageService, 'saveLesson').mockResolvedValue(mockLesson);
    const recordPracticeSpy = jest.spyOn(storageService, 'recordWordPractice').mockResolvedValue();

    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'dialogue' } } as any}
      />
    );

    const completeBtn = screen.getByTestId('lesson-complete-btn');
    fireEvent.press(completeBtn);

    expect(screen.getByTestId('celebration-banner')).toBeTruthy();
    expect(screen.getByText('🎉 Lesson Complete!')).toBeTruthy();
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(mockLesson);
      expect(recordPracticeSpy).toHaveBeenCalledWith(['注文', 'おすすめ']);
    });
  });

  it('defaults Furigana mode to hidden when isPracticePassage is true', async () => {
    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{
          params: {
            lesson: mockLesson,
            initialScreen: 'dialogue',
            isPracticePassage: true,
          },
        } as any}
      />
    );

    await waitFor(() => {
      // In dialogue tab with isPracticePassage, dialogue renders with furigana mode hidden by default
      expect(screen.getByTestId('dialogue-bubble-1')).toBeTruthy();
      expect(screen.getByText('店員 (Staff)')).toBeTruthy();
    });
  });

  it('opens WordTooltipModal when tapping a highlighted target word in the dialogue', async () => {
    const playSentenceSpy = jest.spyOn(audioProvider, 'playSentence').mockResolvedValue();

    render(
      <LessonStudyScreen
        navigation={mockNavigation}
        route={{ params: { lesson: mockLesson, initialScreen: 'dialogue' } } as any}
      />
    );

    // Initial state: tooltip not open
    expect(screen.queryByTestId('word-tooltip-card')).toBeNull();

    // Tap on the highlighted target token "注文"
    const targetToken = screen.getByTestId('target-token-注文');
    expect(targetToken).toBeTruthy();
    fireEvent.press(targetToken);

    // Tooltip modal opens with furigana, romaji, and english definition
    const tooltipCard = screen.getByTestId('word-tooltip-card');
    expect(tooltipCard).toBeTruthy();
    const cardScope = within(tooltipCard);
    expect(cardScope.getByTestId('tooltip-word-surface')).toBeTruthy();
    expect(cardScope.getByText('注文')).toBeTruthy();
    expect(cardScope.getByText('【ちゅうもん】')).toBeTruthy();
    expect(cardScope.getByText('chuumon')).toBeTruthy();
    expect(cardScope.getByText('an order (for food/goods)')).toBeTruthy();

    // Test playing audio from tooltip
    const listenBtn = screen.getByTestId('tooltip-listen-btn');
    fireEvent.press(listenBtn);
    expect(playSentenceSpy).toHaveBeenCalledWith('注文', expect.any(Object));

    // Close the tooltip
    const closeBtn = screen.getByTestId('close-tooltip-btn');
    fireEvent.press(closeBtn);

    // Tooltip is dismissed
    expect(screen.queryByTestId('word-tooltip-card')).toBeNull();
  });
});
