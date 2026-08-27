import {
  buildPrompt,
  buildResponseSchema,
  parseAndValidateLessonResponse,
  generateLesson,
  generateTargetVocabulary,
  generatePassageForVocabulary,
  validateApiKey,
  getMockLesson,
  geminiService,
  InvalidApiKeyError,
  RateLimitError,
  GeminiParseError,
  GeminiApiError,
} from '../src/services/geminiService';
import { JLPTLevel, DailyLesson } from '../src/types/domain';

describe('GeminiService', () => {
  describe('buildPrompt', () => {
    it('should generate a prompt containing the target JLPT level and topic', () => {
      const prompt = buildPrompt('N5', 'Ordering at a café');
      expect(prompt).toContain('JLPT N5');
      expect(prompt).toContain('Ordering at a café');
      expect(prompt).toContain('targetVocabulary');
      expect(prompt).toContain('tokens');
    });

    it('should include custom instructions when provided', () => {
      const prompt = buildPrompt('N3', 'Job Interview', 'Focus on polite keigo');
      expect(prompt).toContain('Focus on polite keigo');
      expect(prompt).toContain('JLPT N3');
    });

    it('should include excluded vocabulary negative constraint when excludeWords is provided', () => {
      const prompt = buildPrompt('N5', 'Daily Routine', undefined, ['食べる', '飲む', '行く']);
      expect(prompt).toContain('Do NOT use any of the following already-learned words');
      expect(prompt).toContain('食べる, 飲む, 行く');
    });
  });

  describe('buildResponseSchema', () => {
    it('should return a valid JSON schema with expected required fields', () => {
      const schema = buildResponseSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('OBJECT');
      expect(schema.properties).toHaveProperty('targetVocabulary');
      expect(schema.properties).toHaveProperty('sentences');
      expect(schema.properties).toHaveProperty('title');
    });
  });

  describe('parseAndValidateLessonResponse', () => {
    const validRawResponse = {
      topic: 'Ordering coffee',
      level: 'N5',
      themeDescription: 'A customer ordering coffee at a cafe',
      title: 'カフェで',
      titleTokens: [
        { surface: 'カフェ', reading: '', isTarget: false },
        { surface: 'で', reading: '', isTarget: false },
      ],
      targetVocabulary: [
        {
          word: '注文',
          reading: 'ちゅうもん',
          romaji: 'chuumon',
          meaning: 'an order',
          partOfSpeech: 'noun',
          examples: [
            {
              japanese: '注文をお願いします。',
              reading: 'ちゅうもんをおねがいします。',
              english: 'I would like to order, please.',
            },
          ],
        },
      ],
      sentences: [
        {
          id: 1,
          speaker: '店員',
          speakerId: 'A',
          japanese: 'いらっしゃいませ。ご注文は何にしますか？',
          english: 'Welcome. What would you like to order?',
          tokens: [
            { surface: 'いらっしゃいませ', reading: '', isTarget: false },
            { surface: '。', reading: '', isTarget: false },
            { surface: 'ご', reading: '', isTarget: false },
            { surface: '注文', reading: 'ちゅうもん', isTarget: true },
            { surface: 'は', reading: '', isTarget: false },
            { surface: '何', reading: 'なん', isTarget: false },
            { surface: 'に', reading: '', isTarget: false },
            { surface: 'しますか', reading: '', isTarget: false },
            { surface: '？', reading: '', isTarget: false },
          ],
        },
      ],
    };

    it('should parse and normalize a valid raw JSON object into a DailyLesson', () => {
      const lesson = parseAndValidateLessonResponse(validRawResponse, {
        topic: 'Ordering coffee',
        level: 'N5',
      });

      expect(lesson.id).toBeDefined();
      expect(lesson.createdAt).toBeDefined();
      expect(lesson.topic).toBe('Ordering coffee');
      expect(lesson.level).toBe('N5');
      expect(lesson.targetVocabulary).toHaveLength(1);
      expect(lesson.targetVocabulary[0].word).toBe('注文');
      expect(lesson.sentences).toHaveLength(1);
      expect(lesson.sentences[0].tokens).toHaveLength(9);
      expect(lesson.isStarred).toBe(false);
    });

    it('should parse raw JSON string with markdown code block formatting', () => {
      const rawWithFences = '```json\n' + JSON.stringify(validRawResponse) + '\n```';
      const lesson = parseAndValidateLessonResponse(rawWithFences, {
        topic: 'Ordering coffee',
        level: 'N5',
      });

      expect(lesson.title).toBe('カフェで');
      expect(lesson.targetVocabulary[0].word).toBe('注文');
    });

    it('should throw GeminiParseError if response is missing required sentences or targetVocabulary', () => {
      const invalidResponse = { topic: 'test' };
      expect(() => {
        parseAndValidateLessonResponse(invalidResponse, {
          topic: 'test',
          level: 'N5',
        });
      }).toThrow(GeminiParseError);
    });
  });

  describe('getMockLesson', () => {
    it('should generate a complete, valid DailyLesson without network calls', () => {
      const mock = getMockLesson('N5', 'Ordering at a café');
      expect(mock.level).toBe('N5');
      expect(mock.topic).toBe('Ordering at a café');
      expect(mock.targetVocabulary.length).toBeGreaterThanOrEqual(3);
      expect(mock.sentences.length).toBeGreaterThanOrEqual(3);
      expect(mock.sentences[0].tokens.length).toBeGreaterThan(0);
      expect(mock.sentences[0].tokens.some((t) => t.isTarget)).toBe(true);
    });

    it('should support all JLPT levels for mock generation', () => {
      const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
      for (const level of levels) {
        const mock = getMockLesson(level);
        expect(mock.level).toBe(level);
        expect(mock.targetVocabulary.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('validateApiKey', () => {
    it('should return false for empty or whitespace API keys', async () => {
      expect(await validateApiKey('')).toBe(false);
      expect(await validateApiKey('   ')).toBe(false);
    });

    it('should return true when API returns 200 OK', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [{ name: 'models/gemini-2.5-flash' }] }),
      } as any);

      const isValid = await validateApiKey('valid-api-key', mockFetch as any);
      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return false when API returns 400 or 403 status', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'API_KEY_INVALID' } }),
      } as any);

      const isValid = await validateApiKey('bad-key', mockFetch as any);
      expect(isValid).toBe(false);
    });

    it('should return false when fetch throws network error', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network offline'));
      const isValid = await validateApiKey('any-key', mockFetch as any);
      expect(isValid).toBe(false);
    });
  });

  describe('generateLesson', () => {
    it('should use getMockLesson when apiKey is not provided', async () => {
      const lesson = await generateLesson({
        level: 'N5',
        topic: 'Daily Routine',
      });

      expect(lesson).toBeDefined();
      expect(lesson.level).toBe('N5');
      expect(lesson.topic).toBe('Daily Routine');
    });

    it('should call Gemini API endpoint with structured output options when apiKey is provided', async () => {
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    topic: 'Train travel',
                    level: 'N5',
                    themeDescription: 'Buying train tickets',
                    title: '切符を買う',
                    titleTokens: [{ surface: '切符', reading: 'きっぷ', isTarget: false }],
                    targetVocabulary: [
                      {
                        word: '切符',
                        reading: 'きっぷ',
                        romaji: 'kippu',
                        meaning: 'ticket',
                        partOfSpeech: 'noun',
                        examples: [
                          {
                            japanese: '切符を一枚ください。',
                            reading: 'きっぷをいちまいください。',
                            english: 'One ticket please.',
                          },
                        ],
                      },
                    ],
                    sentences: [
                      {
                        id: 1,
                        japanese: '切符を買います。',
                        english: 'I buy a ticket.',
                        tokens: [
                          { surface: '切符', reading: 'きっぷ', isTarget: true },
                          { surface: 'を', reading: '', isTarget: false },
                          { surface: '買います', reading: 'かいます', isTarget: false },
                          { surface: '。', reading: '', isTarget: false },
                        ],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as any);

      const lesson = await generateLesson({
        apiKey: 'test-api-key',
        level: 'N5',
        topic: 'Train travel',
        fetchFn: mockFetch as any,
      });

      expect(lesson.title).toBe('切符を買う');
      expect(lesson.targetVocabulary[0].word).toBe('切符');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw InvalidApiKeyError on 400 with API key error', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'API_KEY_INVALID', status: 'INVALID_ARGUMENT' },
        }),
      } as any);

      await expect(
        generateLesson({
          apiKey: 'invalid-key',
          level: 'N5',
          topic: 'Cafe',
          fetchFn: mockFetch as any,
        })
      ).rejects.toThrow(InvalidApiKeyError);
    });

    it('should throw RateLimitError on 429 status', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'RESOURCE_EXHAUSTED' },
        }),
      } as any);

      await expect(
        generateLesson({
          apiKey: 'rate-limited-key',
          level: 'N5',
          topic: 'Cafe',
          fetchFn: mockFetch as any,
        })
      ).rejects.toThrow(RateLimitError);
    });
  });

  describe('Two-Phase Generation', () => {
    it('generateTargetVocabulary should return structured vocabulary and topic metadata (offline fallback)', async () => {
      const result = await geminiService.generateTargetVocabulary('Ordering at a Café', 'N5');
      expect(result).toBeDefined();
      expect(result.topic).toBe('Ordering at a Café');
      expect(result.level).toBe('N5');
      expect(result.targetVocabulary.length).toBeGreaterThan(0);
      expect(result.targetVocabulary[0].examples?.length).toBe(3);
    });

    it('generatePassageForVocabulary should return dialogue sentences embedding target words (offline fallback)', async () => {
      const vocab = (await geminiService.generateTargetVocabulary('Ordering at a Café', 'N5')).targetVocabulary;
      const passageResult = await geminiService.generatePassageForVocabulary(
        vocab,
        'Ordering at a Café',
        'N5'
      );
      expect(passageResult).toBeDefined();
      expect(passageResult.sentences.length).toBeGreaterThan(0);
      expect(passageResult.sentences[0].japanese).toBeTruthy();
      expect(passageResult.sentences[0].tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Word List Import (Batched LLM Enrichment)', () => {
    it('should split raw text into clean word tokens, enrich them, and report batch progress', async () => {
      const rawInput = ' 注文, 予約 \n 店員 、 会計　\n\n ';
      const progressTracker: { completed: number; total: number }[] = [];

      const result = await geminiService.importWordList(
        rawInput,
        'N5',
        undefined,
        (completed, total) => {
          progressTracker.push({ completed, total });
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(4);
      expect(result.map((w) => w.word)).toEqual(['注文', '予約', '店員', '会計']);
      expect(result[0].reading).toBeTruthy();
      expect(result[0].meaning).toBeTruthy();
      expect(result[0].examples?.length).toBeGreaterThan(0);
      expect(progressTracker.length).toBeGreaterThan(0);
      expect(progressTracker[progressTracker.length - 1].completed).toBe(4);
      expect(progressTracker[progressTracker.length - 1].total).toBe(4);
    });

    it('should return an empty array if raw input text contains no words', async () => {
      const result = await geminiService.importWordList('  , \n \t ', 'N5');
      expect(result).toEqual([]);
    });

    it('parseRawWordList should accurately extract Japanese words from formatted notes with brackets, romaji, and english', () => {
      const complexNotes = `
かいます 【買います】 (kaimasu) — To buy
たべます 【食べます】 (tabemasu) — To eat
1. のみます 【飲みます】 - to drink
4. 猫 (neko) : cat
いく / iku / to go
      `;

      const parsed = geminiService.parseRawWordList(complexNotes);
      expect(parsed).toEqual(['買います', '食べます', '飲みます', '猫', 'いく']);
    });

    it('parseRawWordList should parse clean comma- and whitespace-separated lists', () => {
      const input = '注文, 予約\n店員、会計';
      const parsed = geminiService.parseRawWordList(input);
      expect(parsed).toEqual(['注文', '予約', '店員', '会計']);
    });

    it('parseRawWordList should parse single-line comma-separated entries with English definitions', () => {
      const input = '食べる (to eat, consume), 飲む (to drink), 行く (to go)';
      const parsed = geminiService.parseRawWordList(input);
      expect(parsed).toEqual(['食べる', '飲む', '行く']);
    });

    it('parseRawWordList should parse inline numbered items on a single line', () => {
      const input = '1. 注文 2. 予約 3. 店員';
      const parsed = geminiService.parseRawWordList(input);
      expect(parsed).toEqual(['注文', '予約', '店員']);
    });

    it('parseRawWordList should parse comma lists with trailing category tags or notes', () => {
      const input = '注文, 予約, 店員 (N5 vocabulary)';
      const parsed = geminiService.parseRawWordList(input);
      expect(parsed).toEqual(['注文', '予約', '店員']);
    });

    it('importWordList should accept pre-parsed word arrays directly', async () => {
      const preParsedWords = ['注文', '予約'];
      const result = await geminiService.importWordList(preParsedWords, 'N5');
      expect(result.length).toBe(2);
      expect(result.map((w) => w.word)).toEqual(['注文', '予約']);
    });
  });

  describe('Practice Passage Generation', () => {
    const mockWords = [
      {
        word: '注文',
        reading: 'ちゅうもん',
        romaji: 'chuumon',
        meaning: 'order',
        partOfSpeech: 'noun',
        examples: [],
      },
      {
        word: '店員',
        reading: 'てんいん',
        romaji: 'ten-in',
        meaning: 'store clerk',
        partOfSpeech: 'noun',
        examples: [],
      },
    ];

    it('buildPracticePassagePrompt should construct a prompt with level and vocabulary', () => {
      const prompt = geminiService.buildPracticePassagePrompt(mockWords, 'N5', 'Word Bank Immersion');
      expect(prompt).toContain('JLPT N5');
      expect(prompt).toContain('注文');
      expect(prompt).toContain('店員');
    });

    it('generatePracticePassage should generate a dialogue from existing Word Bank words with API key', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'カフェで注文',
                      titleTokens: [{ surface: 'カフェで注文', reading: '', isTarget: false }],
                      sentences: [
                        {
                          id: 1,
                          speaker: '店員',
                          speakerId: 'A',
                          japanese: 'ご注文をどうぞ。',
                          english: 'Your order please.',
                          tokens: [
                            { surface: 'ご', reading: '', isTarget: false },
                            { surface: '注文', reading: 'ちゅうもん', isTarget: true },
                            { surface: 'をどうぞ。', reading: '', isTarget: false },
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const lesson = await geminiService.generatePracticePassage({
        words: mockWords,
        level: 'N5',
        topic: 'Word Bank Immersion',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as any,
      });

      expect(lesson).toBeDefined();
      expect(lesson.title).toBe('カフェで注文');
      expect(lesson.sentences.length).toBe(1);
    });

    it('generatePracticePassage should generate a dialogue from existing Word Bank words (offline fallback)', async () => {
      const lesson = await geminiService.generatePracticePassage({
        words: mockWords,
        level: 'N5',
        topic: 'Word Bank Immersion',
      });

      expect(lesson).toBeDefined();
      expect(lesson.id).toMatch(/^practice-n5-/);
      expect(lesson.topic).toBe('Word Bank Immersion');
      expect(lesson.targetVocabulary).toEqual(mockWords);
      expect(lesson.sentences.length).toBeGreaterThan(0);
      expect(lesson.sentences[0].japanese).toBeTruthy();
    });
  });
});
