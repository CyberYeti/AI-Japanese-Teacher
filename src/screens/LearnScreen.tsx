import React, { useState, useEffect } from 'react';
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
import { JLPTLevel } from '../types/domain';
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
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [customTopic, setCustomTopic] = useState('Ordering at a Café');
  const [activeTopic, setActiveTopic] = useState('Ordering at a Café');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    // Load default JLPT level and check API key on screen mount
    const loadPreferences = async () => {
      try {
        const settings = await storageService.getUserSettings();
        if (settings.defaultJlptLevel) {
          setSelectedLevel(settings.defaultJlptLevel);
        }
        const key = await storageService.getApiKey();
        setHasApiKey(Boolean(key && key.trim().length > 0));
      } catch (err) {
        // use default
      }
    };
    loadPreferences();
  }, []);

  const handleSelectTopic = (topic: string) => {
    setActiveTopic(topic);
    setCustomTopic(topic);
    setErrorMessage(null);
  };

  const handleGenerateLesson = async () => {
    const topicToUse = customTopic.trim() || activeTopic.trim() || 'Daily Life in Japan';
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const apiKey = (await storageService.getApiKey()) || undefined;
      const lesson = await geminiService.generateDailyLesson(
        topicToUse,
        selectedLevel,
        apiKey
      );

      // Auto-save lesson to local storage & cumulative Word Bank
      await storageService.saveLesson(lesson);

      setIsGenerating(false);

      // Navigate to 2-screen lesson study
      if (navigation) {
        navigation.navigate('LessonStudy', { lesson });
      }
    } catch (err: any) {
      setIsGenerating(false);
      setErrorMessage(
        err?.message ||
          'Failed to generate lesson. Please check your network connection or Gemini API key.'
      );
    }
  };

  const currentLevelColors = theme.colors.jlpt[selectedLevel] || theme.colors.jlpt.N5;

  return (
    <SafeAreaView style={styles.safeArea}>
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

        {/* JLPT Level Selector */}
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

        {/* Suggested Topics Carousel/Grid */}
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

        {/* Start / Generate Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleGenerateLesson}
            disabled={isGenerating}
            testID="generate-lesson-btn"
          >
            {isGenerating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.generateButtonText}>
                  Generating {selectedLevel} Lesson...
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContentRow}>
                <Ionicons name="flash" size={20} color="#ffffff" style={styles.buttonIcon} />
                <Text style={styles.generateButtonText}>Generate Daily Lesson</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Generates 3–5 cohesive vocabulary words with Furigana & dialogue
          </Text>
        </View>
      </ScrollView>
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
});
