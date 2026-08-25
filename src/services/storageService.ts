/**
 * AI Japanese Teacher - Local Storage Service
 * Manages user preferences, Gemini API key, cumulative permanent Word Bank,
 * and FIFO 25-lesson history with Starred pinning using AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DailyLesson,
  JLPTLevel,
  TargetWord,
  UserSettings,
  WordBankItem,
  WordExample,
} from '../types/domain';

export const STORAGE_KEYS = {
  SETTINGS: '@ai_japanese_teacher:settings',
  LESSONS: '@ai_japanese_teacher:lessons',
  WORD_BANK: '@ai_japanese_teacher:word_bank',
} as const;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  geminiApiKey: '',
  preferredTtsVoice: 'ja-JP-standard',
  ttsPlaybackRate: 1.0,
  defaultJlptLevel: 'N5',
  furiganaMode: 'all',
  englishSubtitles: true,
  historyMaxCapacity: 25,
};

export interface LessonFilterOptions {
  starredOnly?: boolean;
  level?: JLPTLevel;
  query?: string;
}

export interface WordBankFilterOptions {
  level?: JLPTLevel;
  query?: string;
}

export interface LessonContext {
  lessonId: string;
  lessonTopic: string;
  jlptLevel: JLPTLevel;
}

export interface StorageStats {
  lessonCount: number;
  starredCount: number;
  wordBankCount: number;
}

export class StorageService {
  // ==========================================
  // User Settings & API Key
  // ==========================================

  /**
   * Retrieves user settings, returning merged defaults if unset.
   */
  async getUserSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        return { ...DEFAULT_USER_SETTINGS };
      }
      const parsed = JSON.parse(data) as Partial<UserSettings>;
      return {
        ...DEFAULT_USER_SETTINGS,
        ...parsed,
      };
    } catch (error) {
      console.warn('StorageService.getUserSettings error:', error);
      return { ...DEFAULT_USER_SETTINGS };
    }
  }

  /**
   * Updates partial settings and saves to storage.
   */
  async saveUserSettings(partialSettings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getUserSettings();
    const updated: UserSettings = {
      ...current,
      ...partialSettings,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  /**
   * Convenience method to fetch the Gemini API key.
   */
  async getApiKey(): Promise<string> {
    const settings = await this.getUserSettings();
    return settings.geminiApiKey || '';
  }

  /**
   * Convenience method to update the Gemini API key.
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await this.saveUserSettings({ geminiApiKey: apiKey.trim() });
  }

  /**
   * Convenience method to clear the Gemini API key.
   */
  async clearApiKey(): Promise<void> {
    await this.saveUserSettings({ geminiApiKey: '' });
  }

  // ==========================================
  // Lesson History & FIFO Eviction
  // ==========================================

  /**
   * Retrieves lessons sorted newest first, with optional filters.
   */
  async getLessons(filter?: LessonFilterOptions): Promise<DailyLesson[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LESSONS);
      if (!data) return [];

      let lessons: DailyLesson[] = JSON.parse(data);

      // Sort newest first by createdAt
      lessons.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (filter) {
        if (filter.starredOnly) {
          lessons = lessons.filter((l) => l.isStarred);
        }
        if (filter.level) {
          lessons = lessons.filter((l) => l.level === filter.level);
        }
        if (filter.query && filter.query.trim()) {
          const q = filter.query.trim().toLowerCase();
          lessons = lessons.filter((l) => {
            const matchTopic = l.topic.toLowerCase().includes(q);
            const matchTitle = l.title.toLowerCase().includes(q);
            const matchVocab = l.targetVocabulary.some(
              (v) =>
                v.word.toLowerCase().includes(q) ||
                v.reading.toLowerCase().includes(q) ||
                v.romaji.toLowerCase().includes(q) ||
                v.meaning.toLowerCase().includes(q)
            );
            return matchTopic || matchTitle || matchVocab;
          });
        }
      }

      return lessons;
    } catch (error) {
      console.warn('StorageService.getLessons error:', error);
      return [];
    }
  }

  /**
   * Retrieves a single lesson by ID.
   */
  async getLessonById(id: string): Promise<DailyLesson | null> {
    const lessons = await this.getLessons();
    return lessons.find((l) => l.id === id) || null;
  }

  /**
   * Saves a lesson to history, auto-adds target vocabulary to the Word Bank,
   * and enforces FIFO capacity on un-starred lessons.
   */
  async saveLesson(lesson: DailyLesson): Promise<DailyLesson> {
    // 1. Auto-save target vocabulary into the permanent cumulative Word Bank
    if (lesson.targetVocabulary && lesson.targetVocabulary.length > 0) {
      await this.addWordsToWordBank(lesson.targetVocabulary, {
        lessonId: lesson.id,
        lessonTopic: lesson.topic,
        jlptLevel: lesson.level,
      });
    }

    // 2. Load all existing lessons
    const existingLessons = await this.getLessons();
    const settings = await this.getUserSettings();
    const maxCapacity = settings.historyMaxCapacity || DEFAULT_USER_SETTINGS.historyMaxCapacity;

    // Filter out existing version if updating
    const remainingLessons = existingLessons.filter((l) => l.id !== lesson.id);

    // Combine with new/updated lesson
    const allLessons = [lesson, ...remainingLessons];

    // 3. FIFO Eviction Logic:
    // Starred lessons are pinned permanently and bypass FIFO capacity limit.
    // Un-starred lessons are trimmed to keep at most `maxCapacity` un-starred lessons.
    const starredLessons = allLessons.filter((l) => l.isStarred);
    const unstarredLessons = allLessons.filter((l) => !l.isStarred);

    // Sort un-starred by createdAt descending (newest first)
    unstarredLessons.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Keep only newest up to maxCapacity
    const trimmedUnstarred = unstarredLessons.slice(0, maxCapacity);

    // Merge starred and trimmed un-starred, and sort newest first
    const finalLessons = [...starredLessons, ...trimmedUnstarred].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    await AsyncStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(finalLessons));
    return lesson;
  }

  /**
   * Toggles the starred status of a lesson.
   */
  async toggleLessonStar(id: string): Promise<DailyLesson | null> {
    const lessons = await this.getLessons();
    const targetIndex = lessons.findIndex((l) => l.id === id);
    if (targetIndex === -1) return null;

    lessons[targetIndex].isStarred = !lessons[targetIndex].isStarred;
    await AsyncStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
    return lessons[targetIndex];
  }

  /**
   * Deletes an individual lesson by ID.
   */
  async deleteLesson(id: string): Promise<void> {
    const lessons = await this.getLessons();
    const filtered = lessons.filter((l) => l.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(filtered));
  }

  // ==========================================
  // Cumulative Permanent Word Bank
  // ==========================================

  /**
   * Retrieves all words in the Word Bank, sorted newest first, with optional filters.
   */
  async getWordBank(filter?: WordBankFilterOptions): Promise<WordBankItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORD_BANK);
      if (!data) return [];

      let words: WordBankItem[] = JSON.parse(data);

      // Sort by firstEncounteredAt descending
      words.sort(
        (a, b) =>
          new Date(b.firstEncounteredAt).getTime() - new Date(a.firstEncounteredAt).getTime()
      );

      if (filter) {
        if (filter.level) {
          words = words.filter((w) => w.jlptLevel === filter.level);
        }
        if (filter.query && filter.query.trim()) {
          const q = filter.query.trim().toLowerCase();
          words = words.filter(
            (w) =>
              w.word.toLowerCase().includes(q) ||
              w.reading.toLowerCase().includes(q) ||
              w.romaji.toLowerCase().includes(q) ||
              w.meaning.toLowerCase().includes(q)
          );
        }
      }

      return words;
    } catch (error) {
      console.warn('StorageService.getWordBank error:', error);
      return [];
    }
  }

  /**
   * Retrieves a single word bank item by word text or ID.
   */
  async getWordBankItem(wordOrId: string): Promise<WordBankItem | null> {
    const words = await this.getWordBank();
    return (
      words.find(
        (w) => w.id === wordOrId || w.word === wordOrId || w.word.toLowerCase() === wordOrId.toLowerCase()
      ) || null
    );
  }

  /**
   * Adds target words to the cumulative Word Bank, merging new example sentences and deduplicating by word.
   */
  async addWordsToWordBank(
    words: TargetWord[],
    context: LessonContext
  ): Promise<WordBankItem[]> {
    const currentWords = await this.getWordBank();
    const wordMap = new Map<string, WordBankItem>();

    // Index existing words
    for (const item of currentWords) {
      wordMap.set(item.word, item);
    }

    const now = new Date().toISOString();

    for (const target of words) {
      const existing = wordMap.get(target.word);
      const incomingExamples: WordExample[] = target.examples || [];

      if (existing) {
        // Merge examples without duplicates (deduplicated by japanese sentence text)
        const existingExamples = existing.examples || [];
        const mergedExamples = [...existingExamples];

        for (const ex of incomingExamples) {
          if (!mergedExamples.some((m) => m.japanese === ex.japanese)) {
            mergedExamples.push(ex);
          }
        }

        wordMap.set(target.word, {
          ...existing,
          reading: target.reading || existing.reading,
          romaji: target.romaji || existing.romaji,
          meaning: target.meaning || existing.meaning,
          partOfSpeech: target.partOfSpeech || existing.partOfSpeech,
          examples: mergedExamples,
        });
      } else {
        // Create new item
        const newItem: WordBankItem = {
          id: `word_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          word: target.word,
          reading: target.reading,
          romaji: target.romaji,
          meaning: target.meaning,
          partOfSpeech: target.partOfSpeech,
          jlptLevel: context.jlptLevel,
          firstEncounteredAt: now,
          sourceLessonId: context.lessonId,
          sourceLessonTopic: context.lessonTopic,
          examples: incomingExamples,
        };
        wordMap.set(target.word, newItem);
      }
    }

    const updatedWords = Array.from(wordMap.values()).sort(
      (a, b) =>
        new Date(b.firstEncounteredAt).getTime() - new Date(a.firstEncounteredAt).getTime()
    );

    await AsyncStorage.setItem(STORAGE_KEYS.WORD_BANK, JSON.stringify(updatedWords));
    return updatedWords;
  }

  /**
   * Deletes an individual word from the Word Bank.
   */
  async deleteWordBankItem(id: string): Promise<void> {
    const words = await this.getWordBank();
    const filtered = words.filter((w) => w.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.WORD_BANK, JSON.stringify(filtered));
  }

  /**
   * Clears all items in the Word Bank.
   */
  async clearWordBank(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.WORD_BANK);
  }

  // ==========================================
  // Storage Stats & Data Reset
  // ==========================================

  /**
   * Returns storage statistics for dashboard / settings screen.
   */
  async getStorageStats(): Promise<StorageStats> {
    const lessons = await this.getLessons();
    const wordBank = await this.getWordBank();
    const starredCount = lessons.filter((l) => l.isStarred).length;

    return {
      lessonCount: lessons.length,
      starredCount,
      wordBankCount: wordBank.length,
    };
  }

  /**
   * Clears all application data from AsyncStorage.
   */
  async clearAllData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.LESSONS,
      STORAGE_KEYS.WORD_BANK,
    ]);
  }
}

export const storageService = new StorageService();
