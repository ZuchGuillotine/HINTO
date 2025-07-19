import { signInWithRedirect, signOut as amplifySignOut, getCurrentUser, signUp, signIn, confirmSignUp, resendSignUpCode } from '@aws-amplify/auth';
import { Alert } from 'react-native';

export type AuthProvider = 'google' | 'instagram' | 'snapchat' | 'tiktok' | 'email';

/**
 * Get the current Expo development server URL
 * @returns The current development server URL or fallback
 */
const getExpoDevUrl = (): string => {
  // In development, use the current IP from Expo logs
  // This should match the Metro bundler URL shown in console
  if (typeof global !== 'undefined' && __DEV__) {
    // Try to get the current IP from Expo constants or environment
    const expoUrl = process.env.EXPO_DEVELOPMENT_URL;
    if (expoUrl) {
      return expoUrl;
    }
    
    // Try to detect from various sources
    try {
      // Check if we're in Expo Go and can get the manifest
      if (typeof global !== 'undefined' && global.location) {
        const { hostname, port } = global.location;
        if (hostname && port) {
          return `exp://${hostname}:${port}/`;
        }
      }
    } catch (e) {
      // Ignore errors during detection
    }
    
    // Fallback to the IP seen in your logs
    return 'exp://192.168.1.103:8081/';
  }
  return 'exp://localhost:19000/';
};

/**
 * Get the appropriate redirect URI based on environment
 * @returns The redirect URI for the current environment
 */
export const getRedirectUri = (): string => {
  if (__DEV__) {
    return getExpoDevUrl();
  }
  return 'hnnt://';
};

/**
 * Get redirect URI for Google OAuth (needs to be localhost for development)
 * @returns The redirect URI for Google OAuth
 */
export const getGoogleRedirectUri = (): string => {
  if (__DEV__) {
    // Google OAuth requires localhost URLs in development
    return 'http://localhost:8081/auth/callback';
  }
  return 'https://www.hnnt.app/auth/callback/';
};

/**
 * Get production redirect URIs for AWS Cognito configuration
 * @returns Array of production redirect URIs
 */
export const getProductionRedirectUris = (): string[] => {
  return [
    'hnnt://',
    'https://www.hnnt.app/auth/callback/'
  ];
};

/**
 * Get development redirect URIs for AWS Cognito configuration
 * @returns Array of development redirect URIs
 */
export const getDevelopmentRedirectUris = (): string[] => {
  return [
    'exp://localhost:19000/',
    'exp://192.168.1.103:8081/',
    'exp://127.0.0.1:19000/',
    'exp://[::1]:19000/',
    // Add common development IPs
    'exp://10.0.0.0:8081/',
    'exp://172.16.0.0:8081/',
    'exp://192.168.0.0:8081/',
  ];
};

/**
 * Handle social login with the specified provider
 * @param provider The social login provider to use
 * @returns Promise that resolves when login is complete
 */
