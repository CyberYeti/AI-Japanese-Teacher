/**
 * AI Japanese Teacher - Gemini Lesson Generator Service
 *
 * Provides structured generation of JLPT-graded Japanese lessons,
 * tokenized Furigana segmentation, API key validation, and offline fallbacks.
 */

import {
  DailyLesson,
  JLPTLevel,
  PassageSentence,
  SentenceToken,
  SpeakerInfo,
  TargetWord,
  VocabularyConstraintTier,
  WordBankItem,
  WordExample,
} from '../types/domain';

export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class InvalidApiKeyError extends GeminiApiError {
  constructor(message = 'Invalid or unauthorized Gemini API key.') {
    super(message, 400);
    this.name = 'InvalidApiKeyError';
  }
}

export class RateLimitError extends GeminiApiError {
  constructor(message = 'Gemini API rate limit or quota exceeded. Please wait a moment.') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class GeminiParseError extends GeminiApiError {
  constructor(message: string, public readonly rawContent?: unknown) {
    super(message, 200, rawContent);
    this.name = 'GeminiParseError';
  }
}

export interface GenerateLessonOptions {
  apiKey?: string;
  level: JLPTLevel;
  topic: string;
  customInstruction?: string;
  excludeWords?: string[];
  fetchFn?: typeof fetch;
  model?: string;
}

// Configured active Gemini models - validated and supported in current environment (see CONTEXT.md)
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const levelGuidelines: Record<JLPTLevel, string> = {
  N5: 'Absolute beginner: basic sentence patterns (です/ます, ~たい, ~てください), essential particles (は, が, を, に, で, と), basic greetings and everyday items.',
  N4: 'Elementary: te-form combinations (~ている, ~てから), conditionals (~たら, ~ば), potential form, basic transitivity, daily situations.',
  N3: 'Intermediate: natural spoken expressions, basic honorific/humble language (keigo), compound sentences, nuanced conjunctions, opinion expressions.',
  N2: 'Upper-intermediate: business and formal Japanese, abstract discussions, advanced grammar structures (~わけではない, ~にすぎない), varied registers.',
  N1: 'Advanced: sophisticated literary expressions, formal discourse, nuanced idioms, specialized terminology.',
};

/**
 * Constructs the system and user prompt for structured lesson generation.
 */
export function buildPrompt(
  level: JLPTLevel,
  topic: string,
  customInstruction?: string,
  excludeWords?: string[]
): string {
  const exclusionNote =
    excludeWords && excludeWords.length > 0
      ? `\nEXCLUDED VOCABULARY: Do NOT use any of the following already-learned words as targetVocabulary items: ${excludeWords.join(', ')}`
      : '';

  return `You are a master Japanese language educator.
Generate a daily Japanese lesson tailored to the learner's specified JLPT level and topic.

Target Level: JLPT ${level} (${levelGuidelines[level]})
Topic: ${topic}
${customInstruction ? `Additional Instruction: ${customInstruction}` : ''}${exclusionNote}

CRITICAL REQUIREMENTS:
1. Curate 3 to 5 semantically cohesive vocabulary words ('targetVocabulary') that naturally fit the given topic and JLPT level.
   Each target word MUST include:
   - word: Kanji/Kana surface (e.g. "注文")
   - reading: Full hiragana reading (e.g. "ちゅうもん")
   - romaji: Standard Hepburn romaji (e.g. "chuumon")
   - meaning: Clear English definition
   - partOfSpeech: Part of speech (e.g. "noun / suru-verb")
   - examples: Array of 3 contextual Japanese example sentences with readings and English translations.

2. Compose a natural dialogue or passage (4 to 8 sentences) that incorporates ALL target words in authentic context.
   Each sentence in the passage MUST have:
   - id: 1-indexed number
   - speaker: Name or role of speaker (e.g. "店員", "田中", "Narrator")
   - speakerId: "A" or "B" or "narrator"
   - japanese: Clean plain Japanese text for speech synthesis
   - english: Natural English translation
   - tokens: Array of word tokens breaking down the sentence for Furigana display.

3. TOKENIZATION RULES:
   - Every token has 'surface' (displayed text), 'reading' (Hiragana reading if surface contains Kanji, or empty string "" if purely Kana/punctuation), and 'isTarget' (true if token matches a target vocabulary word).
   - Never leave Kanji without a 'reading' value.
   - Kana-only words, punctuation, and particles must have 'reading': "".

4. JSON Output Schema:
   Return ONLY a valid JSON object strictly adhering to the schema.`;
}

/**
 * Returns the Gemini response schema object for structured outputs.
 */
export function buildResponseSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      topic: { type: 'STRING' },
      level: { type: 'STRING', enum: ['N5', 'N4', 'N3', 'N2', 'N1'] },
      themeDescription: { type: 'STRING' },
      title: { type: 'STRING' },
      titleTokens: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            surface: { type: 'STRING' },
            reading: { type: 'STRING' },
            isTarget: { type: 'BOOLEAN' },
          },
          required: ['surface', 'reading', 'isTarget'],
        },
      },
      targetVocabulary: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            reading: { type: 'STRING' },
            romaji: { type: 'STRING' },
            meaning: { type: 'STRING' },
            partOfSpeech: { type: 'STRING' },
            examples: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  japanese: { type: 'STRING' },
                  reading: { type: 'STRING' },
                  english: { type: 'STRING' },
                },
                required: ['japanese', 'reading', 'english'],
              },
            },
          },
          required: ['word', 'reading', 'romaji', 'meaning', 'partOfSpeech'],
        },
      },
      sentences: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'INTEGER' },
            speaker: { type: 'STRING' },
            speakerId: { type: 'STRING' },
            japanese: { type: 'STRING' },
            english: { type: 'STRING' },
            tokens: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  surface: { type: 'STRING' },
                  reading: { type: 'STRING' },
                  isTarget: { type: 'BOOLEAN' },
                },
                required: ['surface', 'reading', 'isTarget'],
              },
            },
          },
          required: ['id', 'japanese', 'english', 'tokens'],
        },
      },
    },
    required: ['topic', 'level', 'title', 'titleTokens', 'targetVocabulary', 'sentences'],
  };
}

