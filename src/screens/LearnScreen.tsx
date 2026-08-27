import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { JLPTLevel, TargetWord, WordBankItem } from '../types/domain';
import { Ionicons } from '@expo/vector-icons';
import { geminiService, storageService } from '../services';

const SUGGESTED_TOPICS = [
  { topic: 'Ordering at a Café', ja: 'カフェでの注文', icon: 'cafe-outline' as const },
  { topic: 'Train & Subways', ja: '電車の乗り換え', icon: 'train-outline' as const },
  { topic: 'Convenience Store', ja: 'コンビニでの買い物', icon: 'cart-outline' as const },
  { topic: 'Asking Directions', ja: '道案内', icon: 'map-outline' as const },
  { topic: 'At the Izakaya', ja: '居酒屋で乾杯', icon: 'beer-outline' as const },
  { topic: 'Hotel Check-In', ja: 'ホテルのチェックイン', icon: 'business-outline' as const },
];

const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

interface LearnScreenProps {
  navigation?: any;
}

export const LearnScreen: React.FC<LearnScreenProps> = ({ navigation }) => {
  const [activeMode, setActiveMode] = useState<'daily' | 'practice'>('daily');
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [customTopic, setCustomTopic] = useState('Ordering at a Café');
  const [activeTopic, setActiveTopic] = useState('Ordering at a Café');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Practice Passage State
  const [wordBankItems, setWordBankItems] = useState<WordBankItem[]>([]);
  const [practiceMode, setPracticeMode] = useState<'auto' | 'custom'>('auto');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [practiceTopic, setPracticeTopic] = useState('Natural Daily Conversation');

  const loadPreferencesAndWords = useCallback(async () => {
    try {
      const settings = await storageService.getUserSettings();
      if (settings.defaultJlptLevel) {
        setSelectedLevel(settings.defaultJlptLevel);
      }
      const key = await storageService.getApiKey();
      setHasApiKey(Boolean(key && key.trim().length > 0));

      const words = await storageService.getWordBank();
      setWordBankItems(words);
    } catch (err) {
      // use default
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferencesAndWords();
    }, [loadPreferencesAndWords])
  );

  const handleSelectTopic = (topic: string) => {
    setActiveTopic(topic);
    setCustomTopic(topic);
    setErrorMessage(null);
  };

  const toggleWordSelection = (id: string) => {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerateLesson = async () => {
    const topicToUse = customTopic.trim() || activeTopic.trim() || 'Daily Life in Japan';
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const apiKey = (await storageService.getApiKey()) || undefined;

      // Extract existing words to prevent repetitive vocabulary
      const existingWordBank = await storageService.getWordBank();
      const excludeWords = existingWordBank.slice(0, 100).map((w) => w.word);

      // Phase 1: Rapid target vocabulary generation
      const vocabResult = await geminiService.generateTargetVocabulary(
        topicToUse,
        selectedLevel,
        apiKey,
        undefined,
        excludeWords
      );

      const now = new Date().toISOString();
      const initialLesson = {
        id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: now,
        topic: vocabResult.topic,
        level: vocabResult.level,
        themeDescription: vocabResult.themeDescription,
        title: vocabResult.title,
        titleTokens: vocabResult.titleTokens,
        targetVocabulary: vocabResult.targetVocabulary,
        sentences: [],
        isStarred: false,
      };

      // Auto-save initial vocabulary and lesson to local storage & cumulative Word Bank
      await storageService.saveLesson(initialLesson);

      // Reload word bank items
      const updatedWords = await storageService.getWordBank();
      setWordBankItems(updatedWords);

      setIsGenerating(false);

      // Navigate to 2-screen lesson study with passage loading in background
      if (navigation) {
        navigation.navigate('LessonStudy', {
          lesson: initialLesson,
          initialScreen: 'vocab',
          isPassagePending: true,
        });
      }
    } catch (err: any) {
      setIsGenerating(false);
      setErrorMessage(
        err?.message ||
          'Failed to generate lesson. Please check your network connection or Gemini API key.'
      );
    }
  };

  const handleGeneratePracticePassage = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const apiKey = (await storageService.getApiKey()) || undefined;
      let candidateWords: TargetWord[] = [];

      if (practiceMode === 'custom' && selectedWordIds.size > 0) {
        candidateWords = wordBankItems
          .filter((w) => selectedWordIds.has(w.id))
          .map((w) => ({
            word: w.word,
            reading: w.reading,
            romaji: w.romaji,
            meaning: w.meaning,
            partOfSpeech: w.partOfSpeech,
            examples: w.examples,
          }));
      } else {
        const autoItems = await storageService.getWordsForPractice(8, selectedLevel);
        const fallbackItems = autoItems.length > 0 ? autoItems : wordBankItems.slice(0, 8);
        candidateWords = fallbackItems.map((w) => ({
          word: w.word,
          reading: w.reading,
          romaji: w.romaji,
          meaning: w.meaning,
          partOfSpeech: w.partOfSpeech,
          examples: w.examples,
        }));
      }

      if (candidateWords.length === 0) {
        setIsGenerating(false);
        setErrorMessage('No words found in your Word Bank for practice. Please add words first.');
        return;
      }

      const lesson = await geminiService.generatePracticePassage({
        words: candidateWords,
        level: selectedLevel,
        topic: practiceTopic.trim() || 'Word Bank Vocabulary Review',
        apiKey,
      });

      // Auto-save practice passage to lesson history
      await storageService.saveLesson(lesson);

      // Record practice usage on words
      await storageService.recordWordPractice(candidateWords.map((w) => w.word));

      setIsGenerating(false);

      if (navigation) {
        navigation.navigate('LessonStudy', {
          lesson,
          initialScreen: 'dialogue',
          isPracticePassage: true,
        });
      }
    } catch (err: any) {
      setIsGenerating(false);
      setErrorMessage(
        err?.message ||
          'Failed to generate practice passage. Please check your network connection or Gemini API key.'
      );
    }
  };

  const currentLevelColors = theme.colors.jlpt[selectedLevel] || theme.colors.jlpt.N5;

  return (
    <SafeAreaView style={styles.safeArea}>
      {isGenerating ? (
        <View style={styles.splashOverlay} testID="loading-splash-screen">
          <View style={styles.splashCard}>
            <View style={styles.splashIconBadge}>
              <Ionicons name="sparkles" size={32} color="#ffffff" />
            </View>
            <Text style={styles.splashJapaneseTitle}>日本語レッスン作成中</Text>
            <Text style={styles.splashTitle}>Generating Daily Lesson...</Text>
            <View style={styles.splashTopicRow}>
              <View
                style={[
                  styles.levelPill,
                  { backgroundColor: currentLevelColors.bg, borderColor: currentLevelColors.border },
                ]}
              >
                <Text style={[styles.levelPillText, { color: currentLevelColors.text }]}>
                  JLPT {selectedLevel}
                </Text>
              </View>
              <Text style={styles.splashTopicText} numberOfLines={1}>
                {customTopic.trim() || activeTopic.trim() || 'Daily Life in Japan'}
              </Text>
            </View>
            <View style={styles.splashLoadingBox}>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
              <Text style={styles.splashStatusText}>
                Curating target vocabulary & 3 context examples...
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>日</Text>
              </View>
              <View>
                <Text style={styles.title}>AI Japanese Teacher</Text>
                <Text style={styles.subtitle}>Daily Graded Immersion</Text>
              </View>
            </View>
            <View
              style={[
                styles.levelPill,
                {
                  backgroundColor: currentLevelColors.bg,
                  borderColor: currentLevelColors.border,
                },
              ]}
            >
              <Text style={[styles.levelPillText, { color: currentLevelColors.text }]}>
                JLPT {selectedLevel}
              </Text>
            </View>
          </View>

          {/* Dual Mode Selection Hub */}
          <View style={styles.hubContainer}>
            <TouchableOpacity
              style={[
                styles.hubCard,
                activeMode === 'daily' && styles.hubCardActive,
              ]}
              onPress={() => {
                setActiveMode('daily');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
              testID="mode-daily-lesson-btn"
            >
              <View style={styles.hubCardHeader}>
                <View style={[styles.hubIconBadge, { backgroundColor: 'rgba(225, 29, 72, 0.15)' }]}>
                  <Ionicons name="sparkles" size={20} color={theme.colors.brand.primary} />
                </View>
                {activeMode === 'daily' && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.hubTitle}>Daily Lesson</Text>
              <Text style={styles.hubSubtitle}>
                Curate 3–5 fresh target words & authentic dialogue
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.hubCard,
                activeMode === 'practice' && styles.hubCardActive,
              ]}
              onPress={() => {
                setActiveMode('practice');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
              testID="mode-practice-passage-btn"
            >
              <View style={styles.hubCardHeader}>
                <View style={[styles.hubIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="book-outline" size={20} color={theme.colors.ui.success} />
                </View>
                <View style={styles.wordBankCountBadge}>
                  <Text style={styles.wordBankCountText}>{wordBankItems.length} Words</Text>
                </View>
              </View>
              <Text style={styles.hubTitle}>Practice Passage</Text>
              <Text style={styles.hubSubtitle}>
                Practice reading & listening with your Word Bank
              </Text>
            </TouchableOpacity>
          </View>

          {/* API Key Missing Notice (Non-blocking helper) */}
          {hasApiKey === false && (
            <TouchableOpacity
              style={styles.keyNoticeBanner}
              onPress={() => navigation?.navigate('Settings')}
              activeOpacity={0.8}
            >
              <Ionicons name="key" size={16} color={theme.colors.ui.warning} />
              <Text style={styles.keyNoticeText}>
                Using demo offline fallback. Tap to configure your Gemini API Key in Settings →
              </Text>
            </TouchableOpacity>
          )}

          {/* JLPT Level Selector (Shared across modes) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proficiency Level</Text>
            <View style={styles.levelRow}>
              {JLPT_LEVELS.map((level) => {
                const isSelected = selectedLevel === level;
                const levelColors = theme.colors.jlpt[level];
                return (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setSelectedLevel(level)}
                    style={[
                      styles.levelButton,
                      isSelected && {
                        backgroundColor: levelColors.bg,
                        borderColor: levelColors.text,
                        borderWidth: 1.5,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.levelButtonText,
                        isSelected
                          ? { color: levelColors.text, fontWeight: '700' }
                          : { color: theme.colors.text.muted },
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {activeMode === 'daily' ? (
            /* Mode 1: Daily Lesson Form */
            <>
              {/* Topic Input Card */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lesson Topic</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color={theme.colors.brand.primary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter a topic (e.g. Booking a Ryokan)..."
                    placeholderTextColor={theme.colors.text.subtle}
                    value={customTopic}
                    onChangeText={(text) => {
                      setCustomTopic(text);
                      setActiveTopic(text);
                      setErrorMessage(null);
                    }}
                  />
                  {customTopic.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomTopic('')} style={styles.clearBtn}>
                      <Ionicons name="close-circle" size={18} color={theme.colors.text.subtle} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Suggested Topics Grid */}
              <View style={styles.section}>
                <Text style={styles.sectionSubtitle}>Suggested Daily Topics</Text>
                <View style={styles.topicsGrid}>
                  {SUGGESTED_TOPICS.map((item) => {
                    const isSelected = activeTopic === item.topic;
                    return (
                      <TouchableOpacity
                        key={item.topic}
                        onPress={() => handleSelectTopic(item.topic)}
                        style={[styles.topicCard, isSelected && styles.topicCardActive]}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={isSelected ? theme.colors.brand.primary : theme.colors.text.muted}
                          style={styles.topicIcon}
                        />
                        <View style={styles.topicTextContainer}>
                          <Text
                            style={[styles.topicTitle, isSelected && styles.topicTitleActive]}
                            numberOfLines={1}
                          >
                            {item.topic}
                          </Text>
                          <Text style={styles.topicJa}>{item.ja}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Inline Error Card with Retry Button */}
              {errorMessage && (
                <View style={styles.errorCard}>
                  <View style={styles.errorHeaderRow}>
                    <Ionicons name="alert-circle" size={20} color={theme.colors.ui.error} />
                    <Text style={styles.errorTitle}>Generation Failed</Text>
                  </View>
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleGenerateLesson}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.retryButtonText}>🔄 Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Daily Lesson Start Button */}
              <View style={styles.actionSection}>
                <TouchableOpacity
                  style={[styles.generateButton, isGenerating && styles.buttonDisabled]}
                  activeOpacity={0.8}
                  onPress={handleGenerateLesson}
                  disabled={isGenerating}
                  testID="generate-lesson-btn"
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons name="flash" size={20} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.generateButtonText}>Generate Daily Lesson</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.helperText}>
                  Generates 3–5 fresh target words with Furigana & dialogue
                </Text>
              </View>
            </>
          ) : (
            /* Mode 2: Word Bank Practice Passage */
            <>
              {wordBankItems.length === 0 ? (
                <View style={styles.emptyWordBankCard}>
                  <View style={styles.emptyWordBankIconBadge}>
                    <Ionicons name="book-outline" size={32} color={theme.colors.brand.primary} />
                  </View>
                  <Text style={styles.emptyWordBankTitle}>Word Bank is Empty</Text>
                  <Text style={styles.emptyWordBankSubtitle}>
                    Complete your first Daily Lesson or import words from Settings to generate immersion reading passages!
                  </Text>
                  <View style={styles.emptyActionsRow}>
                    <TouchableOpacity
                      style={styles.emptyActionButton}
                      onPress={() => setActiveMode('daily')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.emptyActionButtonText}>Start Daily Lesson</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {/* Practice Word Selection Strategy */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Word Selection</Text>
                    <View style={styles.practiceModeRow}>
                      <TouchableOpacity
                        style={[
                          styles.practiceModeBtn,
                          practiceMode === 'auto' && styles.practiceModeBtnActive,
                        ]}
                        onPress={() => setPracticeMode('auto')}
                        activeOpacity={0.7}
                        testID="practice-mode-auto"
                      >
                        <Ionicons
                          name="refresh-circle"
                          size={18}
                          color={practiceMode === 'auto' ? theme.colors.brand.primary : theme.colors.text.muted}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.practiceModeBtnText,
                            practiceMode === 'auto' && styles.practiceModeBtnTextActive,
                          ]}
                        >
                          Auto (Least Practiced)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.practiceModeBtn,
                          practiceMode === 'custom' && styles.practiceModeBtnActive,
                        ]}
                        onPress={() => setPracticeMode('custom')}
                        activeOpacity={0.7}
                        testID="practice-mode-custom"
                      >
                        <Ionicons
                          name="checkbox"
                          size={18}
                          color={practiceMode === 'custom' ? theme.colors.brand.primary : theme.colors.text.muted}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.practiceModeBtnText,
                            practiceMode === 'custom' && styles.practiceModeBtnTextActive,
                          ]}
                        >
                          Custom Select ({selectedWordIds.size})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {practiceMode === 'custom' && (
                      <View style={styles.customWordsContainer}>
                        <Text style={styles.customWordsInstruction}>
                          Tap words to include in your practice passage:
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.customWordsScroll}
                        >
                          {wordBankItems.map((item) => {
                            const isSelected = selectedWordIds.has(item.id);
                            return (
                              <TouchableOpacity
                                key={item.id}
                                onPress={() => toggleWordSelection(item.id)}
                                style={[
                                  styles.wordChip,
                                  isSelected && styles.wordChipSelected,
                                ]}
                                activeOpacity={0.7}
                                testID={`word-chip-${item.word}`}
                              >
                                <Text
                                  style={[
                                    styles.wordChipText,
                                    isSelected && styles.wordChipTextSelected,
                                  ]}
                                >
                                  {item.word}
                                </Text>
                                <Text
                                  style={[
                                    styles.wordChipReading,
                                    isSelected && styles.wordChipReadingSelected,
                                  ]}
                                >
                                  {item.reading}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Practice Topic / Context Input */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Scenario / Theme (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={18}
                        color={theme.colors.ui.success}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Natural Daily Conversation, At the Market..."
                        placeholderTextColor={theme.colors.text.subtle}
                        value={practiceTopic}
                        onChangeText={(text) => {
                          setPracticeTopic(text);
                          setErrorMessage(null);
                        }}
                      />
                    </View>
                  </View>

                  {/* Inline Error Card */}
                  {errorMessage && (
                    <View style={styles.errorCard}>
                      <View style={styles.errorHeaderRow}>
                        <Ionicons name="alert-circle" size={20} color={theme.colors.ui.error} />
                        <Text style={styles.errorTitle}>Generation Failed</Text>
                      </View>
                      <Text style={styles.errorMessage}>{errorMessage}</Text>
                    </View>
                  )}

                  {/* Practice Passage CTA Button */}
                  <View style={styles.actionSection}>
                    <TouchableOpacity
                      style={[
                        styles.generateButton,
                        { backgroundColor: theme.colors.ui.success },
                        isGenerating && styles.buttonDisabled,
                      ]}
                      activeOpacity={0.8}
                      onPress={handleGeneratePracticePassage}
                      disabled={isGenerating}
                      testID="generate-practice-btn"
                    >
                      <View style={styles.buttonContentRow}>
                        <Ionicons name="book" size={20} color="#ffffff" style={styles.buttonIcon} />
                        <Text style={styles.generateButtonText}>Generate Practice Passage</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.helperText}>
                      Creates an authentic reading dialogue with Furigana hidden by default
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.glow,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  title: {
    fontSize: theme.typography.sizes.subheading,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
  },
  levelPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
  },
  levelPillText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
  },
  keyNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.lg,
  },
  keyNoticeText: {
    flex: 1,
    fontSize: theme.typography.sizes.caption,
    color: '#fbbf24',
    lineHeight: 16,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.sm,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  levelButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelButtonText: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
    paddingVertical: theme.spacing.xs,
  },
  clearBtn: {
    padding: theme.spacing.xs,
  },
  topicsGrid: {
    gap: theme.spacing.sm,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  topicCardActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  topicIcon: {
    marginRight: theme.spacing.md,
  },
  topicTextContainer: {
    flex: 1,
  },
  topicTitle: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  topicTitleActive: {
    color: theme.colors.brand.light,
  },
  topicJa: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorTitle: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ui.error,
  },
  errorMessage: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  actionSection: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  generateButton: {
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    width: '100%',
    ...theme.shadows.glow,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  buttonIcon: {
    marginRight: theme.spacing.sm,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
  },
  helperText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.subtle,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  splashOverlay: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  splashCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    ...theme.shadows.glow,
  },
  splashIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.glow,
  },
  splashJapaneseTitle: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.brand.light,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  splashTitle: {
    fontSize: theme.typography.sizes.subheading,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  splashTopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    width: '100%',
    justifyContent: 'center',
  },
  splashTopicText: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.semibold,
    flexShrink: 1,
  },
  splashLoadingBox: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  splashStatusText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  hubContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  hubCard: {
    flex: 1,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.background.cardBorder,
  },
  hubCardActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.06)',
  },
  hubCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  hubIconBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: theme.colors.brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.round,
  },
  activePillText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
  },
  wordBankCountBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  wordBankCountText: {
    color: theme.colors.ui.success,
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
  },
  hubTitle: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  hubSubtitle: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.muted,
    lineHeight: 14,
  },
  emptyWordBankCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    marginVertical: theme.spacing.lg,
  },
  emptyWordBankIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyWordBankTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  emptyWordBankSubtitle: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  emptyActionsRow: {
    width: '100%',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
  },
  emptyActionButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
  },
  practiceModeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  practiceModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm + 2,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  practiceModeBtnActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  practiceModeBtnText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.muted,
  },
  practiceModeBtnTextActive: {
    color: theme.colors.brand.light,
    fontWeight: theme.typography.weights.bold,
  },
  customWordsContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  customWordsInstruction: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  customWordsScroll: {
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
  wordChip: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    alignItems: 'center',
  },
  wordChipSelected: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
  },
  wordChipText: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  wordChipTextSelected: {
    color: theme.colors.brand.light,
  },
  wordChipReading: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.muted,
    marginTop: 1,
  },
  wordChipReadingSelected: {
    color: theme.colors.text.secondary,
  },
});
