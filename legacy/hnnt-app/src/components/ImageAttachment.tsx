// src/components/ImageAttachment.tsx

import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ImageAttachmentProps = {
  /** URI of the image to display */
  uri: string;
  /** Callback fired when the user taps the remove icon */
  onRemove: () => void;
  /** Optional size override (width & height in px) */
  size?: number;
};

/**
 * A small thumbnail preview with a remove button,
 * used in ChatInput to display attached images.
 */
const ImageAttachment: React.FC<ImageAttachmentProps> = ({ uri, onRemove, size = 60 }) => (
  <View style={[styles.container, { width: size, height: size }]}>  
    <Image source={{ uri }} style={styles.image} />
    <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
      <Ionicons name="close-circle" size={18} color="#fff" />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
});

export default ImageAttachment;
