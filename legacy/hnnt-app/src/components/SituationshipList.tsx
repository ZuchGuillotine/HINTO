// src/components/SituationshipList.tsx

import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, ListRenderItem, LayoutChangeEvent } from 'react-native';
import SituationshipListView from './SituationshipListView';
import VotingControls from './VotingControls';
import { useSituationships } from '../context/useSituationships';
import { Situationship } from '../types/API';

export type SituationshipListProps = {
  mode: 'owner' | 'guest';
  ownerId?: string;
  shareToken?: string;
};

const SituationshipList: React.FC<SituationshipListProps> = ({ mode, ownerId, shareToken }) => {
  const { items, loading, error, reorder, submitVote, canEdit, canVote } = useSituationships(ownerId, shareToken);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragIndex: number;
    dragOffset: { x: number; y: number };
  }>({ isDragging: false, dragIndex: -1, dragOffset: { x: 0, y: 0 } });
  
  const itemLayouts = useRef<{ [key: number]: { y: number; height: number } }>({});

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDragState({
      isDragging: true,
      dragIndex: index,
      dragOffset: { x: 0, y: 0 },
    });
  }, []);

  const handleDragMove = useCallback((gestureState: { dx: number; dy: number }) => {
    setDragState(prev => ({
      ...prev,
      dragOffset: { x: gestureState.dx, y: gestureState.dy },
    }));
  }, []);

  const handleDragEnd = useCallback((fromIndex: number, toIndex: number) => {
    setDragState({ isDragging: false, dragIndex: -1, dragOffset: { x: 0, y: 0 } });
    
    if (fromIndex !== toIndex && mode === 'owner' && canEdit) {
      const newItems = [...items];
      const [draggedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, draggedItem);
      
      // Update rankIndex for all items and get new order
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        rankIndex: index,
      }));
      
      const newIds = updatedItems.map(item => item.id);
      
      // Optimize: Only call reorder if it meets performance requirement
      const startTime = Date.now();
      reorder(newIds).finally(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        if (duration > 200) {
          console.warn(`Reorder took ${duration}ms, exceeding 200ms requirement`);
        }
      });
    }
  }, [items, mode, canEdit, reorder]);

  const handleItemLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    itemLayouts.current[index] = { y, height };
  }, []);

  if (loading) {
    return <View style={styles.loading} />; // TODO: replace with skeleton component
  }
  if (error) {
    return <View style={styles.error} />; // TODO: replace with error UI
  }

  // Handle reordering with up/down buttons (fallback)
  const handleMoveUp = (index: number) => {
    if (index > 0 && mode === 'owner' && canEdit) {
      const newItems = [...items];
      [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
      const newIds = newItems.map(item => item.id);
      reorder(newIds);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items.length - 1 && mode === 'owner' && canEdit) {
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      const newIds = newItems.map(item => item.id);
      reorder(newIds);
    }
  };

  const renderItem: ListRenderItem<Situationship> = ({ item, index }) => {
    const isDragging = dragState.isDragging && dragState.dragIndex === index;
    const canDrag = mode === 'owner' && canEdit;
    
    return (
      <SituationshipListView
        item={item}
        index={index}
        mode={mode}
        onVote={(voteType: string) => {
          if (mode === 'guest' && canVote && (voteType === 'best' || voteType === 'worst')) {
            submitVote(item.id, voteType);
          }
        }}
        onMoveUp={!canDrag ? (mode === 'owner' && canEdit ? () => handleMoveUp(index) : undefined) : undefined}
        onMoveDown={!canDrag ? (mode === 'owner' && canEdit ? () => handleMoveDown(index) : undefined) : undefined}
        canMoveUp={mode === 'owner' && canEdit && index > 0}
        canMoveDown={mode === 'owner' && canEdit && index < items.length - 1}
        // Drag and drop props
        isDragging={isDragging}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        canDrag={canDrag}
        dragOffset={isDragging ? dragState.dragOffset : { x: 0, y: 0 }}
        onLayout={(event) => handleItemLayout(index, event)}
      />
    );
  };

  // Handle vote submission with new vote types
  const handleVoteSubmit = (itemId: string, voteType: 'bestFit' | 'notTheOne', comment?: string) => {
    const legacyVoteType = voteType === 'bestFit' ? 'best' : 'worst';
    submitVote(itemId, legacyVoteType, comment);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragState.isDragging}
        keyboardShouldPersistTaps="handled"
      />
      {mode === 'guest' && canVote && (
        <VotingControls 
          items={items} 
          onSubmit={handleVoteSubmit}
          showResults={true}
          allowComments={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SituationshipList;