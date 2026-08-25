import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { JLPTLevel } from '../types/domain';
import { Ionicons } from '@expo/vector-icons';
import { storageService, geminiService } from '../services';

const SPEEDS = [0.75, 1.0, 1.25];
const FURIGANA_MODES = [
  { id: 'all' as const, label: 'All Words', desc: 'Furigana over all Kanji' },
  { id: 'target-only' as const, label: 'Target Only', desc: 'Only daily vocab words' },
  { id: 'hidden' as const, label: 'Hidden', desc: 'Tap to reveal' },
];

export const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState<number>(1.0);
  const [defaultLevel, setDefaultLevel] = useState<JLPTLevel>('N5');
  const [furiganaMode, setFuriganaMode] = useState<'all' | 'target-only' | 'hidden'>('all');
  const [englishSubtitles, setEnglishSubtitles] = useState(true);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [storageStats, setStorageStats] = useState({
    lessonCount: 0,
    starredCount: 0,
    wordBankCount: 0,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const key = await storageService.getApiKey();
        if (key) setApiKey(key);

        const settings = await storageService.getUserSettings();
        if (settings.ttsPlaybackRate) setSelectedSpeed(settings.ttsPlaybackRate);
        if (settings.defaultJlptLevel) setDefaultLevel(settings.defaultJlptLevel);
        if (settings.furiganaMode) setFuriganaMode(settings.furiganaMode);
        if (typeof settings.englishSubtitles === 'boolean') {
          setEnglishSubtitles(settings.englishSubtitles);
        }

        const stats = await storageService.getStorageStats();
        setStorageStats(stats);
      } catch (err) {
        // fallback
      }
    };
    loadSettings();
  }, []);

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Missing Key', 'Please enter a Gemini API key first.');
      return;
    }
    setIsTestingKey(true);
    try {
      const isValid = await geminiService.validateApiKey(apiKey.trim());
      setIsTestingKey(false);
      if (isValid) {
        setKeyStatus('valid');
        await storageService.saveApiKey(apiKey.trim());
        Alert.alert('Connection Successful', 'Gemini API key verified successfully!');
      } else {
        setKeyStatus('invalid');
        Alert.alert('Connection Failed', 'The provided Gemini API key could not be verified.');
      }
    } catch {
      setIsTestingKey(false);
      setKeyStatus('invalid');
      Alert.alert('Error', 'Failed to test Gemini API connection.');
    }
  };

  const handleSaveLevel = async (level: JLPTLevel) => {
    setDefaultLevel(level);
    await storageService.saveUserSettings({ defaultJlptLevel: level });
  };

  const handleSaveSpeed = async (speed: number) => {
    setSelectedSpeed(speed);
    await storageService.saveUserSettings({ ttsPlaybackRate: speed });
  };

  const handleSaveFurigana = async (mode: 'all' | 'target-only' | 'hidden') => {
    setFuriganaMode(mode);
    await storageService.saveUserSettings({ furiganaMode: mode });
  };

  const handleSaveSubtitles = async (val: boolean) => {
    setEnglishSubtitles(val);
    await storageService.saveUserSettings({ englishSubtitles: val });
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Un-Starred Lessons?',
      'This will remove all non-starred lessons from local cache. Word Bank and starred lessons will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const lessons = await storageService.getLessons();
            for (const l of lessons) {
              if (!l.isStarred) {
                await storageService.deleteLesson(l.id);
              }
            }
            const stats = await storageService.getStorageStats();
            setStorageStats(stats);
            Alert.alert('Cleared', 'Un-starred lesson cache cleared.');
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Reset All Application Data?',
      'This will permanently delete all lessons, Word Bank words, and preferences. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearAllData();
            setApiKey('');
            setKeyStatus('idle');
            setStorageStats({ lessonCount: 0, starredCount: 0, wordBankCount: 0 });
            Alert.alert('Reset Complete', 'All local data has been reset.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>AI engine, voice preferences & local storage</Text>
        </View>

        {/* Gemini API Key Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="key-outline" size={20} color={theme.colors.brand.primary} />
            <Text style={styles.cardTitle}>Google Gemini API Key</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Your API key is stored securely on your device and used directly for lesson generation.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="AIzaSy..."
              placeholderTextColor={theme.colors.text.subtle}
              value={apiKey}
              onChangeText={(val) => {
                setApiKey(val);
                setKeyStatus('idle');
              }}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowKey(!showKey)} style={styles.eyeBtn}>
              <Ionicons
                name={showKey ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.text.subtle}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.keyActionsRow}>
            <TouchableOpacity
              style={[styles.testButton, isTestingKey && styles.buttonDisabled]}
              onPress={handleTestKey}
              disabled={isTestingKey}
              activeOpacity={0.7}
            >
              <Ionicons
                name={keyStatus === 'valid' ? 'checkmark-circle' : 'flash-outline'}
                size={16}
                color={keyStatus === 'valid' ? theme.colors.ui.success : '#ffffff'}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.testButtonText}>
                {isTestingKey ? 'Verifying...' : keyStatus === 'valid' ? 'Key Verified' : 'Test Connection'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Japanese TTS Audio Settings */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="volume-high-outline" size={20} color={theme.colors.brand.primary} />
            <Text style={styles.cardTitle}>Japanese Speech Synthesis</Text>
          </View>
          <Text style={styles.cardSubtitle}>Audio Engine: Native Device TTS (expo-speech)</Text>

          {/* Playback Rate */}
          <Text style={styles.settingLabel}>Default Playback Speed</Text>
          <View style={styles.speedRow}>
            {SPEEDS.map((speed) => {
              const isSelected = selectedSpeed === speed;
              return (
                <TouchableOpacity
                  key={speed}
                  onPress={() => handleSaveSpeed(speed)}
                  style={[styles.speedButton, isSelected && styles.speedButtonActive]}
                  activeOpacity={0.7}
                  testID={`settings-speed-${speed}`}
                >
                  <Text style={[styles.speedButtonText, isSelected && styles.speedButtonTextActive]}>
                    {speed === 1 ? '1.0' : speed}x{' '}
                    {speed === 0.75 ? '(Learner)' : speed === 1.0 ? '(Normal)' : '(Fast)'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Study Preferences */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="options-outline" size={20} color={theme.colors.brand.primary} />
            <Text style={styles.cardTitle}>Study Display Preferences</Text>
          </View>

          {/* Default JLPT Level */}
          <Text style={styles.settingLabel}>Default JLPT Level</Text>
          <View style={styles.levelRow}>
            {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((level) => {
              const isSelected = defaultLevel === level;
              const levelColor = theme.colors.jlpt[level];
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => handleSaveLevel(level)}
                  style={[
                    styles.levelPill,
                    isSelected && {
                      backgroundColor: levelColor.bg,
                      borderColor: levelColor.text,
                      borderWidth: 1.5,
                    },
                  ]}
                  activeOpacity={0.7}
                  testID={`settings-level-${level}`}
                >
                  <Text
                    style={[
                      styles.levelPillText,
                      isSelected ? { color: levelColor.text, fontWeight: '700' } : { color: theme.colors.text.muted },
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Furigana Display Mode */}
          <Text style={[styles.settingLabel, { marginTop: theme.spacing.lg }]}>Furigana (Ruby) Mode</Text>
          <View style={styles.furiganaGrid}>
            {FURIGANA_MODES.map((mode) => {
              const isSelected = furiganaMode === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  onPress={() => handleSaveFurigana(mode.id)}
                  style={[styles.modeCard, isSelected && styles.modeCardActive]}
                  activeOpacity={0.7}
                  testID={`settings-furigana-${mode.id}`}
                >
                  <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>
                    {mode.label}
                  </Text>
                  <Text style={styles.modeDesc}>{mode.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* English Subtitles Toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>English Translations</Text>
              <Text style={styles.toggleSubtitle}>Show English translation below Japanese sentences</Text>
            </View>
            <Switch
              value={englishSubtitles}
              onValueChange={handleSaveSubtitles}
              trackColor={{ false: theme.colors.background.secondary, true: theme.colors.brand.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Data & Storage Management */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="server-outline" size={20} color={theme.colors.brand.primary} />
            <Text style={styles.cardTitle}>Local Device Storage</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            FIFO Policy: Un-starred lessons auto-rotate after 25 lessons. Starred lessons and Word Bank are permanently preserved.
          </Text>

          {/* Storage Statistics Summary */}
          <View style={styles.statsBox}>
            <Ionicons name="pie-chart-outline" size={16} color={theme.colors.brand.light} />
            <Text style={styles.statsText}>
              {storageStats.lessonCount} Lessons ({storageStats.starredCount} ⭐ Starred) · {storageStats.wordBankCount} Word Bank Items
            </Text>
          </View>

          <View style={styles.storageActions}>
            <TouchableOpacity style={styles.dangerButton} onPress={handleClearCache} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color={theme.colors.ui.error} style={{ marginRight: 6 }} />
              <Text style={styles.dangerButtonText}>Clear Un-Starred Lesson Cache</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, { backgroundColor: 'rgba(239, 68, 68, 0.05)', marginTop: 8 }]}
              onPress={handleClearAllData}
              activeOpacity={0.7}
            >
              <Ionicons name="warning-outline" size={16} color={theme.colors.ui.error} style={{ marginRight: 6 }} />
              <Text style={styles.dangerButtonText}>Reset All Application Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About App */}
        <View style={styles.aboutFooter}>
          <Text style={styles.aboutText}>AI Japanese Teacher · Version 1.0.0</Text>
          <Text style={styles.aboutSubtext}>Powered by Google Gemini & React Native Expo</Text>
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
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  subtitle: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  card: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    marginBottom: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  cardSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
  },
  eyeBtn: {
    padding: theme.spacing.xs,
  },
  keyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
  },
  settingLabel: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  speedRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  speedButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    alignItems: 'center',
  },
  speedButtonActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
  },
  speedButtonText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  speedButtonTextActive: {
    color: theme.colors.brand.light,
    fontWeight: theme.typography.weights.bold,
  },
  levelRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    justifyContent: 'space-between',
  },
  levelPill: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    alignItems: 'center',
  },
  levelPillText: {
    fontSize: theme.typography.sizes.bodySm,
  },
  furiganaGrid: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  modeCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  modeCardActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
  },
  modeTitle: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  modeTitleActive: {
    color: theme.colors.brand.light,
  },
  modeDesc: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.subtle,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.4)',
  },
  toggleTitle: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  toggleSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  statsText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
  },
  storageActions: {
    gap: theme.spacing.xs,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  dangerButtonText: {
    color: theme.colors.ui.error,
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
  },
  aboutFooter: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  aboutText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.subtle,
  },
  aboutSubtext: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.subtle,
    marginTop: 2,
  },
});
