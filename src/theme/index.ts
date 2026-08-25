/**
 * AI Japanese Teacher - Theme System
 */

import { colors } from './colors';

export const theme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    hero: 32,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    round: 9999,
  },
  typography: {
    fonts: {
      sans: 'System',
      japanese: 'System',
    },
    sizes: {
      micro: 10,
      caption: 12,
      bodySm: 13,
      body: 14,
      bodyLg: 16,
      subheading: 18,
      heading: 20,
      title: 24,
      hero: 30,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
    },
  },
  shadows: {
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 3,
    },
    glow: {
      shadowColor: colors.brand.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
  },
};

export type Theme = typeof theme;
export { colors };