export function buildTargetVocabularyPrompt(
  level: JLPTLevel,
  topic: string,
  customInstruction?: string,
  excludeWords?: string[]
): string {
  const exclusionNote =
    excludeWords && excludeWords.length > 0
      ? `\nEXCLUDED VOCABULARY: Do NOT use any of the following already-learned words as targetVocabulary items: ${excludeWords.join(', ')}`
      : '';

  return `You are a master Japanese language educator.
Curate a cohesive target vocabulary set (3 to 5 words) for a daily Japanese study session.

Target Level: JLPT ${level} (${levelGuidelines[level]})
Topic: ${topic}
${customInstruction ? `Additional Instruction: ${customInstruction}` : ''}${exclusionNote}

CRITICAL REQUIREMENTS:
1. Curate 3 to 5 semantically cohesive vocabulary words ('targetVocabulary') that naturally fit the given topic and JLPT level.
   Each target word MUST include:
   - word: Kanji/Kana surface (e.g. "注文")
   - reading: Full hiragana reading (e.g. "ちゅうもん")
   - romaji: Standard Hepburn romaji (e.g. "chuumon")
   - meaning: Clear English definition
   - partOfSpeech: Part of speech (e.g. "noun / suru-verb")
   - examples: Array of EXACTLY 3 contextual Japanese example sentences with readings and English translations.

2. Generate a thematic lesson title and breakdown into titleTokens with Furigana readings for Kanji.

3. Return ONLY a valid JSON object strictly adhering to the schema.`;
}

export function buildTargetVocabularySchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      topic: { type: 'STRING' },
      level: { type: 'STRING', enum: ['N5', 'N4', 'N3', 'N2', 'N1'] },
      themeDescription: { type: 'STRING' },
      title: { type: 'STRING' },
      titleTokens: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            surface: { type: 'STRING' },
            reading: { type: 'STRING' },
            isTarget: { type: 'BOOLEAN' },
          },
          required: ['surface', 'reading', 'isTarget'],
        },
      },
      targetVocabulary: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            reading: { type: 'STRING' },
            romaji: { type: 'STRING' },
            meaning: { type: 'STRING' },
            partOfSpeech: { type: 'STRING' },
            examples: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  japanese: { type: 'STRING' },
                  reading: { type: 'STRING' },
                  english: { type: 'STRING' },
                },
                required: ['japanese', 'reading', 'english'],
              },
            },
          },
          required: ['word', 'reading', 'romaji', 'meaning', 'partOfSpeech'],
        },
      },
    },
    required: ['topic', 'level', 'title', 'titleTokens', 'targetVocabulary'],
  };
}

export function formatInventory(words?: (TargetWord | WordBankItem)[]): string {
  if (!words || words.length === 0) return '';
  const seen = new Set<string>();
  const items: string[] = [];
  for (const w of words) {
    if (!w || !w.word) continue;
    const surface = w.word.trim();
    if (!seen.has(surface)) {
      seen.add(surface);
      const readingPart = w.reading ? ` (${w.reading}${w.meaning ? ` - ${w.meaning}` : ''})` : '';
      items.push(`${surface}${readingPart}`);
    }
  }
  return items.join(', ');
}

export function buildConstraintPromptSection(
  tier: VocabularyConstraintTier = 'strict',
  inventoryText: string,
  totalWordCount: number,
  level: JLPTLevel
): string {
  if (tier === 'strict') {
    const sparseNote =
      totalWordCount < 15
        ? `\n\nSPARSE INVENTORY FALLBACK: If the provided vocabulary inventory is too small to form a full coherent dialogue, you may ONLY supplement with essential beginner survival vocabulary: はい, いいえ, ありがとう, すみません, これ, それ, あれ, 行く, 来る, 食べる, 飲む, 好き, 美味しい, 大きい, 小さい.`
        : '';

    return `\nPEDAGOGICAL CONSTRAINT: STRICT CLOSED BANK (Zero Unknown Content Words)
1. 100% of all content words (nouns, main verbs, adjectives, adverbs) in the dialogue MUST be drawn strictly from the provided TARGET VOCABULARY and KNOWN VOCABULARY INVENTORY. Do NOT introduce any novel content vocabulary.
2. Form natural Japanese sentences using standard level-appropriate particles (は, が, を, に, で, と, も, へ, から, まで, よ, ね) and standard JLPT ${level} inflections/copulas (です, ます, ない, たい, て-form, past tense).${sparseNote}`;
  }

  if (tier === 'i_plus_one') {
    return `\nPEDAGOGICAL CONSTRAINT: COMPREHENSIBLE INPUT (i+1 Mode)
1. 85-90% of the vocabulary in the dialogue must come from the TARGET VOCABULARY and KNOWN VOCABULARY INVENTORY.
2. Intentionally introduce EXACTLY 1 to 2 level-appropriate novel vocabulary words in clear, natural context so the learner can infer their meaning from context.
3. Return all newly introduced novel words in the 'novelWords' array with full word, reading, romaji, meaning, and partOfSpeech. In the sentence tokens, set 'isNovel': true for tokens corresponding to these novel words.`;
  }

  // natural tier
  return `\nPEDAGOGICAL CONSTRAINT: NATURAL GRADED IMMERSION
1. Compose an authentic, natural JLPT ${level} dialogue roleplay incorporating the target vocabulary.`;
}

export function buildPassagePrompt(
  targetVocabulary: TargetWord[],
  topic: string,
  level: JLPTLevel,
  customInstruction?: string,
  reviewWords?: TargetWord[],
  constraintTier: VocabularyConstraintTier = 'strict',
  knownVocabulary?: (TargetWord | WordBankItem)[]
): string {
  const wordsList = targetVocabulary
    .map((v) => `${v.word} (${v.reading} - ${v.meaning})`)
    .join(', ');

  const combinedInventory = [
    ...(knownVocabulary || []),
    ...(reviewWords || []),
  ];

  const inventoryText = formatInventory(combinedInventory);
  const inventorySection =
    inventoryText && constraintTier !== 'natural'
      ? `\n\nKNOWN VOCABULARY INVENTORY (User's Learned Word Bank):\n${inventoryText}`
      : '';

  const totalWordsCount = targetVocabulary.length + combinedInventory.length;
  const constraintSection = buildConstraintPromptSection(
    constraintTier,
    inventoryText,
    totalWordsCount,
    level
  );

  return `You are a master Japanese language educator.
Generate an authentic Japanese dialogue passage (4 to 8 sentences) for JLPT ${level} level on the topic "${topic}".

TARGET VOCABULARY TO INCORPORATE:
${wordsList}${inventorySection}
${constraintSection}
${customInstruction ? `\nAdditional Instruction: ${customInstruction}` : ''}

MANDATORY REQUIREMENTS:
1. Natural dialogue roleplay between 2 distinct speakers (Speaker A and Speaker B), with optional Narrator.
2. Incorporate ALL target vocabulary words naturally in context.
3. Each sentence in the passage MUST have:
   - id: 1-indexed sequential number
   - speaker: Name or role of speaker (e.g. "店員 (Staff)", "田中 (Tanaka)")
   - speakerId: "A" or "B" or "narrator"
   - japanese: Clean Japanese text for speech synthesis
   - english: Natural English translation
   - tokens: Array of word tokens breaking down the sentence for Furigana display.
     Every token has 'surface' (displayed text), 'reading' (Hiragana reading for Kanji, or "" for Kana/punctuation), 'isTarget' (true if token matches one of the target words), and 'isNovel' (true if token matches a novel i+1 word).
4. If in i+1 mode and novel words are introduced, list them in the 'novelWords' array.
5. Return ONLY a valid JSON object strictly adhering to the schema.`;
}

