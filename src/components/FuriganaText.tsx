import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { SentenceToken } from '../types/domain';
import { theme } from '../theme';

export type FuriganaMode = 'all' | 'target-only' | 'hidden';

export interface FuriganaTextProps {
  tokens: SentenceToken[];
  mode?: FuriganaMode;
  fontSize?: number;
  textColor?: string;
  readingColor?: string;
  targetHighlightColor?: string;
  style?: ViewStyle;
  testID?: string;
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({
  tokens,
  mode = 'all',
  fontSize = 18,
  textColor = theme.colors.text.primary,
  readingColor = theme.colors.text.secondary,
  targetHighlightColor = theme.colors.brand.light,
  style,
  testID,
}) => {
  const readingFontSize = Math.max(10, Math.round(fontSize * 0.55));

  const shouldShowReading = (token: SentenceToken): boolean => {
    if (!token.reading || token.reading === token.surface) return false;
    if (mode === 'all') return true;
    if (mode === 'target-only') return token.isTarget;
    if (mode === 'hidden') return false;
    return false;
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {tokens.map((token, index) => {
        const hasReading = shouldShowReading(token);
        const isTarget = token.isTarget;
        const currentTextColor = isTarget ? targetHighlightColor : textColor;
        const currentReadingColor = isTarget ? targetHighlightColor : readingColor;

        if (hasReading) {
          return (
            <View
              key={`token-${index}`}
              style={[
                styles.rubyPair,
                isTarget && styles.targetRubyPair,
              ]}
              testID={isTarget ? `target-token-${token.surface}` : undefined}
            >
              <Text
                style={[
                  styles.readingText,
                  {
                    fontSize: readingFontSize,
                    color: currentReadingColor,
                    fontWeight: isTarget ? '700' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {token.reading}
              </Text>
              <Text
                style={[
                  styles.surfaceText,
                  {
                    fontSize: fontSize,
                    color: currentTextColor,
                    fontWeight: isTarget ? '700' : '500',
                  },
                ]}
              >
                {token.surface}
              </Text>
            </View>
          );
        }

        // Plain token without ruby reading
        return (
          <View
            key={`token-${index}`}
            style={[
              styles.plainPair,
              isTarget && styles.targetPlainPair,
            ]}
            testID={isTarget ? `target-token-${token.surface}` : undefined}
          >
            {/* Empty space holder to align baselines with ruby pairs when needed */}
            <Text
              style={[
                styles.surfaceText,
                {
                  fontSize: fontSize,
                  color: currentTextColor,
                  fontWeight: isTarget ? '700' : '400',
                },
              ]}
            >
              {token.surface}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: 4,
  },
  rubyPair: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 0.5,
  },
  plainPair: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  readingText: {
    textAlign: 'center',
    lineHeight: 12,
    marginBottom: 1,
  },
  surfaceText: {
    textAlign: 'center',
  },
  targetRubyPair: {
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.brand.primary,
  },
  targetPlainPair: {
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.brand.primary,
  },
});
