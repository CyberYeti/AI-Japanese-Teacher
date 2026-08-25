import {
  buildPrompt,
  buildResponseSchema,
  parseAndValidateLessonResponse,
  generateLesson,
  validateApiKey,
  getMockLesson,
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
});
