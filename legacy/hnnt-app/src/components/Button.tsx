// src/components/Button.tsx

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

export interface ButtonProps {
  /** Text label to display inside the button */
  title: string;
  /** Callback when the button is pressed */
  onPress: (event: GestureResponderEvent) => void;
  /** Style variant: primary (filled), secondary (outlined), link (text) */
  variant?: ButtonVariant;
  /** Disable interactions and show disabled styles */
  disabled?: boolean;
  /** Optional custom container style */
  style?: ViewStyle;
  /** Optional custom text style */
  textStyle?: TextStyle;
}

/**
 * Reusable Button component with three variants:
 * - primary: filled background
 * - secondary: bordered
 * - link: text only
 *
 * Handles disabled state and supports style overrides.
 */
const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}) => {
  const containerStyles = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'link' && styles.link,
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.textBase,
    variant === 'primary' && styles.textPrimary,
    variant === 'secondary' && styles.textSecondary,
    variant === 'link' && styles.textLink,
    disabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={containerStyles as ViewStyle}
      activeOpacity={0.7}
    >
      <Text style={textStyles as TextStyle}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  link: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  disabled: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
  },
  textBase: {
    fontSize: 16,
    fontWeight: '600',
  },
  textPrimary: {
    color: '#fff',
  },
  textSecondary: {
    color: '#007AFF',
  },
  textLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  textDisabled: {
    color: '#888',
  },
});

export default Button;
