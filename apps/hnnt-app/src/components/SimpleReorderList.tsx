/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 01/07/2025 - 19:41:31
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 01/07/2025
    * - Author          : 
    * - Modification    : 
**/
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Situationship } from '../types/API';

interface SimpleReorderListProps {
  items: Situationship[];
  onReorder: (newOrder: string[]) => void;
  renderItem: (item: Situationship, index: number) => React.ReactElement;
  canEdit?: boolean;
}

const SimpleReorderList: React.FC<SimpleReorderListProps> = ({
  items,
  onReorder,
  renderItem,
  canEdit = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);

    // Extract IDs for the reorder function
    const newIds = newItems.map(item => item.id);
    onReorder(newIds);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      moveItem(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items.length - 1) {
      moveItem(index, index + 1);
    }
  };

  const handleLongPress = (index: number) => {
    if (!canEdit) return;
    
    setSelectedIndex(index);
    Alert.alert(
      'Reorder Item',
      `Move "${items[index].name}" to a new position?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move Up', onPress: () => handleMoveUp(index) },
        { text: 'Move Down', onPress: () => handleMoveDown(index) },
      ]
    );
  };

  const renderItemWithControls = ({ item, index }: { item: Situationship; index: number }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.itemContent}
        onLongPress={() => handleLongPress(index)}
        disabled={!canEdit}
      >
        {renderItem(item, index)}
      </TouchableOpacity>
      
      {canEdit && (
        <View style={styles.reorderControls}>
          <TouchableOpacity
            style={[styles.reorderButton, index === 0 && styles.disabledButton]}
            onPress={() => handleMoveUp(index)}
            disabled={index === 0}
          >
            <Text style={[styles.reorderButtonText, index === 0 && styles.disabledText]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reorderButton, index === items.length - 1 && styles.disabledButton]}
            onPress={() => handleMoveDown(index)}
            disabled={index === items.length - 1}
          >
            <Text style={[styles.reorderButtonText, index === items.length - 1 && styles.disabledText]}>↓</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItemWithControls}
      style={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    marginVertical: 4,
  },
  itemContent: {
    flex: 1,
  },
  reorderControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  reorderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  reorderButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
  },
  disabledButton: {
    backgroundColor: '#f8f9fa',
  },
  disabledText: {
    color: '#adb5bd',
  },
});

export default SimpleReorderList; 