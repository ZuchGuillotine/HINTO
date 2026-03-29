import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  useColorScheme, 
  SafeAreaView, 
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { useSpring, animated, config } from '@react-spring/native';
import Header from '../components/Header';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/Chatinput';
import TypingIndicator from '../components/TypingIndicator';
import ConnectionStatus from '../components/ConnectionStatus';

const AnimatedFlatList = animated(FlatList);

type Message = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  isStreaming?: boolean;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your AI coach. I'm here to help you navigate your relationship questions and provide personalized advice. What's on your mind?",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const flatListRef = useRef<FlatList>(null);

  // Screen entrance animation
  const screenAnimation = useSpring({
    from: { opacity: 0, transform: [{ translateY: 20 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
    config: config.gentle,
  });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = (animated: boolean = true) => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: 0, 
          animated,
          viewPosition: 0
        });
      }, 100);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const simulateAIResponse = async (userMessage: string) => {
    setIsTyping(true);
    
    // Simulate API delay (≤3s for first token)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const aiResponse = `I understand you're asking about "${userMessage.substring(0, 30)}...". Let me help you with that. This is a simulated AI response that demonstrates the streaming text animation feature.`;
    
    const newMessageId = Date.now().toString();
    setStreamingMessageId(newMessageId);
    setIsTyping(false);
    
    const newMessage: Message = {
      id: newMessageId,
      text: aiResponse,
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
    };
    
    setMessages(prev => [newMessage, ...prev]);
    
    // Stop streaming after text is revealed
    setTimeout(() => {
      setStreamingMessageId(null);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === newMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    }, aiResponse.length * 30 + 1000); // 30ms per character + buffer
  };

  const onSend = async (text: string, ocrTexts: string[]) => {
    if (!text.trim() && ocrTexts.length === 0) return;

    const fullText = [text, ...ocrTexts].filter(Boolean).join('\n');
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: fullText,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [userMessage, ...prev]);
    
    // Simulate AI response
    await simulateAIResponse(fullText);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
    <ChatBubble
      text={item.text}
      isUser={item.isUser}
      timestamp={item.timestamp}
      isStreaming={item.isStreaming}
      animationDelay={index * 100}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <Header title="AI Coach" />
      <ConnectionStatus isOnline={isOnline} visible={true} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <animated.View style={[styles.chatContainer, screenAnimation]}>
          <AnimatedFlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={scrollToBottom}
            style={[{ backgroundColor: isDark ? '#000' : '#fff' }]}
          />
          
          <TypingIndicator visible={isTyping} />
          
          <ChatInput onSend={onSend} />
        </animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  systemMessage: {
    alignItems: 'center',
    padding: 16,
  },
  systemText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});