export function buildPracticePassagePrompt(
  words: TargetWord[],
  level: JLPTLevel,
  topic?: string,
  customInstruction?: string,
  constraintTier: VocabularyConstraintTier = 'strict',
  knownVocabulary?: (TargetWord | WordBankItem)[]
): string {
  const chosenTopic = topic && topic.trim() ? topic.trim() : 'Natural Japanese Conversation';
  const wordsList = words
    .map((v) => `${v.word} (${v.reading} - ${v.meaning})`)
    .join(', ');

  const combinedInventory = [
    ...(knownVocabulary || []),
    ...words,
  ];

  const inventoryText = formatInventory(combinedInventory);
  const inventorySection =
    inventoryText && constraintTier !== 'natural'
      ? `\n\nKNOWN VOCABULARY INVENTORY (Available Word Bank Words):\n${inventoryText}`
      : '';

  const totalWordsCount = combinedInventory.length;
  const constraintSection = buildConstraintPromptSection(
    constraintTier,
    inventoryText,
    totalWordsCount,
    level
  );

  return `You are a master Japanese educator and conversational storyteller.
Create an engaging, natural dialogue or short passage for a JLPT ${level} learner practicing vocabulary from their Word Bank.

Target Level: JLPT ${level} (${levelGuidelines[level]})
Topic / Scenario: ${chosenTopic}
Focus Practice Vocabulary: ${wordsList}${inventorySection}
${constraintSection}
${customInstruction ? `\nAdditional Instruction: ${customInstruction}` : ''}

CRITICAL PEDAGOGICAL REQUIREMENTS:
1. READABILITY IS THE PARAMOUNT GOAL: Write smooth, natural, authentic Japanese dialogue. Do NOT force or cram words if it makes the phrasing awkward or unnatural.
2. Incorporate as many of the provided focus vocabulary words as fit naturally and fluidly into the dialogue.
3. Length: 4 to 8 authentic conversational turns or narrative sentences.
4. Each sentence MUST have:
   - id: 1-indexed number
   - speaker: Name/role of speaker (e.g. "店員", "田中", "客", "Narrator")
   - speakerId: "A" or "B" or "narrator"
   - japanese: Clean Japanese text for speech synthesis
   - english: Natural English translation
   - tokens: Array of tokens with 'surface', 'reading' (Hiragana reading for Kanji, or "" for Kana/punctuation), 'isTarget' (true if this token matches one of the focus vocabulary words), and 'isNovel' (true if this token is a novel i+1 word).
5. If in i+1 mode and novel words are introduced, return them in the 'novelWords' array.
6. Return ONLY a valid JSON object strictly adhering to the schema.`;
}

export function buildPracticePassageSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      titleTokens: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            surface: { type: 'STRING' },
            reading: { type: 'STRING' },
            isTarget: { type: 'BOOLEAN' },
            isNovel: { type: 'BOOLEAN' },
          },
          required: ['surface', 'reading', 'isTarget'],
        },
      },
      themeDescription: { type: 'STRING' },
      novelWords: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            reading: { type: 'STRING' },
            romaji: { type: 'STRING' },
            meaning: { type: 'STRING' },
            partOfSpeech: { type: 'STRING' },
          },
          required: ['word', 'reading', 'romaji', 'meaning', 'partOfSpeech'],
        },
      },
      sentences: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'INTEGER' },
            speaker: { type: 'STRING' },
            speakerId: { type: 'STRING' },
            japanese: { type: 'STRING' },
            english: { type: 'STRING' },
            tokens: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  surface: { type: 'STRING' },
                  reading: { type: 'STRING' },
                  isTarget: { type: 'BOOLEAN' },
                  isNovel: { type: 'BOOLEAN' },
                },
                required: ['surface', 'reading', 'isTarget'],
              },
            },
          },
          required: ['id', 'japanese', 'english', 'tokens'],
        },
      },
    },
    required: ['title', 'titleTokens', 'sentences'],
  };
}

export function buildPassageSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      novelWords: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            reading: { type: 'STRING' },
            romaji: { type: 'STRING' },
            meaning: { type: 'STRING' },
            partOfSpeech: { type: 'STRING' },
          },
          required: ['word', 'reading', 'romaji', 'meaning', 'partOfSpeech'],
        },
      },
      sentences: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'INTEGER' },
            speaker: { type: 'STRING' },
            speakerId: { type: 'STRING' },
            japanese: { type: 'STRING' },
            english: { type: 'STRING' },
            tokens: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  surface: { type: 'STRING' },
                  reading: { type: 'STRING' },
                  isTarget: { type: 'BOOLEAN' },
                  isNovel: { type: 'BOOLEAN' },
                },
                required: ['surface', 'reading', 'isTarget'],
              },
            },
          },
          required: ['id', 'japanese', 'english', 'tokens'],
        },
      },
    },
    required: ['sentences'],
  };
}

export interface TargetVocabularyResult {
  topic: string;
  level: JLPTLevel;
  themeDescription: string;
  title: string;
  titleTokens: SentenceToken[];
  targetVocabulary: TargetWord[];
}

export interface PassageResult {
  sentences: PassageSentence[];
  speakers?: SpeakerInfo[];
  novelWords?: TargetWord[];
}

/**
 * Parses and validates raw response into a structured DailyLesson domain model.
 */
