// src/components/ConnectionStatus.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSpring, animated, config } from '@react-spring/native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedView = animated(View);

export type ConnectionStatusProps = {
  /** Whether the connection is online */
  isOnline?: boolean;
  /** Show connection status indicator */
  visible?: boolean;
};

/**
 * ConnectionStatus shows an animated indicator for online/offline status
 */
const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  isOnline = true, 
  visible = true 
}) => {
  // Pulse animation for online status
  const pulseAnimation = useSpring({
    from: { opacity: 0.7, transform: [{ scale: 1 }] },
    to: (isOnline && visible) 
      ? { opacity: 1, transform: [{ scale: 1.1 }] }
      : { opacity: 0.7, transform: [{ scale: 1 }] },
    loop: isOnline && visible,
    config: { ...config.gentle, duration: 1000 },
  });

  // Container animation
  const containerAnimation = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? [{ translateY: 0 }] : [{ translateY: -10 }],
    config: config.gentle,
  });

  // Status color animation
  const statusAnimation = useSpring({
    backgroundColor: isOnline ? '#4CAF50' : '#F44336',
    config: config.gentle,
  });

  if (!visible) return null;

  return (
    <AnimatedView style={[styles.container, containerAnimation]}>
      <AnimatedView 
        style={[
          styles.indicator,
          statusAnimation,
          isOnline ? pulseAnimation : {}
        ]}
      >
        <Ionicons 
          name={isOnline ? 'wifi' : 'wifi-outline'} 
          size={12} 
          color="#fff" 
        />
      </AnimatedView>
      <Text style={[styles.text, { color: isOnline ? '#4CAF50' : '#F44336' }]}>
        {isOnline ? 'Online' : 'Offline'}
      </Text>
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ConnectionStatus;