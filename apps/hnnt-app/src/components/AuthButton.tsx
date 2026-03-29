import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/spacing';
import { textStyles } from '../styles/typography';

export type AuthProvider = 'google' | 'snapchat' | 'tiktok' | 'email' | 'instagram';

interface AuthButtonProps {
  provider: AuthProvider;
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
  isLoading?: boolean;
  disabled?: boolean;
}

const getProviderConfig = (provider: AuthProvider) => {
  switch (provider) {
    case 'google':
      return {
        icon: 'logo-google' as const,
        color: colors.social.google,
        backgroundColor: colors.background.primary,
        borderColor: colors.social.google,
        defaultLabel: 'Continue with Google',
      };
    case 'instagram':
      return {
        icon: 'logo-instagram' as const,
        color: colors.social.instagram,
        backgroundColor: colors.background.primary,
        borderColor: colors.social.instagram,
        defaultLabel: 'Continue with Instagram',
      };
    case 'snapchat':
      return {
        icon: 'logo-snapchat' as const,
        color: colors.neutral[900],
        backgroundColor: colors.social.snapchat,
        borderColor: colors.social.snapchat,
        defaultLabel: 'Continue with Snapchat',
      };
    case 'tiktok':
      return {
        icon: 'logo-tiktok' as const,
        color: colors.social.tiktok,
        backgroundColor: colors.background.primary,
        borderColor: colors.social.tiktok,
        defaultLabel: 'Continue with TikTok',
      };
    case 'email':
      return {
        icon: 'mail' as const,
        color: colors.social.email,
        backgroundColor: colors.background.primary,
        borderColor: colors.social.email,
        defaultLabel: 'Continue with Email',
      };
  }
};

const AuthButton: React.FC<AuthButtonProps> = ({
  provider,
  onPress,
  label,
  style,
  isLoading = false,
  disabled = false,
}) => {
  const config = getProviderConfig(provider);
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name={config.icon}
        size={24}
        color={config.color}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          {
            color: config.color,
          },
        ]}
      >
        {isLoading ? 'Loading...' : label || config.defaultLabel}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3], // 12px
    paddingHorizontal: spacing[4], // 16px
    borderRadius: radius.button, // 8px
    borderWidth: 1,
    marginVertical: spacing[2], // 8px
    width: '100%',
  },
  icon: {
    marginRight: spacing[3], // 12px
  },
  text: {
    ...textStyles.button,
  },
});

export default AuthButton; 