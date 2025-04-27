// src/components/SituationshipList.tsx

import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import SituationshipListView from './SituationshipListView';
import VotingControls from './VotingControls';
import { useSituationships } from '../context/useSituationships';

export type SituationshipListProps = {
  mode: 'owner' | 'guest';
  ownerId?: string;
  shareToken?: string;
};

const SituationshipList: React.FC<SituationshipListProps> = ({ mode, ownerId, shareToken }) => {
  const { items, loading, error, reorder, submitVote, canEdit, canVote } =
    useSituationships(ownerId, shareToken);

  if (loading) {
    return <View style={styles.loading} />; // TODO: replace with skeleton
  }
  if (error) {
    return <View style={styles.error} />; // TODO: replace with error UI
  }

  const renderDraggableItem = ({ item, index, drag, isActive }: RenderItemParams<any>) => (
    <SituationshipListView
      item={item}
      index={index}
      mode={mode}
      drag={mode === 'owner' && canEdit ? drag : undefined}
      isActive={isActive}
    />
  );

  const renderStaticItem = ({ item, index }: { item: any; index: number }) => (
    <SituationshipListView item={item} index={index} mode={mode} />
  );

  return (
    <View style={styles.container}>
      {mode === 'owner' && canEdit ? (
        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderDraggableItem}
          onDragEnd={({ data }) => reorder(data.map((i) => i.id))}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderStaticItem}
        />
      )}
      {mode === 'guest' && canVote && (
        <VotingControls items={items} onSubmit={submitVote} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, backgroundColor: '#f0f0f0' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default SituationshipList;
