// src/components/SituationshipCard.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  PanResponder,
  LayoutChangeEvent,
  Pressable,
} from 'react-native';
import { useSpring, animated, config } from '@react-spring/native';
import * as Haptics from 'expo-haptics';

export interface Situationship {
  id: string;
  name: string;
  category?: string | null;
  avatarUrl?: string | null;
  emoji?: string | null;
  rankIndex?: number | null;
  owner?: string;
  sharedWith?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SituationshipCardProps {
  item: Situationship;
  index: number;
  mode: 'owner' | 'guest';
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  // Drag and drop props
  isDragging?: boolean;
  onDragStart?: (index: number) => void;
  onDragMove?: (gestureState: { dx: number; dy: number }) => void;
  onDragEnd?: (fromIndex: number, toIndex: number) => void;
  canDrag?: boolean;
  dragOffset?: { x: number; y: number };
  onLayout?: (event: LayoutChangeEvent) => void;
  // Animation props
  isLoading?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  isNew?: boolean;
}

const AnimatedView = animated(View);
const AnimatedText = animated(Text);
const AnimatedImage = animated(Image);

const SituationshipCard: React.FC<SituationshipCardProps> = ({
  item,
  index,
  mode,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onPress,
  isDragging = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  canDrag = false,
  dragOffset = { x: 0, y: 0 },
  onLayout,
  isLoading = false,
  isSelected = false,
  isFocused = false,
  isNew = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [previousItem, setPreviousItem] = useState(item);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canDrag,
      onMoveShouldSetPanResponder: () => canDrag,
      onPanResponderGrant: () => {
        if (canDrag && onDragStart) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDragStart(index);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (canDrag && onDragMove) {
          onDragMove(gestureState);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (canDrag && onDragEnd) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Calculate drop position based on gesture
          const cardHeight = 76; // Approximate card height including margins
          const moveDistance = gestureState.dy;
          const positionChange = Math.round(moveDistance / cardHeight);
          const targetIndex = Math.max(0, index + positionChange);
          onDragEnd(index, targetIndex);
        }
      },
    })
  ).current;

  // Detect content changes for smooth transitions
  useEffect(() => {
    if (item.name !== previousItem.name || item.avatarUrl !== previousItem.avatarUrl) {
      setPreviousItem(item);
    }
  }, [item, previousItem]);

  // Press feedback handlers
  const handlePressIn = useCallback(() => {
    if (!canDrag) {
      setIsPressed(true);
      Haptics.selectionAsync();
    }
  }, [canDrag]);

  const handlePressOut = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Entry animation (for new cards)
  const [entrySpring] = useSpring(() => ({
    from: { 
      opacity: isNew ? 0 : 1, 
      scale: isNew ? 0.95 : 1 
    },
    to: { 
      opacity: 1, 
      scale: 1 
    },
    config: config.gentle,
    delay: isNew ? index * 100 : 0, // Staggered entry
  }), [isNew, index]);

  // Main card animation (press, focus, selection, drag)
  const [cardSpring] = useSpring(() => {
    const baseScale = 1;
    const pressScale = 0.98;
    const focusScale = 1.02;
    const dragScale = 1.05;
    
    let targetScale = baseScale;
    if (isDragging) {
      targetScale = dragScale;
    } else if (isPressed) {
      targetScale = pressScale;
    } else if (isFocused) {
      targetScale = focusScale;
    }

    return {
      scale: targetScale,
      translateX: isDragging ? dragOffset.x : 0,
      translateY: isDragging ? dragOffset.y : 0,
      shadowOpacity: isDragging ? 0.3 : isSelected ? 0.2 : 0.1,
      borderWidth: isSelected ? 2 : 0,
      config: isDragging ? config.default : config.gentle,
    };
  }, [isDragging, isPressed, isFocused, isSelected, dragOffset]);

  // Loading animation (gentle pulsing)
  const [loadingSpring] = useSpring(() => ({
    opacity: isLoading ? 0.6 : 1,
    config: config.slow,
    loop: isLoading,
  }), [isLoading]);

  // Content transition animation (for avatar/name changes)
  const [contentSpring] = useSpring(() => ({
    opacity: 1,
    config: config.gentle,
  }), [item.name, item.avatarUrl]);

  // Selection glow animation
  const [selectionSpring] = useSpring(() => ({
    glowOpacity: isSelected ? 0.3 : 0,
    config: config.gentle,
  }), [isSelected]);
  const CardContent = () => (
    <>
      {/* Selection glow background */}
      {isSelected && (
        <AnimatedView
          style={[
            styles.selectionGlow,
            {
              opacity: selectionSpring.glowOpacity,
            },
          ]}
        />
      )}
      
      <AnimatedView 
        style={[
          styles.avatarContainer,
          {
            opacity: contentSpring.opacity,
          },
        ]}
      >
        {item.avatarUrl ? (
          <AnimatedImage 
            source={{ uri: item.avatarUrl }} 
            style={[
              styles.avatar,
              {
                opacity: contentSpring.opacity,
              },
            ]} 
          />
        ) : (
          <AnimatedText 
            style={[
              styles.emoji,
              {
                opacity: contentSpring.opacity,
              },
            ]}
          >
            {item.emoji || '🙂'}
          </AnimatedText>
        )}
      </AnimatedView>
      
      <AnimatedView 
        style={[
          styles.infoContainer,
          {
            opacity: contentSpring.opacity,
          },
        ]}
      >
        <AnimatedText 
          style={[
            styles.name,
            {
              opacity: contentSpring.opacity,
            },
          ]}
        >
          {item.name}
        </AnimatedText>
        {item.category && (
          <AnimatedText 
            style={[
              styles.category,
              {
                opacity: contentSpring.opacity,
              },
            ]}
          >
            {item.category}
          </AnimatedText>
        )}
      </AnimatedView>
      
      {item.rankIndex !== undefined && item.rankIndex !== null && (
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>#{item.rankIndex + 1}</Text>
        </View>
      )}
      
      {mode === 'owner' && !canDrag && (onMoveUp || onMoveDown) && (
        <View style={styles.controlsContainer}>
          {onMoveUp && (
            <TouchableOpacity
              onPress={onMoveUp}
              disabled={!canMoveUp}
              style={[styles.moveButton, !canMoveUp && styles.disabledButton]}
            >
              <Text style={[styles.moveButtonText, !canMoveUp && styles.disabledText]}>▲</Text>
            </TouchableOpacity>
          )}
          {onMoveDown && (
            <TouchableOpacity
              onPress={onMoveDown}
              disabled={!canMoveDown}
              style={[styles.moveButton, !canMoveDown && styles.disabledButton]}
            >
              <Text style={[styles.moveButtonText, !canMoveDown && styles.disabledText]}>▼</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {canDrag && (
        <View style={styles.dragHandle}>
          <Text style={styles.dragHandleText}>⋮⋮</Text>
        </View>
      )}
      
      {/* Loading overlay */}
      {isLoading && (
        <AnimatedView
          style={[
            styles.loadingOverlay,
            {
              opacity: loadingSpring.opacity,
            },
          ]}
        />
      )}
    </>
  );

  if (canDrag) {
    return (
      <AnimatedView
        style={[
          {
            opacity: entrySpring.opacity,
            transform: [{ scale: entrySpring.scale }],
          },
        ]}
      >
        <AnimatedView
          style={[
            styles.card,
            isSelected && { borderColor: '#007AFF' },
            {
              opacity: loadingSpring.opacity,
              borderWidth: cardSpring.borderWidth,
              transform: [
                { scale: cardSpring.scale },
                { translateX: cardSpring.translateX },
                { translateY: cardSpring.translateY },
              ],
              zIndex: isDragging ? 1000 : 1,
              shadowOpacity: cardSpring.shadowOpacity,
            },
          ]}
          onLayout={onLayout}
          {...panResponder.panHandlers}
        >
          <CardContent />
        </AnimatedView>
      </AnimatedView>
    );
  }

  return (
    <AnimatedView
      style={[
        {
          opacity: entrySpring.opacity,
          transform: [{ scale: entrySpring.scale }],
        },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[
          styles.card,
          isSelected && { borderColor: '#007AFF' },
        ]}
        onLayout={onLayout}
      >
        <AnimatedView
          style={[
            styles.cardInner,
            {
              opacity: loadingSpring.opacity,
              borderWidth: cardSpring.borderWidth,
              transform: [{ scale: cardSpring.scale }],
              shadowOpacity: cardSpring.shadowOpacity,
            },
          ]}
        >
          <CardContent />
        </AnimatedView>
      </Pressable>
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    zIndex: -1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    zIndex: 10,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 24,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  rankContainer: {
    backgroundColor: '#e1f5fe',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0277bd',
  },
  controlsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  moveButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  disabledButton: {
    backgroundColor: '#f8f8f8',
  },
  moveButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  disabledText: {
    color: '#ccc',
  },
  dragHandle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleText: {
    fontSize: 16,
    color: '#999',
    fontWeight: 'bold',
    lineHeight: 16,
  },
});

export default SituationshipCard;
