import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AuthProvider = 'google' | 'snapchat' | 'tiktok' | 'email' | 'instagram';

interface AuthButtonProps {
  provider: AuthProvider;
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

const getProviderConfig = (provider: AuthProvider) => {
  switch (provider) {
    case 'google':
      return {
        icon: 'logo-google' as const,
        color: '#4285F4',
        backgroundColor: '#fff',
        borderColor: '#4285F4',
        defaultLabel: 'Continue with Google',
      };
    case 'instagram':
      return {
        icon: 'logo-instagram' as const,
        color: '#E1306C',
        backgroundColor: '#fff',
        borderColor: '#E1306C',
        defaultLabel: 'Continue with Instagram',
      };
    case 'snapchat':
      return {
        icon: 'logo-snapchat' as const,
        color: '#FFFC00',
        backgroundColor: '#FFFC00',
        borderColor: '#FFFC00',
        defaultLabel: 'Continue with Snapchat',
      };
    case 'tiktok':
      return {
        icon: 'logo-tiktok' as const,
        color: '#000000',
        backgroundColor: '#fff',
        borderColor: '#000000',
        defaultLabel: 'Continue with TikTok',
      };
    case 'email':
      return {
        icon: 'mail' as const,
        color: '#007AFF',
        backgroundColor: '#fff',
        borderColor: '#007AFF',
        defaultLabel: 'Continue with Email',
      };
  }
};

const AuthButton: React.FC<AuthButtonProps> = ({
  provider,
  onPress,
  label,
  style,
  disabled = false,
}) => {
  const config = getProviderConfig(provider);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
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
        {label || config.defaultLabel}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
    width: '100%',
  },
  icon: {
    marginRight: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AuthButton; 