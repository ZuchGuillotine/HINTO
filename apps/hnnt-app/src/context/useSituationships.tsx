import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { generateClient } from '@aws-amplify/api';
import { getCurrentUser } from '@aws-amplify/auth';
import { Situationship } from '../types/API';

const client = generateClient();

interface SituationshipsContextType {
  items: Situationship[];
  loading: boolean;
  error: Error | null;
  reorder: (situationshipIds: string[]) => Promise<void>;
  submitVote: (situationshipId: string, voteType: 'best' | 'worst') => Promise<void>;
  canEdit: boolean;
  canVote: boolean;
}

const SituationshipsContext = createContext<SituationshipsContextType | undefined>(undefined);

interface SituationshipsProviderProps {
  children: ReactNode;
}

const LIST_SITUATIONSHIPS_QUERY = `
  query ListSituationships($owner: String) {
    listSituationships(filter: { owner: { eq: $owner } }) {
      items {
        id
        owner
        name
        emoji
        category
        avatarUrl
        rankIndex
        sharedWith
        createdAt
        updatedAt
      }
    }
  }
`;

const REORDER_SITUATIONSHIPS_MUTATION = `
  mutation ReorderSituationships($input: ReorderSituationshipsInput!) {
    reorderSituationships(input: $input) {
      id
      rankIndex
    }
  }
`;

const CREATE_VOTE_MUTATION = `
  mutation CreateVote($input: CreateVoteInput!) {
    createVote(input: $input) {
      id
      voterId
      targetUserId
      bestId
      worstId
      comment
      createdAt
    }
  }
`;

export const SituationshipsProvider = ({ children }: SituationshipsProviderProps): JSX.Element => {
  const [items, setItems] = useState<Situationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canVote, setCanVote] = useState(false);

  const fetchSituationships = async (ownerId?: string, shareToken?: string) => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = await getCurrentUser();
      const isOwner = !ownerId || ownerId === currentUser.userId;
      setCanEdit(isOwner);
      setCanVote(!isOwner && !!shareToken);

      const result = await client.graphql({
        query: LIST_SITUATIONSHIPS_QUERY,
        variables: { owner: ownerId || currentUser.userId },
      }) as { data: { listSituationships: { items: Situationship[] } } };

      setItems(result.data.listSituationships.items.sort((a, b) => (a.rankIndex || 0) - (b.rankIndex || 0)));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch situationships'));
    } finally {
      setLoading(false);
    }
  };

  const reorder = async (situationshipIds: string[]) => {
    try {
      setError(null);
      const result = await client.graphql({
        query: REORDER_SITUATIONSHIPS_MUTATION,
        variables: {
          input: {
            situationshipIds,
            newRankIndices: situationshipIds.map((_, index) => index),
          },
        },
      }) as { data: { reorderSituationships: Situationship[] } };

      // Update local state with new order
      const updatedItems = [...items];
      result.data.reorderSituationships.forEach((situationship) => {
        const index = updatedItems.findIndex(item => item.id === situationship.id);
        if (index !== -1) {
          updatedItems[index] = { ...updatedItems[index], rankIndex: situationship.rankIndex };
        }
      });
      setItems(updatedItems.sort((a, b) => (a.rankIndex || 0) - (b.rankIndex || 0)));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reorder situationships'));
      throw err;
    }
  };

  const submitVote = async (situationshipId: string, voteType: 'best' | 'worst') => {
    try {
      setError(null);
      const currentUser = await getCurrentUser();
      
      await client.graphql({
        query: CREATE_VOTE_MUTATION,
        variables: {
          input: {
            voterId: currentUser.userId,
            targetUserId: items[0]?.owner, // The owner of the situationships
            bestId: voteType === 'best' ? situationshipId : null,
            worstId: voteType === 'worst' ? situationshipId : null,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to submit vote'));
      throw err;
    }
  };

  useEffect(() => {
    fetchSituationships();
  }, []);

  const value: SituationshipsContextType = {
    items,
    loading,
    error,
    reorder,
    submitVote,
    canEdit,
    canVote,
  };

  return React.createElement(SituationshipsContext.Provider, { value }, children);
};

export const useSituationships = (ownerId?: string, shareToken?: string): SituationshipsContextType => {
  const context = useContext(SituationshipsContext);
  if (context === undefined) {
    throw new Error('useSituationships must be used within a SituationshipsProvider');
  }
  return context;
}; 