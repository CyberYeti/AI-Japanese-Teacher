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

const SAMPLE_HISTORY = [
  {
    id: '1',
    topic: 'Ordering at a Café',
    titleJa: 'カフェでの注文',
    level: 'N5' as const,
    date: 'Today, 10:30 AM',
    wordCount: 4,
    words: ['注文 (ちゅうもん)', 'おすすめ', 'お会計 (おかいけい)', '持ち帰り'],
    isStarred: true,
  },
  {
    id: '2',
    topic: 'Train & Subways',
    titleJa: '電車の乗り換え',
    level: 'N5' as const,
    date: 'Yesterday',
    wordCount: 3,
    words: ['切符 (きっぷ)', '乗り換え (のりかえ)', '何番線 (なんばんせん)'],
    isStarred: false,
  },
  {
    id: '3',
    topic: 'Booking a Hotel Room',
    titleJa: 'ホテルのチェックイン',
    level: 'N4' as const,
    date: 'Aug 23, 2026',
    wordCount: 4,
    words: ['予約 (よやく)', '部屋 (へや)', '禁煙 (きんえん)', '朝食 (ちょうしょく)'],
    isStarred: true,
  },
];

export const HistoryScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'starred' | 'N5' | 'N4' | 'N3'>('all');
  const [lessons, setLessons] = useState(SAMPLE_HISTORY);

  const toggleStar = (id: string) => {
    setLessons((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isStarred: !item.isStarred } : item))
    );
  };

  const filteredLessons = lessons.filter((item) => {
    if (activeFilter === 'starred' && !item.isStarred) return false;
    if (activeFilter.startsWith('N') && item.level !== activeFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        item.topic.toLowerCase().includes(q) ||
        item.titleJa.toLowerCase().includes(q) ||
        item.words.some((w) => w.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Lesson History</Text>
          <Text style={styles.subtitle}>Recent lessons (Auto-saved FIFO) · Star to pin</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.text.subtle} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search topics, kanji, or meanings..."
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
            {(['all', 'starred', 'N5', 'N4', 'N3'] as const).map((filter) => {
              const isSelected = activeFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {filter === 'all' ? 'All Lessons' : filter === 'starred' ? '⭐ Starred' : filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Lessons List */}
        <View style={styles.listContainer}>
          {filteredLessons.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color={theme.colors.text.subtle} />
              <Text style={styles.emptyTitle}>No lessons found</Text>
              <Text style={styles.emptySubtitle}>Try changing your search or filter</Text>
            </View>
          ) : (
            filteredLessons.map((item) => {
              const levelColor = theme.colors.jlpt[item.level];
              return (
                <TouchableOpacity key={item.id} style={styles.lessonCard} activeOpacity={0.7}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
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
                      <View style={styles.titleInfo}>
                        <Text style={styles.cardTopic}>{item.topic}</Text>
                        <Text style={styles.cardJa}>{item.titleJa}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleStar(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={item.isStarred ? 'star' : 'star-outline'}
                        size={22}
                        color={item.isStarred ? theme.colors.ui.star : theme.colors.text.subtle}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Words preview */}
                  <View style={styles.wordsPreviewRow}>
                    {item.words.map((word, idx) => (
                      <View key={idx} style={styles.wordChip}>
                        <Text style={styles.wordChipText}>{word}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    <View style={styles.reviewLink}>
                      <Text style={styles.reviewText}>Review Lesson</Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.colors.brand.light} />
                    </View>
                  </View>
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
    marginTop: 4,
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
  lessonCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  levelBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
  },
  titleInfo: {
    flex: 1,
  },
  cardTopic: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  cardJa: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  wordsPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  wordChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  wordChipText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.brand.light,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.4)',
    paddingTop: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.subtle,
  },
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewText: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.brand.light,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.subheading,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.typography.sizes.bodySm,
    color: theme.colors.text.muted,
    marginTop: 4,
  },
});
