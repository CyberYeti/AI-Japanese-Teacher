/**
 * AI Japanese Teacher - Pluggable Audio Provider Architecture
 *
 * Provides swappable text-to-speech synthesis implementations.
 * Default provider utilizes expo-speech for zero-cost offline native speech on iOS & Android.
 */

import * as Speech from 'expo-speech';
import { AudioProvider, PlaybackOptions } from '../types/domain';

export class NativeExpoSpeechProvider implements AudioProvider {
  readonly id = 'expo-speech';
  readonly name = 'Native Device Speech (Expo Speech)';

  private isCancelled = false;
  private isPlayingPassage = false;
  private currentPassageIndex = 0;
  private passageSentences: string[] = [];
  private activeOptions?: PlaybackOptions;

  /**
   * Speaks an individual Japanese sentence with optional speed and voice overrides.
   */
  async playSentence(
    text: string,
    sentenceIndex: number,
    options?: PlaybackOptions
  ): Promise<void> {
    await Speech.stop();
    this.isCancelled = false;
    this.isPlayingPassage = false;

    Speech.speak(text, {
      language: 'ja-JP',
      rate: options?.rate ?? 1.0,
      voice: options?.voiceId,
      onStart: () => {
        if (!this.isCancelled) {
          options?.onSentenceStart?.(sentenceIndex);
        }
      },
      onDone: () => {
        if (!this.isCancelled) {
          options?.onSentenceEnd?.(sentenceIndex);
          options?.onFinished?.();
        }
      },
      onStopped: () => {
        // stopped
      },
      onError: (err: any) => {
        options?.onError?.(
          err instanceof Error ? err : new Error(String(err))
        );
      },
    });
  }

  /**
   * Sequentially plays through a full Japanese passage from a given start index.
   */
  async playPassage(
    sentences: string[],
    startIndex = 0,
    options?: PlaybackOptions
  ): Promise<void> {
    await Speech.stop();
    this.isCancelled = false;
    this.isPlayingPassage = true;
    this.passageSentences = sentences;
    this.currentPassageIndex = Math.max(0, startIndex);
    this.activeOptions = options;

    this.playNextPassageSentence();
  }

  private playNextPassageSentence(): void {
    if (
      this.isCancelled ||
      !this.isPlayingPassage ||
      this.currentPassageIndex >= this.passageSentences.length
    ) {
      if (
        !this.isCancelled &&
        this.isPlayingPassage &&
        this.currentPassageIndex >= this.passageSentences.length
      ) {
        this.isPlayingPassage = false;
        this.activeOptions?.onFinished?.();
      }
      return;
    }

    const currentIndex = this.currentPassageIndex;
    const currentSentence = this.passageSentences[currentIndex];

    Speech.speak(currentSentence, {
      language: 'ja-JP',
      rate: this.activeOptions?.rate ?? 1.0,
      voice: this.activeOptions?.voiceId,
      onStart: () => {
        if (!this.isCancelled) {
          this.activeOptions?.onSentenceStart?.(currentIndex);
        }
      },
      onDone: () => {
        if (!this.isCancelled && this.isPlayingPassage) {
          this.activeOptions?.onSentenceEnd?.(currentIndex);
          this.currentPassageIndex++;
          this.playNextPassageSentence();
        }
      },
      onStopped: () => {
        this.isPlayingPassage = false;
      },
      onError: (err: any) => {
        this.isPlayingPassage = false;
        this.activeOptions?.onError?.(
          err instanceof Error ? err : new Error(String(err))
        );
      },
    });
  }

  /**
   * Stops any currently playing speech and cancels any ongoing passage queue.
   */
  async stop(): Promise<void> {
    this.isCancelled = true;
    this.isPlayingPassage = false;
    await Speech.stop();
  }

  /**
   * Pauses the current speech synthesis.
   */
  async pause(): Promise<void> {
    await Speech.pause();
  }

  /**
   * Resumes paused speech synthesis.
   */
  async resume(): Promise<void> {
    await Speech.resume();
  }

  /**
   * Checks whether speech synthesis is actively outputting audio.
   */
  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  }

  /**
   * Returns all speech synthesis voices available on the device.
   */
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    return Speech.getAvailableVoicesAsync();
  }

  /**
   * Returns only Japanese (ja-JP / ja) voices installed on the device.
   */
  async getJapaneseVoices(): Promise<Speech.Voice[]> {
    const allVoices = await this.getAvailableVoices();
    return allVoices.filter(
      (v) =>
        v.language?.toLowerCase().startsWith('ja') ||
        v.language?.toLowerCase().includes('jp')
    );
  }
}

export const defaultAudioProvider = new NativeExpoSpeechProvider();
