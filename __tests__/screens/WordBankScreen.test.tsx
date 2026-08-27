import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { WordBankScreen } from '../../src/screens/WordBankScreen';
import { storageService, audioProvider } from '../../src/services';
import { WordBankItem } from '../../src/types/domain';

const mockWords: WordBankItem[] = [
  {
    id: 'w-1',
    word: '注文',
    reading: 'ちゅうもん',
    romaji: 'chuumon',
    meaning: 'an order (for goods/food)',
    partOfSpeech: 'noun / suru-verb',
    jlptLevel: 'N5',
    firstEncounteredAt: '2026-08-25T10:00:00.000Z',
    sourceLessonId: 'lesson-1',
    sourceLessonTopic: 'Ordering at a Café',
    examples: [
      {
        japanese: '注文をお願いします。',
        reading: 'ちゅうもん を おねがい します。',
        english: "I'd like to order, please.",
      },
    ],
  },
  {
    id: 'w-2',
    word: '予約',
    reading: 'よやく',
    romaji: 'yoyaku',
    meaning: 'reservation / booking',
    partOfSpeech: 'noun',
    jlptLevel: 'N4',
    firstEncounteredAt: '2026-08-24T10:00:00.000Z',
    sourceLessonId: 'lesson-2',
    sourceLessonTopic: 'Hotel Check-In',
    examples: [
      {
        japanese: '予約を確認してください。',
        reading: 'よやく を かくにん してください。',
        english: 'Please confirm the reservation.',
      },
    ],
  },
];

describe('WordBankScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(storageService, 'getWordBank').mockResolvedValue(mockWords);
  });

  it('loads and displays cumulative vocabulary words and total count', async () => {
    render(<WordBankScreen />);

    expect(await screen.findByText('注文')).toBeTruthy();
    expect(screen.getByText('Word Bank')).toBeTruthy();
    expect(screen.getByText('Cumulative vocabulary from daily lessons')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // word count badge
    expect(screen.getByText('予約')).toBeTruthy();
  });

  it('filters words by JLPT level pill', async () => {
    render(<WordBankScreen />);

    await screen.findByText('注文');

    const n4Pill = screen.getByTestId('filter-pill-N4');
    fireEvent.press(n4Pill);

    expect(screen.getByText('予約')).toBeTruthy();
    expect(screen.queryByText('注文')).toBeNull();
  });

  it('filters words by search query', async () => {
    render(<WordBankScreen />);

    await screen.findByText('注文');

    const searchInput = screen.getByPlaceholderText('Search by Kanji, reading, or meaning...');
    fireEvent.changeText(searchInput, 'reservation');

    expect(screen.getByText('予約')).toBeTruthy();
    expect(screen.queryByText('注文')).toBeNull();
  });

  it('plays audio pronunciation for a word when audio button is clicked', async () => {
    const playSentenceSpy = jest.spyOn(audioProvider, 'playSentence').mockResolvedValue();

    render(<WordBankScreen />);

    await screen.findByText('注文');

    const playBtn = screen.getByTestId('play-word-w-1');
    fireEvent.press(playBtn);

    expect(playSentenceSpy).toHaveBeenCalledWith('注文', expect.any(Object));
  });

  it('renders words in compact collapsed state by default and expands accordion on tap', async () => {
    render(<WordBankScreen />);

    await screen.findByText('注文');

    // Examples should be hidden initially
    expect(screen.queryByText("I'd like to order, please.")).toBeNull();
    expect(screen.queryByText('Please confirm the reservation.')).toBeNull();

    // Tap word 1 card to expand
    const wordCard1 = screen.getByTestId('word-card-w-1');
    fireEvent.press(wordCard1);

    // Now word 1 example is revealed
    expect(screen.getByText("I'd like to order, please.")).toBeTruthy();
    expect(screen.queryByText('Please confirm the reservation.')).toBeNull();

    // Tap word 2 card to expand (multi-accordion allows both open)
    const wordCard2 = screen.getByTestId('word-card-w-2');
    fireEvent.press(wordCard2);

    expect(screen.getByText("I'd like to order, please.")).toBeTruthy();
    expect(screen.getByText('Please confirm the reservation.')).toBeTruthy();

    // Tap word 1 card again to collapse it
    fireEvent.press(wordCard1);
    expect(screen.queryByText("I'd like to order, please.")).toBeNull();
    expect(screen.getByText('Please confirm the reservation.')).toBeTruthy();
  });
});