export function parseAndValidateLessonResponse(
  raw: unknown,
  metadata: { topic: string; level: JLPTLevel }
): DailyLesson {
  let parsed: any = raw;

  if (typeof raw === 'string') {
    let cleanJson = raw.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    try {
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      throw new GeminiParseError('Failed to parse Gemini response as JSON.', raw);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new GeminiParseError('Gemini response is not a valid object.', parsed);
  }

  if (
    !Array.isArray(parsed.targetVocabulary) ||
    parsed.targetVocabulary.length === 0 ||
    !Array.isArray(parsed.sentences) ||
    parsed.sentences.length === 0
  ) {
    throw new GeminiParseError(
      'Gemini response is missing targetVocabulary or sentences.',
      parsed
    );
  }

  const validatedVocabulary: TargetWord[] = parsed.targetVocabulary.map((v: any) => ({
    word: String(v.word || ''),
    reading: String(v.reading || ''),
    romaji: String(v.romaji || ''),
    meaning: String(v.meaning || ''),
    partOfSpeech: String(v.partOfSpeech || 'word'),
    examples: Array.isArray(v.examples)
      ? v.examples.map((ex: any) => ({
        japanese: String(ex.japanese || ''),
        reading: String(ex.reading || ''),
        english: String(ex.english || ''),
      }))
      : [],
  }));

  const validatedSentences: PassageSentence[] = parsed.sentences.map(
    (s: any, idx: number) => ({
      id: typeof s.id === 'number' ? s.id : idx + 1,
      speaker: s.speaker ? String(s.speaker) : undefined,
      speakerId: s.speakerId ? String(s.speakerId) : idx % 2 === 0 ? 'A' : 'B',
      japanese: String(s.japanese || ''),
      english: String(s.english || ''),
      tokens: Array.isArray(s.tokens)
        ? s.tokens.map((t: any) => ({
          surface: String(t.surface || ''),
          reading: String(t.reading || ''),
          isTarget: Boolean(t.isTarget),
        }))
        : [{ surface: String(s.japanese || ''), reading: '', isTarget: false }],
    })
  );

  const validatedTitleTokens: SentenceToken[] = Array.isArray(parsed.titleTokens)
    ? parsed.titleTokens.map((t: any) => ({
      surface: String(t.surface || ''),
      reading: String(t.reading || ''),
      isTarget: Boolean(t.isTarget),
    }))
    : [{ surface: String(parsed.title || metadata.topic), reading: '', isTarget: false }];

  const now = new Date().toISOString();

  return {
    id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    topic: parsed.topic || metadata.topic,
    level: (parsed.level as JLPTLevel) || metadata.level,
    themeDescription:
      parsed.themeDescription || `Daily study session for ${metadata.topic}`,
    title: parsed.title || metadata.topic,
    titleTokens: validatedTitleTokens,
    targetVocabulary: validatedVocabulary,
    sentences: validatedSentences,
    isStarred: false,
  };
}

export function parseAndValidateTargetVocabularyResponse(
  raw: unknown,
  metadata: { topic: string; level: JLPTLevel }
): TargetVocabularyResult {
  let parsed: any = raw;

  if (typeof raw === 'string') {
    let cleanJson = raw.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
    cleanJson = cleanJson.trim();

    try {
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      throw new GeminiParseError('Failed to parse Gemini response as JSON.', raw);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new GeminiParseError('Gemini response is not a valid object.', parsed);
  }

  if (!Array.isArray(parsed.targetVocabulary) || parsed.targetVocabulary.length === 0) {
    throw new GeminiParseError('Gemini response is missing targetVocabulary.', parsed);
  }

  const validatedVocabulary: TargetWord[] = parsed.targetVocabulary.map((v: any) => ({
    word: String(v.word || ''),
    reading: String(v.reading || ''),
    romaji: String(v.romaji || ''),
    meaning: String(v.meaning || ''),
    partOfSpeech: String(v.partOfSpeech || 'word'),
    examples: Array.isArray(v.examples)
      ? v.examples.map((ex: any) => ({
        japanese: String(ex.japanese || ''),
        reading: String(ex.reading || ''),
        english: String(ex.english || ''),
      }))
      : [],
  }));

  const validatedTitleTokens: SentenceToken[] = Array.isArray(parsed.titleTokens)
    ? parsed.titleTokens.map((t: any) => ({
      surface: String(t.surface || ''),
      reading: String(t.reading || ''),
      isTarget: Boolean(t.isTarget),
    }))
    : [{ surface: String(parsed.title || metadata.topic), reading: '', isTarget: false }];

  return {
    topic: parsed.topic || metadata.topic,
    level: (parsed.level as JLPTLevel) || metadata.level,
    themeDescription:
      parsed.themeDescription || `Daily study session for ${metadata.topic}`,
    title: parsed.title || metadata.topic,
    titleTokens: validatedTitleTokens,
    targetVocabulary: validatedVocabulary,
  };
}

export function parseAndValidatePassageResponse(raw: unknown): PassageResult {
  let parsed: any = raw;

  if (typeof raw === 'string') {
    let cleanJson = raw.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
    cleanJson = cleanJson.trim();

    try {
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      throw new GeminiParseError('Failed to parse Gemini passage response as JSON.', raw);
    }
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sentences) || parsed.sentences.length === 0) {
    throw new GeminiParseError('Gemini passage response is missing sentences.', parsed);
  }

  const validatedNovelWords: TargetWord[] | undefined = Array.isArray(parsed.novelWords)
    ? parsed.novelWords.map((v: any) => ({
      word: String(v.word || ''),
      reading: String(v.reading || ''),
      romaji: String(v.romaji || ''),
      meaning: String(v.meaning || ''),
      partOfSpeech: String(v.partOfSpeech || 'word'),
      examples: Array.isArray(v.examples)
        ? v.examples.map((ex: any) => ({
          japanese: String(ex.japanese || ''),
          reading: String(ex.reading || ''),
          english: String(ex.english || ''),
        }))
        : [],
    }))
    : undefined;

  const validatedSentences: PassageSentence[] = parsed.sentences.map((s: any, idx: number) => ({
    id: typeof s.id === 'number' ? s.id : idx + 1,
    speaker: s.speaker ? String(s.speaker) : undefined,
    speakerId: s.speakerId ? String(s.speakerId) : idx % 2 === 0 ? 'A' : 'B',
    japanese: String(s.japanese || ''),
    english: String(s.english || ''),
    tokens: Array.isArray(s.tokens)
      ? s.tokens.map((t: any) => ({
        surface: String(t.surface || ''),
        reading: String(t.reading || ''),
        isTarget: Boolean(t.isTarget),
        isNovel: Boolean(t.isNovel),
      }))
      : [{ surface: String(s.japanese || ''), reading: '', isTarget: false, isNovel: false }],
  }));

  return {
    sentences: validatedSentences,
    speakers: parsed.speakers,
    novelWords: validatedNovelWords,
  };
}

export function buildWordImportPrompt(words: string[], level: JLPTLevel): string {
  return `You are a master Japanese lexicographer and educator.
Enrich the following list of Japanese vocabulary items into complete, structured dictionary entries suitable for JLPT ${level} study:
Words to enrich: ${words.join(', ')}

REQUIREMENTS FOR EACH WORD:
- word: Clean Kanji/Kana surface (e.g. "注文")
- reading: Full hiragana reading (e.g. "ちゅうもん")
- romaji: Standard Hepburn romaji (e.g. "chuumon")
- meaning: Clear concise English definition
- partOfSpeech: Accurate part of speech (e.g. "noun / suru-verb", "i-adjective", "godan verb")
- examples: Array of EXACTLY 3 authentic, natural contextual Japanese example sentences with readings and English translations.

Return ONLY a valid JSON object strictly adhering to the schema.`;
}

export function buildWordImportSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      words: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            reading: { type: 'STRING' },
            romaji: { type: 'STRING' },
            meaning: { type: 'STRING' },
            partOfSpeech: { type: 'STRING' },
            examples: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  japanese: { type: 'STRING' },
                  reading: { type: 'STRING' },
                  english: { type: 'STRING' },
                },
                required: ['japanese', 'reading', 'english'],
              },
            },
          },
          required: ['word', 'reading', 'romaji', 'meaning', 'partOfSpeech', 'examples'],
        },
      },
    },
    required: ['words'],
  };
}

