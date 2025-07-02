import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Hub } from '@aws-amplify/core';
import { getCurrentUser, signOut as amplifySignOut, signInWithRedirect, type AuthUser } from '@aws-amplify/auth';

// Define the shape of the user object you expect.
// It should ideally match the attributes you have in Cognito plus any custom fields.
interface AppUser {
  userId: string;
  username?: string;
  email?: string;
  // Add other attributes like profilePictureUrl, custom fields, etc.
  [key: string]: any; // Allow other properties from Cognito
}

// Define the type for the authentication providers your app supports
export type AuthProviderOption = 'Google' | 'Facebook' | 'Apple' | 'Amazon'; // Amplify provider names
export type CustomAuthProviderOption = 'Snapchat' | 'TikTok'; // For custom flows
export type SupportedAuthProvider = AuthProviderOption | CustomAuthProviderOption;

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  signInWithSocial: (provider: AuthProviderOption, customState?: string) => Promise<void>;
  signOut: () => Promise<void>;
  // You could add more functions like signUp, confirmSignUp, etc.
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
      await amplifySignOut({ global: true });
      // Hub listener should pick up 'signedOut'
    } catch (error) {
      console.error('Error signing out: ', error);
      setIsLoading(false); // Ensure loading state is reset even on error
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithSocial, signOut: signOutUser }}>
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