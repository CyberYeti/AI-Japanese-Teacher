import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, TouchableOpacity } from 'react-native';
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
  novelHighlightColor?: string;
  style?: ViewStyle;
  testID?: string;
  onPressToken?: (token: SentenceToken) => void;
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({
  tokens,
  mode = 'all',
  fontSize = 18,
  textColor = theme.colors.text.primary,
  readingColor = theme.colors.text.secondary,
  targetHighlightColor = theme.colors.brand.light,
  novelHighlightColor = '#10B981',
  style,
  testID,
  onPressToken,
}) => {
  const readingFontSize = Math.max(10, Math.round(fontSize * 0.55));

  const shouldShowReading = (token: SentenceToken): boolean => {
    if (!token.reading || token.reading === token.surface) return false;
    if (mode === 'all') return true;
    if (mode === 'target-only') return Boolean(token.isTarget || token.isNovel);
    if (mode === 'hidden') return false;
    return false;
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {tokens.map((token, index) => {
        const hasReading = shouldShowReading(token);
        const isTarget = Boolean(token.isTarget);
        const isNovel = Boolean(token.isNovel);
        const isInteractive = (isTarget || isNovel) && Boolean(onPressToken);

        const currentTextColor = isTarget
          ? targetHighlightColor
          : isNovel
            ? novelHighlightColor
            : textColor;

        const currentReadingColor = isTarget
          ? targetHighlightColor
          : isNovel
            ? novelHighlightColor
            : readingColor;

        const tokenTestID = isTarget
          ? `target-token-${token.surface}`
          : isNovel
            ? `novel-token-${token.surface}`
            : undefined;

        if (hasReading) {
          const content = (
            <>
              <Text
                style={[
                  styles.readingText,
                  {
                    fontSize: readingFontSize,
                    color: currentReadingColor,
                    fontWeight: isTarget || isNovel ? '700' : '500',
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
                    fontWeight: isTarget || isNovel ? '700' : '500',
                  },
                ]}
              >
                {token.surface}
              </Text>
            </>
          );

          if (isInteractive) {
            return (
              <TouchableOpacity
                key={`token-${index}`}
                style={[
                  styles.rubyPair,
                  isTarget && styles.targetRubyPair,
                  isNovel && styles.novelRubyPair,
                ]}
                onPress={() => onPressToken?.(token)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${token.surface}, reading: ${token.reading}`}
                testID={tokenTestID}
              >
                {content}
              </TouchableOpacity>
            );
          }

          return (
            <View
              key={`token-${index}`}
              style={[
                styles.rubyPair,
                isTarget && styles.targetRubyPair,
                isNovel && styles.novelRubyPair,
              ]}
              testID={tokenTestID}
            >
              {content}
            </View>
          );
        }

        // Plain token without ruby reading
        const plainContent = (
          <Text
            style={[
              styles.surfaceText,
              {
                fontSize: fontSize,
                color: currentTextColor,
                fontWeight: isTarget || isNovel ? '700' : '400',
              },
            ]}
          >
            {token.surface}
          </Text>
        );

        if (isInteractive) {
          return (
            <TouchableOpacity
              key={`token-${index}`}
              style={[
                styles.plainPair,
                isTarget && styles.targetPlainPair,
                isNovel && styles.novelPlainPair,
              ]}
              onPress={() => onPressToken?.(token)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${token.surface}`}
              testID={tokenTestID}
            >
              {plainContent}
            </TouchableOpacity>
          );
        }

        return (
          <View
            key={`token-${index}`}
            style={[
              styles.plainPair,
              isTarget && styles.targetPlainPair,
              isNovel && styles.novelPlainPair,
            ]}
            testID={tokenTestID}
          >
            {plainContent}
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
  novelRubyPair: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#10B981',
  },
  novelPlainPair: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#10B981',
  },
});
