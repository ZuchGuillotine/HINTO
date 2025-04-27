// src/components/SituationshipCard.tsx

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';

export interface Situationship {
  id: string;
  name: string;
  category: string;
  avatarUrl?: string;
  emoji?: string;
  rankIndex?: number;
}

export interface SituationshipCardProps {
  item: Situationship;
  index: number;
  mode: 'owner' | 'guest';
  drag?: () => void;
  isActive?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
}

const SituationshipCard: React.FC<SituationshipCardProps> = ({
  item,
  index,
  mode,
  drag,
  isActive,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={mode === 'owner' && drag ? drag : undefined}
      onPress={onPress}
      style={[
        styles.card,
        mode === 'owner' && drag && styles.draggable,
        isActive && styles.activeCard,
      ]}
    >
      <View style={styles.avatarContainer}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <Text style={styles.emoji}>{item.emoji || '🙂'}</Text>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      {item.rankIndex !== undefined && (
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>#{item.rankIndex + 1}</Text>
        </View>
      )}
    </TouchableOpacity>
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
  },
  draggable: {
    // show handle or subtle visual cue for draggable items
    borderColor: '#ccc',
    borderWidth: 1,
  },
  activeCard: {
    opacity: 0.8,
    transform: [{ scale: 1.03 }],
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
  },
  rankText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0277bd',
  },
});

export default SituationshipCard;
