# Research: Gemini Prompt Architecture for Graded Japanese Passages

**Research Issue**: [#2](https://github.com/CyberYeti/AI-Japanese-Teacher/issues/2)  
**Date**: 2026-08-25  
**Target Engine**: Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`)

---

## 1. Objective
Design a prompt template and structured JSON schema that consistently generates:
1. **Topically Cohesive Vocabulary**: 3–5 semantically related Japanese words graded by JLPT level (N5–N1).
2. **Contextual Natural Passage**: A story or dialogue using all target words naturally.
3. **Structured Token Segmentation**: Each sentence broken into tokens with Kanji surface text, Hiragana furigana reading, and a flag indicating if it is a target word.
4. **Sentence-Level Segmentation**: Individual sentences with English translations for synced audio playback.

---

## 2. Recommended JSON Schema (`responseSchema`)

Using Gemini's Structured Outputs (`responseMimeType: "application/json"`), the response adheres to this TypeScript interface:

```typescript
export interface TargetWord {
  word: string;         // e.g. "注文"
  reading: string;      // e.g. "ちゅうもん"
  romaji: string;       // e.g. "chuumon"
  meaning: string;      // e.g. "an order (for food/goods)"
  partOfSpeech: string; // e.g. "noun / suru-verb"
}

export interface SentenceToken {
  surface: string;      // The displayed text, e.g. "店員" or "さん"
  reading: string;      // Hiragana reading for kanji, or "" for kana/punctuation
  isTarget: boolean;    // true if this token is one of the target vocabulary words
}

export interface PassageSentence {
  id: number;           // 1-indexed sentence sequence
  japanese: string;     // Full sentence in Japanese for TTS input
  english: string;      // Natural English translation
  tokens: SentenceToken[]; // For rendering Furigana and word highlights
}

export interface DailyLessonResponse {
  topic: string;
  level: "N5" | "N4" | "N3" | "N2" | "N1";
  themeDescription: string;
  targetVocabulary: TargetWord[];
  title: string;
  titleTokens: SentenceToken[];
  sentences: PassageSentence[];
}
```

---

## 3. System Prompt Template

```markdown
You are a master Japanese language educator. 
Generate a daily Japanese lesson tailored to the learner's specified JLPT level and topic.

Guidelines:
1. Curate 3 to 5 semantically cohesive vocabulary words that naturally fit the given topic and JLPT level.
2. Compose a cohesive, natural passage (4–8 sentences) that incorporates all target words.
3. Keep grammar and non-target vocabulary strictly appropriate for the requested JLPT level.
4. Break each sentence into tokens. For tokens containing Kanji, provide the exact Hiragana reading in the 'reading' field. For Kana-only words or particles, set 'reading' to empty string "".
5. Mark 'isTarget: true' on any token matching a target vocabulary word.
6. Provide natural English translations for each word and sentence.
```

---

## 4. Key Benefits of Tokenized Schema

- **Zero-Dependency Furigana**: The mobile client can directly render `<Ruby>` components without bundling large Japanese dictionary data (e.g. Kuromoji or MeCab dictionaries).
- **Exact Audio Alignment**: `sentence.japanese` contains the clean plain text sent directly to the TTS engine, matching sentence by sentence with the UI.
- **Visual Vocabulary Highlights**: Tokens flagged with `isTarget: true` can be highlighted with themed accent colors to help the learner spot daily words instantly in context.
