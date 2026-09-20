// Design tokens for HNNT brand colors
export const colors = {
  // Primary brand colors
  primary: {
    50: '#FFF1F3',
    100: '#FFE4E8', 
    200: '#FFCDD6',
    300: '#FFA8B8',
    400: '#FF7396',
    500: '#FF4275', // Main brand color - vibrant pink
    600: '#E91E5E',
    700: '#C4124A',
    800: '#A31440',
    900: '#8B1538',
  },

  // Secondary/accent colors
  secondary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9', // Complementary blue
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },

  // Neutral grays
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Semantic colors
  success: {
    50: '#F0FDF4',
    500: '#22C55E',
    600: '#16A34A',
  },
  
  warning: {
    50: '#FFFBEB',
    500: '#F59E0B',
    600: '#D97706',
  },
  
  error: {
    50: '#FEF2F2',
    500: '#EF4444',
    600: '#DC2626',
  },

  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#FAFAFA',
    tertiary: '#F5F5F5',
  },

  // Dark mode
  dark: {
    background: {
      primary: '#000000',
      secondary: '#0A0A0A',
      tertiary: '#171717',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3A3A3',
      tertiary: '#737373',
    }
  },

  // Social platform colors (from AuthButton)
  social: {
    google: '#4285F4',
    instagram: '#E1306C',
    snapchat: '#FFFC00',
    tiktok: '#000000',
    email: '#007AFF',
  },

  // Text colors
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    inverse: '#FFFFFF',
  }
};

// Convenience exports for common use cases
export const brandColors = {
  primary: colors.primary[500],
  secondary: colors.secondary[500],
  background: colors.background.primary,
  text: colors.text.primary,
};

export default colors;