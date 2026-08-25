import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FuriganaText } from '../../src/components/FuriganaText';
import { SentenceToken } from '../../src/types/domain';

describe('FuriganaText Component', () => {
  const sampleTokens: SentenceToken[] = [
    { surface: '私', reading: 'わたし', isTarget: false },
    { surface: 'は', reading: '', isTarget: false },
    { surface: '注文', reading: 'ちゅうもん', isTarget: true },
    { surface: 'を', reading: '', isTarget: false },
    { surface: 'しました', reading: '', isTarget: false },
    { surface: '。', reading: '', isTarget: false },
  ];

  it('renders all surface characters and readings when mode is "all"', () => {
    render(<FuriganaText tokens={sampleTokens} mode="all" />);

    // Surface text
    expect(screen.getByText('私')).toBeTruthy();
    expect(screen.getByText('は')).toBeTruthy();
    expect(screen.getByText('注文')).toBeTruthy();
    expect(screen.getByText('を')).toBeTruthy();
    expect(screen.getByText('しました')).toBeTruthy();
    expect(screen.getByText('。')).toBeTruthy();

    // Furigana reading aids
    expect(screen.getByText('わたし')).toBeTruthy();
    expect(screen.getByText('ちゅうもん')).toBeTruthy();
  });

  it('only renders readings for target words when mode is "target-only"', () => {
    render(<FuriganaText tokens={sampleTokens} mode="target-only" />);

    // Target word reading is present
    expect(screen.getByText('ちゅうもん')).toBeTruthy();

    // Non-target reading is not shown
    expect(screen.queryByText('わたし')).toBeNull();
  });

  it('does not render readings when mode is "hidden"', () => {
    render(<FuriganaText tokens={sampleTokens} mode="hidden" />);

    // Surface text still rendered
    expect(screen.getByText('私')).toBeTruthy();
    expect(screen.getByText('注文')).toBeTruthy();

    // Neither reading is displayed
    expect(screen.queryByText('わたし')).toBeNull();
    expect(screen.queryByText('ちゅうもん')).toBeNull();
  });

  it('highlights target vocabulary token', () => {
    const { getByTestId } = render(
      <FuriganaText tokens={sampleTokens} mode="all" testID="furigana-container" />
    );

    expect(getByTestId('furigana-container')).toBeTruthy();
    expect(getByTestId('target-token-注文')).toBeTruthy();
  });
});
