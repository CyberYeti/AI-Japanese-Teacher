import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TargetWord } from '../types/domain';
import { theme } from '../theme';

export interface WordTooltipModalProps {
  visible: boolean;
  word: TargetWord | null;
  onClose: () => void;
  onPlayAudio?: (text: string) => void;
  isNovel?: boolean;
  isSavedToWordBank?: boolean;
  onAddToWordBank?: (word: TargetWord) => void;
  testID?: string;
}

export const WordTooltipModal: React.FC<WordTooltipModalProps> = ({
  visible,
  word,
  onClose,
  onPlayAudio,
  isNovel,
  isSavedToWordBank = false,
  onAddToWordBank,
  testID = 'word-tooltip-modal',
}) => {
  if (!word) return null;

  const handlePlayAudio = () => {
    if (onPlayAudio && word.word) {
      onPlayAudio(word.word);
    }
  };

  const handleAddWord = () => {
    if (onAddToWordBank && word) {
      onAddToWordBank(word);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <TouchableWithoutFeedback onPress={onClose} testID="word-tooltip-backdrop">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.tooltipCard,
                isNovel && styles.tooltipCardNovel,
              ]}
              testID="word-tooltip-card"
            >
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.vocabBadge,
                      isNovel && styles.novelBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.vocabBadgeText,
                        isNovel && styles.novelBadgeText,
                      ]}
                    >
                      {isNovel ? '✨ NOVEL WORD (i+1)' : 'VOCABULARY'}
                    </Text>
                  </View>
                  {word.partOfSpeech ? (
                    <View style={styles.posBadge}>
                      <Text style={styles.posBadgeText}>{word.partOfSpeech}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close tooltip"
                  testID="close-tooltip-btn"
                >
                  <Ionicons name="close" size={20} color={theme.colors.text.muted} />
                </TouchableOpacity>
              </View>

              {/* Japanese Word & Furigana */}
              <View style={styles.wordSection}>
                <Text style={styles.japaneseSurface} testID="tooltip-word-surface">
                  {word.word}
                </Text>
                {word.reading && word.reading !== word.word ? (
                  <Text
                    style={[
                      styles.readingText,
                      isNovel && { color: '#10B981' },
                    ]}
                    testID="tooltip-word-furigana"
                  >
                    【{word.reading}】
                  </Text>
                ) : null}
              </View>

              {/* Romaji */}
              {word.romaji ? (
                <View style={styles.romajiContainer}>
                  <Text style={styles.romajiLabel}>Romaji:</Text>
                  <Text style={styles.romajiText} testID="tooltip-word-romaji">
                    {word.romaji}
                  </Text>
                </View>
              ) : null}

              {/* English Definition */}
              <View style={styles.meaningContainer}>
                <Text style={styles.meaningLabel}>English Meaning:</Text>
                <Text style={styles.meaningText} testID="tooltip-word-meaning">
                  {word.meaning}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {onPlayAudio ? (
                  <TouchableOpacity
                    style={[styles.listenBtn, onAddToWordBank && { flex: 1 }]}
                    onPress={handlePlayAudio}
                    activeOpacity={0.8}
                    testID="tooltip-listen-btn"
                  >
                    <Ionicons
                      name="volume-medium"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.listenBtnText}>Listen</Text>
                  </TouchableOpacity>
                ) : null}

                {onAddToWordBank ? (
                  <TouchableOpacity
                    style={[
                      styles.addWordBtn,
                      isSavedToWordBank && styles.addWordBtnSaved,
                    ]}
                    onPress={handleAddWord}
                    disabled={isSavedToWordBank}
                    activeOpacity={0.8}
                    testID="tooltip-add-word-btn"
                  >
                    <Ionicons
                      name={isSavedToWordBank ? 'checkmark-circle' : 'add-circle-outline'}
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.addWordBtnText}>
                      {isSavedToWordBank ? 'Saved' : 'Add to Bank'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  tooltipCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.brand.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  vocabBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  vocabBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.brand.light,
    letterSpacing: 0.5,
  },
  posBadge: {
    backgroundColor: theme.colors.background.card,
    borderColor: theme.colors.background.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  posBadgeText: {
    fontSize: 10,
    color: theme.colors.text.muted,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  wordSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  japaneseSurface: {
    fontSize: 26,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  readingText: {
    fontSize: theme.typography.sizes.bodyLg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.brand.light,
  },
  romajiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    gap: 6,
  },
  romajiLabel: {
    fontSize: 12,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  romajiText: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  meaningContainer: {
    marginBottom: theme.spacing.md,
  },
  meaningLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  meaningText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.medium,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.primary,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    marginTop: 4,
  },
  listenBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  tooltipCardNovel: {
    borderColor: '#10B981',
  },
  novelBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  novelBadgeText: {
    color: '#10B981',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  addWordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  addWordBtnSaved: {
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
  },
  addWordBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
});
