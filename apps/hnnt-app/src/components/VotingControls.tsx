// src/components/VotingControls.tsx

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { animated, useSpring, config } from '@react-spring/native';
import * as Haptics from 'expo-haptics';
import { Situationship } from './SituationshipCard';
import { useVoting } from '../context/useVoting';
const AnimatedText = animated(Text);
const AnimatedView = animated(View);

type VoteType = 'bestFit' | 'notTheOne';

interface VoteSubmissionState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

interface VoteResult {
  bestFitCount: number;
  notTheOneCount: number;
  totalVotes: number;
}

export interface VotingControlsProps {
  items: Situationship[];
  onSubmit?: (itemId: string, voteType: VoteType, comment?: string) => void;
  freeVotesLeft?: number;         // Monthly free votes
  sessionVoteCap?: number;       // Max votes per session
  onPurchase?: () => void;       // Callback to trigger paywall
  showResults?: boolean;         // Show real-time results
  allowComments?: boolean;       // Enable comment functionality
}

const VotingControls: React.FC<VotingControlsProps> = ({
  items,
  onSubmit,
  freeVotesLeft = 3,
  sessionVoteCap = 5,
  onPurchase,
  showResults = true,
  allowComments = true,
}) => {
  const { submitVote } = useVoting();
  const [votesRemaining, setVotesRemaining] = useState<number>(freeVotesLeft);
  const [voteResults, setVoteResults] = useState<Record<string, VoteResult>>({});
  const [submissions, setSubmissions] = useState<Record<string, VoteSubmissionState>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [selectedVoteType, setSelectedVoteType] = useState<Record<string, VoteType | null>>({});

  const totalVotesUsed = useMemo(() => 
    Object.values(voteResults).reduce((sum, result) => sum + result.totalVotes, 0), 
    [voteResults]
  );
  const sessionVotesRemaining = sessionVoteCap - totalVotesUsed;
  const isOutOfVotes = votesRemaining <= 0 || sessionVotesRemaining <= 0;

  // Haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch {
      // Silently fail if haptics not available
    }
  }, []);

  const handleVoteSelection = useCallback((itemId: string, voteType: VoteType) => {
    triggerHaptic('light');
    setSelectedVoteType(prev => ({ ...prev, [itemId]: voteType }));
    
    if (!allowComments) {
      handleVoteSubmit(itemId, voteType);
    }
  }, [allowComments, triggerHaptic, handleVoteSubmit]);

  const handleVoteSubmit = useCallback(async (itemId: string, voteType: VoteType, comment?: string) => {
    if (isOutOfVotes) {
      Alert.alert('No Votes Remaining', 'You have used all your available votes.');
      return;
    }

    // Set loading state
    setSubmissions(prev => ({
      ...prev,
      [itemId]: { loading: true, success: false, error: null }
    }));

    try {
      triggerHaptic('medium');
      
      // Submit via context
      if (onSubmit) {
        onSubmit(itemId, voteType, comment);
      } else {
        await submitVote({
          situationshipId: itemId,
          voterName: 'Anonymous', // TODO: Get from user context
          bestFit: voteType === 'bestFit',
          notTheOne: voteType === 'notTheOne',
          comment,
        });
      }

      // Update local state with success
      setSubmissions(prev => ({
        ...prev,
        [itemId]: { loading: false, success: true, error: null }
      }));

      // Update vote results
      setVoteResults(prev => {
        const current = prev[itemId] || { bestFitCount: 0, notTheOneCount: 0, totalVotes: 0 };
        return {
          ...prev,
          [itemId]: {
            bestFitCount: current.bestFitCount + (voteType === 'bestFit' ? 1 : 0),
            notTheOneCount: current.notTheOneCount + (voteType === 'notTheOne' ? 1 : 0),
            totalVotes: current.totalVotes + 1,
          }
        };
      });

      // Update remaining votes
      setVotesRemaining(prev => prev - 1);
      
      // Clear comment and selection
      setComments(prev => ({ ...prev, [itemId]: '' }));
      setSelectedVoteType(prev => ({ ...prev, [itemId]: null }));
      
      // Success haptic
      triggerHaptic('heavy');
      
      // Clear success state after animation
      setTimeout(() => {
        setSubmissions(prev => ({
          ...prev,
          [itemId]: { loading: false, success: false, error: null }
        }));
      }, 2000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote';
      setSubmissions(prev => ({
        ...prev,
        [itemId]: { loading: false, success: false, error: errorMessage }
      }));
      
      Alert.alert('Vote Failed', errorMessage);
      
      // Clear error state after delay
      setTimeout(() => {
        setSubmissions(prev => ({
          ...prev,
          [itemId]: { loading: false, success: false, error: null }
        }));
      }, 3000);
    }
  }, [isOutOfVotes, triggerHaptic, onSubmit, submitVote]);

  // Animated button component
  const AnimatedVoteButton = ({ 
    voteType, 
    itemId, 
    disabled, 
    selected 
  }: { 
    voteType: VoteType;
    itemId: string;
    disabled: boolean;
    selected: boolean;
  }) => {
    const [pressed, setPressed] = useState(false);
    
    const buttonSpring = useSpring({
      transform: [{ scale: pressed ? 0.95 : selected ? 1.05 : 1 }],
      backgroundColor: disabled ? '#ccc' : 
                     selected ? (voteType === 'bestFit' ? '#28a745' : '#dc3545') :
                     (voteType === 'bestFit' ? '#007bff' : '#6c757d'),
      config: config.wobbly,
    });

    const textSpring = useSpring({
      color: disabled ? '#666' : '#fff',
      config: config.gentle,
    });

    return (
      <TouchableOpacity
        style={{ flex: 1, marginHorizontal: 8 }}
        onPressIn={() => !disabled && setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => !disabled && handleVoteSelection(itemId, voteType)}
        disabled={disabled}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Vote ${voteType === 'bestFit' ? 'Best Fit' : 'Not the One'}`}
        accessibilityHint={`Double tap to vote ${voteType === 'bestFit' ? 'Best Fit' : 'Not the One'} for this situationship`}
        activeOpacity={0.8}
      >
        <AnimatedView style={[styles.voteButton, buttonSpring]}>
          <AnimatedText style={[styles.voteButtonText, textSpring]}>
            {voteType === 'bestFit' ? '💚 Best Fit' : '❌ Not the One'}
          </AnimatedText>
        </AnimatedView>
      </TouchableOpacity>
    );
  };

  // Item Component with hooks
  const VotingItem = ({ item }: { item: Situationship }) => {
    const results = voteResults[item.id] || { bestFitCount: 0, notTheOneCount: 0, totalVotes: 0 };
    const submission = submissions[item.id] || { loading: false, success: false, error: null };
    const selectedType = selectedVoteType[item.id];
    const comment = comments[item.id] || '';
    const disabled = isOutOfVotes || submission.loading;

    // Animation for vote results
    const resultsSpring = useSpring({
      opacity: showResults && results.totalVotes > 0 ? 1 : 0,
      translateY: showResults && results.totalVotes > 0 ? 0 : 20,
      config: config.gentle,
    });

    // Animation for submission states
    const submissionSpring = useSpring({
      opacity: submission.loading || submission.success || submission.error ? 1 : 0,
      scale: submission.success ? 1.1 : 1,
      config: config.wobbly,
    });

    return (
      <View style={styles.option} key={item.id}>
        <View style={styles.itemHeader}>
          <Text style={styles.name}>{item.name}</Text>
          {submission.loading && (
            <AnimatedView style={[styles.statusIndicator, submissionSpring]}>
              <Text style={styles.loadingText}>Submitting...</Text>
            </AnimatedView>
          )}
          {submission.success && (
            <AnimatedView style={[styles.statusIndicator, styles.successIndicator, submissionSpring]}>
              <Text style={styles.successText}>✓ Vote Submitted!</Text>
            </AnimatedView>
          )}
          {submission.error && (
            <AnimatedView style={[styles.statusIndicator, styles.errorIndicator, submissionSpring]}>
              <Text style={styles.errorText}>✗ {submission.error}</Text>
            </AnimatedView>
          )}
        </View>

        <View style={styles.voteSection}>
          <View style={styles.voteButtons}>
            <AnimatedVoteButton
              voteType="bestFit"
              itemId={item.id}
              disabled={disabled}
              selected={selectedType === 'bestFit'}
            />
            <AnimatedVoteButton
              voteType="notTheOne"
              itemId={item.id}
              disabled={disabled}
              selected={selectedType === 'notTheOne'}
            />
          </View>

          {allowComments && selectedType && (
            <View style={styles.commentSection}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment (optional)"
                value={comment}
                onChangeText={(text) => setComments(prev => ({ ...prev, [item.id]: text }))}
                multiline
                maxLength={200}
                accessible={true}
                accessibilityLabel="Comment input"
                accessibilityHint="Enter an optional comment for your vote"
              />
              <View style={styles.commentActions}>
                <TouchableOpacity 
                  style={styles.submitButton}
                  onPress={() => handleVoteSubmit(item.id, selectedType, comment)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Submit vote"
                >
                  <Text style={styles.submitButtonText}>Submit Vote</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setSelectedVoteType(prev => ({ ...prev, [item.id]: null }));
                    setComments(prev => ({ ...prev, [item.id]: '' }));
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel vote"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {showResults && (
          <AnimatedView style={[styles.results, resultsSpring]}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>💚 Best Fit:</Text>
              <AnimatedText style={styles.resultCount}>
                {results.bestFitCount}
              </AnimatedText>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>❌ Not the One:</Text>
              <AnimatedText style={styles.resultCount}>
                {results.notTheOneCount}
              </AnimatedText>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Total Votes:</Text>
              <AnimatedText style={[styles.resultCount, styles.totalCount]}>
                {results.totalVotes}
              </AnimatedText>
            </View>
          </AnimatedView>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: Situationship }) => {
    return <VotingItem item={item} />;
  };

  // Header animation
  const headerSpring = useSpring({
    opacity: 1,
    translateY: 0,
    from: { opacity: 0, translateY: -20 },
    config: config.gentle,
  });

  const remainingVotes = Math.max(0, Math.min(votesRemaining, sessionVotesRemaining));

  return (
    <View style={styles.container}>
      <AnimatedView style={[styles.header, headerSpring]}>
        <Text style={styles.headerText}>
          Votes Remaining: {remainingVotes}
        </Text>
        <Text style={styles.subHeaderText}>
          Vote on your friend&apos;s situationships
        </Text>
      </AnimatedView>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
      
      {isOutOfVotes && onPurchase && (
        <AnimatedView style={[styles.purchaseSection, headerSpring]}>
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={onPurchase}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Unlock more votes"
          >
            <Text style={styles.purchaseButtonText}>
              🚀 Unlock More Votes
            </Text>
          </TouchableOpacity>
        </AnimatedView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#e1e5e9',
    backgroundColor: '#f8f9fa',
    minHeight: 300,
  },
  header: {
    marginBottom: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  option: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  voteSection: {
    marginTop: 8,
  },
  voteButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  voteButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  commentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#e9ecef',
  },
  successIndicator: {
    backgroundColor: '#d4edda',
  },
  errorIndicator: {
    backgroundColor: '#f8d7da',
  },
  loadingText: {
    fontSize: 12,
    color: '#6c757d',
  },
  successText: {
    fontSize: 12,
    color: '#155724',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#721c24',
    fontWeight: '600',
  },
  results: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 14,
    color: '#495057',
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  totalCount: {
    fontSize: 16,
    color: '#007bff',
  },
  purchaseSection: {
    marginTop: 16,
  },
  purchaseButton: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VotingControls;
export type { VoteType, VoteResult, VoteSubmissionState };
