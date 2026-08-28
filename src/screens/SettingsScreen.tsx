import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { JLPTLevel, VocabularyConstraintTier } from '../types/domain';
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
  const [vocabularyConstraint, setVocabularyConstraint] = useState<VocabularyConstraintTier>('strict');
  const [furiganaMode, setFuriganaMode] = useState<'all' | 'target-only' | 'hidden'>('all');
  const [englishSubtitles, setEnglishSubtitles] = useState(true);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [storageStats, setStorageStats] = useState({
    lessonCount: 0,
    starredCount: 0,
    wordBankCount: 0,
  });

  // Word List Import Modal State
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState<'input' | 'preview' | 'importing' | 'success'>('input');
  const [importText, setImportText] = useState('');
  const [parsedWords, setParsedWords] = useState<string[]>([]);
  const [importLevel, setImportLevel] = useState<JLPTLevel>('N5');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ completed: number; total: number } | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [importErrorMsg, setImportErrorMsg] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const key = await storageService.getApiKey();
      if (key) setApiKey(key);

      const settings = await storageService.getUserSettings();
      if (settings.ttsPlaybackRate) setSelectedSpeed(settings.ttsPlaybackRate);
      if (settings.defaultJlptLevel) setDefaultLevel(settings.defaultJlptLevel);
      if (settings.vocabularyConstraint) setVocabularyConstraint(settings.vocabularyConstraint);
      if (settings.furiganaMode) setFuriganaMode(settings.furiganaMode);
      if (typeof settings.englishSubtitles === 'boolean') {
        setEnglishSubtitles(settings.englishSubtitles);
      }

      const stats = await storageService.getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      // fallback
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

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

  const handleSaveConstraint = async (tier: VocabularyConstraintTier) => {
    setVocabularyConstraint(tier);
    await storageService.saveUserSettings({ vocabularyConstraint: tier });
  };

  const handleSaveSubtitles = async (val: boolean) => {
    setEnglishSubtitles(val);
    await storageService.saveUserSettings({ englishSubtitles: val });
  };

  const handlePreviewParsedWords = () => {
    if (!importText.trim()) {
      setImportErrorMsg('Please paste some Japanese vocabulary or Kanji to import.');
      return;
    }
    const words = geminiService.parseRawWordList(importText.trim());
    if (words.length === 0) {
      setImportErrorMsg('No valid Japanese words could be extracted. Please check your text.');
      return;
    }
    setParsedWords(words);
    setImportErrorMsg(null);
    setImportSuccessMsg(null);
    setImportStep('preview');
  };

  const handleRemoveParsedWord = (indexToRemove: number) => {
    setParsedWords((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleBackToInput = () => {
    setImportStep('input');
    setImportErrorMsg(null);
  };

  const handleConfirmImport = async () => {
    if (parsedWords.length === 0) {
      setImportErrorMsg('No words remaining to import. Please go back and add words.');
      return;
    }
    setImportStep('importing');
    setIsImporting(true);
    setImportErrorMsg(null);
    setImportSuccessMsg(null);
    setImportProgress(null);

    try {
      const enrichedWords = await geminiService.importWordList(
        parsedWords,
        importLevel,
        apiKey.trim() ? apiKey.trim() : undefined,
        (completed, total) => {
          setImportProgress({ completed, total });
        }
      );

      if (enrichedWords.length === 0) {
        setIsImporting(false);
        setImportStep('preview');
        setImportErrorMsg('No valid words could be enriched from the provided list.');
        return;
      }

      await storageService.saveWords(enrichedWords, 'Imported Word List', importLevel);
      const stats = await storageService.getStorageStats();
      setStorageStats(stats);

      setIsImporting(false);
      setImportStep('success');
      setImportSuccessMsg(`Successfully enriched and imported ${enrichedWords.length} words to your Word Bank!`);
    } catch (err: any) {
      setIsImporting(false);
      setImportStep('preview');
      setImportErrorMsg(err?.message || 'Failed to import and enrich vocabulary.');
    }
  };

  const handleCloseImportModal = () => {
    if (isImporting) return;
    setIsImportModalVisible(false);
    setImportStep('input');
    setImportText('');
    setParsedWords([]);
    setImportErrorMsg(null);
    setImportSuccessMsg(null);
    setImportProgress(null);
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

  const handleClearWordBank = () => {
    Alert.alert(
      'Clear Word Bank?',
      'This will remove all saved vocabulary and imported words from your Word Bank. Your lessons, API key, and settings will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Word Bank',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearWordBank();
            const stats = await storageService.getStorageStats();
            setStorageStats(stats);
            Alert.alert('Word Bank Cleared', 'All saved and imported words have been removed.');
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

        {/* Word List Import Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="download-outline" size={20} color={theme.colors.brand.primary} />
            <Text style={styles.cardTitle}>Word List Import</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Paste external vocabulary lists (Anki, Genki, JLPT decks) to automatically enrich and add words into your cumulative Word Bank.
          </Text>

          <TouchableOpacity
            style={styles.importLaunchButton}
            onPress={() => {
              setImportLevel(defaultLevel);
              setImportErrorMsg(null);
              setImportSuccessMsg(null);
              setIsImportModalVisible(true);
            }}
            activeOpacity={0.7}
            testID="open-import-modal-btn"
          >
            <Ionicons name="documents-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.importLaunchButtonText}>Import Word List</Text>
          </TouchableOpacity>
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

        {/* Passage Vocabulary Constraint Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.brand.primary} />
            <Text style={styles.cardTitle}>Passage Vocabulary Constraint</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Control whether AI passage generation strictly uses only your cumulative Word Bank or introduces new immersion vocabulary.
          </Text>

          <View style={styles.constraintList}>
            {[
              {
                id: 'strict' as const,
                title: 'Strict Closed Bank',
                tag: '0 Unknown Content Words',
                tagColor: '#3b82f6',
                desc: 'Guarantees passages use strictly words already in your Word Bank. Ideal for beginners focusing on pure sentence comprehension and recall.',
              },
              {
                id: 'i_plus_one' as const,
                title: 'Comprehensible Input (i+1)',
                tag: '1–2 Novel Words',
                tagColor: '#10b981',
                desc: 'Builds sentences from your known Word Bank while introducing 1–2 target novel words in context with instant 1-tap word bank acquisition.',
              },
              {
                id: 'natural' as const,
                title: 'Natural Graded Immersion',
                tag: 'Standard JLPT',
                tagColor: '#f59e0b',
                desc: 'Generates free-flowing authentic Japanese at your target JLPT level without restricting content words to your personal bank.',
              },
            ].map((item) => {
              const isSelected = vocabularyConstraint === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.constraintCard, isSelected && styles.constraintCardActive]}
                  onPress={() => handleSaveConstraint(item.id)}
                  activeOpacity={0.7}
                  testID={`settings-constraint-${item.id}`}
                >
                  <View style={styles.constraintTopRow}>
                    <View style={styles.constraintTitleGroup}>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? theme.colors.brand.primary : theme.colors.text.muted}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.constraintTitle, isSelected && styles.constraintTitleActive]}>
                        {item.title}
                      </Text>
                    </View>
                    <View style={[styles.constraintTag, { borderColor: item.tagColor }]}>
                      <Text style={[styles.constraintTagText, { color: item.tagColor }]}>
                        {item.tag}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.constraintDesc}>{item.desc}</Text>
                </TouchableOpacity>
              );
            })}
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
              style={[
                styles.dangerButton,
                { backgroundColor: 'rgba(239, 68, 68, 0.08)', marginTop: 8 },
              ]}
              onPress={handleClearWordBank}
              activeOpacity={0.7}
              testID="clear-word-bank-btn"
            >
              <Ionicons name="book-outline" size={16} color={theme.colors.ui.error} style={{ marginRight: 6 }} />
              <Text style={styles.dangerButtonText}>Clear Word Bank (Dev)</Text>
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
          <Text style={styles.aboutText}>AI Japanese Teacher · Version 0.1.0</Text>
          <Text style={styles.aboutSubtext}>Powered by Google Gemini & React Native Expo</Text>
        </View>
      </ScrollView>

      {/* Word List Import Modal */}
      <Modal
        visible={isImportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseImportModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdropDismiss} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={importStep === 'preview' ? 'list-outline' : 'download-outline'}
                    size={22}
                    color={theme.colors.brand.primary}
                  />
                  <Text style={styles.modalTitle}>
                    {importStep === 'input' && 'Import Word List'}
                    {importStep === 'preview' && 'Confirm Parsed Words'}
                    {importStep === 'importing' && 'Enriching Words...'}
                    {importStep === 'success' && 'Import Complete!'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseImportModal}
                  disabled={isImporting}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID="close-import-modal-btn"
                >
                  <Ionicons name="close" size={24} color={theme.colors.text.subtle} />
                </TouchableOpacity>
              </View>

              {/* STEP 1: INPUT */}
              {importStep === 'input' && (
                <>
                  <Text style={styles.modalSubtitle}>
                    Paste Japanese words, Kanji, or notes (e.g. from textbooks or Anki). The smart parser will extract the target words and enrich definitions, readings, and example sentences.
                  </Text>

                  {/* Target JLPT Level Selection */}
                  <Text style={styles.modalFieldLabel}>Target Level</Text>
                  <View style={styles.levelRow}>
                    {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((level) => {
                      const isSelected = importLevel === level;
                      const levelColor = theme.colors.jlpt[level];
                      return (
                        <TouchableOpacity
                          key={level}
                          onPress={() => setImportLevel(level)}
                          style={[
                            styles.levelPill,
                            isSelected && {
                              backgroundColor: levelColor.bg,
                              borderColor: levelColor.text,
                              borderWidth: 1.5,
                            },
                          ]}
                          activeOpacity={0.7}
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

                  {/* Input Text Area */}
                  <Text style={[styles.modalFieldLabel, { marginTop: theme.spacing.md }]}>Word List (Plain Text)</Text>
                  <TextInput
                    style={styles.modalTextArea}
                    placeholder="e.g.&#10;注文, 予約&#10;かいます 【買います】 (kaimasu) — To buy&#10;店員 : store clerk"
                    placeholderTextColor={theme.colors.text.subtle}
                    value={importText}
                    onChangeText={(text) => {
                      setImportText(text);
                      setImportErrorMsg(null);
                    }}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    testID="import-text-input"
                  />

                  {importErrorMsg && (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color={theme.colors.ui.error} />
                      <Text style={styles.errorBannerText}>{importErrorMsg}</Text>
                    </View>
                  )}

                  {/* Preview Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitImportButton,
                      !importText.trim() && styles.buttonDisabled,
                    ]}
                    onPress={handlePreviewParsedWords}
                    disabled={!importText.trim()}
                    activeOpacity={0.8}
                    testID="preview-import-btn"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.submitImportButtonText}>Preview Extracted Words</Text>
                      <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* STEP 2: PREVIEW & CONFIRMATION */}
              {importStep === 'preview' && (
                <>
                  <Text style={styles.modalSubtitle}>
                    Review the extracted words below before sending requests to the AI model. Tap × on any chip to remove unwanted terms.
                  </Text>

                  <View style={styles.previewStatsHeader}>
                    <View style={styles.previewCountBadge}>
                      <Text style={styles.previewCountBadgeText}>
                        {parsedWords.length} {parsedWords.length === 1 ? 'Word' : 'Words'} Extracted · JLPT {importLevel}
                      </Text>
                    </View>
                  </View>

                  {/* Parsed Words Chips Scroll Container */}
                  <ScrollView
                    style={styles.previewChipsScroll}
                    contentContainerStyle={styles.previewChipsContent}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    testID="preview-chips-scroll"
                  >
                    {parsedWords.length === 0 ? (
                      <Text style={styles.emptyParsedText}>No words remaining. Tap "Edit Text" to add words.</Text>
                    ) : (
                      parsedWords.map((word, idx) => (
                        <View key={`${word}-${idx}`} style={styles.previewWordChip} testID={`parsed-chip-${word}`}>
                          <Text style={styles.previewWordChipText}>{word}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveParsedWord(idx)}
                            style={styles.removeChipBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            testID={`remove-chip-${word}`}
                          >
                            <Ionicons name="close-circle" size={16} color={theme.colors.text.muted} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </ScrollView>

                  {importErrorMsg && (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color={theme.colors.ui.error} />
                      <Text style={styles.errorBannerText}>{importErrorMsg}</Text>
                    </View>
                  )}

                  {/* Action Buttons Row */}
                  <View style={styles.previewActionsRow}>
                    <TouchableOpacity
                      style={styles.backToInputBtn}
                      onPress={handleBackToInput}
                      activeOpacity={0.8}
                      testID="back-to-input-btn"
                    >
                      <Ionicons name="arrow-back" size={18} color={theme.colors.text.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.backToInputBtnText}>Edit Text</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.confirmImportBtn,
                        parsedWords.length === 0 && styles.buttonDisabled,
                      ]}
                      onPress={handleConfirmImport}
                      disabled={parsedWords.length === 0}
                      activeOpacity={0.8}
                      testID="submit-import-btn"
                    >
                      <Ionicons name="sparkles" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.submitImportButtonText}>
                        Enrich ({parsedWords.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* STEP 3: IMPORTING PROGRESS */}
              {importStep === 'importing' && (
                <View style={styles.importingStepBox}>
                  <ActivityIndicator size="large" color={theme.colors.brand.primary} style={{ marginBottom: theme.spacing.md }} />
                  <Text style={styles.importingStepTitle}>Enriching Vocabulary with AI</Text>
                  <Text style={styles.importingStepSubtitle}>
                    Generating readings, definitions, and 3 authentic example sentences for each word...
                  </Text>
                  {importProgress && (
                    <Text style={styles.importingProgressText}>
                      Completed {importProgress.completed} of {importProgress.total} words
                    </Text>
                  )}
                  {importProgress && importProgress.total > 0 && (
                    <View style={[styles.progressBarTrack, { width: '100%', marginTop: theme.spacing.md }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.round((importProgress.completed / importProgress.total) * 100)}%` },
                        ]}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* STEP 4: SUCCESS */}
              {importStep === 'success' && (
                <View style={styles.successStepBox}>
                  <View style={styles.successIconBadge}>
                    <Ionicons name="checkmark" size={32} color="#ffffff" />
                  </View>
                  <Text style={styles.successStepTitle}>Import Successful!</Text>
                  <Text style={styles.successStepSubtitle}>
                    {importSuccessMsg || `Successfully enriched and added ${parsedWords.length} words to your Word Bank.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={handleCloseImportModal}
                    activeOpacity={0.8}
                    testID="import-done-btn"
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  importLaunchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  importLaunchButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    maxHeight: '90%',
  },
  modalScrollContent: {
    paddingBottom: theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.heading,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  modalSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  modalFieldLabel: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  modalTextArea: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    padding: theme.spacing.md,
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
    minHeight: 120,
    marginBottom: theme.spacing.md,
  },
  progressContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  progressText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.brand.primary,
    borderRadius: 3,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
  },
  successBannerText: {
    color: theme.colors.ui.success,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
  },
  errorBannerText: {
    color: theme.colors.ui.error,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    flex: 1,
  },
  submitImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
  },
  submitImportButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
  },
  previewStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  previewCountBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: theme.borderRadius.round,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.md,
  },
  previewCountBadgeText: {
    color: theme.colors.brand.primary,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  previewChipsScroll: {
    maxHeight: 240,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    marginBottom: theme.spacing.lg,
  },
  previewChipsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  emptyParsedText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    textAlign: 'center',
    width: '100%',
    paddingVertical: theme.spacing.md,
  },
  previewWordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm + 2,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    gap: 6,
  },
  previewWordChipText: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  removeChipBtn: {
    padding: 2,
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  backToInputBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  backToInputBtnText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  confirmImportBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.glow,
  },
  importingStepBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  importingStepTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  importingStepSubtitle: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  importingProgressText: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.brand.light,
    marginTop: theme.spacing.xs,
  },
  successStepBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.ui.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  successStepTitle: {
    fontSize: theme.typography.sizes.heading,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  successStepSubtitle: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  doneButton: {
    backgroundColor: theme.colors.ui.success,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
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
  constraintList: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  constraintCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    gap: 6,
  },
  constraintCardActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: 'rgba(225, 29, 72, 0.06)',
  },
  constraintTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  constraintTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  constraintTitle: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  constraintTitleActive: {
    color: theme.colors.brand.light,
  },
  constraintTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  constraintTagText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  constraintDesc: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    paddingLeft: 26,
  },
});
