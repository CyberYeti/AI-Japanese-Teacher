import { DailyLesson, TargetWord, PassageSentence, SentenceToken } from '../src/types/domain';

describe('Domain Models and Schema Validation', () => {
  it('should correctly structure a DailyLesson object conforming to CONTEXT.md', () => {
    const targetVocab: TargetWord[] = [
      {
        word: '注文',
        reading: 'ちゅうもん',
        romaji: 'chuumon',
        meaning: 'an order (for food/goods)',
        partOfSpeech: 'noun / suru-verb',
        examples: [
          {
            japanese: '注文をお願いします。',
            reading: 'ちゅうもんをおねがいします。',
            english: "I'd like to order, please.",
          },
        ],
      },
      {
        word: 'おすすめ',
        reading: 'おすすめ',
        romaji: 'osusume',
        meaning: 'recommendation',
        partOfSpeech: 'noun',
      },
    ];

    const tokens: SentenceToken[] = [
      { surface: 'すみません', reading: '', isTarget: false },
      { surface: '、', reading: '', isTarget: false },
      { surface: '注文', reading: 'ちゅうもん', isTarget: true },
      { surface: 'をお', reading: '', isTarget: false },
      { surface: '願', reading: 'ねが', isTarget: false },
      { surface: 'いします。', reading: '', isTarget: false },
    ];

    const sentence: PassageSentence = {
      id: 1,
      speaker: '客 (Customer)',
      speakerId: 'A',
      japanese: 'すみません、注文をお願いします。',
      english: "Excuse me, I'd like to order please.",
      tokens,
    };

    const lesson: DailyLesson = {
      id: 'lesson-101',
      createdAt: new Date().toISOString(),
      topic: 'Ordering at a Café',
      level: 'N5',
      themeDescription: 'Essential phrases for ordering coffee and food at a Japanese café.',
      targetVocabulary: targetVocab,
      title: 'カフェでの注文',
      titleTokens: [
        { surface: 'カフェでの', reading: '', isTarget: false },
        { surface: '注文', reading: 'ちゅうもん', isTarget: true },
      ],
      sentences: [sentence],
      isStarred: false,
    };

    expect(lesson.id).toBe('lesson-101');
    expect(lesson.level).toBe('N5');
    expect(lesson.targetVocabulary.length).toBe(2);
    expect(lesson.sentences[0].tokens[2].isTarget).toBe(true);
    expect(lesson.sentences[0].tokens[2].reading).toBe('ちゅうもん');
  });

  it('should support novelWords and isNovel tokens for Comprehensible Input (i+1) mode', () => {
    const novelWord: TargetWord = {
      word: 'お会計',
      reading: 'おかいけい',
      romaji: 'okaikei',
      meaning: 'bill / check',
      partOfSpeech: 'noun',
    };

    const token: SentenceToken = {
      surface: 'お会計',
      reading: 'おかいけい',
      isTarget: false,
      isNovel: true,
    };

    const lesson: Partial<DailyLesson> = {
      novelWords: [novelWord],
    };

    expect(token.isNovel).toBe(true);
    expect(lesson.novelWords?.[0].word).toBe('お会計');
  });
});
