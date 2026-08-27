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
import { Ionicons } from '@expo/vector-icons';
import { storageService, audioProvider } from '../services';
import { WordBankItem, JLPTLevel } from '../types/domain';

export const WordBankScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevelFilter, setActiveLevelFilter] = useState<'ALL' | JLPTLevel>('ALL');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [words, setWords] = useState<WordBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(new Set());

  const loadWordBank = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedWords = await storageService.getWordBank();
      setWords(storedWords);
    } catch (err) {
      // fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWordBank();
    }, [loadWordBank])
  );

  const toggleExpandWord = (id: string) => {
    setExpandedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePlayWord = async (id: string, text: string) => {
    setPlayingId(id);
    try {
      await audioProvider.playSentence(text, {
        onFinished: () => setPlayingId(null),
        onError: () => setPlayingId(null),
      });
    } catch {
      setPlayingId(null);
    }
  };

  const filteredWords = words.filter((item) => {
    if (activeLevelFilter !== 'ALL' && item.jlptLevel !== activeLevelFilter) return false;
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
            <Text style={styles.countNumber}>{words.length}</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {(['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map((filter) => {
              const isSelected = activeLevelFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setActiveLevelFilter(filter)}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  activeOpacity={0.7}
                  testID={`filter-pill-${filter}`}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {filter === 'ALL' ? 'All Words' : filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Words List */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            </View>
          ) : filteredWords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={48} color={theme.colors.text.subtle} />
              <Text style={styles.emptyTitle}>No words match your search</Text>
            </View>
          ) : (
            filteredWords.map((item) => {
              const isPlaying = playingId === item.id;
              const isExpanded = expandedWordIds.has(item.id);
              const levelColor = theme.colors.jlpt[item.jlptLevel] || theme.colors.jlpt.N5;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.wordCard,
                    isExpanded && styles.wordCardExpanded,
                  ]}
                  onPress={() => toggleExpandWord(item.id)}
                  activeOpacity={0.85}
                  testID={`word-card-${item.id}`}
                >
                  {/* Compact Header Row */}
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
                            {item.jlptLevel}
                          </Text>
                        </View>
                        <Text style={styles.readingText}>
                          {item.reading} · {item.romaji}
                        </Text>
                      </View>
                      <Text style={styles.meaningText} numberOfLines={isExpanded ? undefined : 1}>
                        {item.meaning}
                      </Text>
                    </View>

                    {/* Actions: Audio Button & Accordion Chevron */}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.audioButton, isPlaying && styles.audioButtonPlaying]}
                        onPress={() => handlePlayWord(item.id, item.word)}
                        activeOpacity={0.7}
                        testID={`play-word-${item.id}`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                          size={18}
                          color={isPlaying ? '#ffffff' : theme.colors.brand.light}
                        />
                      </TouchableOpacity>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors.text.subtle}
                        style={styles.chevronIcon}
                      />
                    </View>
                  </View>

                  {/* Expanded Accordion Body */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      <View style={styles.metadataRow}>
                        <View style={styles.posPill}>
                          <Text style={styles.posPillText}>{item.partOfSpeech}</Text>
                        </View>
                        {item.sourceLessonTopic ? (
                          <Text style={styles.sourceTopicText}>
                            Learned in: {item.sourceLessonTopic}
                          </Text>
                        ) : null}
                      </View>

                      {item.examples && item.examples.length > 0 && (
                        <View style={styles.examplesContainer}>
                          <Text style={styles.examplesHeading}>
                            Context Examples ({item.examples.length}):
                          </Text>
                          {item.examples.map((ex, exIdx) => {
                            const isExPlaying = playingId === `ex-${item.id}-${exIdx}`;
                            return (
                              <View key={`ex-${exIdx}`} style={styles.exampleItem}>
                                <View style={styles.exampleHeaderRow}>
                                  <Text style={styles.exampleNumber}>0{exIdx + 1}</Text>
                                  <TouchableOpacity
                                    onPress={() =>
                                      handlePlayWord(`ex-${item.id}-${exIdx}`, ex.japanese)
                                    }
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    style={styles.exampleAudioBtn}
                                  >
                                    <Ionicons
                                      name={isExPlaying ? 'volume-high' : 'volume-medium-outline'}
                                      size={14}
                                      color={isExPlaying ? theme.colors.brand.primary : theme.colors.brand.light}
                                    />
                                  </TouchableOpacity>
                                </View>
                                <Text style={styles.exampleJa}>{ex.japanese}</Text>
                                <Text style={styles.exampleEn}>{ex.english}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
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
  filterScroll: {
    marginBottom: theme.spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  wordCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  wordCardExpanded: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: theme.colors.background.elevated,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordInfo: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  wordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.xs + 2,
    marginBottom: 4,
  },
  kanjiText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
  },
  readingText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.brand.light,
    fontWeight: theme.typography.weights.medium,
  },
  meaningText: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
  },
  audioButton: {
    width: 34,
    height: 34,
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
  chevronIcon: {
    marginLeft: 2,
  },
  expandedSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background.cardBorder,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  posPill: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: theme.spacing.xs + 4,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  posPillText: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  sourceTopicText: {
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.text.subtle,
    fontStyle: 'italic',
  },
  examplesContainer: {
    gap: theme.spacing.sm,
  },
  examplesHeading: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.muted,
    marginBottom: 2,
  },
  exampleItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.brand.primary,
  },
  exampleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  exampleNumber: {
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.brand.light,
  },
  exampleAudioBtn: {
    padding: 2,
  },
  exampleJa: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.primary,
    lineHeight: 20,
    marginBottom: 2,
  },
  exampleEn: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    lineHeight: 16,
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
