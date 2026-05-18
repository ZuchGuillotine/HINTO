// src/components/ChatBubble.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { useSpring, animated, config } from '@react-spring/native';

const AnimatedView = animated(View);
const AnimatedText = animated(Text);

export type ChatBubbleProps = {
  /** Optional message text to display */
  text?: string;
  /** Optional array of image URIs to display with the message */
  attachments?: string[];
  /** Styles the bubble as user-sent when true; otherwise AI-sent */
  isUser?: boolean;
  /** Optional timestamp shown under the message */
  timestamp?: string;
  /** Whether this message is streaming (for AI responses) */
  isStreaming?: boolean;
  /** Animation delay in milliseconds */
  animationDelay?: number;
};

/**
 * Animated text component that reveals text progressively for streaming
 */
const StreamingText: React.FC<{ 
  text: string; 
  isStreaming: boolean; 
  style: object;
  delay?: number;
}> = ({ text, isStreaming, style, delay = 0 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      return;
    }

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 30 + delay); // 30ms per character with optional delay

      return () => clearTimeout(timeout);
    }
  }, [text, isStreaming, currentIndex, delay]);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText('');
      setCurrentIndex(0);
    }
  }, [text, isStreaming]);

  return (
    <AnimatedText style={style}>
      {displayedText}
    </AnimatedText>
  );
};

/**
 * ChatBubble renders a message bubble with smooth animations,
 * aligned right for user messages and left for AI messages.
 */
const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  text, 
  attachments, 
  isUser = false, 
  timestamp, 
  isStreaming = false,
  animationDelay = 0
}) => {
  // Bubble entrance animation
  const bubbleAnimation = useSpring({
    from: { opacity: 0, transform: [{ scale: 0.8 }, { translateY: 20 }] },
    to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
    delay: animationDelay,
    config: config.gentle,
  });

  // Attachment animation
  const attachmentAnimation = useSpring({
    from: { opacity: 0, transform: [{ scale: 0.9 }] },
    to: { opacity: 1, transform: [{ scale: 1 }] },
    delay: animationDelay + 100,
    config: config.gentle,
  });

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <AnimatedView 
        style={[
          styles.bubble, 
          isUser ? styles.userBubble : styles.aiBubble,
          bubbleAnimation
        ]}
      >
        {attachments && attachments.length > 0 && (
          <AnimatedView style={[styles.attachmentsContainer, attachmentAnimation]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {attachments.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.attachmentImage} />
              ))}
            </ScrollView>
          </AnimatedView>
        )}
        {text ? (
          <StreamingText
            text={text}
            isStreaming={isStreaming}
            style={[styles.text, isUser ? styles.userText : styles.aiText]}
            delay={animationDelay}
          />
        ) : null}
        {timestamp && (
          <AnimatedText 
            style={[
              styles.timestamp,
              {
                opacity: bubbleAnimation.opacity,
              }
            ]}
          >
            {timestamp}
          </AnimatedText>
        )}
      </AnimatedView>
    </View>
  );
};

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
