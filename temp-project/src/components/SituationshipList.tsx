// src/components/SituationshipList.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  const { items, loading, error, reorder, submitVote, canEdit, canVote } = useSituationships(ownerId, shareToken);

  if (loading) {
    return <View style={styles.loading} />; // TODO: replace with skeleton component
  }
  if (error) {
    return <View style={styles.error} />; // TODO: replace with error UI
  }

  const renderItem = ({ item, index, drag, isActive }: RenderItemParams<any>) => (
    <SituationshipListView
      item={item}
      index={index}
      drag={mode === 'owner' && canEdit ? drag : undefined}
      isActive={isActive}
      mode={mode}
      onVote={(voteType) => mode === 'guest' && canVote && submitVote(item.id, voteType)}
    />
  );

  return (
    <View style={styles.container}>
      {mode === 'owner' && canEdit ? (
        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorder(data.map(i => i.id))}
        />
      ) : (
        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled
n          activationDistance={100000} // disable drag
        />
      )}
      {mode === 'guest' && canVote && <VotingControls items={items} onSubmit={submitVote} />}
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