export const handleSocialLogin = async (provider: AuthProvider): Promise<void> => {
  try {
    const redirectUri = provider === 'google' ? getGoogleRedirectUri() : getRedirectUri();
    console.log(`Attempting ${provider} login with redirect URI: ${redirectUri}`);
    
    switch (provider) {
      case 'google':
        await signInWithRedirect({ provider: 'Google' });
        break;
      case 'instagram':
        // Instagram uses the same OAuth flow as Facebook since it's part of the Meta platform
        // We'll use the Facebook provider but with Instagram scopes
        await signInWithRedirect({ 
          provider: 'Facebook',
          customState: 'instagram' // This helps us identify it's an Instagram login
        });
        break;
      case 'snapchat':
        // For Snapchat, we'll use our custom Lambda function
        // This will be implemented when we set up the API Gateway endpoints
        throw new Error('Snapchat login not yet implemented');
      case 'tiktok':
        // For TikTok, we'll use our custom Lambda function
        // This will be implemented when we set up the API Gateway endpoints
        throw new Error('TikTok login not yet implemented');
      case 'email':
        // For email, we'll use the navigation to LoginScreen
        throw new Error('EMAIL_NAVIGATION_REQUIRED');
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error: any) {
    console.error(`${provider} OAuth error:`, error);
    
    const redirectUri = getRedirectUri();
    
    // Enhanced error handling for common OAuth issues
    if (error.message?.includes('redirect_uri_mismatch')) {
      Alert.alert(
        'OAuth Configuration Error',
        __DEV__ 
          ? `Redirect URI mismatch. Expected: ${redirectUri}. Please check your Cognito configuration.`
          : 'There was an issue with the OAuth configuration. Please contact support.',
        [{ text: 'OK' }]
      );
    } else if (error.message?.includes('UserPool not configured')) {
      if (__DEV__) {
        Alert.alert(
          'Development Mode',
          'OAuth is not configured for development. Use the "Bypass Auth" option in the email login screen for testing.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Service Unavailable',
          'Authentication service is temporarily unavailable. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } else if (error.message?.includes('not yet implemented')) {
      Alert.alert(
        'Feature Coming Soon',
        `${provider} login is not yet available. Please try Google or Instagram.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Login Error',
        __DEV__ 
          ? `Failed to sign in with ${provider}: ${error.message}`
          : `Failed to sign in with ${provider}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
    
    throw error;
  }
};

/**
 * Check if the user is currently authenticated
 * @returns Promise that resolves to true if authenticated, false otherwise
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
};

/**
 * Sign out the current user
 * @returns Promise that resolves when sign out is complete
 */
export const signOut = async (): Promise<void> => {
  try {
    await amplifySignOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

/**
 * Get the current user's session
 * @returns Promise that resolves to the current user or null if not authenticated
 */
export const getCurrentSession = async () => {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
};

/**
 * Sign up with email and password
 * @param email User's email address
 * @param password User's password
 * @param username Optional username (will use email if not provided)
 * @returns Promise that resolves to the sign up result
 */
export const signUpWithEmail = async (email: string, password: string, username?: string) => {
  try {
    const result = await signUp({
      username: username || email,
      password,
      options: {
        userAttributes: {
          email,
        },
        autoSignIn: true
      }
    });
    return result;
  } catch (error: any) {
    console.error('Email signup error:', error);
    
    // If it's a UserPool configuration error in dev mode, suggest the bypass
    if (error.message?.includes('UserPool not configured') && __DEV__) {
      throw new Error('UserPool configuration issue detected. Please use the Development Bypass option below for testing.');
    }
    
    throw error;
  }
};

/**
 * Sign in with email and password
 * @param email User's email address
 * @param password User's password
 * @returns Promise that resolves when sign in is complete
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signIn({
      username: email,
      password
    });
    return result;
  } catch (error: any) {
    console.error('Email signin error:', error);
    
    // If it's a UserPool configuration error in dev mode, suggest the bypass
    if (error.message?.includes('UserPool not configured') && __DEV__) {
      throw new Error('UserPool configuration issue detected. Please use the Development Bypass option below for testing.');
    }
    
    throw error;
  }
};

/**
 * Confirm sign up with verification code
 * @param email User's email address
 * @param code Verification code sent to email
 * @returns Promise that resolves when confirmation is complete
 */
export const confirmSignUpWithCode = async (email: string, code: string) => {
  try {
    const result = await confirmSignUp({
      username: email,
      confirmationCode: code
    });
    return result;
  } catch (error) {
    console.error('Confirmation error:', error);
    throw error;
  }
};

/**
 * Resend verification code
 * @param email User's email address
 * @returns Promise that resolves when code is resent
 */
export const resendVerificationCode = async (email: string) => {
  try {
    const result = await resendSignUpCode({
      username: email
    });
    return result;
  } catch (error) {
    console.error('Resend code error:', error);
    throw error;
  }
};

/**
 * Development mode bypass - DO NOT USE IN PRODUCTION
 * Creates a temporary mock user for testing UI
 * @returns Promise that resolves to a mock authenticated state
 */
export const devModeBypass = async () => {
  if (!__DEV__) {
    throw new Error('Development bypass only available in dev mode');
  }
  
  console.warn('🚨 DEVELOPMENT MODE: Bypassing authentication for UI testing');
  
  // Return a mock user object for testing
  return {
    userId: 'dev-user-123',
    username: 'dev-user',
    email: 'dev@hnnt.app',
    isDevMode: true
  };
};