export function parseAndValidateWordImportResponse(raw: unknown): TargetWord[] {
  let parsed: any = raw;
  if (typeof raw === 'string') {
    let cleanJson = raw.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
    cleanJson = cleanJson.trim();

    try {
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      throw new GeminiParseError('Failed to parse Gemini word import response as JSON.', raw);
    }
  }

  const items = Array.isArray(parsed?.words) ? parsed.words : Array.isArray(parsed) ? parsed : [];
  return items.map((v: any) => ({
    word: String(v.word || ''),
    reading: String(v.reading || ''),
    romaji: String(v.romaji || ''),
    meaning: String(v.meaning || ''),
    partOfSpeech: String(v.partOfSpeech || 'word'),
    examples: Array.isArray(v.examples)
      ? v.examples.map((ex: any) => ({
        japanese: String(ex.japanese || ''),
        reading: String(ex.reading || ''),
        english: String(ex.english || ''),
      }))
      : [],
  }));
}

/**
 * Intelligently extracts individual Japanese target words/Kanji from raw text.
 * Supports:
 * - Simple comma/newline/space separated lists (e.g. "注文, 予約, 店員")
 * - Line-by-line formatted study entries (e.g. "かいます 【買います】 (kaimasu) — To buy" -> "買います")
 * - Single-line comma-separated entries with English notes (e.g. "食べる (to eat), 飲む (to drink), 行く (to go)")
 * - Inline numbered lists (e.g. "1. 注文 2. 予約 3. 店員")
 */
