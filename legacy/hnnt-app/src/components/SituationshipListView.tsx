// src/components/SituationshipListView.tsx

import React, { useState, useEffect } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import SituationshipCard, { Situationship } from './SituationshipCard';

export interface SituationshipListViewProps {
  item: Situationship;
  index: number;
  mode: 'owner' | 'guest';
  onVote?: (voteType: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
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
  selectedItems?: string[];
  isNew?: boolean;
}

const SituationshipListView: React.FC<SituationshipListViewProps> = ({
  item,
  index,
  mode,
  onVote: _onVote,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  canDrag,
  dragOffset,
  onLayout,
  isLoading = false,
  isSelected = false,
  selectedItems = [],
  isNew = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [wasJustCreated, setWasJustCreated] = useState(isNew);

  // Detect if this is a newly created item based on createdAt timestamp
  useEffect(() => {
    if (item.createdAt) {
      const createdTime = new Date(item.createdAt).getTime();
      const now = Date.now();
      const fiveSecondsAgo = now - 5000; // 5 seconds
      
      if (createdTime > fiveSecondsAgo) {
        setWasJustCreated(true);
        // Reset the "new" state after animation completes
        const timer = setTimeout(() => {
          setWasJustCreated(false);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [item.createdAt]);

  // Determine if card is selected (from selectedItems array or isSelected prop)
  const cardIsSelected = isSelected || selectedItems.includes(item.id);

  const handlePress = () => {
    // Handle card press - could navigate to detail view
    // TODO: Add navigation or callback handling here
  };

  const handleFocusIn = () => {
    setIsFocused(true);
  };

  const handleFocusOut = () => {
    setIsFocused(false);
  };

  return (
    <View
      onPointerEnter={handleFocusIn}
      onPointerLeave={handleFocusOut}
    >
      <SituationshipCard
        item={item}
        index={index}
        mode={mode}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onPress={handlePress}
        isDragging={isDragging}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        canDrag={canDrag}
        dragOffset={dragOffset}
        onLayout={onLayout}
        // Animation props
        isLoading={isLoading}
        isSelected={cardIsSelected}
        isFocused={isFocused}
        isNew={wasJustCreated || isNew}
      />
    </View>
  );
};

export default SituationshipListView;
