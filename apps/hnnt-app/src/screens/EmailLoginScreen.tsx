/**
 * @description      : Email login screen with email/password authentication
 * @author           : 
 * @group            : 
 * @created          : 02/01/2025 - 13:30:00
 * 
 * MODIFICATION LOG
 * - Version         : 1.0.0
 * - Date            : 02/01/2025
 * - Author          : 
 * - Modification    : Initial implementation with dev bypass option
**/

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  SafeAreaView,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/spacing';
import { textStyles } from '../styles/typography';
import { useAuth } from '../hooks/useAuth';

type AuthMode = 'signin' | 'signup' | 'verify';

export default function EmailLoginScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');
  const navigation = useNavigation<unknown>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { devBypass, signInWithEmail, signUpWithEmail, confirmSignUp } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);

  const handleSignIn = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLocalLoading(true);
    try {
      console.log(`🔑 LOCAL: Attempting signin with username: ${username}`);
      await signInWithEmail(username, password);
      console.log('✅ LOCAL: Signin successful');
      // Auth context will handle navigation
    } catch (error: unknown) {
      console.error('❌ LOCAL: Sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please check your credentials and try again.';
      Alert.alert('Sign In Failed', errorMessage);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    setLocalLoading(true);
    try {
      console.log(`📝 LOCAL: Attempting signup with username: ${username}, email: ${email}`);
      
      await signUpWithEmail(username, email, password);
      
      console.log('✅ LOCAL: Signup successful, switching to verify mode');
      setMode('verify');
      Alert.alert('Success', 'Please check your email for a verification code');
    } catch (error: unknown) {
      console.error('❌ LOCAL: Sign up error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Sign Up Failed', errorMessage);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setLocalLoading(true);
    try {
      console.log(`🔍 LOCAL: Verifying username: ${username} with code: ${verificationCode}`);
      
      await confirmSignUp(username, verificationCode);
      
      console.log('✅ LOCAL: Verification successful');
      Alert.alert('Success', 'Account verified! You can now sign in.');
      setMode('signin');
      setVerificationCode('');
    } catch (error: unknown) {
      console.error('❌ LOCAL: Verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please check your code and try again.';
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDevBypass = async () => {
    Alert.alert(
      'Development Mode',
      'This will bypass authentication for UI testing. Only use in development!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            try {
              await devBypass();
              // Navigation will be handled automatically by the auth state change
            } catch (error) {
              Alert.alert('Error', 'Dev bypass failed');
            }
          },
        },
      ]
    );
  };

  const renderSignInForm = () => (
    <>
      <Text style={[styles.title, { color: isDark ? colors.dark.text.primary : colors.text.primary }]}>
        Welcome Back
      </Text>
      <Text style={[styles.subtitle, { color: isDark ? colors.dark.text.secondary : colors.text.secondary }]}>
        Sign in to your HNNT account
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Username"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Password"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary[500] }]}
        onPress={handleSignIn}
        disabled={localLoading}
      >
        <Text style={styles.buttonText}>
          {localLoading ? 'Signing In...' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode('signup')}>
        <Text style={[styles.linkText, { color: colors.primary[500] }]}>
          Don&apos;t have an account? Sign Up
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderSignUpForm = () => (
    <>
      <Text style={[styles.title, { color: isDark ? colors.dark.text.primary : colors.text.primary }]}>
        Create Account
      </Text>
      <Text style={[styles.subtitle, { color: isDark ? colors.dark.text.secondary : colors.text.secondary }]}>
        Join HNNT today
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Username"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Email"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Password (min 8 characters)"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Confirm Password"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary[500] }]}
        onPress={handleSignUp}
        disabled={localLoading}
      >
        <Text style={styles.buttonText}>
          {localLoading ? 'Creating Account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode('signin')}>
        <Text style={[styles.linkText, { color: colors.primary[500] }]}>
          Already have an account? Sign In
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderVerificationForm = () => {
    console.log('🔍 Rendering verification form');
    return (
      <>
        <Text style={[styles.title, { color: isDark ? colors.dark.text.primary : colors.text.primary }]}>
          Verify Email
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? colors.dark.text.secondary : colors.text.secondary }]}>
          Enter the verification code sent to {email} for username: {username}
        </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.dark.background.secondary : colors.background.secondary,
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            color: isDark ? colors.dark.text.primary : colors.text.primary,
          },
        ]}
        placeholder="Verification Code"
        placeholderTextColor={isDark ? colors.dark.text.tertiary : colors.text.tertiary}
        value={verificationCode}
        onChangeText={setVerificationCode}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary[500] }]}
        onPress={handleVerification}
        disabled={localLoading}
      >
        <Text style={styles.buttonText}>
          {localLoading ? 'Verifying...' : 'Verify'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode('signin')}>
        <Text style={[styles.linkText, { color: colors.primary[500] }]}>
          Back to Sign In
        </Text>
      </TouchableOpacity>
    </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.dark.background.primary : colors.background.primary }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[styles.backButton, { color: colors.primary[500] }]}>
                ← Back
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {__DEV__ && (
              <Text style={{ textAlign: 'center', marginBottom: 16, fontSize: 12, color: 'gray' }}>
                Current mode: {mode}
              </Text>
            )}
            {mode === 'signin' && renderSignInForm()}
            {mode === 'signup' && renderSignUpForm()}
            {mode === 'verify' && renderVerificationForm()}

            {__DEV__ && (
              <View style={styles.devSection}>
                <Text style={[styles.devText, { color: isDark ? colors.dark.text.tertiary : colors.text.tertiary }]}>
                  Development Mode
                </Text>
                <TouchableOpacity
                  style={[styles.devButton, { borderColor: colors.warning[500] }]}
                  onPress={handleDevBypass}
                >
                  <Text style={[styles.devButtonText, { color: colors.warning[500] }]}>
                    Bypass Auth (Testing Only)
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  backButton: {
    ...textStyles.body,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    ...textStyles.h1,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  input: {
    ...textStyles.body,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.input,
    borderWidth: 1,
    marginBottom: spacing[4],
  },
  primaryButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: radius.button,
    alignItems: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  buttonText: {
    ...textStyles.button,
    color: colors.text.inverse,
  },
  linkText: {
    ...textStyles.body,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  devSection: {
    marginTop: spacing[8],
    paddingTop: spacing[6],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[300],
    alignItems: 'center',
  },
  devText: {
    ...textStyles.caption,
    marginBottom: spacing[4],
  },
  devButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.button,
    borderWidth: 1,
  },
  devButtonText: {
    ...textStyles.buttonSmall,
  },
});