/**
 * AI Japanese Teacher - Core Domain Types
 * Based on CONTEXT.md and Research Issues #2, #3, #5
 */

export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type SpeakerGender = 'male' | 'female' | 'neutral';

export interface TargetWord {
  word: string; // e.g. "注文"
  reading: string; // e.g. "ちゅうもん"
  romaji: string; // e.g. "chuumon"
  meaning: string; // e.g. "an order (for food/goods)"
  partOfSpeech: string; // e.g. "noun / suru-verb"
  examples?: WordExample[];
}

export interface WordExample {
  japanese: string; // Full sentence in Japanese
  reading: string; // Reading aid or hiragana
  english: string; // English translation
}

export interface SentenceToken {
  surface: string; // e.g. "店員" or "さん"
  reading: string; // Hiragana reading for kanji, or "" for kana/punctuation
  isTarget: boolean; // true if this token matches a target vocabulary word
}

export interface SpeakerInfo {
  id: string; // e.g. "A" or "B" or "Narrator"
  name: string; // e.g. "店員 (Staff)" or "田中 (Tanaka)"
  gender: SpeakerGender;
  colorScheme: {
    badgeBg: string;
    badgeText: string;
    border: string;
  };
}

export interface PassageSentence {
  id: number; // 1-indexed sentence sequence
  speaker?: string; // e.g. "店員" or "客"
  speakerId?: string; // "A" | "B" | "narrator"
  japanese: string; // Full Japanese sentence for TTS
  english: string; // Natural English translation
  tokens: SentenceToken[]; // Furigana and vocabulary highlight tokens
}

export interface DailyLesson {
  id: string; // Unique ID (e.g. UUID or timestamp)
  createdAt: string; // ISO 8601 string
  topic: string; // e.g. "Ordering at a café"
  level: JLPTLevel;
  themeDescription: string;
  targetVocabulary: TargetWord[];
  title: string;
  titleTokens: SentenceToken[];
  sentences: PassageSentence[];
  isStarred: boolean;
}

export interface WordBankItem {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  partOfSpeech: string;
  jlptLevel: JLPTLevel;
  firstEncounteredAt: string;
  sourceLessonId: string;
  sourceLessonTopic: string;
  examples: WordExample[];
}

export interface UserSettings {
  geminiApiKey: string;
  preferredTtsVoice: string;
  ttsPlaybackRate: number; // 0.75 | 1.0 | 1.25
  defaultJlptLevel: JLPTLevel;
  furiganaMode: 'all' | 'target-only' | 'hidden';
  englishSubtitles: boolean;
  historyMaxCapacity: number; // default 25
}

export interface PlaybackOptions {
  rate?: number;
  voiceId?: string;
  onSentenceStart?: (sentenceIndex: number) => void;
  onSentenceEnd?: (sentenceIndex: number) => void;
  onFinished?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioProvider {
  readonly id: string;
  readonly name: string;
  playSentence(text: string, sentenceIndex: number, options?: PlaybackOptions): Promise<void>;
  playPassage(sentences: string[], startIndex?: number, options?: PlaybackOptions): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isSpeaking(): Promise<boolean>;
}
