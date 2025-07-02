import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateClient } from '@aws-amplify/api';
import { getCurrentUser, signOut as amplifySignOut } from '@aws-amplify/auth';
import { User } from '../types/API';

const client = generateClient();

interface UserProfileContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await getCurrentUser();
      
      // Get user profile from AppSync
      const result = await client.graphql({
        query: /* GraphQL */ `
          query GetUser($id: ID!) {
            getUser(id: $id) {
              id
              username
              email
              avatarUrl
              isPrivate
              mutualsOnly
              plan
              createdAt
              updatedAt
            }
          }
        `,
        variables: { id: currentUser.userId },
      });

      setUser(result.data.getUser);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await client.graphql({
        query: /* GraphQL */ `
          mutation UpdateUser($input: UpdateUserInput!) {
            updateUser(input: $input) {
              id
              username
              email
              avatarUrl
              isPrivate
              mutualsOnly
              plan
              updatedAt
            }
          }
        `,
        variables: {
          input: {
            id: user?.id,
            ...updates,
          },
        },
      });

      setUser(result.data.updateUser);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update profile'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('No user profile found');
      }

      // Delete user profile from AppSync
      await client.graphql({
        query: /* GraphQL */ `
          mutation DeleteUser($input: DeleteUserInput!) {
            deleteUser(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            id: user.id,
          },
        },
      });

      // Sign out after successful deletion
      await amplifySignOut();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete profile'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <UserProfileContext.Provider
      value={{
        user,
        loading,
        error,
        updateProfile,
        refreshProfile: fetchProfile,
        deleteProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}; 