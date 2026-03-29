// src/components/ChatInput.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSpring, animated, config } from '@react-spring/native';
import { useAttachments } from '../context/useAttachments';
import { useOCR } from '../context/useOCR';

const AnimatedTouchableOpacity = animated(TouchableOpacity);

const MAX_WIDTH = 1024;
const QUALITY = 0.8;

type ChatInputProps = {
  onSend: (text: string, ocrTexts: string[]) => void;
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const { attachments, addAttachment, removeAttachment } = useAttachments();
  const { submitOCR } = useOCR();

  // Send button animation
  const sendButtonAnimation = useSpring({
    transform: isPressed ? [{ scale: 0.95 }] : [{ scale: 1 }],
    config: config.wobbly,
  });

  // Input container animation
  const inputAnimation = useSpring({
    transform: text.length > 0 ? [{ scale: 1.02 }] : [{ scale: 1 }],
    config: config.gentle,
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.cancelled) {
      processImage(result.uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.cancelled) {
      processImage(result.uri);
    }
  };

  const processImage = async (uri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_WIDTH } }],
        { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
      );
      addAttachment({ uri: manipResult.uri });
    } catch (err) {
      console.error('Image processing error', err);
    }
  };

  const handleSend = async () => {
    // Haptic feedback on send
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setUploading(true);
    const ocrResults: string[] = [];
    for (const att of attachments) {
      try {
        const ocrText = await submitOCR(att.uri);
        ocrResults.push(ocrText);
      } catch (err) {
        console.error('OCR error', err);
      }
    }
    onSend(text, ocrResults);
    setText('');
    setUploading(false);
  };

  const handlePressIn = () => {
    setIsPressed(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const canSend = !!text.trim() || attachments.length > 0;

  return (
    <View style={styles.container}>
      {attachments.length > 0 && (
        <FlatList
          data={attachments}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.attachment}>
              <Image source={{ uri: item.uri }} style={styles.thumbnail} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeAttachment(item.id)}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
          <Ionicons name="image-outline" size={24} />
        </TouchableOpacity>
        <TouchableOpacity onPress={takePhoto} style={styles.iconButton}>
          <Ionicons name="camera-outline" size={24} />
        </TouchableOpacity>
        <animated.View style={[inputAnimation]}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            multiline
            value={text}
            onChangeText={setText}
          />
        </animated.View>
        <AnimatedTouchableOpacity
          onPress={handleSend}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!canSend || uploading}
          style={[
            styles.sendButton,
            !(canSend && !uploading) && styles.disabledButton,
            sendButtonAnimation,
          ]}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="send" size={24} color="#fff" />
          )}
        </AnimatedTouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  attachment: {
    marginRight: 8,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginHorizontal: 4,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 24,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

export default ChatInput;
