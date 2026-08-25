import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { HistoryScreen } from '../../src/screens/HistoryScreen';
import { storageService } from '../../src/services';
import { DailyLesson } from '../../src/types/domain';

const mockLessons: DailyLesson[] = [
  {
    id: 'lesson-1',
    topic: 'Ordering at a Café',
    topicEnglish: 'Ordering at a Café',
    topicJapanese: 'カフェでの注文',
    title: 'カフェでの注文',
    themeDescription: 'Café conversation',
    titleTokens: [],
    sentences: [],
    level: 'N5',
    createdAt: '2026-08-25T10:30:00.000Z',
    isStarred: true,
    targetVocabulary: [
      {
        word: '注文',
        reading: 'ちゅうもん',
        romaji: 'chuumon',
        meaning: 'an order',
        partOfSpeech: 'noun',
      },
      {
        word: 'おすすめ',
        reading: 'おすすめ',
        romaji: 'osusume',
        meaning: 'recommendation',
        partOfSpeech: 'noun',
      },
    ],
    passage: {
      title: 'カフェでの注文',
      titleEnglish: 'Ordering at a Café',
      speakers: [],
      sentences: [],
    },
  },
  {
    id: 'lesson-2',
    topic: 'Train & Subways',
    topicEnglish: 'Train & Subways',
    topicJapanese: '電車の乗り換え',
    title: '電車の乗り換え',
    themeDescription: 'Train travel',
    titleTokens: [],
    sentences: [],
    level: 'N4',
    createdAt: '2026-08-24T10:30:00.000Z',
    isStarred: false,
    targetVocabulary: [
      {
        word: '切符',
        reading: 'きっぷ',
        romaji: 'kippu',
        meaning: 'ticket',
        partOfSpeech: 'noun',
      },
    ],
    passage: {
      title: '電車の乗り換え',
      titleEnglish: 'Train & Subways',
      speakers: [],
      sentences: [],
    },
  },
];

const mockNavigation: any = {
  navigate: jest.fn(),
};

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(storageService, 'getLessons').mockResolvedValue(mockLessons);
  });

  it('loads and displays lessons from storageService', async () => {
    render(<HistoryScreen navigation={mockNavigation} />);

    expect(await screen.findByText('Lesson History')).toBeTruthy();
    expect(screen.getByText('Ordering at a Café')).toBeTruthy();
    expect(screen.getByText('カフェでの注文')).toBeTruthy();
    expect(screen.getByText('Train & Subways')).toBeTruthy();
  });

  it('filters lessons when Starred filter pill is selected', async () => {
    render(<HistoryScreen navigation={mockNavigation} />);

    expect(await screen.findByText('Ordering at a Café')).toBeTruthy();
    expect(screen.getByText('Train & Subways')).toBeTruthy();

    const starredPill = screen.getByText('⭐ Starred');
    fireEvent.press(starredPill);

    expect(screen.getByText('Ordering at a Café')).toBeTruthy();
    expect(screen.queryByText('Train & Subways')).toBeNull();
  });

  it('filters lessons by search query', async () => {
    render(<HistoryScreen navigation={mockNavigation} />);

    expect(await screen.findByText('Ordering at a Café')).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Search topics, kanji, or meanings...');
    fireEvent.changeText(searchInput, 'Train');

    expect(screen.getByText('Train & Subways')).toBeTruthy();
    expect(screen.queryByText('Ordering at a Café')).toBeNull();
  });

  it('toggles star status for a lesson', async () => {
    const toggleSpy = jest
      .spyOn(storageService, 'toggleLessonStar')
      .mockResolvedValue({ ...mockLessons[0], isStarred: false });

    render(<HistoryScreen navigation={mockNavigation} />);

    await screen.findByText('Ordering at a Café');

    const starBtn = screen.getByTestId('star-btn-lesson-1');
    fireEvent.press(starBtn);

    await waitFor(() => {
      expect(toggleSpy).toHaveBeenCalledWith('lesson-1');
    });
  });

  it('navigates to LessonStudyScreen when a lesson card is pressed', async () => {
    render(<HistoryScreen navigation={mockNavigation} />);

    const lessonCard = await screen.findByTestId('lesson-card-lesson-1');
    fireEvent.press(lessonCard);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('LessonStudy', {
      lesson: mockLessons[0],
    });
  });
});
