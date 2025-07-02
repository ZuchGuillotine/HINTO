/**
    * @description      : Onboarding screen with swipeable cards and OAuth buttons
    * @author           : 
    * @group            : 
    * @created          : 26/04/2025 - 22:44:25
    * 
    * MODIFICATION LOG
    * - Version         : 2.0.0
    * - Date            : 02/01/2025
    * - Author          : 
    * - Modification    : Redesigned layout with cards in top half, OAuth always visible
**/

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  useColorScheme, 
  Alert,
  ScrollView,
  SafeAreaView 
} from 'react-native';
import { useSpring, animated } from '@react-spring/native';
import FeatureCard from '../components/FeatureCard';
import AuthButton from '../components/AuthButton';
import { useNavigation } from '@react-navigation/native';
import { handleSocialLogin } from '../utils/auth';
import type { AuthProvider } from '../components/AuthButton';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import { textStyles } from '../styles/typography';

const { width, height } = Dimensions.get('window');
const AnimatedView = animated(View);

const slides = [
  {
    key: 'welcome',
    title: "He's Not Into You",
    description: 'Navigate your dating life with clarity and get the truth about your situationships.',
    emoji: '💖',
  },
  {
    key: 'features',
    title: 'Rank Your Crushes',
    description: 'Add people you\'re interested in and drag to reorder based on your priorities.',
    emoji: '📱',
  },
  {
    key: 'ai',
    title: 'AI-Powered Coach',
    description: 'Get private, personalized advice 24/7 from our relationship AI assistant.',
    emoji: '🤖',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation for card transitions
  const cardAnimation = useSpring({
    opacity: 1,
    scale: 1,
    from: { opacity: 0, scale: 0.95 },
    reset: true,
    config: { tension: 300, friction: 30 },
  });

  const goNext = () => {
    if (index < slides.length - 1) {
      setIndex(i => i + 1);
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setIndex(i => i - 1);
    }
  };

  const handleAuth = async (provider: AuthProvider) => {
    try {
      setIsLoading(true);
      await handleSocialLogin(provider);
      // Auth state change will handle navigation to main app automatically
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert(
        'Login Failed',
        'Unable to sign in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.dark.background.primary : colors.background.primary }]}>
      {/* Top Half - Swipeable Cards */}
      <View style={styles.cardsSection}>
        <AnimatedView style={[cardAnimation, styles.cardContainer]}>
          <FeatureCard
            title={slides[index].title}
            description={slides[index].description}
            emoji={slides[index].emoji}
            width={width * 0.85}
          />
        </AnimatedView>

        {/* Card Navigation */}
        <View style={styles.cardNavigation}>
          <View style={styles.pagination}>
            {slides.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dot,
                  idx === index && styles.activeDot,
                  { backgroundColor: idx === index ? colors.primary[500] : colors.neutral[300] }
                ]}
                onPress={() => setIndex(idx)}
              />
            ))}
          </View>
          
          <View style={styles.navButtons}>
            <TouchableOpacity 
              onPress={goPrev} 
              disabled={index === 0}
              style={[styles.navButton, { opacity: index === 0 ? 0.3 : 1 }]}
            >
              <Text style={[styles.navText, { color: isDark ? colors.dark.text.primary : colors.text.primary }]}>
                ← Back
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={goNext}
              disabled={index === slides.length - 1}
              style={[styles.navButton, { opacity: index === slides.length - 1 ? 0.3 : 1 }]}
            >
              <Text style={[styles.navText, { color: isDark ? colors.dark.text.primary : colors.text.primary }]}>
                Next →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Half - OAuth Buttons */}
      <View style={styles.authSection}>
        <Text style={[styles.authTitle, { color: isDark ? colors.dark.text.primary : colors.text.primary }]}>
          Get started with HNNT
        </Text>
        <Text style={[styles.authSubtitle, { color: isDark ? colors.dark.text.secondary : colors.text.secondary }]}>
          Choose your preferred sign-in method
        </Text>
        
        <ScrollView 
          style={styles.authButtonsContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.authButtonsContent}
        >
          <AuthButton 
            provider="instagram" 
            onPress={() => handleAuth('instagram')} 
            disabled={isLoading}
          />
          <AuthButton 
            provider="snapchat" 
            onPress={() => handleAuth('snapchat')} 
            disabled={isLoading}
          />
          <AuthButton 
            provider="google" 
            onPress={() => handleAuth('google')} 
            disabled={isLoading}
          />
          <AuthButton 
            provider="tiktok" 
            onPress={() => handleAuth('tiktok')} 
            disabled={isLoading}
          />
          <AuthButton 
            provider="email" 
            onPress={() => handleAuth('email')} 
            disabled={isLoading}
          />
          
          <TouchableOpacity 
            onPress={() => navigation.navigate('Login')}
            disabled={isLoading}
            style={styles.loginButton}
          >
            <Text style={[styles.loginText, { color: isDark ? colors.dark.text.secondary : colors.text.secondary }]}>
              Already have an account? <Text style={{ color: colors.primary[500] }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Top half - Cards section
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
  },
  
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  
  cardNavigation: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: spacing[6],
  },
  
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: spacing[1],
  },
  
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  
  navButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  
  navButton: {
    padding: spacing[2],
    minWidth: 80,
    alignItems: 'center',
  },
  
  navText: {
    ...textStyles.buttonSmall,
  },
  
  // Bottom half - Auth section
  authSection: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    justifyContent: 'flex-start',
  },
  
  authTitle: {
    ...textStyles.h2,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  
  authSubtitle: {
    ...textStyles.body,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  
  authButtonsContainer: {
    flex: 1,
  },
  
  authButtonsContent: {
    paddingBottom: spacing[4],
  },
  
  loginButton: {
    marginTop: spacing[4],
    padding: spacing[3],
    alignItems: 'center',
  },
  
  loginText: {
    ...textStyles.bodySmall,
    textAlign: 'center',
  },
});
