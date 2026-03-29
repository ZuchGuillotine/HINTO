// src/components/TypingIndicator.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSpring, animated, config } from '@react-spring/native';

const AnimatedView = animated(View);

export type TypingIndicatorProps = {
  /** Whether to show the typing indicator */
  visible?: boolean;
  /** Color of the dots */
  color?: string;
  /** Size of the dots */
  size?: number;
};

/**
 * Individual animated dot component
 */
const TypingDot: React.FC<{ 
  delay: number; 
  color: string; 
  size: number; 
  visible: boolean; 
}> = ({ delay, color, size, visible }) => {
  const animation = useSpring({
    from: { opacity: 0.3, transform: [{ scale: 1 }] },
    to: visible 
      ? { opacity: 1, transform: [{ scale: 1.2 }] }
      : { opacity: 0.3, transform: [{ scale: 1 }] },
    loop: visible,
    config: { ...config.gentle, duration: 600 },
    delay,
  });

  const containerAnimation = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? [{ scale: 1 }] : [{ scale: 0.8 }],
    config: config.gentle,
  });

  return (
    <AnimatedView style={[containerAnimation]}>
      <AnimatedView
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            marginHorizontal: 2,
          },
          animation,
        ]}
      />
    </AnimatedView>
  );
};

/**
 * TypingIndicator shows an animated three-dot indicator
 * to indicate that the AI is typing a response
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  visible = false, 
  color = '#999', 
  size = 8 
}) => {
  const containerAnimation = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? [{ translateY: 0 }] : [{ translateY: 10 }],
    config: config.gentle,
  });

  if (!visible) return null;

  return (
    <AnimatedView style={[styles.container, containerAnimation]}>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <TypingDot delay={0} color={color} size={size} visible={visible} />
          <TypingDot delay={200} color={color} size={size} visible={visible} />
          <TypingDot delay={400} color={color} size={size} visible={visible} />
        </View>
      </View>
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
  },
  bubble: {
    backgroundColor: '#E5E5EA',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    minWidth: 60,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TypingIndicator;