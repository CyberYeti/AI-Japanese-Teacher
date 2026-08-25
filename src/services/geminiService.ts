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
  TargetWord,
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
  fetchFn?: typeof fetch;
  model?: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Constructs the system and user prompt for structured lesson generation.
 */
export function buildPrompt(
  level: JLPTLevel,
  topic: string,
  customInstruction?: string
): string {
  const levelGuidelines: Record<JLPTLevel, string> = {
    N5: 'Absolute beginner: basic sentence patterns (です/ます, ~たい, ~てください), essential particles (は, が, を, に, で, と), basic greetings and everyday items.',
    N4: 'Elementary: te-form combinations (~ている, ~てから), conditionals (~たら, ~ば), potential form, basic transitivity, daily situations.',
    N3: 'Intermediate: natural spoken expressions, basic honorific/humble language (keigo), compound sentences, nuanced conjunctions, opinion expressions.',
    N2: 'Upper-intermediate: business and formal Japanese, abstract discussions, advanced grammar structures (~わけではない, ~にすぎない), varied registers.',
    N1: 'Advanced: sophisticated literary expressions, formal discourse, nuanced idioms, specialized terminology.',
  };

  return `You are a master Japanese language educator.
Generate a daily Japanese lesson tailored to the learner's specified JLPT level and topic.

Target Level: JLPT ${level} (${levelGuidelines[level]})
Topic: ${topic}
${customInstruction ? `Additional Instruction: ${customInstruction}` : ''}

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
    // Strip markdown code fences if returned
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
 * Generates a full DailyLesson using Gemini API or offline mock generator.
 */
export async function generateLesson(
  options: GenerateLessonOptions
): Promise<DailyLesson> {
  const {
    apiKey,
    level,
    topic,
    customInstruction,
    fetchFn = fetch,
    model = DEFAULT_MODEL,
  } = options;

  if (!apiKey || apiKey.trim() === '') {
    // Return offline mock lesson when no API key provided
    return getMockLesson(level, topic);
  }

  const promptText = buildPrompt(level, topic, customInstruction);
  const responseSchema = buildResponseSchema();

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(
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

    if (response.status === 400 || response.status === 403) {
      const msg = errorData?.error?.message || 'Invalid Gemini API key.';
      if (
        msg.includes('API_KEY_INVALID') ||
        msg.includes('API key') ||
        response.status === 403
      ) {
        throw new InvalidApiKeyError(msg);
      }
      throw new GeminiApiError(`Gemini API error (400): ${msg}`, 400, errorData);
    }

    if (response.status === 429) {
      throw new RateLimitError(
        errorData?.error?.message || 'Gemini API rate limit exceeded.'
      );
    }

    throw new GeminiApiError(
      `Gemini API request failed with status ${response.status}: ${
        errorData?.error?.message || response.statusText
      }`,
      response.status,
      errorData
    );
  }

  const jsonResponse: any = await response.json();
  const textContent =
    jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new GeminiParseError('Gemini API returned an empty response.', jsonResponse);
  }

  return parseAndValidateLessonResponse(textContent, { topic, level });
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
  generateDailyLesson: (topic: string, level: JLPTLevel, apiKey?: string) =>
    generateLesson({ topic, level, apiKey }),
  validateApiKey,
  buildPrompt,
  getMockLesson,
};