export function parseRawWordList(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== 'string') return [];

  // Split input into logical entry chunks respecting brackets/parentheses and delimiters
  const chunks: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < rawInput.length; i++) {
    const char = rawInput[i];

    if (char === '(' || char === '（') {
      parenDepth++;
      current += char;
    } else if (char === ')' || char === '）') {
      if (parenDepth > 0) parenDepth--;
      current += char;
    } else if (char === '[' || char === '【' || char === '「') {
      bracketDepth++;
      current += char;
    } else if (char === ']' || char === '】' || char === '」') {
      if (bracketDepth > 0) bracketDepth--;
      current += char;
    } else if (
      (char === '\n' || char === '\r' || char === ',' || char === '，' || char === '、' || char === ';' || char === '；') &&
      parenDepth === 0 &&
      bracketDepth === 0
    ) {
      if (current.trim().length > 0) {
        chunks.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  // Also split on inline numbered list markers like "1. 注文 2. 予約 3. 店員"
  const entryItems: string[] = [];
  for (const chunk of chunks) {
    const subChunks = chunk.split(/(?<=\S)\s+(?=\d+[\.\)])/);
    for (const sc of subChunks) {
      if (sc.trim().length > 0) {
        entryItems.push(sc.trim());
      }
    }
  }

  if (entryItems.length === 0) return [];

  const kanjiRegex = /[\u3400-\u4dbf\u4e00-\u9fff]/;
  const extractedWords: string[] = [];

  for (const item of entryItems) {
    // 1. If entry has 【...】 or [...] or 「...」 with Japanese characters inside, prefer the bracketed word
    const bracketMatch = item.match(
      /【([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)】|\[([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)\]|「([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)」/
    );
    if (bracketMatch) {
      const wordInBrackets = (bracketMatch[1] || bracketMatch[2] || bracketMatch[3] || '').trim();
      if (wordInBrackets.length > 0) {
        extractedWords.push(wordInBrackets);
        continue;
      }
    }

    // 2. Strip bullet prefixes like "1. ", "1) ", "* ", "- "
    const cleanItem = item.replace(/^\s*(\d+[\.\)]|[-*•])\s+/, '').trim();

    // 3. Look for continuous Japanese segments (Kanji/Kana)
    const japaneseSegments = cleanItem.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+/g);
    if (japaneseSegments && japaneseSegments.length > 0) {
      const hasSeparators = /[—–\-:：/|~～(（]/.test(cleanItem);
      const hasEnglish = /[a-zA-Z]/.test(cleanItem);

      if (hasSeparators || hasEnglish) {
        // Formatted study card item: prefer segment with Kanji if present (e.g. 買います over かいます)
        const segmentWithKanji = japaneseSegments.find((seg) => kanjiRegex.test(seg));
        if (segmentWithKanji) {
          extractedWords.push(segmentWithKanji.trim());
        } else {
          extractedWords.push(japaneseSegments[0].trim());
        }
      } else {
        // Plain whitespace-separated Japanese words (e.g. "注文 予約 店員")
        for (const seg of japaneseSegments) {
          if (seg.trim().length > 0) {
            extractedWords.push(seg.trim());
          }
        }
      }
      continue;
    }

    // 4. Fallback for non-Japanese plain terms (e.g. "Tokyo", "Osaka")
    const cleaned = cleanItem
      .replace(
        /^[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+|[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+$/g,
        ''
      )
      .trim();
    if (cleaned.length > 0) {
      extractedWords.push(cleaned);
    }
  }

  // Deduplicate preserving encounter order
  return Array.from(new Set(extractedWords));
}

/**
 * Batched Plain-Text Word List Importer with LLM Enrichment.
 */
export async function importWordList(
  rawInput: string | string[],
  level: JLPTLevel,
  apiKey?: string,
  onProgress?: (completed: number, total: number) => void,
  fetchFn: typeof fetch = fetch,
  model = DEFAULT_MODEL
): Promise<TargetWord[]> {
  const uniqueWords = Array.isArray(rawInput)
    ? Array.from(new Set(rawInput.map((w) => w.trim()).filter((w) => w.length > 0)))
    : parseRawWordList(rawInput);

  if (uniqueWords.length === 0) {
    return [];
  }

  const BATCH_SIZE = 6;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueWords.length; i += BATCH_SIZE) {
    batches.push(uniqueWords.slice(i, i + BATCH_SIZE));
  }

  const results: TargetWord[] = [];
  let completed = 0;

  for (const batch of batches) {
    if (!apiKey || apiKey.trim() === '') {
      // Mock offline enrichment
      for (const word of batch) {
        results.push({
          word,
          reading: word,
          romaji: word.toLowerCase(),
          meaning: `Imported definition for ${word}`,
          partOfSpeech: 'noun',
          examples: [
            {
              japanese: `${word}を使います。`,
              reading: `${word}をつかいます。`,
              english: `Using the word ${word}.`,
            },
          ],
        });
      }
    } else {
      const prompt = buildWordImportPrompt(batch, level);
      const schema = buildWordImportSchema();
      const rawResponse = await callGeminiStructuredApi(prompt, schema, {
        apiKey,
        fetchFn,
        model,
      });
      const parsedBatch = parseAndValidateWordImportResponse(rawResponse);
      results.push(...parsedBatch);
    }

    completed += batch.length;
    if (onProgress) {
      onProgress(completed, uniqueWords.length);
    }
  }

  return results;
}

/**
 * Internal executor that tries models with fallback cascade for structured Gemini JSON responses.
 */
async function callGeminiStructuredApi(
  promptText: string,
  responseSchema: Record<string, unknown>,
  options: {
    apiKey: string;
    fetchFn?: typeof fetch;
    model?: string;
  }
): Promise<any> {
  const { apiKey, fetchFn = fetch, model = DEFAULT_MODEL } = options;
  const modelsToTry = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    const url = `${GEMINI_BASE_URL}/${currentModel}:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    };

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      throw new GeminiApiError(`Network request to Gemini API failed: ${err.message}`);
    }

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // ignore
      }

      if (response.status === 404) {
        lastError = new GeminiApiError(
          `Gemini model ${currentModel} not found (404).`,
          404,
          errorData
        );
        continue;
      }

      if (response.status === 400 || response.status === 403) {
        const msg = errorData?.error?.message || 'Invalid Gemini API key.';
        if (
          msg.includes('API_KEY_INVALID') ||
          msg.includes('API key') ||
          response.status === 403
        ) {
          throw new InvalidApiKeyError(msg);
        }
        throw new GeminiApiError(`Gemini API error (${response.status}): ${msg}`, response.status, errorData);
      }

      if (response.status === 429) {
        throw new RateLimitError(
          errorData?.error?.message || 'Gemini API rate limit exceeded.'
        );
      }

      lastError = new GeminiApiError(
        `Gemini API request failed with status ${response.status}: ${
          errorData?.error?.message || response.statusText
        }`,
        response.status,
        errorData
      );
      continue;
    }

    const jsonResponse: any = await response.json();
    const textContent =
      jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new GeminiParseError('Gemini API returned an empty response.', jsonResponse);
    }

    return textContent;
  }

  throw lastError || new GeminiApiError('Failed to complete request with available Gemini models.');
}

/**
 * Validates a user's Gemini API key by making a lightweight model list request.
 */
export function validateApiKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const trimmed = apiKey?.trim();
  if (!trimmed) {
    return Promise.resolve(false);
  }

  const url = `${GEMINI_BASE_URL}?key=${encodeURIComponent(trimmed)}`;

  return fetchFn(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((res) => {
      return res.ok;
    })
    .catch(() => {
      return false;
    });
}

/**
 * Phase 1: Generates target vocabulary and examples rapidly.
 */
export async function generateTargetVocabulary(
  topic: string,
  level: JLPTLevel,
  apiKey?: string,
  customInstruction?: string,
  excludeWords?: string[],
  fetchFn: typeof fetch = fetch,
  model = DEFAULT_MODEL
): Promise<TargetVocabularyResult> {
  if (!apiKey || apiKey.trim() === '') {
    const mock = getMockLesson(level, topic);
    return {
      topic: mock.topic,
      level: mock.level,
      themeDescription: mock.themeDescription,
      title: mock.title,
      titleTokens: mock.titleTokens,
      targetVocabulary: mock.targetVocabulary,
    };
  }

  const promptText = buildTargetVocabularyPrompt(level, topic, customInstruction, excludeWords);
  const responseSchema = buildTargetVocabularySchema();

  const rawText = await callGeminiStructuredApi(promptText, responseSchema, {
    apiKey,
    fetchFn,
    model,
  });

  return parseAndValidateTargetVocabularyResponse(rawText, { topic, level });
}

/**
 * Phase 2: Generates contextual dialogue passage embedding target words (and optional review words).
 */
export async function generatePassageForVocabulary(
  targetVocabulary: TargetWord[],
  topic: string,
  level: JLPTLevel,
  apiKey?: string,
  customInstruction?: string,
  reviewWords?: TargetWord[],
  constraintTier: VocabularyConstraintTier = 'strict',
  knownVocabulary?: (TargetWord | WordBankItem)[],
  fetchFn: typeof fetch = fetch,
  model = DEFAULT_MODEL
): Promise<PassageResult> {
  if (!apiKey || apiKey.trim() === '') {
    const mock = getMockLesson(level, topic);
    return {
      sentences: mock.sentences,
      speakers: mock.passage?.speakers,
      novelWords: mock.novelWords,
    };
  }

  const promptText = buildPassagePrompt(
    targetVocabulary,
    topic,
    level,
    customInstruction,
    reviewWords,
    constraintTier,
    knownVocabulary
  );
  const responseSchema = buildPassageSchema();

  const rawText = await callGeminiStructuredApi(promptText, responseSchema, {
    apiKey,
    fetchFn,
    model,
  });

  return parseAndValidatePassageResponse(rawText);
}

export interface GeneratePracticePassageOptions {
  words: TargetWord[];
  level: JLPTLevel;
  topic?: string;
  apiKey?: string;
  customInstruction?: string;
  constraintTier?: VocabularyConstraintTier;
  knownVocabulary?: (TargetWord | WordBankItem)[];
  fetchFn?: typeof fetch;
  model?: string;
}

/**
 * Generates an authentic Japanese reading/listening passage using existing vocabulary from the Word Bank.
 */
export async function generatePracticePassage(
  options: GeneratePracticePassageOptions
): Promise<DailyLesson> {
  const {
    words,
    level,
    topic = 'Word Bank Vocabulary Review',
    apiKey,
    customInstruction,
    constraintTier = 'strict',
    knownVocabulary,
    fetchFn = fetch,
    model = DEFAULT_MODEL,
  } = options;

  const now = new Date().toISOString();

  if (!apiKey || apiKey.trim() === '') {
    const mock = getMockLesson(level, topic);
    return {
      ...mock,
      id: `practice-${level.toLowerCase()}-${Date.now()}`,
      createdAt: now,
      topic,
      level,
      targetVocabulary: words.length > 0 ? words : mock.targetVocabulary,
      themeDescription: `Practice passage reviewing ${words.length} words from your Word Bank.`,
      novelWords: mock.novelWords,
    };
  }

  const promptText = buildPracticePassagePrompt(
    words,
    level,
    topic,
    customInstruction,
    constraintTier,
    knownVocabulary
  );
  const responseSchema = buildPracticePassageSchema();

  const rawText = await callGeminiStructuredApi(promptText, responseSchema, {
    apiKey,
    fetchFn,
    model,
  });

  let parsedJson: any = {};
  if (typeof rawText === 'string') {
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
    try {
      parsedJson = JSON.parse(cleanJson.trim());
    } catch {
      parsedJson = {};
    }
  } else if (rawText && typeof rawText === 'object') {
    parsedJson = rawText;
  }

  const passageResult = parseAndValidatePassageResponse(rawText);
  const titleTokens: SentenceToken[] = Array.isArray(parsedJson?.titleTokens)
    ? parsedJson.titleTokens
    : [{ surface: parsedJson?.title || topic, reading: '', isTarget: false }];

  return {
    id: `practice-${level.toLowerCase()}-${Date.now()}`,
    createdAt: now,
    topic,
    level,
    themeDescription:
      parsedJson?.themeDescription ||
      `Practice passage reviewing ${words.length} words from your Word Bank.`,
    title: parsedJson?.title || topic,
    titleTokens,
    targetVocabulary: words,
    novelWords: passageResult.novelWords,
    sentences: passageResult.sentences,
    passage: {
      title: parsedJson?.title || topic,
      speakers: passageResult.speakers,
      sentences: passageResult.sentences,
      novelWords: passageResult.novelWords,
    },
    isStarred: false,
  };
}

/**
 * Generates a full DailyLesson in a single call using Gemini API or offline mock generator.
 */
export async function generateLesson(
  options: GenerateLessonOptions
): Promise<DailyLesson> {
  const {
    apiKey,
    level,
    topic,
    customInstruction,
    excludeWords,
    fetchFn = fetch,
    model = DEFAULT_MODEL,
  } = options;

  if (!apiKey || apiKey.trim() === '') {
    return getMockLesson(level, topic);
  }

  const promptText = buildPrompt(level, topic, customInstruction, excludeWords);
  const responseSchema = buildResponseSchema();

  const rawText = await callGeminiStructuredApi(promptText, responseSchema, {
    apiKey,
    fetchFn,
    model,
  });

  return parseAndValidateLessonResponse(rawText, { topic, level });
}

/**
 * Built-in mock lesson generator for offline use, tests, and first-run preview.
 */
export function getMockLesson(level: JLPTLevel, topic?: string): DailyLesson {
  const chosenTopic = topic || 'Ordering at a Japanese Café';
  const now = new Date().toISOString();

  const mockVocab: Record<JLPTLevel, TargetWord[]> = {
    N5: [
      {
        word: '注文',
        reading: 'ちゅうもん',
        romaji: 'chuumon',
        meaning: 'an order (for goods/food)',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: 'ご注文は何にしますか？',
            reading: 'ごちゅうもんはなににしますか？',
            english: 'What would you like to order?',
          },
          {
            japanese: 'ホットコーヒーを注文しました。',
            reading: 'ホットコーヒーをちゅうもんしました。',
            english: 'I ordered a hot coffee.',
          },
          {
            japanese: '注文をお願いします。',
            reading: 'ちゅうもんをおねがいします。',
            english: 'I would like to order, please.',
          },
        ],
      },
      {
        word: '店員',
        reading: 'てんいん',
        romaji: 'ten-in',
        meaning: 'store clerk / staff',
        partOfSpeech: 'noun',
        examples: [
          {
            japanese: '店員さんがメニューを持ってきました。',
            reading: 'てんいんさんがメニューをもってきました。',
            english: 'The clerk brought the menu.',
          },
          {
            japanese: '店員にオススメを聞きます。',
            reading: 'てんいんにおススメをききます。',
            english: 'I ask the clerk for recommendations.',
          },
          {
            japanese: '親切な店員さんでした。',
            reading: 'しんせつなてんいんさんでした。',
            english: 'It was a very kind clerk.',
          },
        ],
      },
      {
        word: '持ち帰り',
        reading: 'もちかえり',
        romaji: 'mochikaeri',
        meaning: 'takeout / to go',
        partOfSpeech: 'noun',
        examples: [
          {
            japanese: '持ち帰りでおねがいします。',
            reading: 'もちかえりでおねがいします。',
            english: 'Takeout, please.',
          },
          {
            japanese: '店内で召し上がりますか、持ち帰りですか？',
            reading: 'てんないでめしあがりますか、もちかえりですか？',
            english: 'For here or to go?',
          },
          {
            japanese: '持ち帰りのコーヒーを買いました。',
            reading: 'もちかえりのコーヒーをかいました。',
            english: 'I bought a takeout coffee.',
          },
        ],
      },
    ],
    N4: [
      {
        word: '予約',
        reading: 'よやく',
        romaji: 'yoyaku',
        meaning: 'reservation / booking',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: '新幹線の席を予約しました。',
            reading: 'しんかんせんのせきをよやくしました。',
            english: 'I booked a seat on the bullet train.',
          },
          {
            japanese: '予約した田中と申します。',
            reading: 'よやくしたたなかともうします。',
            english: 'I have a reservation under Tanaka.',
          },
          {
            japanese: '週末は予約が必要です。',
            reading: 'しゅうまつはよやくがひつようです。',
            english: 'Reservations are required on weekends.',
          },
        ],
      },
      {
        word: '出発',
        reading: 'しゅっぱつ',
        romaji: 'shuppatsu',
        meaning: 'departure',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: '電車は何時に出発しますか？',
            reading: 'でんしゃはなんじにしゅっぱつしますか？',
            english: 'What time does the train depart?',
          },
          {
            japanese: '定刻通りに出発しました。',
            reading: 'ていこくどおりにしゅっぱつしました。',
            english: 'It departed on schedule.',
          },
          {
            japanese: 'もうすぐ出発の時間です。',
            reading: 'もうすぐしゅっぱつのじかんです。',
            english: "It's almost departure time.",
          },
        ],
      },
      {
        word: '案内',
        reading: 'あんない',
        romaji: 'annai',
        meaning: 'guidance / information',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: '駅員さんに道を案内してもらいました。',
            reading: 'えきいんさんにみちをあんないしてもらいました。',
            english: 'The station staff guided me with directions.',
          },
          {
            japanese: '館内を案内します。',
            reading: 'かんないをあんないします。',
            english: "I will guide you through the building.",
          },
          {
            japanese: '案内所は改札の隣です。',
            reading: 'あんないじょはかいさつのとなりです。',
            english: 'The information desk is next to the ticket gate.',
          },
        ],
      },
    ],
    N3: [
      {
        word: '手続き',
        reading: 'てつづき',
        romaji: 'tetsuzuki',
        meaning: 'procedure / formalities',
        partOfSpeech: 'noun',
        examples: [
          {
            japanese: '市役所で転入の手続きを行いました。',
            reading: 'しやくしょでてんにゅうのてつづきをおこないました。',
            english: 'I completed moving-in procedures at the city hall.',
          },
          {
            japanese: '面倒な手続きは不要です。',
            reading: 'めんどうなてつづきはふようです。',
            english: 'No troublesome procedures are required.',
          },
          {
            japanese: '手続きの期限を確認してください。',
            reading: 'てつづきのきげんをかくにんしてください。',
            english: 'Please verify the procedure deadline.',
          },
        ],
      },
    ],
    N2: [
      {
        word: '効率',
        reading: 'こうりつ',
        romaji: 'kouritsu',
        meaning: 'efficiency / performance',
        partOfSpeech: 'noun',
        examples: [
          {
            japanese: '業務の効率を高める工夫をしています。',
            reading: 'ぎょうむのこうりつをたかめるくふうをしています。',
            english: 'We are making efforts to improve work efficiency.',
          },
        ],
      },
    ],
    N1: [
      {
        word: '把握',
        reading: 'はあく',
        romaji: 'haaku',
        meaning: 'grasp / comprehension',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: '現状を正確に把握することが重要です。',
            reading: 'げんじょうをせいかくにはあくすることがじゅうようです。',
            english: 'Accurately grasping the current situation is essential.',
          },
        ],
      },
    ],
  };

  const vocab = mockVocab[level] || mockVocab.N5;

  const mockSentences: PassageSentence[] = [
    {
      id: 1,
      speaker: '店員 (Staff)',
      speakerId: 'A',
      japanese: 'いらっしゃいませ！ご注文はお決まりですか？',
      english: 'Welcome! Have you decided on your order?',
      tokens: [
        { surface: 'いらっしゃいませ', reading: '', isTarget: false },
        { surface: '！', reading: '', isTarget: false },
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
      speakerId: 'B',
      japanese: 'はい、店員さん、アイスラテを一つお願いします。',
      english: 'Yes, excuse me staff member, one iced latte please.',
      tokens: [
        { surface: 'はい', reading: '', isTarget: false },
        { surface: '、', reading: '', isTarget: false },
        { surface: '店員', reading: 'てんいん', isTarget: true },
        { surface: 'さん', reading: '', isTarget: false },
        { surface: '、', reading: '', isTarget: false },
        { surface: 'アイスラテ', reading: '', isTarget: false },
        { surface: 'を', reading: '', isTarget: false },
        { surface: '一', reading: 'ひと', isTarget: false },
        { surface: 'つ', reading: '', isTarget: false },
        { surface: 'お願い', reading: 'おねがい', isTarget: false },
        { surface: 'します', reading: '', isTarget: false },
        { surface: '。', reading: '', isTarget: false },
      ],
    },
    {
      id: 3,
      speaker: '店員 (Staff)',
      speakerId: 'A',
      japanese: 'かしこまりました。店内でお召し上がりですか、持ち帰りですか？',
      english: 'Certainly. Will that be for here, or takeout to go?',
      tokens: [
        { surface: 'かしこまりました', reading: '', isTarget: false },
        { surface: '。', reading: '', isTarget: false },
        { surface: '店内', reading: 'てんない', isTarget: false },
        { surface: 'で', reading: '', isTarget: false },
        { surface: 'お', reading: '', isTarget: false },
        { surface: '召し上がり', reading: 'めしあがり', isTarget: false },
        { surface: 'ですか', reading: '', isTarget: false },
        { surface: '、', reading: '', isTarget: false },
        { surface: '持ち帰り', reading: 'もちかえり', isTarget: true },
        { surface: 'ですか', reading: '', isTarget: false },
        { surface: '？', reading: '', isTarget: false },
      ],
    },
    {
      id: 4,
      speaker: '客 (Customer)',
      speakerId: 'B',
      japanese: '持ち帰りでお願いします。',
      english: 'Takeout to go, please.',
      tokens: [
        { surface: '持ち帰り', reading: 'もちかえり', isTarget: true },
        { surface: 'で', reading: '', isTarget: false },
        { surface: 'お願い', reading: 'おねがい', isTarget: false },
        { surface: 'します', reading: '', isTarget: false },
        { surface: '。', reading: '', isTarget: false },
      ],
    },
  ];

  return {
    id: `mock-lesson-${level.toLowerCase()}-${Date.now()}`,
    createdAt: now,
    topic: chosenTopic,
    level: level,
    themeDescription: `A practical daily lesson on ${chosenTopic} tailored for JLPT ${level}.`,
    title: 'カフェでの注文 (Ordering at a Café)',
    titleTokens: [
      { surface: 'カフェ', reading: '', isTarget: false },
      { surface: 'での', reading: '', isTarget: false },
      { surface: '注文', reading: 'ちゅうもん', isTarget: true },
    ],
    targetVocabulary: vocab,
    sentences: mockSentences,
    isStarred: false,
  };
}

export const geminiService = {
  generateLesson,
  generateDailyLesson: (
    topic: string,
    level: JLPTLevel,
    apiKey?: string,
    customInstruction?: string,
    excludeWords?: string[]
  ) => generateLesson({ topic, level, apiKey, customInstruction, excludeWords }),
  generateTargetVocabulary,
  generatePassageForVocabulary,
  generatePracticePassage,
  importWordList,
  parseRawWordList,
  buildWordImportPrompt,
  buildWordImportSchema,
  buildPassagePrompt,
  buildPassageSchema,
  buildPracticePassagePrompt,
  buildPracticePassageSchema,
  parseAndValidatePassageResponse,
  formatInventory,
  buildConstraintPromptSection,
  levelGuidelines,
  validateApiKey,
  buildPrompt,
  getMockLesson,
};

