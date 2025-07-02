import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';

interface FeatureCardProps {
  title: string;
  description: string;
  width?: number;
}

export default function FeatureCard({ title, description, width = 300 }: FeatureCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[
      styles.container, 
      { width, backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa' }
    ]}>
      <Text style={[styles.title, { color: isDark ? '#ffffff' : '#333333' }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: isDark ? '#cccccc' : '#666666' }]}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});