import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type VoteType = 'bestFit' | 'notTheOne';

export interface Vote {
  id: string;
  situationshipId: string;
  voterName?: string;
  voteType: VoteType;
  bestFit: boolean;
  notTheOne: boolean;
  comment?: string;
  createdAt: string;
}

export interface VoteStats {
  bestFitCount: number;
  notTheOneCount: number;
  totalVotes: number;
  comments: Array<{ comment: string; voteType: VoteType; voterName?: string; createdAt: string }>;
}

export interface VotingSession {
  id: string;
  shareToken: string;
  ownerId: string;
  situationshipIds: string[];
  expiresAt: string;
  isActive: boolean;
  votes: Vote[];
}

interface VotingContextType {
  currentSession: VotingSession | null;
  votes: Vote[];
  voteStats: Record<string, VoteStats>;
  loading: boolean;
  error: string | null;
  createVotingSession: (situationshipIds: string[]) => Promise<VotingSession>;
  submitVote: (vote: Omit<Vote, 'id' | 'createdAt' | 'voteType'>) => Promise<void>;
  getVotingSession: (shareToken: string) => Promise<VotingSession>;
  getVotes: (sessionId: string) => Promise<Vote[]>;
  getVoteStats: (situationshipId: string) => VoteStats;
  clearVotes: () => void;
}

const VotingContext = createContext<VotingContextType | undefined>(undefined);

interface VotingProviderProps {
  children: ReactNode;
}

export const VotingProvider: React.FC<VotingProviderProps> = ({ children }) => {
  const [currentSession, setCurrentSession] = useState<VotingSession | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [voteStats, setVoteStats] = useState<Record<string, VoteStats>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createVotingSession = async (situationshipIds: string[]): Promise<VotingSession> => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Implement GraphQL mutation to create voting session
      const mockSession: VotingSession = {
        id: `session_${Date.now()}`,
        shareToken: `token_${Math.random().toString(36).substr(2, 9)}`,
        ownerId: 'current_user_id', // TODO: Get from auth context
        situationshipIds,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        votes: [],
      };
      
      setCurrentSession(mockSession);
      return mockSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create voting session';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const submitVote = useCallback(async (voteData: Omit<Vote, 'id' | 'createdAt' | 'voteType'>): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Determine vote type from bestFit/notTheOne flags
      const voteType: VoteType = voteData.bestFit ? 'bestFit' : 'notTheOne';
      
      // TODO: Implement GraphQL mutation to submit vote
      const newVote: Vote = {
        ...voteData,
        voteType,
        id: `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
      
      // Add to votes array
      setVotes(prev => [...prev, newVote]);
      
      // Update vote statistics
      setVoteStats(prev => {
        const currentStats = prev[voteData.situationshipId] || {
          bestFitCount: 0,
          notTheOneCount: 0,
          totalVotes: 0,
          comments: [],
        };
        
        const updatedStats: VoteStats = {
          bestFitCount: currentStats.bestFitCount + (voteData.bestFit ? 1 : 0),
          notTheOneCount: currentStats.notTheOneCount + (voteData.notTheOne ? 1 : 0),
          totalVotes: currentStats.totalVotes + 1,
          comments: voteData.comment ? [
            ...currentStats.comments,
            {
              comment: voteData.comment,
              voteType,
              voterName: voteData.voterName,
              createdAt: newVote.createdAt,
            }
          ] : currentStats.comments,
        };
        
        return {
          ...prev,
          [voteData.situationshipId]: updatedStats,
        };
      });
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit vote';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getVotingSession = async (shareToken: string): Promise<VotingSession> => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Implement GraphQL query to get voting session
      throw new Error('Not implemented yet');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get voting session';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getVotes = useCallback(async (sessionId: string): Promise<Vote[]> => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Implement GraphQL query to get votes
      return votes.filter(vote => 
        currentSession?.id === sessionId && 
        currentSession.situationshipIds.includes(vote.situationshipId)
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get votes';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [votes, currentSession]);

  const getVoteStats = useCallback((situationshipId: string): VoteStats => {
    return voteStats[situationshipId] || {
      bestFitCount: 0,
      notTheOneCount: 0,
      totalVotes: 0,
      comments: [],
    };
  }, [voteStats]);

  const clearVotes = useCallback(() => {
    setVotes([]);
    setVoteStats({});
    setCurrentSession(null);
    setError(null);
  }, []);

  const value: VotingContextType = {
    currentSession,
    votes,
    voteStats,
    loading,
    error,
    createVotingSession,
    submitVote,
    getVotingSession,
    getVotes,
    getVoteStats,
    clearVotes,
  };

  return (
    <VotingContext.Provider value={value}>
      {children}
    </VotingContext.Provider>
  );
};

export const useVoting = (): VotingContextType => {
  const context = useContext(VotingContext);
  if (!context) {
    throw new Error('useVoting must be used within a VotingProvider');
  }
  return context;
};