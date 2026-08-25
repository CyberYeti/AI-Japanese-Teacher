import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { FuriganaText, FuriganaMode } from '../components/FuriganaText';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { audioProvider, storageService } from '../services';

type Props = NativeStackScreenProps<RootStackParamList, 'LessonStudy'>;

export const LessonStudyScreen: React.FC<Props> = ({ route, navigation }) => {
  const { lesson, initialScreen = 'vocab' } = route.params;

  const [activeTab, setActiveTab] = useState<'vocab' | 'dialogue'>(initialScreen);
  const [furiganaMode, setFuriganaMode] = useState<FuriganaMode>('all');
  const [showTranslations, setShowTranslations] = useState(true);
  const [isStarred, setIsStarred] = useState(lesson.isStarred ?? false);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(1);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);

  const sentences = lesson.passage?.sentences || lesson.sentences || [];
  const totalSentences = sentences.length;
  const topicEnglish = lesson.topicEnglish || lesson.topic || 'Daily Lesson';
  const topicJapanese = lesson.topicJapanese || lesson.title || '';

  useEffect(() => {
    // Load initial user settings for rate & furigana mode if available
    storageService.getUserSettings().then((settings) => {
      if (settings.ttsPlaybackRate) setSpeechRate(settings.ttsPlaybackRate);
      if (settings.furiganaMode) setFuriganaMode(settings.furiganaMode);
      if (typeof settings.englishSubtitles === 'boolean') {
        setShowTranslations(settings.englishSubtitles);
      }
    });

    return () => {
      audioProvider.stop();
    };
  }, []);

  const handleToggleStar = async () => {
    const nextState = !isStarred;
    setIsStarred(nextState);
    await storageService.toggleLessonStar(lesson.id);
  };

  const handlePlayWord = async (text: string) => {
    await audioProvider.playSentence(text, { rate: speechRate });
  };

  const handlePlaySentence = async (sentenceId: number, text: string) => {
    setActiveSentenceId(sentenceId);
    setCurrentSentenceIndex(sentenceId);
    setIsPlaying(true);
    await audioProvider.playSentence(text, {
      rate: speechRate,
      onFinished: () => {
        setIsPlaying(false);
        setActiveSentenceId(null);
      },
      onError: () => {
        setIsPlaying(false);
        setActiveSentenceId(null);
      },
    });
  };

  const handleToggleFullPlay = async () => {
    if (isPlaying) {
      await audioProvider.stop();
      setIsPlaying(false);
      setActiveSentenceId(null);
    } else {
      setIsPlaying(true);
      if (isLooping) {
        const sentence = sentences[currentSentenceIndex - 1] || sentences[0];
        if (sentence) {
          setActiveSentenceId(sentence.id);
          await audioProvider.playSentence(sentence.japanese, {
            rate: speechRate,
            onFinished: () => {
              // Re-play if still looping
              if (isLooping) {
                handlePlaySentence(sentence.id, sentence.japanese);
              }
            },
          });
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
    if (isPlaying) {
      // Restart with or without loop
      audioProvider.stop();
      setIsPlaying(false);
    }
  };

  const handleChangeRate = (rate: number) => {
    setSpeechRate(rate);
  };

  const levelColor = theme.colors.jlpt[lesson.level] || theme.colors.jlpt.N5;

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
              JLPT {lesson.level}
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
                  Master these {lesson.targetVocabulary.length} words with 3 example sentences each:
                </Text>
              </View>
              <View style={styles.wordCountBadge}>
                <Text style={styles.wordCountBadgeText}>
                  {lesson.targetVocabulary.length} Words
                </Text>
              </View>
            </View>

            {/* Target Vocabulary Cards */}
            <View style={styles.vocabList}>
              {lesson.targetVocabulary.map((item, index) => (
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
                            {lesson.level}
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

            {/* Dialogue Speech Bubbles */}
            <View style={styles.dialogueList}>
              {sentences.map((sent) => {
                const isCurrent = activeSentenceId === sent.id;
                const speaker = lesson.passage?.speakers?.find(
                  (s) => s.name === sent.speaker || s.id === sent.speaker
                );
                const speakerColorScheme = speaker?.colorScheme ?? {
                  badgeBg: 'rgba(59, 130, 246, 0.15)',
                  badgeText: '#60a5fa',
                  border: 'rgba(59, 130, 246, 0.3)',
                };

                return (
                  <View
                    key={`sentence-${sent.id}`}
                    style={[
                      styles.dialogueBubble,
                      isCurrent && styles.dialogueBubbleActive,
                    ]}
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

            {/* Back to Vocab Button */}
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
});
