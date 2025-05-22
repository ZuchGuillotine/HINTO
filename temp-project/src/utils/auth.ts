import { signInWithRedirect, signOut as amplifySignOut, getCurrentUser } from 'aws-amplify/auth';
import { AuthProvider } from '../components/AuthButton';

/**
 * Handle social login with the specified provider
 * @param provider The social login provider to use
 * @returns Promise that resolves when login is complete
 */
export const handleSocialLogin = async (provider: AuthProvider): Promise<void> => {
  try {
    switch (provider) {
      case 'google':
        await signInWithRedirect({ provider: 'Google' });
        break;
      case 'instagram':
        // Instagram uses the same OAuth flow as Facebook since it's part of the Meta platform
        // We'll use the Facebook provider but with Instagram scopes
        await signInWithRedirect({ 
          provider: 'Facebook',
          customState: 'instagram', // This helps us identify it's an Instagram login
          scopes: ['instagram_basic', 'instagram_content_publish'] // Instagram-specific scopes
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
        // For email, we'll show the email sign-in screen
        await signInWithRedirect();
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error('Social login error:', error);
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
