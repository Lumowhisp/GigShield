/**
 * GigGuard Design System v2
 * Premium dark theme — #131323 base with aqua + burnt orange accents
 */

export const colors = {
  // Base backgrounds
  bg: '#131323',
  bgCard: '#1A1A2E',
  bgCardHover: '#22223A',
  bgElevated: '#1E1E32',
  bgSurface: '#16162A',

  // Text hierarchy
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0C0',
  textMuted: '#6B6B85',

  // Brand — Dual accent system
  aqua: '#00E5FF',
  aquaLight: '#4EEDFF',
  aquaDim: 'rgba(0, 229, 255, 0.12)',
  aquaBorder: 'rgba(0, 229, 255, 0.25)',

  orange: '#FF6B35',
  orangeLight: '#FF8F60',
  orangeDim: 'rgba(255, 107, 53, 0.12)',
  orangeBorder: 'rgba(255, 107, 53, 0.3)',

  // Legacy alias
  accent: '#FF6B35',
  accentLight: '#FF8F60',
  accentDim: 'rgba(255, 107, 53, 0.12)',

  // Status
  success: '#00E676',
  successDim: 'rgba(0, 230, 118, 0.12)',
  warning: '#FFB300',
  warningDim: 'rgba(255, 179, 0, 0.12)',
  danger: '#FF5252',
  dangerDim: 'rgba(255, 82, 82, 0.12)',
  info: '#448AFF',
  infoDim: 'rgba(68, 138, 255, 0.12)',

  // Risk levels
  riskLow: '#00E676',
  riskModerate: '#FFB300',
  riskHigh: '#FF6B35',
  riskExtreme: '#FF5252',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.10)',
  borderAccent: 'rgba(0, 229, 255, 0.25)',

  // Gradient stops
  gradientStart: '#131323',
  gradientEnd: '#1A1A2E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  }),
};

export const riskConfig = {
  low: { color: colors.riskLow, label: 'Low Risk', icon: '🟢' },
  moderate: { color: colors.riskModerate, label: 'Moderate', icon: '🟡' },
  high: { color: colors.riskHigh, label: 'High Risk', icon: '🟠' },
  extreme: { color: colors.riskExtreme, label: 'Extreme', icon: '🔴' },
};
