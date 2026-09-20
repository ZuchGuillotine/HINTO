import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut as amplifySignOut, signInWithRedirect, signIn, signUp, confirmSignUp as amplifyConfirmSignUp, type AuthUser } from '@aws-amplify/auth';

// Define the shape of the user object you expect.
// It should ideally match the attributes you have in Cognito plus any custom fields.
interface AppUser {
  userId: string;
  username?: string;
  email?: string;
  isDevMode?: boolean; // Flag for development bypass
  // Add other attributes like profilePictureUrl, custom fields, etc.
  [key: string]: unknown; // Allow other properties from Cognito
}

// Define the type for the authentication providers your app supports
export type AuthProviderOption = 'Google' | 'Facebook' | 'Apple' | 'Amazon'; // Amplify provider names
export type CustomAuthProviderOption = 'Snapchat' | 'TikTok'; // For custom flows
export type SupportedAuthProvider = AuthProviderOption | CustomAuthProviderOption;

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  signInWithSocial: (provider: AuthProviderOption, customState?: string) => Promise<void>;
  signInWithEmail: (username: string, password: string) => Promise<void>;
  signUpWithEmail: (username: string, email: string, password: string) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  devBypass: () => Promise<void>; // Add dev bypass function
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to map Cognito user to our AppUser type
const mapCognitoUserToAppUser = (cognitoUser: AuthUser): AppUser => {
  const { userId, username } = cognitoUser;
  const email = cognitoUser.signInDetails?.loginId; // Example, actual email attribute might vary
  return {
    userId,
    username,
    email,
    ...(cognitoUser.attributes || {}), // Spread other attributes if they exist
  };
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkCurrentUser = async () => {
      setIsLoading(true);
      try {
        const cognitoAuthUser = await getCurrentUser();
        setUser(mapCognitoUserToAppUser(cognitoAuthUser));
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkCurrentUser();

    const hubListenerCancel = Hub.listen('auth', ({ payload }) => {
      const { event, data } = payload;
      switch (event) {
        case 'signedIn':
          if (data) setUser(mapCognitoUserToAppUser(data as AuthUser));
          else checkCurrentUser(); // Fallback if no data with event
          setIsLoading(false);
          break;
        case 'signedOut':
          setUser(null);
          setIsLoading(false);
          break;
        case 'signInWithRedirect_failure':
        case 'tokenRefresh_failure': // if you handle token refresh explicitly
          console.error('Auth failure event:', event, data);
          setUser(null);
          setIsLoading(false);
          break;
      }
    });

    return () => {
      hubListenerCancel();
    };
  }, []);

  const signInWithSocial = async (provider: AuthProviderOption, customState?: string) => {
    setIsLoading(true);
    try {
      await signInWithRedirect({ provider, customState });
      // Hub listener should pick up 'signedIn' or 'signInWithRedirect_failure'
    } catch (error) {
      console.error(`Error initiating sign in with ${provider}:`, error);
      setUser(null);
      setIsLoading(false);
      throw error;
    }
  };

  const signOutUser = async () => {
    setIsLoading(true);
    try {
      // Check if it's a dev mode user
      if (user?.isDevMode) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      await amplifySignOut({ global: true });
      // Hub listener should pick up 'signedOut'
    } catch (error) {
      console.error('Error signing out: ', error);
      setIsLoading(false); // Ensure loading state is reset even on error
      throw error;
    }
  };

  const devBypassAuth = async () => {
    if (!__DEV__) {
      throw new Error('Development bypass only available in dev mode');
    }
    
    setIsLoading(true);
    try {
      const mockUser: AppUser = {
        userId: 'dev-user-123',
        username: 'dev-user',
        email: 'dev@hnnt.app',
        isDevMode: true,
      };
      
      console.warn('🚨 DEVELOPMENT MODE: Authentication bypassed for UI testing');
      setUser(mockUser);
    } catch (error) {
      console.error('Dev bypass error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmailAuth = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      console.log(`🔑 Attempting signin with username: ${username}`);
      
      // Use the proper v6 configuration with explicit auth flow
      const result = await signIn({
        username: username,
        password,
        options: {
          authFlowType: 'USER_PASSWORD_AUTH'  // Force direct password auth instead of SRP
        }
      });
      
      console.log('🎉 Signin successful, getting current user');
      
      // Get the current user after successful sign in
      const currentUser = await getCurrentUser();
      const appUser = mapCognitoUserToAppUser(currentUser);
      setUser(appUser);
      
      return result;
    } catch (error: unknown) {
      console.error('❌ Username signin error:', error);
      console.error('Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        code: (error as { code?: string }).code
      });
      setUser(null);
      setIsLoading(false);
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmailAuth = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log(`📝 Attempting signup with username: ${username}, email: ${email}`);
      
      const result = await signUp({
        username: username,
        password,
        options: {
          userAttributes: {
            email: email,
          },
          autoSignIn: false
        }
      });
      
      console.log('📧 Signup result:', result);
      console.log('✅ Signup completed, setting loading to false');
      return result;
    } catch (error: unknown) {
      console.error('❌ Email signup error:', error);
      console.error('Signup error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        code: (error as { code?: string }).code
      });
      throw error;
    } finally {
      console.log('🔄 Setting loading to false in finally block');
      setIsLoading(false);
    }
  };

  const confirmSignUpAuth = async (username: string, code: string) => {
    setIsLoading(true);
    try {
      const result = await amplifyConfirmSignUp({
        username: username,
        confirmationCode: code
      });
      
      // If autoSignIn was enabled during signup, user should be signed in automatically
      // But let's check and update user state
      try {
        const currentUser = await getCurrentUser();
        const appUser = mapCognitoUserToAppUser(currentUser);
        setUser(appUser);
      } catch (getUserError) {
        // User might not be signed in yet, that's okay
        console.log('User not automatically signed in after confirmation');
      }
      
      return result;
    } catch (error: unknown) {
      console.error('Confirmation error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      signInWithSocial, 
      signInWithEmail: signInWithEmailAuth,
      signUpWithEmail: signUpWithEmailAuth,
      confirmSignUp: confirmSignUpAuth,
      signOut: signOutUser, 
      devBypass: devBypassAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 