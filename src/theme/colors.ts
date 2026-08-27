/**
 * AI Japanese Teacher - Color Design System
 * Curated dark palette with Japanese crimson accents
 */

export const colors = {
  background: {
    primary: '#020617', // slate-950
    secondary: '#0f172a', // slate-900
    card: '#1e293b', // slate-800
    cardHover: '#293548',
    cardBorder: 'rgba(51, 65, 85, 0.8)', // slate-700
    elevated: '#1e293b',
    subtle: 'rgba(15, 23, 42, 0.6)',
  },
  brand: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48', // Japanese Crimson
    700: '#be123c',
    900: '#881337',
    primary: '#e11d48',
    secondary: '#fb7185',
    light: '#fb7185',
    accent: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.25)',
  },
  text: {
    primary: '#f8fafc', // slate-50
    secondary: '#cbd5e1', // slate-300
    muted: '#94a3b8', // slate-400
    subtle: '#64748b', // slate-500
    highlight: '#fb7185', // rose-400 (furigana/target word)
    inverse: '#020617',
  },
  jlpt: {
    N5: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    N4: { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.3)' },
    N3: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
    N2: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.3)' },
    N1: { bg: 'rgba(225, 29, 72, 0.15)', text: '#fb7185', border: 'rgba(225, 29, 72, 0.3)' },
  },
  speakers: {
    speakerA: {
      badgeBg: 'rgba(59, 130, 246, 0.2)',
      badgeText: '#60a5fa',
      border: 'rgba(59, 130, 246, 0.4)',
      bubbleBg: 'rgba(23, 37, 84, 0.5)', // deep blue slate tint
      highlightBg: 'rgba(59, 130, 246, 0.12)',
      accent: '#3b82f6',
    },
    speakerB: {
      badgeBg: 'rgba(16, 185, 129, 0.2)',
      badgeText: '#34d399',
      border: 'rgba(16, 185, 129, 0.4)',
      bubbleBg: 'rgba(6, 44, 34, 0.5)', // deep emerald slate tint
      highlightBg: 'rgba(16, 185, 129, 0.12)',
      accent: '#10b981',
    },
    narrator: {
      badgeBg: 'rgba(168, 85, 247, 0.2)',
      badgeText: '#c084fc',
      border: 'rgba(168, 85, 247, 0.4)',
      bubbleBg: 'rgba(46, 16, 68, 0.5)', // deep purple slate tint
      highlightBg: 'rgba(168, 85, 247, 0.12)',
      accent: '#a855f7',
    },
  },
  ui: {
    border: '#334155',
    borderLight: '#475569',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    star: '#facc15',
    activeAudioGlow: '#f43f5e',
  },
};
