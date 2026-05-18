import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Modal, Text, Share, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import SituationshipList from '../components/SituationshipList';
import { useSituationships } from '../context/useSituationships';
import { generateClient } from '@aws-amplify/api';

const client = generateClient();

type RootStackParamList = {
  SituationshipDetail: { id?: string };
  Share: { token: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CREATE_INVITE_TOKEN_MUTATION = `
  mutation CreateInviteToken($input: CreateInviteTokenInput!) {
    createInviteToken(input: $input) {
      id
      token
      ownerId
      expiresAt
      createdAt
    }
  }
`;

export const SituationshipListScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const { items, loading, error } = useSituationships();
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const handleSharePress = async () => {
    if (items.length < 2) {
      Alert.alert(
        'Not Enough Situationships',
        'You need at least 2 situationships to create a share session for voting.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsCreatingShare(true);
      const result = await client.graphql({
        query: CREATE_INVITE_TOKEN_MUTATION,
        variables: {
          input: {
            expiresIn: 48 * 60 * 60, // 48 hours in seconds
          },
        },
      }) as { data: { createInviteToken: { token: string } } };

      const token = result.data.createInviteToken.token;
      setShareToken(token);
      setShareModalVisible(true);

      // Generate share URL
      const shareUrl = `https://hinto.app/share/${token}`;
      await Share.share({
        message: `Check out my situationship list and vote on it! ${shareUrl}\n\nThis link will expire in 48 hours.`,
        url: shareUrl,
      });
    } catch (err) {
      Alert.alert(
        'Error',
        'Failed to create share session. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleViewResults = () => {
    if (shareToken) {
      navigation.navigate('Share', { token: shareToken });
    }
    setShareModalVisible(false);
  };

  return (
    <View style={[styles.container, colorScheme === 'dark' && styles.darkContainer]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleSharePress}
          disabled={isCreatingShare}
        >
          {isCreatingShare ? (
            <ActivityIndicator color={colorScheme === 'dark' ? '#fff' : '#000'} />
          ) : (
            <Ionicons
              name="share-social-outline"
              size={24}
              color={colorScheme === 'dark' ? '#fff' : '#000'}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('SituationshipDetail')}
        >
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={colorScheme === 'dark' ? '#fff' : '#000'}
          />
        </TouchableOpacity>
      </View>

      <SituationshipList mode="owner" />

      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, colorScheme === 'dark' && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, colorScheme === 'dark' && styles.darkText]}>
              Share Session Created
            </Text>
            <Text style={[styles.modalText, colorScheme === 'dark' && styles.darkText]}>
              Your situationship list is now available for voting. The share link will expire in 48 hours.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.viewResultsButton]}
                onPress={handleViewResults}
              >
                <Text style={styles.buttonText}>View Results</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  darkHeader: {
    borderBottomColor: '#333',
  },
  shareButton: {
    marginRight: 16,
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  darkText: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  viewResultsButton: {
    backgroundColor: '#007AFF',
  },
  closeButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
