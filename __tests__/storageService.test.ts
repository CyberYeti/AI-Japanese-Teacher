import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storageService,
  DEFAULT_USER_SETTINGS,
  STORAGE_KEYS,
} from '../src/services/storageService';
import { DailyLesson, JLPTLevel, TargetWord, UserSettings, WordBankItem } from '../src/types/domain';

describe('StorageService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  const sampleLesson1: DailyLesson = {
    id: 'lesson-1',
    createdAt: '2026-08-25T10:00:00.000Z',
    topic: 'Ordering at a café',
    level: 'N5',
    themeDescription: 'Café conversation in Tokyo',
    title: 'カフェで注文する',
    titleTokens: [
      { surface: 'カフェ', reading: '', isTarget: false },
      { surface: 'で', reading: '', isTarget: false },
      { surface: '注文', reading: 'ちゅうもん', isTarget: true },
      { surface: 'する', reading: '', isTarget: false },
    ],
    targetVocabulary: [
      {
        word: '注文',
        reading: 'ちゅうもん',
        romaji: 'chuumon',
        meaning: 'order (for goods/food)',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: 'ご注文はお決まりですか？',
            reading: 'ごちゅうもんはおきまりですか？',
            english: 'Are you ready to order?',
          },
        ],
      },
      {
        word: '店員',
        reading: 'てんいん',
        romaji: 'ten-in',
        meaning: 'clerk / store staff',
        partOfSpeech: 'noun',
        examples: [
          {
            japanese: '店員を呼ぶ。',
            reading: 'てんいんをよぶ。',
            english: 'Call the clerk.',
          },
        ],
      },
    ],
    sentences: [
      {
        id: 1,
        speaker: '店員',
        speakerId: 'A',
        japanese: 'いらっしゃいませ！ご注文はお決まりですか？',
        english: 'Welcome! Are you ready to order?',
        tokens: [],
      },
    ],
    isStarred: false,
  };

  const sampleLesson2: DailyLesson = {
    id: 'lesson-2',
    createdAt: '2026-08-25T11:00:00.000Z',
    topic: 'Asking for train directions',
    level: 'N4',
    themeDescription: 'Train travel in Shinjuku',
    title: '駅で道を尋ねる',
    titleTokens: [],
    targetVocabulary: [
      {
        word: '切符',
        reading: 'きっぷ',
        romaji: 'kippu',
        meaning: 'ticket',
        partOfSpeech: 'noun',
        examples: [
          {
            japanese: '切符を買います。',
            reading: 'きっぷをかいます。',
            english: 'I buy a ticket.',
          },
        ],
      },
    ],
    sentences: [],
    isStarred: true,
  };

  describe('User Settings & API Key', () => {
    it('returns default settings when none are stored', async () => {
      const settings = await storageService.getUserSettings();
      expect(settings).toEqual(DEFAULT_USER_SETTINGS);
      expect(settings.geminiApiKey).toBe('');
      expect(settings.defaultJlptLevel).toBe('N5');
      expect(settings.historyMaxCapacity).toBe(25);
      expect(settings.ttsPlaybackRate).toBe(1.0);
      expect(settings.vocabularyConstraint).toBe('strict');
    });

    it('persists partial setting updates and merges with existing', async () => {
      const updated = await storageService.saveUserSettings({
        defaultJlptLevel: 'N3',
        ttsPlaybackRate: 0.75,
        vocabularyConstraint: 'i_plus_one',
      });

      expect(updated.defaultJlptLevel).toBe('N3');
      expect(updated.ttsPlaybackRate).toBe(0.75);
      expect(updated.vocabularyConstraint).toBe('i_plus_one');
      expect(updated.preferredTtsVoice).toBe(DEFAULT_USER_SETTINGS.preferredTtsVoice);

      const retrieved = await storageService.getUserSettings();
      expect(retrieved.defaultJlptLevel).toBe('N3');
      expect(retrieved.ttsPlaybackRate).toBe(0.75);
      expect(retrieved.vocabularyConstraint).toBe('i_plus_one');
    });

    it('manages Gemini API key directly', async () => {
      expect(await storageService.getApiKey()).toBe('');

      await storageService.saveApiKey('AIzaSyTestApiKey123');
      expect(await storageService.getApiKey()).toBe('AIzaSyTestApiKey123');

      const settings = await storageService.getUserSettings();
      expect(settings.geminiApiKey).toBe('AIzaSyTestApiKey123');

      await storageService.clearApiKey();
      expect(await storageService.getApiKey()).toBe('');
    });
  });

  describe('Cumulative Word Bank', () => {
    it('automatically adds target vocabulary to word bank when saving a lesson', async () => {
      await storageService.saveLesson(sampleLesson1);

      const words = await storageService.getWordBank();
      expect(words).toHaveLength(2);
      expect(words.map((w) => w.word)).toContain('注文');
      expect(words.map((w) => w.word)).toContain('店員');

      const chuumon = words.find((w) => w.word === '注文');
      expect(chuumon?.reading).toBe('ちゅうもん');
      expect(chuumon?.meaning).toBe('order (for goods/food)');
      expect(chuumon?.jlptLevel).toBe('N5');
      expect(chuumon?.sourceLessonId).toBe('lesson-1');
      expect(chuumon?.examples).toHaveLength(1);
    });

    it('deduplicates words in word bank and merges new example sentences', async () => {
      await storageService.saveLesson(sampleLesson1);

      const duplicateLesson: DailyLesson = {
        ...sampleLesson1,
        id: 'lesson-dup',
        createdAt: '2026-08-25T12:00:00.000Z',
        targetVocabulary: [
          {
            word: '注文',
            reading: 'ちゅうもん',
            romaji: 'chuumon',
            meaning: 'order (for goods/food)',
            partOfSpeech: 'noun / suru-verb',
            examples: [
              {
                japanese: 'ご注文はお決まりですか？', // Duplicate example
                reading: 'ごちゅうもんはおきまりですか？',
                english: 'Are you ready to order?',
              },
              {
                japanese: 'ネットで注文しました。', // New example
                reading: 'ネットでちゅうもんしました。',
                english: 'I ordered it online.',
              },
            ],
          },
        ],
      };

      await storageService.saveLesson(duplicateLesson);

      const words = await storageService.getWordBank();
      const chuumonList = words.filter((w) => w.word === '注文');
      expect(chuumonList).toHaveLength(1);

      const chuumon = chuumonList[0];
      // Kept earliest encounter metadata
      expect(chuumon.sourceLessonId).toBe('lesson-1');
      // Merged example sentences without duplicates
      expect(chuumon.examples).toHaveLength(2);
      expect(chuumon.examples[1].japanese).toBe('ネットで注文しました。');
    });

    it('filters word bank by JLPT level and search query', async () => {
      await storageService.saveLesson(sampleLesson1); // N5: 注文, 店員
      await storageService.saveLesson(sampleLesson2); // N4: 切符

      const n4Words = await storageService.getWordBank({ level: 'N4' });
      expect(n4Words).toHaveLength(1);
      expect(n4Words[0].word).toBe('切符');

      const searchQuery = await storageService.getWordBank({ query: 'clerk' });
      expect(searchQuery).toHaveLength(1);
      expect(searchQuery[0].word).toBe('店員');

      const searchRomaji = await storageService.getWordBank({ query: 'kippu' });
      expect(searchRomaji).toHaveLength(1);
      expect(searchRomaji[0].word).toBe('切符');
    });

    it('deletes an individual word from word bank and clears all words', async () => {
      await storageService.saveLesson(sampleLesson1);
      const initialWords = await storageService.getWordBank();
      const wordToDelete = initialWords[0];

      await storageService.deleteWordBankItem(wordToDelete.id);
      const remaining = await storageService.getWordBank();
      expect(remaining).toHaveLength(1);
      expect(remaining.find((w) => w.id === wordToDelete.id)).toBeUndefined();

      await storageService.clearWordBank();
      expect(await storageService.getWordBank()).toHaveLength(0);
    });
  });

  describe('Lesson History & FIFO Eviction with Starred Pinning', () => {
    it('saves lessons and retrieves them sorted newest first', async () => {
      await storageService.saveLesson(sampleLesson1);
      await storageService.saveLesson(sampleLesson2);

      const lessons = await storageService.getLessons();
      expect(lessons).toHaveLength(2);
      expect(lessons[0].id).toBe('lesson-2'); // Newer
      expect(lessons[1].id).toBe('lesson-1');
    });

    it('retrieves a single lesson by ID', async () => {
      await storageService.saveLesson(sampleLesson1);
      const found = await storageService.getLessonById('lesson-1');
      expect(found).not.toBeNull();
      expect(found?.topic).toBe('Ordering at a café');

      const notFound = await storageService.getLessonById('non-existent');
      expect(notFound).toBeNull();
    });

    it('filters lessons by starred status, level, and query', async () => {
      await storageService.saveLesson(sampleLesson1); // N5, unstarred
      await storageService.saveLesson(sampleLesson2); // N4, starred

      const starred = await storageService.getLessons({ starredOnly: true });
      expect(starred).toHaveLength(1);
      expect(starred[0].id).toBe('lesson-2');

      const n5Lessons = await storageService.getLessons({ level: 'N5' });
      expect(n5Lessons).toHaveLength(1);
      expect(n5Lessons[0].id).toBe('lesson-1');

      const searched = await storageService.getLessons({ query: 'café' });
      expect(searched).toHaveLength(1);
      expect(searched[0].id).toBe('lesson-1');
    });

    it('toggles star status of a lesson', async () => {
      await storageService.saveLesson(sampleLesson1); // initial isStarred: false
      expect((await storageService.getLessonById('lesson-1'))?.isStarred).toBe(false);

      const starred = await storageService.toggleLessonStar('lesson-1');
      expect(starred?.isStarred).toBe(true);
      expect((await storageService.getLessonById('lesson-1'))?.isStarred).toBe(true);

      const unstarred = await storageService.toggleLessonStar('lesson-1');
      expect(unstarred?.isStarred).toBe(false);
      expect((await storageService.getLessonById('lesson-1'))?.isStarred).toBe(false);
    });

    it('deletes a lesson by ID', async () => {
      await storageService.saveLesson(sampleLesson1);
      await storageService.saveLesson(sampleLesson2);

      await storageService.deleteLesson('lesson-1');
      const lessons = await storageService.getLessons();
      expect(lessons).toHaveLength(1);
      expect(lessons[0].id).toBe('lesson-2');
    });

    it('enforces FIFO eviction on un-starred lessons when capacity is exceeded while preserving starred lessons', async () => {
      // Set custom capacity of 3 for testing
      await storageService.saveUserSettings({ historyMaxCapacity: 3 });

      // Save 1 Starred lesson
      const starredLesson: DailyLesson = {
        ...sampleLesson1,
        id: 'lesson-starred-1',
        createdAt: '2026-08-25T01:00:00.000Z',
        isStarred: true,
      };
      await storageService.saveLesson(starredLesson);

      // Save 3 unstarred lessons (reaches capacity of 3 unstarred lessons)
      const u1: DailyLesson = {
        ...sampleLesson1,
        id: 'lesson-u1',
        createdAt: '2026-08-25T02:00:00.000Z',
        isStarred: false,
      };
      const u2: DailyLesson = {
        ...sampleLesson1,
        id: 'lesson-u2',
        createdAt: '2026-08-25T03:00:00.000Z',
        isStarred: false,
      };
      const u3: DailyLesson = {
        ...sampleLesson1,
        id: 'lesson-u3',
        createdAt: '2026-08-25T04:00:00.000Z',
        isStarred: false,
      };

      await storageService.saveLesson(u1);
      await storageService.saveLesson(u2);
      await storageService.saveLesson(u3);

      let lessons = await storageService.getLessons();
      // Total 4 lessons: 1 starred + 3 unstarred
      expect(lessons).toHaveLength(4);
      expect(lessons.map((l) => l.id)).toEqual(['lesson-u3', 'lesson-u2', 'lesson-u1', 'lesson-starred-1']);

      // Now save a 4th unstarred lesson - oldest unstarred ('lesson-u1') should be evicted!
      const u4: DailyLesson = {
        ...sampleLesson1,
        id: 'lesson-u4',
        createdAt: '2026-08-25T05:00:00.000Z',
        isStarred: false,
      };
      await storageService.saveLesson(u4);

      lessons = await storageService.getLessons();
      // Total 4: 1 starred + 3 unstarred (lesson-u1 was evicted, starred was pinned!)
      expect(lessons).toHaveLength(4);
      const ids = lessons.map((l) => l.id);
      expect(ids).toContain('lesson-starred-1'); // Pinned!
      expect(ids).toContain('lesson-u4');
      expect(ids).toContain('lesson-u3');
      expect(ids).toContain('lesson-u2');
      expect(ids).not.toContain('lesson-u1'); // Evicted!
    });
  });

  describe('Storage Stats & Clearing Data', () => {
    it('computes storage statistics correctly', async () => {
      await storageService.saveLesson(sampleLesson1); // 1 lesson, 0 starred, 2 words
      await storageService.saveLesson(sampleLesson2); // 1 lesson (starred), 1 word

      const stats = await storageService.getStorageStats();
      expect(stats.lessonCount).toBe(2);
      expect(stats.starredCount).toBe(1);
      expect(stats.wordBankCount).toBe(3);
    });

    it('clears all application storage data', async () => {
      await storageService.saveApiKey('test-key');
      await storageService.saveLesson(sampleLesson1);

      await storageService.clearAllData();

      const settings = await storageService.getUserSettings();
      expect(settings.geminiApiKey).toBe('');
      expect(await storageService.getLessons()).toHaveLength(0);
      expect(await storageService.getWordBank()).toHaveLength(0);
    });
  });

  describe('Word Bank Spaced Rotation & Practice Tracking', () => {
    it('saveWords saves vocabulary to Word Bank with custom source topic', async () => {
      await storageService.saveWords(
        [
          {
            word: '予約',
            reading: 'よやく',
            romaji: 'yoyaku',
            meaning: 'reservation',
            partOfSpeech: 'noun',
            examples: [],
          },
        ],
        'Imported Deck',
        'N5'
      );

      const items = await storageService.getWordBank();
      expect(items).toHaveLength(1);
      expect(items[0].word).toBe('予約');
      expect(items[0].sourceLessonTopic).toBe('Imported Deck');
      expect(items[0].jlptLevel).toBe('N5');
    });

    it('getWordsForPractice returns words prioritized by lowest practice count and oldest timestamps', async () => {
      await storageService.saveWords([
        { word: '単語A', reading: 'たんごA', romaji: 'tangoA', meaning: 'word A', partOfSpeech: 'noun' },
        { word: '単語B', reading: 'たんごB', romaji: 'tangoB', meaning: 'word B', partOfSpeech: 'noun' },
        { word: '単語C', reading: 'たんごC', romaji: 'tangoC', meaning: 'word C', partOfSpeech: 'noun' },
      ]);

      // Record practice on 単語A
      await storageService.recordWordPractice(['単語A']);

      const candidates = await storageService.getWordsForPractice(2);
      expect(candidates).toHaveLength(2);
      // 単語B and 単語C have practiceCount = 0 (or undefined), so they are prioritized over 単語A
      const candidateSurfaces = candidates.map((c) => c.word);
      expect(candidateSurfaces).toContain('単語B');
      expect(candidateSurfaces).toContain('単語C');
      expect(candidateSurfaces).not.toContain('単語A');
    });

    it('recordWordPractice increments practiceCount and updates lastPracticedAt', async () => {
      await storageService.saveWords([
        { word: '会計', reading: 'かいけい', romaji: 'kaikei', meaning: 'bill / check', partOfSpeech: 'noun' },
      ]);

      await storageService.recordWordPractice(['会計']);
      let item = await storageService.getWordBankItem('会計');
      expect(item?.practiceCount).toBe(1);
      expect(item?.lastPracticedAt).toBeTruthy();

      await storageService.recordWordPractice(['会計']);
      item = await storageService.getWordBankItem('会計');
      expect(item?.practiceCount).toBe(2);
    });
  });
});
