// src/components/ChatBubble.tsx

import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';

export type ChatBubbleProps = {
  /** Optional message text to display */
  text?: string;
  /** Optional array of image URIs to display with the message */
  attachments?: string[];
  /** Styles the bubble as user-sent when true; otherwise AI-sent */
  isUser?: boolean;
  /** Optional timestamp shown under the message */
  timestamp?: string;
};

/**
 * ChatBubble renders a message bubble, including optional image attachments,
 * aligned right for user messages and left for AI messages.
 */
const ChatBubble: React.FC<ChatBubbleProps> = ({ text, attachments, isUser = false, timestamp }) => (
  <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      {attachments && attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.attachmentsContainer}
        >
          {attachments.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.attachmentImage} />
          ))}
        </ScrollView>
      )}
      {text ? (
        <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
          {text}
        </Text>
      ) : null}
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  aiContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderTopRightRadius: 0,
  },
  aiBubble: {
    backgroundColor: '#E5E5EA',
    borderTopLeftRadius: 0,
  },
  attachmentsContainer: {
    marginBottom: 6,
  },
  attachmentImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: '#555',
    marginTop: 4,
    textAlign: 'right',
  },
});

export default ChatBubble;
