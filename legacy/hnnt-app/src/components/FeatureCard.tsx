import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/spacing';
import { textStyles } from '../styles/typography';

interface FeatureCardProps {
  title: string;
  description: string;
  emoji?: string;
  width?: number;
}

export default function FeatureCard({ title, description, emoji, width = 300 }: FeatureCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[
      styles.container, 
      { 
        width, 
        backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary 
      }
    ]}>
      {emoji && (
        <Text style={styles.emoji}>
          {emoji}
        </Text>
      )}
      <Text style={[
        styles.title, 
        { color: isDark ? colors.dark.text.primary : colors.text.primary }
      ]}>
        {title}
      </Text>
      <Text style={[
        styles.description, 
        { color: isDark ? colors.dark.text.secondary : colors.text.secondary }
      ]}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[6], // 24px
    borderRadius: radius.card, // 12px
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing[4], // 16px
    textAlign: 'center',
  },
  title: {
    ...textStyles.h3,
    textAlign: 'center',
    marginBottom: spacing[3], // 12px
  },
  description: {
    ...textStyles.body,
    textAlign: 'center',
  },
});