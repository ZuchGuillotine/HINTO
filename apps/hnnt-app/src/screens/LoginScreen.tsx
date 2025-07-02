import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, useColorScheme, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { handleSocialLogin, AuthProvider } from '../utils/auth';
import AuthButton from '../components/AuthButton';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();

  const onLogin = async (provider: AuthProvider) => {
    try {
      setIsLoading(true);
      await handleSocialLogin(provider);
      // On successful redirect, the auth state change will handle navigation
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
          Create an Account
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#ccc' : '#666' }]}>
          Join the community
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <AuthButton
          provider="google"
          onPress={() => onLogin('google')}
          isLoading={isLoading}
        />
        <AuthButton
          provider="instagram"
          onPress={() => onLogin('instagram')}
          isLoading={isLoading}
        />
        <AuthButton
          provider="snapchat"
          onPress={() => onLogin('snapchat')}
          isLoading={isLoading}
        />
        <AuthButton
          provider="tiktok"
          onPress={() => onLogin('tiktok')}
          isLoading={isLoading}
        />
        <AuthButton
          provider="email"
          onPress={() => navigation.navigate('EmailLogin')} // We'll create this screen later
          isLoading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  buttonContainer: {
    marginBottom: 40,
  },
});