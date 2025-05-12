// src/components/VotingControls.tsx

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Situationship } from './SituationshipCard';

export interface VotingControlsProps {
  items: Situationship[];
  onSubmit: (itemId: string) => void;
  freeVotesLeft?: number;         // Monthly free votes
  sessionVoteCap?: number;       // Max votes per session
  onPurchase?: () => void;       // Callback to trigger paywall
}

const VotingControls: React.FC<VotingControlsProps> = ({
  items,
  onSubmit,
  freeVotesLeft = 3,
  sessionVoteCap = 5,
  onPurchase,
}) => {
  const [votesRemaining, setVotesRemaining] = useState<number>(freeVotesLeft);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  const totalVotesUsed = useMemo(() => Object.values(voteCounts).reduce((sum, v) => sum + v, 0), [voteCounts]);
  const sessionVotesRemaining = sessionVoteCap - totalVotesUsed;
  const isOutOfVotes = votesRemaining <= 0 || sessionVotesRemaining <= 0;

  const handleVote = (itemId: string) => {
    if (isOutOfVotes) {
      return;
    }
    // Call parent callback
    onSubmit(itemId);
    // Update local counters
    setVotesRemaining((prev) => prev - 1);
    setVoteCounts((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

  const renderItem = ({ item }: { item: Situationship }) => {
    const count = voteCounts[item.id] || 0;
    const disabled = isOutOfVotes;

    return (
      <View style={styles.option} key={item.id}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.voteButton, disabled && styles.disabledButton]}
            onPress={() => handleVote(item.id)}
            disabled={disabled}
          >
            <Text style={styles.voteButtonText}>Vote</Text>
          </TouchableOpacity>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        Votes Remaining: {Math.max(0, Math.min(votesRemaining, sessionVotesRemaining))}
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
      />
      {isOutOfVotes && (
        <TouchableOpacity
          style={styles.purchaseButton}
          onPress={onPurchase}
        >
          <Text style={styles.purchaseButtonText}>
            Unlock more votes
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  list: {
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007bff',
    borderRadius: 4,
    marginRight: 8,
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  countText: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
  },
  purchaseButton: {
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: '#28a745',
    borderRadius: 4,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VotingControls;
