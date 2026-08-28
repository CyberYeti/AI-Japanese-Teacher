import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { DailyLesson, FuriganaMode, SentenceToken, TargetWord } from '../types/domain';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { FuriganaText } from '../components/FuriganaText';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { WordTooltipModal } from '../components/WordTooltipModal';
import { audioProvider, storageService, geminiService } from '../services';

type Props = NativeStackScreenProps<RootStackParamList, 'LessonStudy'>;

export const LessonStudyScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    lesson: initialLesson,
    initialScreen = 'vocab',
    isPassagePending = false,
    isPracticePassage = false,
  } = route.params;

  const [currentLesson, setCurrentLesson] = useState<DailyLesson>(initialLesson);
  const [activeTab, setActiveTab] = useState<'vocab' | 'dialogue'>(initialScreen);
  const [furiganaMode, setFuriganaMode] = useState<FuriganaMode>(isPracticePassage ? 'hidden' : 'all');
  const [showTranslations, setShowTranslations] = useState(true);
  const [isStarred, setIsStarred] = useState(initialLesson.isStarred ?? false);

  // Word Tooltip state for highlighted words
  const [selectedWord, setSelectedWord] = useState<TargetWord | null>(null);
  const [selectedWordIsNovel, setSelectedWordIsNovel] = useState(false);
  const [savedNovelWords, setSavedNovelWords] = useState<Set<string>>(new Set());
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // Two-phase background passage generation state
  const [isPassageLoading, setIsPassageLoading] = useState<boolean>(
    Boolean(isPassagePending && (!initialLesson.sentences || initialLesson.sentences.length === 0))
  );
  const [passageError, setPassageError] = useState<string | null>(null);
  const [isCelebrationVisible, setIsCelebrationVisible] = useState(false);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(1);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);

  const sentences = currentLesson.passage?.sentences || currentLesson.sentences || [];
  const totalSentences = sentences.length;
  const topicEnglish = currentLesson.topicEnglish || currentLesson.topic || 'Daily Lesson';
  const topicJapanese = currentLesson.topicJapanese || currentLesson.title || '';

  const fetchPassage = async () => {
    setIsPassageLoading(true);
    setPassageError(null);
    try {
      const apiKey = (await storageService.getApiKey()) || undefined;

      // Sample review words from cumulative Word Bank to recycle older vocabulary
      const candidateReviewWords = await storageService.getWordsForPractice(4, currentLesson.level);
      const targetSurfaces = new Set((currentLesson.targetVocabulary || []).map((v) => v.word));
      const reviewWords: TargetWord[] = candidateReviewWords
        .filter((w) => !targetSurfaces.has(w.word))
        .map((w) => ({
          word: w.word,
          reading: w.reading,
          romaji: w.romaji,
          meaning: w.meaning,
          partOfSpeech: w.partOfSpeech,
          examples: w.examples,
        }));

      const userSettings = await storageService.getUserSettings();
      const allWordBank = await storageService.getWordBank();

      const passageResult = await geminiService.generatePassageForVocabulary(
        currentLesson.targetVocabulary,
        currentLesson.topic,
        currentLesson.level,
        apiKey,
        undefined,
        reviewWords,
        userSettings.vocabularyConstraint || 'strict',
        allWordBank
      );

      const updatedLesson: DailyLesson = {
        ...currentLesson,
        sentences: passageResult.sentences,
        novelWords: passageResult.novelWords,
        passage: {
          title: currentLesson.title,
          speakers: passageResult.speakers,
          sentences: passageResult.sentences,
          novelWords: passageResult.novelWords,
        },
      };

      setCurrentLesson(updatedLesson);
      await storageService.saveLesson(updatedLesson);
      setIsPassageLoading(false);
    } catch (err: any) {
      setIsPassageLoading(false);
      setPassageError(err?.message || 'Failed to generate dialogue passage.');
    }
  };

  useEffect(() => {
    // If passage is pending or sentences are empty, fetch in background
    if (isPassagePending && (!currentLesson.sentences || currentLesson.sentences.length === 0)) {
      fetchPassage();
    }
  }, []);

  useEffect(() => {
    // Load initial user settings for rate & furigana mode if available
    storageService.getUserSettings().then((settings) => {
      if (settings.ttsPlaybackRate) setSpeechRate(settings.ttsPlaybackRate);
      if (isPracticePassage) {
        setFuriganaMode('hidden');
      } else if (settings.furiganaMode) {
        setFuriganaMode(settings.furiganaMode);
      }
      if (typeof settings.englishSubtitles === 'boolean') {
        setShowTranslations(settings.englishSubtitles);
      }
    });

    storageService.getWordBank().then((bank) => {
      setSavedNovelWords(new Set(bank.map((w) => w.word)));
    });

    return () => {
      audioProvider.stop();
    };
  }, []);

  const handleToggleStar = async () => {
    const nextState = !isStarred;
    setIsStarred(nextState);
    await storageService.toggleLessonStar(currentLesson.id);
  };

  const handlePlayWord = async (text: string) => {
    await audioProvider.playSentence(text, { rate: speechRate });
  };

  const handleAddNovelWordToBank = async (word: TargetWord) => {
    await storageService.addWordsToWordBank([word], {
      lessonId: currentLesson.id,
      lessonTopic: currentLesson.topic,
      jlptLevel: currentLesson.level,
    });
    setSavedNovelWords((prev) => new Set([...prev, word.word]));
  };

  const handleTokenPress = async (token: SentenceToken) => {
    if (!token.isTarget && !token.isNovel) return;

    // Check novel words first if token is flagged as novel
    const novelWordsList = currentLesson.novelWords || currentLesson.passage?.novelWords || [];
    if (token.isNovel) {
      const novelMatch = novelWordsList.find(
        (v) =>
          v.word === token.surface ||
          (token.reading && v.reading === token.reading) ||
          token.surface.includes(v.word) ||
          v.word.includes(token.surface)
      );
      if (novelMatch) {
        setSelectedWord(novelMatch);
        setSelectedWordIsNovel(true);
        setIsTooltipVisible(true);
        return;
      }
    }

    // 1. Try finding in currentLesson.targetVocabulary
    const targetVocab = currentLesson.targetVocabulary || [];
    const directMatch = targetVocab.find(
      (v) => v.word === token.surface || (token.reading && v.reading === token.reading)
    );
    if (directMatch) {
      setSelectedWord(directMatch);
      setSelectedWordIsNovel(false);
      setIsTooltipVisible(true);
      return;
    }

    const partialMatch = targetVocab.find(
      (v) => token.surface.includes(v.word) || v.word.includes(token.surface)
    );
    if (partialMatch) {
      setSelectedWord(partialMatch);
      setSelectedWordIsNovel(false);
      setIsTooltipVisible(true);
      return;
    }

    // 2. Try finding in Word Bank (for practice passages or recycled review words)
    try {
      const wordBank = await storageService.getWordBank();
      const bankMatch = wordBank.find(
        (w) =>
          w.word === token.surface ||
          (token.reading && w.reading === token.reading) ||
          token.surface.includes(w.word) ||
          w.word.includes(token.surface)
      );
      if (bankMatch) {
        setSelectedWord({
          word: bankMatch.word,
          reading: bankMatch.reading,
          romaji: bankMatch.romaji,
          meaning: bankMatch.meaning,
          partOfSpeech: bankMatch.partOfSpeech,
          examples: bankMatch.examples,
        });
        setSelectedWordIsNovel(false);
        setIsTooltipVisible(true);
        return;
      }
    } catch {
      // ignore
    }

    // 3. Fallback construct from token info
    setSelectedWord({
      word: token.surface,
      reading: token.reading || token.surface,
      romaji: '',
      meaning: token.isNovel ? 'Novel vocabulary item' : 'Target vocabulary item',
      partOfSpeech: 'word',
    });
    setSelectedWordIsNovel(Boolean(token.isNovel));
    setIsTooltipVisible(true);
  };

  const isLoopingRef = useRef(isLooping);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isLoopingRef.current = isLooping;
    if (!isLooping && loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, [isLooping]);

  const handleCloseTooltip = () => {
    setIsTooltipVisible(false);
    setSelectedWord(null);
    setSelectedWordIsNovel(false);
  };

  const playSentenceInLoop = async (sentenceId: number, text: string) => {
    setActiveSentenceId(sentenceId);
    setCurrentSentenceIndex(sentenceId);
    setIsPlaying(true);
    await audioProvider.playSentence(text, {
      rate: speechRate,
      onFinished: () => {
        if (isLoopingRef.current) {
          if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
          loopTimerRef.current = setTimeout(() => {
            if (isLoopingRef.current) {
              playSentenceInLoop(sentenceId, text);
            } else {
              setIsPlaying(false);
              setActiveSentenceId(null);
            }
          }, 300);
        } else {
          setIsPlaying(false);
          setActiveSentenceId(null);
        }
      },
      onError: () => {
        setIsPlaying(false);
        setActiveSentenceId(null);
      },
    });
  };

  const handlePlaySentence = async (sentenceId: number, text: string) => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    await playSentenceInLoop(sentenceId, text);
  };

  const handleToggleFullPlay = async () => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }

    if (isPlaying) {
      await audioProvider.stop();
      setIsPlaying(false);
      setActiveSentenceId(null);
    } else {
      setIsPlaying(true);
      if (isLooping) {
        const sentence = sentences[currentSentenceIndex - 1] || sentences[0];
        if (sentence) {
          await playSentenceInLoop(sentence.id, sentence.japanese);
        }
      } else {
        const sentenceTexts = sentences.map((s) => s.japanese);
        await audioProvider.playPassage(sentenceTexts, 0, {
          rate: speechRate,
          onSentenceStart: (index: number) => {
            setCurrentSentenceIndex(index + 1);
            setActiveSentenceId(sentences[index]?.id ?? null);
          },
          onFinished: () => {
            setIsPlaying(false);
            setActiveSentenceId(null);
          },
          onError: () => {
            setIsPlaying(false);
            setActiveSentenceId(null);
          },
        });
      }
    }
  };

  const handleToggleLoop = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    isLoopingRef.current = nextLoop;
    if (!nextLoop && loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  };

  const handleChangeRate = (rate: number) => {
    setSpeechRate(rate);
  };

  const handleLessonComplete = async () => {
    setIsCelebrationVisible(true);
    // Force-save lesson state
    await storageService.saveLesson(currentLesson);
    // Record word practice frequency & recency
    const wordsPracticed = (currentLesson.targetVocabulary || []).map((w) => w.word);
    if (wordsPracticed.length > 0) {
      await storageService.recordWordPractice(wordsPracticed);
    }
    setTimeout(() => {
      if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
        navigation.goBack();
      } else if (navigation && typeof navigation.goBack === 'function') {
        navigation.goBack();
      } else if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('MainTabs', { screen: 'Learn' });
      }
    }, 800);
  };

  const levelColor = theme.colors.jlpt[currentLesson.level] || theme.colors.jlpt.N5;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background.primary} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="lesson-back-btn"
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {topicEnglish}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {topicJapanese}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View
            style={[
              styles.levelBadge,
              { backgroundColor: levelColor.bg, borderColor: levelColor.border },
            ]}
          >
            <Text style={[styles.levelBadgeText, { color: levelColor.text }]}>
              JLPT {currentLesson.level}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleStar}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="lesson-star-toggle-btn"
          >
            <Ionicons
              name={isStarred ? 'star' : 'star-outline'}
              size={22}
              color={isStarred ? theme.colors.ui.star : theme.colors.text.subtle}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Celebration Banner */}
      {isCelebrationVisible && (
        <View style={styles.celebrationBanner} testID="celebration-banner">
          <Ionicons name="trophy" size={24} color="#f59e0b" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.celebrationTitle}>🎉 Lesson Complete!</Text>
            <Text style={styles.celebrationSubtitle}>
              Progress and vocabulary saved to your Word Bank.
            </Text>
          </View>
        </View>
      )}

      {/* 2-Screen Study View Switch Tabs */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'vocab' && styles.tabButtonActive]}
            onPress={() => setActiveTab('vocab')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="book"
              size={15}
              color={activeTab === 'vocab' ? '#ffffff' : theme.colors.text.muted}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'vocab' && styles.tabButtonTextActive,
              ]}
            >
              Daily Target Words
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'dialogue' && styles.tabButtonActive]}
            onPress={() => setActiveTab('dialogue')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chatbubbles"
              size={15}
              color={activeTab === 'dialogue' ? '#ffffff' : theme.colors.text.muted}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'dialogue' && styles.tabButtonTextActive,
              ]}
            >
              Conversation Roleplay
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Settings Sub-bar */}
      <View style={styles.quickSettingsBar}>
        <View style={styles.quickSettingItem}>
          <Text style={styles.quickSettingLabel}>Furigana:</Text>
          <View style={styles.furiganaPills}>
            {(['all', 'target-only', 'hidden'] as FuriganaMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setFuriganaMode(mode)}
                style={[
                  styles.furiganaPill,
                  furiganaMode === mode && styles.furiganaPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.furiganaPillText,
                    furiganaMode === mode && styles.furiganaPillTextActive,
                  ]}
                >
                  {mode === 'all' ? 'All' : mode === 'target-only' ? 'Target' : 'Off'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.quickSettingItem}>
          <Text style={styles.quickSettingLabel}>English:</Text>
          <TouchableOpacity
            onPress={() => setShowTranslations(!showTranslations)}
            style={[
              styles.translationToggle,
              showTranslations && styles.translationToggleActive,
            ]}
          >
            <Text
              style={[
                styles.translationToggleText,
                showTranslations && styles.translationToggleTextActive,
              ]}
            >
              {showTranslations ? 'Visible' : 'Hidden'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'vocab' ? (
          /* ========================================================
             SCREEN 1: DAILY TARGET WORDS PRIMER
             ======================================================== */
          <View style={styles.screenSection}>
            <View style={styles.vocabHeader}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Daily Target Words</Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Master these {currentLesson.targetVocabulary.length} words with 3 example sentences each:
                </Text>
              </View>
              <View style={styles.wordCountBadge}>
                <Text style={styles.wordCountBadgeText}>
                  {currentLesson.targetVocabulary.length} Words
                </Text>
              </View>
            </View>

            {/* Target Vocabulary Cards */}
            <View style={styles.vocabList}>
              {currentLesson.targetVocabulary.map((item, index) => (
                <View key={`vocab-${index}`} style={styles.vocabCard}>
                  {/* Word Top Bar */}
                  <View style={styles.vocabCardTop}>
                    <View style={styles.vocabMainInfo}>
                      <View style={styles.vocabWordRow}>
                        <Text style={styles.vocabKanji}>{item.word}</Text>
                        <View
                          style={[
                            styles.vocabLevelPill,
                            { backgroundColor: levelColor.bg, borderColor: levelColor.border },
                          ]}
                        >
                          <Text style={[styles.vocabLevelPillText, { color: levelColor.text }]}>
                            {currentLesson.level}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.vocabReading}>
                        {item.reading} · {item.romaji}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.vocabAudioBtn}
                      onPress={() => handlePlayWord(item.word)}
                      activeOpacity={0.7}
                      testID={`play-vocab-${item.word}`}
                    >
                      <Ionicons name="volume-medium" size={18} color={theme.colors.brand.light} />
                    </TouchableOpacity>
                  </View>

                  {/* Meaning and Part of Speech */}
                  <View style={styles.vocabMeaningRow}>
                    <Text style={styles.vocabMeaning}>{item.meaning}</Text>
                    <Text style={styles.vocabPos}>{item.partOfSpeech}</Text>
                  </View>

                  {/* 3 Contextual Example Sentences */}
                  {item.examples && item.examples.length > 0 && (
                    <View style={styles.examplesContainer}>
                      <Text style={styles.examplesLabel}>Context Examples ({item.examples.length}):</Text>
                      {item.examples.map((ex, exIdx) => (
                        <View key={`ex-${exIdx}`} style={styles.exampleItem}>
                          <View style={styles.exampleHeaderRow}>
                            <Text style={styles.exampleNumber}>0{exIdx + 1}</Text>
                            <TouchableOpacity
                              onPress={() => handlePlayWord(ex.japanese)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={styles.exampleAudioBtn}
                            >
                              <Ionicons
                                name="volume-medium-outline"
                                size={14}
                                color={theme.colors.brand.light}
                              />
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.exampleJa}>{ex.japanese}</Text>
                          {showTranslations && (
                            <Text style={styles.exampleEn}>{ex.english}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Switch to Dialogue Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setActiveTab('dialogue')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>
                Practice Conversation Roleplay →
              </Text>
            </TouchableOpacity>

            {/* Lesson Complete Button on Vocab tab */}
            <TouchableOpacity
              style={styles.secondaryCompleteButton}
              onPress={handleLessonComplete}
              activeOpacity={0.8}
              testID="lesson-complete-vocab-btn"
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.brand.light} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryCompleteButtonText}>Mark Lesson Complete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ========================================================
             SCREEN 2: CONVERSATION ROLEPLAY
             ======================================================== */
          <View style={styles.screenSection}>
            {/* Passage Context Header */}
            <View style={styles.dialogueHeroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconBadge}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Conversation Roleplay</Text>
                  <Text style={styles.heroSubtitle}>{topicJapanese}</Text>
                </View>
              </View>
              <Text style={styles.heroDesc}>
                Tap any character speech bubble to hear pronunciation, or use the bottom audio bar for continuous listening:
              </Text>
            </View>

            {/* In-Flight Passage Generation State */}
            {isPassageLoading ? (
              <View style={styles.passageLoadingCard} testID="passage-loading-card">
                <ActivityIndicator size="large" color={theme.colors.brand.primary} />
                <Text style={styles.passageLoadingTitle}>Writing Conversation Dialogue...</Text>
                <Text style={styles.passageLoadingSubtext}>
                  Crafting authentic roleplay with your {currentLesson.targetVocabulary.length} target words
                </Text>
              </View>
            ) : passageError ? (
              <View style={styles.passageErrorCard} testID="passage-error-card">
                <Ionicons name="alert-circle" size={32} color={theme.colors.ui.error} />
                <Text style={styles.passageErrorTitle}>Dialogue Generation Failed</Text>
                <Text style={styles.passageErrorText}>{passageError}</Text>
                <TouchableOpacity
                  style={styles.retryPassageBtn}
                  onPress={fetchPassage}
                  testID="retry-passage-btn"
                >
                  <Text style={styles.retryPassageBtnText}>🔄 Retry Dialogue Generation</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Dialogue Speech Bubbles */
              <View style={styles.dialogueList}>
                {sentences.map((sent, index) => {
                  const isCurrent = activeSentenceId === sent.id;
                  const speakerIdUpper = (sent.speakerId || '').toUpperCase();
                  const speakerNameLower = (sent.speaker || '').toLowerCase();

                  let speakerColorScheme = theme.colors.speakers.speakerA;
                  if (speakerIdUpper === 'B' || speakerIdUpper === 'SPEAKERB') {
                    speakerColorScheme = theme.colors.speakers.speakerB;
                  } else if (
                    speakerIdUpper === 'NARRATOR' ||
                    speakerNameLower.includes('narrator') ||
                    speakerNameLower.includes('解説')
                  ) {
                    speakerColorScheme = theme.colors.speakers.narrator;
                  } else if (speakerIdUpper === 'A' || speakerIdUpper === 'SPEAKERA') {
                    speakerColorScheme = theme.colors.speakers.speakerA;
                  } else {
                    speakerColorScheme =
                      index % 2 === 0
                        ? theme.colors.speakers.speakerA
                        : theme.colors.speakers.speakerB;
                  }

                  return (
                    <View
                      key={`sentence-${sent.id}`}
                      style={[
                        styles.dialogueBubble,
                        {
                          backgroundColor: isCurrent
                            ? 'rgba(225, 29, 72, 0.12)'
                            : speakerColorScheme.bubbleBg,
                          borderColor: isCurrent
                            ? theme.colors.brand.primary
                            : speakerColorScheme.border,
                        },
                        isCurrent && styles.dialogueBubbleActive,
                      ]}
                      testID={`dialogue-bubble-${sent.id}`}
                    >
                      {/* Speaker Header */}
                      <View style={styles.bubbleHeader}>
                        <View
                          style={[
                            styles.speakerBadge,
                            {
                              backgroundColor: speakerColorScheme.badgeBg,
                              borderColor: speakerColorScheme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.speakerBadgeText,
                              { color: speakerColorScheme.badgeText },
                            ]}
                          >
                            {sent.speaker ?? 'Speaker'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.bubblePlayBtn,
                            isCurrent && styles.bubblePlayBtnActive,
                          ]}
                          onPress={() => handlePlaySentence(sent.id, sent.japanese)}
                          activeOpacity={0.7}
                          testID={`play-sentence-${sent.id}`}
                        >
                          <Ionicons
                            name={isCurrent ? 'volume-high' : 'volume-medium-outline'}
                            size={16}
                            color={isCurrent ? '#ffffff' : theme.colors.brand.light}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Japanese Sentence with Furigana */}
                      <View style={styles.sentenceTextContainer}>
                        {sent.tokens && sent.tokens.length > 0 ? (
                          <FuriganaText
                            tokens={sent.tokens}
                            mode={furiganaMode}
                            fontSize={17}
                            onPressToken={handleTokenPress}
                          />
                        ) : (
                          <Text style={styles.plainSentenceJa}>{sent.japanese}</Text>
                        )}
                      </View>

                      {/* English Translation */}
                      {showTranslations && (
                        <View style={styles.englishSubBox}>
                          <Text style={styles.englishSubText}>{sent.english}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* ✨ New Words in this Passage (i+1 Mode) Breakdown Card */}
            {((currentLesson.novelWords && currentLesson.novelWords.length > 0) ||
              (currentLesson.passage?.novelWords && currentLesson.passage.novelWords.length > 0)) && (
              <View style={styles.novelWordsCard} testID="novel-words-card">
                <View style={styles.novelWordsHeader}>
                  <View style={styles.novelWordsHeaderLeft}>
                    <Ionicons name="sparkles" size={18} color="#10B981" />
                    <Text style={styles.novelWordsTitle}>New Words in this Passage (i+1)</Text>
                  </View>
                  <Text style={styles.novelWordsSubtext}>
                    Introduced in context. Save to your Word Bank to practice in future sessions.
                  </Text>
                </View>

                <View style={styles.novelWordsList}>
                  {(currentLesson.novelWords || currentLesson.passage?.novelWords || []).map(
                    (novelWord, idx) => {
                      const isSaved = savedNovelWords.has(novelWord.word);
                      return (
                        <View
                          key={`novel-word-${idx}`}
                          style={styles.novelWordRow}
                          testID={`novel-word-item-${novelWord.word}`}
                        >
                          <View style={styles.novelWordInfo}>
                            <View style={styles.novelWordTopLine}>
                              <Text style={styles.novelWordSurface}>{novelWord.word}</Text>
                              {novelWord.reading && novelWord.reading !== novelWord.word ? (
                                <Text style={styles.novelWordReading}>
                                  【{novelWord.reading}】
                                </Text>
                              ) : null}
                              {novelWord.romaji ? (
                                <Text style={styles.novelWordRomaji}>{novelWord.romaji}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.novelWordMeaning}>{novelWord.meaning}</Text>
                          </View>

                          <View style={styles.novelWordActions}>
                            <TouchableOpacity
                              style={styles.novelWordPlayBtn}
                              onPress={() => handlePlayWord(novelWord.word)}
                              accessibilityLabel={`Listen to ${novelWord.word}`}
                              testID={`play-novel-word-${novelWord.word}`}
                            >
                              <Ionicons name="volume-medium" size={16} color="#10B981" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.novelWordAddBtn,
                                isSaved && styles.novelWordAddBtnSaved,
                              ]}
                              onPress={() => handleAddNovelWordToBank(novelWord)}
                              disabled={isSaved}
                              accessibilityLabel={
                                isSaved
                                  ? `Saved ${novelWord.word}`
                                  : `Add ${novelWord.word} to word bank`
                              }
                              testID={`add-novel-word-btn-${novelWord.word}`}
                            >
                              <Ionicons
                                name={isSaved ? 'checkmark-circle' : 'add'}
                                size={14}
                                color="#ffffff"
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.novelWordAddBtnText}>
                                {isSaved ? 'Saved' : 'Add to Bank'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            )}

            {/* Bottom Actions Section */}
            <View style={styles.bottomActionSection}>
              <TouchableOpacity
                style={styles.completeButton}
                onPress={handleLessonComplete}
                activeOpacity={0.8}
                testID="lesson-complete-btn"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.completeButtonText}>Lesson Complete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setActiveTab('vocab')}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>
                  ← Back to Daily Target Words
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Audio Player Bar */}
      <AudioPlayerBar
        isPlaying={isPlaying}
        currentSentenceIndex={currentSentenceIndex}
        totalSentences={totalSentences}
        speechRate={speechRate}
        isLooping={isLooping}
        onTogglePlay={handleToggleFullPlay}
        onChangeRate={handleChangeRate}
        onToggleLoop={handleToggleLoop}
        statusLabel={
          isPlaying
            ? isLooping
              ? `Looping Sentence ${currentSentenceIndex}`
              : `Playing Sentence ${currentSentenceIndex} of ${totalSentences}`
            : 'Tap Play to Listen'
        }
      />

      {/* Word Tooltip Modal for Highlighted Words */}
      <WordTooltipModal
        visible={isTooltipVisible}
        word={selectedWord}
        isNovel={selectedWordIsNovel}
        isSavedToWordBank={selectedWord ? savedNovelWords.has(selectedWord.word) : false}
        onAddToWordBank={selectedWordIsNovel ? handleAddNovelWordToBank : undefined}
        onClose={handleCloseTooltip}
        onPlayAudio={handlePlayWord}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.cardBorder,
    backgroundColor: theme.colors.background.secondary,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  levelBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  tabBarContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    backgroundColor: theme.colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.cardBorder,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.borderRadius.lg,
    padding: 3,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm - 1,
    borderRadius: theme.borderRadius.md,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.brand.primary,
    ...theme.shadows.subtle,
  },
  tabButtonText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.muted,
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: theme.typography.weights.bold,
  },
  quickSettingsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)',
  },
  quickSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickSettingLabel: {
    fontSize: theme.typography.sizes.micro + 1,
    color: theme.colors.text.subtle,
  },
  furiganaPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.borderRadius.sm,
    padding: 2,
  },
  furiganaPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  furiganaPillActive: {
    backgroundColor: theme.colors.brand.primary,
  },
  furiganaPillText: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  furiganaPillTextActive: {
    color: '#ffffff',
    fontWeight: theme.typography.weights.bold,
  },
  translationToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  translationToggleActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
  },
  translationToggleText: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  translationToggleTextActive: {
    color: theme.colors.brand.light,
    fontWeight: theme.typography.weights.bold,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: 24,
  },
  screenSection: {
    gap: theme.spacing.md,
  },
  vocabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  sectionHeaderTitle: {
    fontSize: theme.typography.sizes.subheading,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  sectionHeaderSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  wordCountBadge: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.3)',
  },
  wordCountBadgeText: {
    fontSize: theme.typography.sizes.micro + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.brand.light,
  },
  vocabList: {
    gap: theme.spacing.md,
  },
  vocabCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  vocabCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  vocabMainInfo: {
    flex: 1,
  },
  vocabWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  vocabKanji: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  vocabLevelPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  vocabLevelPillText: {
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
  },
  vocabReading: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.brand.light,
    marginTop: 2,
    fontWeight: theme.typography.weights.medium,
  },
  vocabAudioBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.round,
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.25)',
  },
  vocabMeaningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  vocabMeaning: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
    flex: 1,
  },
  vocabPos: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.subtle,
    fontStyle: 'italic',
  },
  examplesContainer: {
    marginTop: theme.spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  examplesLabel: {
    fontSize: theme.typography.sizes.micro + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleItem: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.brand.primary,
    paddingLeft: theme.spacing.sm,
    paddingVertical: 2,
  },
  exampleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  exampleNumber: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.subtle,
    fontWeight: theme.typography.weights.bold,
  },
  exampleAudioBtn: {
    padding: 2,
  },
  exampleJa: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  exampleEn: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.glow,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
  },
  dialogueHeroCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  heroIconBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  heroSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.brand.light,
  },
  heroDesc: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  dialogueList: {
    gap: theme.spacing.md,
  },
  dialogueBubble: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  dialogueBubbleActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    ...theme.shadows.glow,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  speakerBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  speakerBadgeText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  bubblePlayBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.round,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  bubblePlayBtnActive: {
    backgroundColor: theme.colors.brand.primary,
  },
  sentenceTextContainer: {
    marginVertical: theme.spacing.xs,
  },
  plainSentenceJa: {
    fontSize: theme.typography.sizes.bodyLg,
    color: theme.colors.text.primary,
    lineHeight: 24,
  },
  englishSubBox: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.3)',
  },
  englishSubText: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.muted,
  },
  secondaryButton: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    marginTop: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
  },
  celebrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: '#f59e0b',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  celebrationTitle: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.bold,
    color: '#fbbf24',
  },
  celebrationSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
  },
  passageLoadingCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    marginVertical: theme.spacing.md,
  },
  passageLoadingTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  passageLoadingSubtext: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  passageErrorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.md,
  },
  passageErrorTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ui.error,
  },
  passageErrorText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  retryPassageBtn: {
    backgroundColor: theme.colors.ui.error,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  retryPassageBtnText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  bottomActionSection: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.glow,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
  },
  secondaryCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginTop: theme.spacing.sm,
  },
  secondaryCompleteButtonText: {
    color: '#34d399',
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.bold,
  },
  novelWordsCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  novelWordsHeader: {
    gap: 4,
  },
  novelWordsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  novelWordsTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: '#10B981',
  },
  novelWordsSubtext: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    lineHeight: 16,
  },
  novelWordsList: {
    gap: theme.spacing.sm,
  },
  novelWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    gap: theme.spacing.sm,
  },
  novelWordInfo: {
    flex: 1,
    gap: 2,
  },
  novelWordTopLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  novelWordSurface: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  novelWordReading: {
    fontSize: theme.typography.sizes.caption,
    color: '#10B981',
    fontWeight: theme.typography.weights.medium,
  },
  novelWordRomaji: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
  },
  novelWordMeaning: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.secondary,
  },
  novelWordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  novelWordPlayBtn: {
    padding: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  novelWordAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  novelWordAddBtnSaved: {
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
  },
  novelWordAddBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
});
