import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { storageService } from '../services';
import { DailyLesson, JLPTLevel } from '../types/domain';

interface HistoryScreenProps {
  navigation?: any;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'starred' | JLPTLevel>('all');
  const [lessons, setLessons] = useState<DailyLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLessons = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedLessons = await storageService.getLessons();
      setLessons(storedLessons);
    } catch (err) {
      // fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const toggleStar = async (id: string) => {
    setLessons((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isStarred: !item.isStarred } : item))
    );
    await storageService.toggleLessonStar(id);
  };

  const handleDeleteLesson = (id: string, topic: string) => {
    Alert.alert(
      'Delete Lesson',
      `Are you sure you want to delete "${topic}" from your history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLessons((prev) => prev.filter((item) => item.id !== id));
            await storageService.deleteLesson(id);
          },
        },
      ]
    );
  };

  const filteredLessons = lessons.filter((item) => {
    if (activeFilter === 'starred' && !item.isStarred) return false;
    if (activeFilter.startsWith('N') && item.level !== activeFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const topicEn = (item.topicEnglish || item.topic || '').toLowerCase();
      const topicJa = (item.topicJapanese || item.title || '').toLowerCase();
      const wordMatch = item.targetVocabulary.some(
        (w) =>
          w.word.toLowerCase().includes(q) ||
          w.reading.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q)
      );
      return topicEn.includes(q) || topicJa.includes(q) || wordMatch;
    }
    return true;
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

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
            {(['all', 'starred', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map((filter) => {
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
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.brand.primary} />
            </View>
          ) : filteredLessons.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color={theme.colors.text.subtle} />
              <Text style={styles.emptyTitle}>No lessons found</Text>
              <Text style={styles.emptySubtitle}>Try changing your search or filter</Text>
            </View>
          ) : (
            filteredLessons.map((item) => {
              const levelColor = theme.colors.jlpt[item.level] || theme.colors.jlpt.N5;
              const topicEn = item.topicEnglish || item.topic || 'Lesson';
              const topicJa = item.topicJapanese || item.title || '';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.lessonCard}
                  activeOpacity={0.7}
                  onPress={() => navigation?.navigate('LessonStudy', { lesson: item })}
                  testID={`lesson-card-${item.id}`}
                >
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
                        <Text style={styles.cardTopic}>{topicEn}</Text>
                        <Text style={styles.cardJa}>{topicJa}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleStar(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      testID={`star-btn-${item.id}`}
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
                    {item.targetVocabulary.map((v, idx) => (
                      <View key={idx} style={styles.wordChip}>
                        <Text style={styles.wordChipText}>
                          {v.word} ({v.reading})
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
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
