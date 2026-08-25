import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export interface AudioPlayerBarProps {
  isPlaying: boolean;
  currentSentenceIndex?: number;
  totalSentences?: number;
  speechRate: number;
  isLooping: boolean;
  onTogglePlay: () => void;
  onChangeRate: (rate: number) => void;
  onToggleLoop: () => void;
  statusLabel?: string;
  subLabel?: string;
}

const AVAILABLE_RATES = [0.75, 1.0, 1.25];

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  currentSentenceIndex = 1,
  totalSentences = 1,
  speechRate = 1.0,
  isLooping,
  onTogglePlay,
  onChangeRate,
  onToggleLoop,
  statusLabel,
  subLabel,
}) => {
  const displayStatus =
    statusLabel ?? (isPlaying ? 'Playing Dialogue' : 'Ready to play');
  const displaySub =
    subLabel ?? `Sentence ${currentSentenceIndex} of ${totalSentences}`;
  const progressPercent =
    totalSentences > 0 ? (currentSentenceIndex / totalSentences) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Play / Pause button & Status */}
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={[styles.playButton, isPlaying && styles.playButtonActive]}
            onPress={onTogglePlay}
            activeOpacity={0.8}
            testID="audio-play-toggle-btn"
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="#ffffff"
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </TouchableOpacity>
          <View style={styles.textContainer}>
            <Text style={styles.statusText} numberOfLines={1}>
              {displayStatus}
            </Text>
            <Text style={styles.subText} numberOfLines={1}>
              {displaySub}
            </Text>
          </View>
        </View>

        {/* Controls: Loop & Speed */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={[styles.loopButton, isLooping && styles.loopButtonActive]}
            onPress={onToggleLoop}
            activeOpacity={0.7}
            testID="audio-loop-btn"
          >
            <Text
              style={[
                styles.loopButtonText,
                isLooping && styles.loopButtonTextActive,
              ]}
            >
              🔁 Loop: {isLooping ? 'On' : 'Off'}
            </Text>
          </TouchableOpacity>

          <View style={styles.speedGroup}>
            {AVAILABLE_RATES.map((rate) => {
              const isSelected = speechRate === rate;
              return (
                <TouchableOpacity
                  key={rate}
                  style={[
                    styles.speedItem,
                    isSelected && styles.speedItemActive,
                  ]}
                  onPress={() => onChangeRate(rate)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.speedItemText,
                      isSelected && styles.speedItemTextActive,
                    ]}
                  >
                    {rate === 1 ? '1.0' : rate}x
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Progress Track */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressBar, { width: `${progressPercent}%` }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.background.cardBorder,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    ...theme.shadows.glow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.glow,
  },
  playButtonActive: {
    backgroundColor: '#be123c',
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  subText: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  loopButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
  },
  loopButtonActive: {
    backgroundColor: 'rgba(225, 29, 72, 0.2)',
    borderColor: theme.colors.brand.primary,
  },
  loopButtonText: {
    fontSize: theme.typography.sizes.micro + 1,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.secondary,
  },
  loopButtonTextActive: {
    color: theme.colors.brand.light,
    fontWeight: theme.typography.weights.bold,
  },
  speedGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.background.cardBorder,
    padding: 2,
  },
  speedItem: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  speedItemActive: {
    backgroundColor: theme.colors.brand.primary,
  },
  speedItemText: {
    fontSize: theme.typography.sizes.micro + 1,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
  },
  speedItemTextActive: {
    color: '#ffffff',
    fontWeight: theme.typography.weights.bold,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.brand.primary,
    borderRadius: theme.borderRadius.round,
  },
});
