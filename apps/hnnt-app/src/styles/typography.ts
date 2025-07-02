// Typography design tokens for HNNT
export const typography = {
  // Font families
  fonts: {
    primary: 'System', // Uses platform default (SF Pro on iOS, Roboto on Android)
    secondary: 'System',
    mono: 'Menlo', // For code or technical text
  },

  // Font weights
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  // Font sizes
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
    '6xl': 48,
    '7xl': 56,
    '8xl': 64,
  },

  // Line heights
  lineHeights: {
    xs: 16,
    sm: 20,
    base: 24,
    lg: 28,
    xl: 32,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
    '5xl': 44,
    '6xl': 56,
    '7xl': 64,
    '8xl': 72,
  },

  // Letter spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
  },
};

// Predefined text styles for consistency
export const textStyles = {
  // Display styles
  display: {
    fontSize: typography.sizes['6xl'],
    lineHeight: typography.lineHeights['6xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  // Heading styles
  h1: {
    fontSize: typography.sizes['4xl'],
    lineHeight: typography.lineHeights['4xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  h2: {
    fontSize: typography.sizes['3xl'],
    lineHeight: typography.lineHeights['3xl'],
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  h3: {
    fontSize: typography.sizes['2xl'],
    lineHeight: typography.lineHeights['2xl'],
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.normal,
  },
  
  h4: {
    fontSize: typography.sizes.xl,
    lineHeight: typography.lineHeights.xl,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.normal,
  },
  
  h5: {
    fontSize: typography.sizes.lg,
    lineHeight: typography.lineHeights.lg,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.normal,
  },

  // Body text styles
  bodyLarge: {
    fontSize: typography.sizes.lg,
    lineHeight: typography.lineHeights.lg,
    fontWeight: typography.weights.regular,
    letterSpacing: typography.letterSpacing.normal,
  },
  
  body: {
    fontSize: typography.sizes.base,
    lineHeight: typography.lineHeights.base,
    fontWeight: typography.weights.regular,
    letterSpacing: typography.letterSpacing.normal,
  },
  
  bodySmall: {
    fontSize: typography.sizes.sm,
    lineHeight: typography.lineHeights.sm,
    fontWeight: typography.weights.regular,
    letterSpacing: typography.letterSpacing.normal,
  },

  // Caption and fine print
  caption: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
    fontWeight: typography.weights.regular,
    letterSpacing: typography.letterSpacing.wide,
  },

  // Button text
  button: {
    fontSize: typography.sizes.base,
    lineHeight: typography.lineHeights.base,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.normal,
  },

  buttonSmall: {
    fontSize: typography.sizes.sm,
    lineHeight: typography.lineHeights.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.normal,
  },

  // Label text
  label: {
    fontSize: typography.sizes.sm,
    lineHeight: typography.lineHeights.sm,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.normal,
  },
};

export default typography;