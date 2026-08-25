import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

const SAMPLE_WORDS = [
  {
    id: 'w1',
    word: '注文',
    reading: 'ちゅうもん',
    romaji: 'chuumon',
    meaning: 'an order (for food/goods)',
    partOfSpeech: 'noun / suru-verb',
    level: 'N5' as const,
    exampleJa: '注文をお願いします。',
    exampleEn: "I'd like to order, please.",
  },
  {
    id: 'w2',
    word: 'おすすめ',
    reading: 'おすすめ',
    romaji: 'osusume',
    meaning: 'recommendation',
    partOfSpeech: 'noun',
    level: 'N5' as const,
    exampleJa: 'おすすめの料理は何ですか？',
    exampleEn: "What is your recommended dish?",
  },
  {
    id: 'w3',
    word: 'お会計',
    reading: 'おかいけい',
    romaji: 'okaikei',
    meaning: 'the bill / check',
    partOfSpeech: 'noun',
    level: 'N5' as const,
    exampleJa: 'お会計はどこですか？',
    exampleEn: "Where do I pay the bill?",
  },
  {
    id: 'w4',
    word: '持ち帰り',
    reading: 'もちかえり',
    romaji: 'mochikaeri',
    meaning: 'takeout / to go',
    partOfSpeech: 'noun',
    level: 'N5' as const,
    exampleJa: '持ち帰りでお願いします。',
    exampleEn: "To go, please.",
  },
  {
    id: 'w5',
    word: '予約',
    reading: 'よやく',
    romaji: 'yoyaku',
    meaning: 'reservation / booking',
    partOfSpeech: 'noun / suru-verb',
    level: 'N4' as const,
    exampleJa: '予約を確認してください。',
    exampleEn: 'Please confirm the reservation.',
  },
];

export const WordBankScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevelFilter, setActiveLevelFilter] = useState<'ALL' | 'N5' | 'N4' | 'N3'>('ALL');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlayWord = (id: string, text: string) => {
    setPlayingId(id);
    Speech.speak(text, {
      language: 'ja-JP',
      rate: 0.85,
      onDone: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const filteredWords = SAMPLE_WORDS.filter((item) => {
    if (activeLevelFilter !== 'ALL' && item.level !== activeLevelFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        item.word.toLowerCase().includes(q) ||
        item.reading.toLowerCase().includes(q) ||
        item.romaji.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Word Bank</Text>
            <Text style={styles.subtitle}>Cumulative vocabulary from daily lessons</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countNumber}>{SAMPLE_WORDS.length}</Text>
            <Text style={styles.countLabel}>Words</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.text.subtle} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Kanji, reading, or meaning..."
            placeholderTextColor={theme.colors.text.subtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.text.subtle} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(['ALL', 'N5', 'N4', 'N3'] as const).map((filter) => {
            const isSelected = activeLevelFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveLevelFilter(filter)}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {filter === 'ALL' ? 'All Words' : filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Words List */}
        <View style={styles.listContainer}>
          {filteredWords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={48} color={theme.colors.text.subtle} />
              <Text style={styles.emptyTitle}>No words match your search</Text>
            </View>
          ) : (
            filteredWords.map((item) => {
              const isPlaying = playingId === item.id;
              const levelColor = theme.colors.jlpt[item.level];
              return (
                <View key={item.id} style={styles.wordCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.wordInfo}>
                      <View style={styles.wordHeaderRow}>
                        <Text style={styles.kanjiText}>{item.word}</Text>
                        <View
                          style={[
                            styles.levelBadge,
                            { backgroundColor: levelColor.bg, borderColor: levelColor.border },
                          ]}
                        >
                          <Text style={[styles.levelBadgeText, { color: levelColor.text }]}>
                            {item.level}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.readingText}>{item.reading} · {item.romaji}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.audioButton, isPlaying && styles.audioButtonPlaying]}
                      onPress={() => handlePlayWord(item.id, item.word)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                        size={20}
                        color={isPlaying ? '#ffffff' : theme.colors.brand.light}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.definitionBox}>
                    <Text style={styles.meaningText}>{item.meaning}</Text>
                    <Text style={styles.posText}>{item.partOfSpeech}</Text>
                  </View>

                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleJa}>{item.exampleJa}</Text>
                    <Text style={styles.exampleEn}>{item.exampleEn}</Text>
                  </View>
                </View>
              );
            })
          )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  countBadge: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  countNumber: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.brand.light,
  },
  countLabel: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.subtle,
    textTransform: 'uppercase',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.body,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  filterPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.background.card,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  filterPillActive: {
    backgroundColor: theme.colors.brand.primary,
    borderColor: theme.colors.brand.primary,
  },
  filterPillText: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: theme.typography.weights.bold,
  },
  listContainer: {
    gap: theme.spacing.md,
  },
  wordCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  wordInfo: {
    flex: 1,
  },
  wordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  kanjiText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  levelBadge: {
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  readingText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.brand.light,
    marginTop: 2,
    fontWeight: theme.typography.weights.medium,
  },
  audioButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.round,
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.25)',
  },
  audioButtonPlaying: {
    backgroundColor: theme.colors.brand.primary,
  },
  definitionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs + 2,
    marginBottom: theme.spacing.xs,
  },
  meaningText: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
    flex: 1,
  },
  posText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.subtle,
    fontStyle: 'italic',
  },
  exampleBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.brand.primary,
    marginTop: theme.spacing.xs,
  },
  exampleJa: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.secondary,
  },
  exampleEn: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.bodyLg,
    color: theme.colors.text.muted,
    marginTop: theme.spacing.md,
  },
});
