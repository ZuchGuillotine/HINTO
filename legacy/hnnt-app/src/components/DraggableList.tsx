import React, { useRef, useState } from 'react';
import {
  View,
  FlatList,
  PanResponder,
  Animated,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DraggableListProps<T> {
  data: T[];
  renderItem: (item: T, index: number, drag: () => void, isActive: boolean) => React.ReactElement;
  keyExtractor: (item: T) => string;
  onDragEnd: (data: T[]) => void;
  enabled?: boolean;
}

export function DraggableList<T>({
  data,
  renderItem,
  keyExtractor,
  onDragEnd,
  enabled = true,
}: DraggableListProps<T>) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [items, setItems] = useState(data);
  const pan = useRef(new Animated.ValueXY()).current;
  const scrollOffset = useRef(0);
  const flatListRef = useRef<FlatList>(null);
  const itemHeight = useRef(0);
  const topOffset = useRef(0);

  React.useEffect(() => {
    setItems(data);
  }, [data]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => draggingIdx !== null,
      onPanResponderGrant: () => {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: 0, y: gestureState.dy });
        
        // Auto-scroll when near edges
        const screenHeight = Dimensions.get('window').height;
        const currentY = topOffset.current + gestureState.dy;
        
        if (currentY < 100 && scrollOffset.current > 0) {
          flatListRef.current?.scrollToOffset({
            offset: Math.max(0, scrollOffset.current - 5),
            animated: false,
          });
        } else if (currentY > screenHeight - 200) {
          flatListRef.current?.scrollToOffset({
            offset: scrollOffset.current + 5,
            animated: false,
          });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (draggingIdx === null || itemHeight.current === 0) return;

        const moveY = gestureState.dy + scrollOffset.current;
        const destIndex = Math.max(
          0,
          Math.min(
            items.length - 1,
            Math.round((topOffset.current + moveY) / itemHeight.current)
          )
        );

        if (destIndex !== draggingIdx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          
          const newItems = [...items];
          const [removed] = newItems.splice(draggingIdx, 1);
          newItems.splice(destIndex, 0, removed);
          
          setItems(newItems);
          onDragEnd(newItems);
        }

        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        
        setDraggingIdx(null);
      },
    })
  ).current;

  const startDrag = (index: number) => {
    if (!enabled) return;
    
    setDraggingIdx(index);
    if (Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderItemWrapper = ({ item, index }: { item: T; index: number }) => {
    const isDragging = draggingIdx === index;
    
    return (
      <View
        onLayout={(e) => {
          if (itemHeight.current === 0) {
            itemHeight.current = e.nativeEvent.layout.height;
          }
          if (index === 0) {
            topOffset.current = e.nativeEvent.layout.y;
          }
        }}
      >
        <Animated.View
          style={[
            isDragging && {
              transform: [
                { translateY: pan.y },
              ],
              opacity: 0.8,
              zIndex: 1000,
            },
          ]}
          {...(isDragging ? panResponder.panHandlers : {})}
        >
          {renderItem(item, index, () => startDrag(index), isDragging)}
        </Animated.View>
        {isDragging && (
          <View style={styles.placeholder} />
        )}
      </View>
    );
  };

  return (
    <FlatList
      ref={flatListRef}
      data={items}
      renderItem={renderItemWrapper}
      keyExtractor={keyExtractor}
      onScroll={(e) => {
        scrollOffset.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      scrollEnabled={draggingIdx === null}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f0f0f0',
    height: 80, // Adjust based on your item height
  },
}); 