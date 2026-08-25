import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AudioPlayerBar } from '../../src/components/AudioPlayerBar';

describe('AudioPlayerBar Component', () => {
  it('renders playback controls, status labels, and rate buttons', () => {
    const onTogglePlay = jest.fn();
    const onChangeRate = jest.fn();
    const onToggleLoop = jest.fn();

    render(
      <AudioPlayerBar
        isPlaying={false}
        currentSentenceIndex={1}
        totalSentences={5}
        speechRate={1.0}
        isLooping={false}
        onTogglePlay={onTogglePlay}
        onChangeRate={onChangeRate}
        onToggleLoop={onToggleLoop}
      />
    );

    expect(screen.getByText('Ready to play')).toBeTruthy();
    expect(screen.getByText('Sentence 1 of 5')).toBeTruthy();
    expect(screen.getByText('🔁 Loop: Off')).toBeTruthy();
    expect(screen.getByText('1.0x')).toBeTruthy();
  });

  it('triggers onTogglePlay when play/pause button is pressed', () => {
    const onTogglePlay = jest.fn();

    render(
      <AudioPlayerBar
        isPlaying={false}
        currentSentenceIndex={1}
        totalSentences={5}
        speechRate={1.0}
        isLooping={false}
        onTogglePlay={onTogglePlay}
        onChangeRate={jest.fn()}
        onToggleLoop={jest.fn()}
      />
    );

    const playBtn = screen.getByTestId('audio-play-toggle-btn');
    fireEvent.press(playBtn);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('triggers onChangeRate when a rate button is pressed', () => {
    const onChangeRate = jest.fn();

    render(
      <AudioPlayerBar
        isPlaying={false}
        currentSentenceIndex={1}
        totalSentences={5}
        speechRate={1.0}
        isLooping={false}
        onTogglePlay={jest.fn()}
        onChangeRate={onChangeRate}
        onToggleLoop={jest.fn()}
      />
    );

    const rateBtn = screen.getByText('0.75x');
    fireEvent.press(rateBtn);
    expect(onChangeRate).toHaveBeenCalledWith(0.75);
  });

  it('triggers onToggleLoop when loop button is pressed', () => {
    const onToggleLoop = jest.fn();

    render(
      <AudioPlayerBar
        isPlaying={true}
        currentSentenceIndex={2}
        totalSentences={5}
        speechRate={1.0}
        isLooping={true}
        onTogglePlay={jest.fn()}
        onChangeRate={jest.fn()}
        onToggleLoop={onToggleLoop}
      />
    );

    expect(screen.getByText('🔁 Loop: On')).toBeTruthy();
    const loopBtn = screen.getByTestId('audio-loop-btn');
    fireEvent.press(loopBtn);
    expect(onToggleLoop).toHaveBeenCalledTimes(1);
  });
});
