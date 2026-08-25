# Research: Pluggable Audio Architecture & Sentence-Level Playback

**Research Issue**: [#3](https://github.com/CyberYeti/AI-Japanese-Teacher/issues/3)  
**Date**: 2026-08-25  
**Core Technologies**: Expo Speech (`expo-speech`), Expo AV / Audio (`expo-av`), Cloud TTS (Google Cloud TTS / ElevenLabs)

---

## 1. Objective
Design an audio subsystem for React Native / Expo that:
1. Provides **immediate, zero-cost Japanese speech synthesis** on iOS and Android via `expo-speech`.
2. Supports **sentence-by-sentence playback**, looping, and rate control (0.75x, 1.0x, 1.25x).
3. Defines a **clean, swappable interface (`AudioProvider`)** so Neural Cloud TTS (e.g. Google Cloud TTS Neural2 / Wavenet or ElevenLabs) can be dropped in without changing UI code.

---

## 2. `expo-speech` Capabilities & Platform Notes

### iOS & Android Support:
- **Language**: Setting `language: 'ja-JP'` automatically uses the system's Japanese voice (iOS: Kyoko, Otoya, or Siri Japanese; Android: Google Speech Services Japanese).
- **Speech Rate**: Accepts rates from `0.0` to `2.0` (where `1.0` is standard speed, `0.75` provides clear pronunciation for language learners).
- **Callbacks**:
  - `onStart`: Fired when a sentence begins playback (used to highlight the active sentence in the UI).
  - `onDone`: Fired when speech finishes (used to trigger the next sentence in continuous mode, or stop).
  - `onStopped`: Fired on user cancellation or pause.
  - `onError`: Fired if speech synthesis fails.

---

## 3. Abstract Provider Interface

```typescript
export interface PlaybackOptions {
  rate?: number; // 0.75, 1.0, 1.25
  voiceId?: string;
  onSentenceStart?: (sentenceIndex: number) => void;
  onSentenceEnd?: (sentenceIndex: number) => void;
  onFinished?: () => void;
}

export interface AudioProvider {
  readonly id: string;
  readonly name: string;
  
  // Play a single sentence (with highlight/loop support)
  playSentence(text: string, sentenceIndex: number, options?: PlaybackOptions): Promise<void>;
  
  // Play through full passage sequentially
  playPassage(sentences: string[], startIndex?: number, options?: PlaybackOptions): Promise<void>;
  
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isSpeaking(): Promise<boolean>;
}
```

---

## 4. Provider Implementations

1. **`NativeExpoSpeechProvider`**:
   - Implements `AudioProvider` using `expo-speech`.
   - Requires no API keys, no network latency, runs 100% offline.
   - Ideal default engine.

2. **`CloudNeuralTtsProvider` (Future / Optional Upgrade)**:
   - Fetches high-fidelity audio (e.g., Google Cloud `ja-JP-Neural2-B` or ElevenLabs Japanese model).
   - Uses `expo-file-system` to cache generated MP3s locally and `expo-av` / `expo-audio` to play them.
   - Drop-in replacement with identical UI controls.
