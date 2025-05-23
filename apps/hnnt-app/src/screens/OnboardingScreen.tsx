/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 26/04/2025 - 22:44:25
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 26/04/2025
    * - Author          : 
    * - Modification    : 
**/
# Onboarding Screen Design

import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, useColorScheme, Alert } from 'react-native';
import FeatureCard from '../components/FeatureCard';
import AuthButton from '../components/AuthButton';
import { useNavigation } from '@react-navigation/native';
import { handleSocialLogin } from '../utils/auth';
import type { AuthProvider } from '../components/AuthButton';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'welcome',
    title: "He's Not Into You",
    description: 'Navigate your dating life with clarity.',
  },
  {
    key: 'features',
    title: 'Add and rank your crushes',
    description: 'Quickly add people and drag to reorder.',
  },
  {
    key: 'features2',
    title: 'AI-Powered Coach',
    description: 'Get private advice 24/7.',
  },
  {
    key: 'features3',
    title: 'Invite Friends',
    description: 'Share your list and get real feedback.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();

  const isLast = index === slides.length - 1;

  const goNext = () => {
    if (isLast) return;
    setIndex(i => i + 1);
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex(i => i - 1);
  };

  const handleAuth = async (provider: AuthProvider) => {
    try {
      setIsLoading(true);
      await handleSocialLogin(provider);
      // If login is successful, navigate to the main app
      navigation.replace('SituationshipList');
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
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>      
      <View style={styles.slideContainer}>
        <FeatureCard
          title={slides[index].title}
          description={slides[index].description}
          width={width * 0.8}
          />
      </View>

      <View style={styles.pagination}>
        {slides.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              idx === index && styles.activeDot,
            ]}
          />
        ))}
      </View>

      {isLast ? (
        <View style={styles.authContainer}>
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
            provider="tiktok" 
            onPress={() => handleAuth('tiktok')} 
            disabled={isLoading}
          />
          <AuthButton 
            provider="google" 
            onPress={() => handleAuth('google')} 
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
          >
            <Text style={[styles.loginText, isLoading && styles.disabledText]}>
              Already have an account? Login
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.navButtons}>          
          <TouchableOpacity onPress={goPrev} disabled={index === 0}>
            <Text style={[styles.navText, index === 0 && styles.disabledText]}>← Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goNext}>
            <Text style={styles.navText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slideContainer: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#333',
  },
  navButtons: {
    flexDirection: 'row',
    width: '80%',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navText: {
    fontSize: 16,
  },
  disabledText: {
    opacity: 0.5,
  },
  authContainer: {
    width: '80%',
    alignItems: 'center',
  },
  loginText: {
    marginTop: 12,
    textDecorationLine: 'underline',
    fontSize: 14,
  },
});
```

*Next: implement `AuthButton` props for `provider` and wire up actual auth logic.*

