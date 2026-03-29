// Spacing design tokens for HNNT
export const spacing = {
  // Base spacing unit (4px)
  unit: 4,

  // Spacing scale
  0: 0,
  1: 4,    // 0.25rem
  2: 8,    // 0.5rem
  3: 12,   // 0.75rem
  4: 16,   // 1rem
  5: 20,   // 1.25rem
  6: 24,   // 1.5rem
  7: 28,   // 1.75rem
  8: 32,   // 2rem
  9: 36,   // 2.25rem
  10: 40,  // 2.5rem
  11: 44,  // 2.75rem
  12: 48,  // 3rem
  14: 56,  // 3.5rem
  16: 64,  // 4rem
  20: 80,  // 5rem
  24: 96,  // 6rem
  28: 112, // 7rem
  32: 128, // 8rem
  36: 144, // 9rem
  40: 160, // 10rem
  44: 176, // 11rem
  48: 192, // 12rem
  52: 208, // 13rem
  56: 224, // 14rem
  60: 240, // 15rem
  64: 256, // 16rem
  72: 288, // 18rem
  80: 320, // 20rem
  96: 384, // 24rem
};

// Semantic spacing for common use cases
export const semanticSpacing = {
  // Screen padding
  screenPadding: spacing[4], // 16px
  screenPaddingLarge: spacing[6], // 24px
  
  // Component spacing
  componentSpacing: spacing[4], // 16px
  componentSpacingSmall: spacing[2], // 8px
  componentSpacingLarge: spacing[6], // 24px
  
  // Card spacing
  cardPadding: spacing[4], // 16px
  cardPaddingLarge: spacing[6], // 24px
  cardMargin: spacing[4], // 16px
  
  // Button spacing
  buttonPadding: spacing[3], // 12px
  buttonPaddingLarge: spacing[4], // 16px
  buttonMargin: spacing[2], // 8px
  
  // Text spacing
  textSpacing: spacing[2], // 8px
  textSpacingLarge: spacing[4], // 16px
  
  // List spacing
  listItemSpacing: spacing[3], // 12px
  listItemSpacingLarge: spacing[4], // 16px
  
  // Input spacing
  inputPadding: spacing[3], // 12px
  inputMargin: spacing[2], // 8px
  
  // Section spacing
  sectionSpacing: spacing[8], // 32px
  sectionSpacingLarge: spacing[12], // 48px
};

// Border radius scale
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

// Common radius values
export const radius = {
  button: borderRadius.base, // 8px
  card: borderRadius.md, // 12px
  input: borderRadius.base, // 8px
  avatar: borderRadius.full, // Full circle
  image: borderRadius.lg, // 16px
};

export default spacing;