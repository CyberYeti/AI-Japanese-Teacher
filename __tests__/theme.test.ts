import { theme, colors } from '../src/theme';
import { JLPTLevel } from '../src/types/domain';

describe('Theme System', () => {
  it('should define primary and background color tokens', () => {
    expect(theme.colors.background.primary).toBe('#020617');
    expect(theme.colors.brand.primary).toBe('#e11d48');
    expect(theme.colors.text.primary).toBe('#f8fafc');
  });

  it('should have color tokens defined for all 5 JLPT levels', () => {
    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
    levels.forEach((level) => {
      expect(theme.colors.jlpt[level]).toBeDefined();
      expect(theme.colors.jlpt[level].bg).toBeDefined();
      expect(theme.colors.jlpt[level].text).toBeDefined();
      expect(theme.colors.jlpt[level].border).toBeDefined();
    });
  });

  it('should define distinct speaker tints for dialogue roleplay', () => {
    expect(theme.colors.speakers.speakerA).toBeDefined();
    expect(theme.colors.speakers.speakerB).toBeDefined();
    expect(theme.colors.speakers.narrator).toBeDefined();
    expect(theme.colors.speakers.speakerA.badgeText).not.toEqual(theme.colors.speakers.speakerB.badgeText);
  });

  it('should provide spacing and border radius tokens', () => {
    expect(theme.spacing.lg).toBe(16);
    expect(theme.borderRadius.xl).toBe(18);
  });
});
