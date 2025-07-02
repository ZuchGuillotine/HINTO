import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { generateClient } from '@aws-amplify/api';
import { getCurrentUser } from '@aws-amplify/auth';
import { uploadData } from '@aws-amplify/storage';
import { MainStackParamList } from '../navigation/types';
import { Situationship, CreateSituationshipInput, UpdateSituationshipInput } from '../types/API';

const client = generateClient();

type SituationshipDetailScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'SituationshipDetail'>;
type SituationshipDetailScreenRouteProp = RouteProp<MainStackParamList, 'SituationshipDetail'>;

interface SituationshipFormData {
  name: string;
  category: string;
  emoji: string;
  avatarUrl?: string | null;
  sharedWith: string[];
}

const CATEGORIES = [
  'Friend',
  'Crush',
  'Ex',
  'Family',
  'Work',
  'Other',
];

export default function SituationshipDetailScreen() {
  const navigation = useNavigation<SituationshipDetailScreenNavigationProp>();
  const route = useRoute<SituationshipDetailScreenRouteProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isEditing = !!route.params?.id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [situationship, setSituationship] = useState<Situationship | null>(null);
  const [formData, setFormData] = useState<SituationshipFormData>({
    name: '',
    category: CATEGORIES[0],
    emoji: '🙂',
    avatarUrl: null,
    sharedWith: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SituationshipFormData, string>>>({});

  useEffect(() => {
    if (isEditing) {
      fetchSituationship();
    }
  }, [route.params?.id]);

  const fetchSituationship = async () => {
    try {
      setLoading(true);
      const result = await client.graphql({
        query: /* GraphQL */ `
          query GetSituationship($id: ID!) {
            getSituationship(id: $id) {
              id
              name
              category
              emoji
              avatarUrl
              sharedWith
              rankIndex
              createdAt
              updatedAt
            }
          }
        `,
        variables: { id: route.params.id },
      }) as { data: { getSituationship: Situationship } };

      const data = result.data.getSituationship;
      setSituationship(data);
      setFormData({
        name: data.name,
        category: data.category || CATEGORIES[0],
        emoji: data.emoji || '🙂',
        avatarUrl: data.avatarUrl,
        sharedWith: data.sharedWith || [],
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to load situationship details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setSaving(true);
        const currentUser = await getCurrentUser();
        const key = `situationships/${currentUser.userId}/${Date.now()}.jpg`;
        
        await uploadData({
          key,
          data: result.assets[0].uri,
          options: {
            contentType: 'image/jpeg',
            accessLevel: 'private',
          },
        });

        setFormData(prev => ({
          ...prev,
          avatarUrl: key,
          emoji: '🙂', // Set default emoji instead of null
        }));
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({
      ...prev,
      emoji,
      avatarUrl: null, // Clear image when setting emoji
    }));
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      const currentUser = await getCurrentUser();
      
      const input = {
        ...(isEditing ? { id: route.params.id } : {}),
        name: formData.name.trim(),
        category: formData.category,
        emoji: formData.emoji,
        avatarUrl: formData.avatarUrl,
        sharedWith: formData.sharedWith,
        owner: currentUser.userId,
      };

      if (isEditing) {
        await client.graphql({
          query: /* GraphQL */ `
            mutation UpdateSituationship($input: UpdateSituationshipInput!) {
              updateSituationship(input: $input) {
                id
                name
                category
                emoji
                avatarUrl
                sharedWith
                rankIndex
                updatedAt
              }
            }
          `,
          variables: { input },
        }) as { data: { updateSituationship: Situationship } };
      } else {
        await client.graphql({
          query: /* GraphQL */ `
            mutation CreateSituationship($input: CreateSituationshipInput!) {
              createSituationship(input: $input) {
                id
                name
                category
                emoji
                avatarUrl
                sharedWith
                rankIndex
                createdAt
              }
            }
          `,
          variables: { input },
        }) as { data: { createSituationship: Situationship } };
      }

      Alert.alert('Success', `Situationship ${isEditing ? 'updated' : 'created'} successfully`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} situationship`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Situationship',
      'Are you sure you want to delete this situationship? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await client.graphql({
                query: /* GraphQL */ `
                  mutation DeleteSituationship($input: DeleteSituationshipInput!) {
                    deleteSituationship(input: $input) {
                      id
                    }
                  }
                `,
                variables: {
                  input: { id: route.params.id },
                },
              }) as { data: { deleteSituationship: { id: string } } };
              Alert.alert('Success', 'Situationship deleted successfully');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete situationship');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleImagePick}
            disabled={saving}
          >
            {formData.avatarUrl ? (
              <Image
                source={{ uri: formData.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{formData.emoji}</Text>
              </View>
            )}
            <View style={styles.editOverlay}>
              <Ionicons name="camera" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Situationship Details
          </Text>

          <TextInput
            style={[
              styles.input,
              isDark && styles.darkInput,
              errors.name && styles.inputError,
            ]}
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Name"
            placeholderTextColor={isDark ? '#666' : '#999'}
          />
          {errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}

          <Text style={[styles.label, isDark && styles.darkText]}>
            Category
          </Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  formData.category === category && styles.categoryButtonActive,
                  isDark && styles.darkCategoryButton,
                ]}
                onPress={() => setFormData(prev => ({ ...prev, category }))}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    formData.category === category && styles.categoryButtonTextActive,
                    isDark && styles.darkCategoryButtonText,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, isDark && styles.darkText]}>
            Emoji
          </Text>
          <View style={styles.emojiGrid}>
            {['🙂', '😊', '🥰', '😍', '😘', '😎', '🤔', '😅', '😭', '😡'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiButton,
                  formData.emoji === emoji && styles.emojiButtonActive,
                ]}
                onPress={() => handleEmojiSelect(emoji)}
              >
                <Text style={styles.emojiButtonText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isEditing ? 'Save Changes' : 'Create Situationship'}
              </Text>
            )}
          </TouchableOpacity>

          {isEditing && (
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#FF3B30" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete Situationship</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  emojiContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  darkText: {
    color: '#fff',
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    marginBottom: 16,
  },
  darkInput: {
    color: '#fff',
    borderBottomColor: '#333',
  },
  inputError: {
    borderBottomColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: -12,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  darkCategoryButton: {
    backgroundColor: '#333',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  darkCategoryButtonText: {
    color: '#fff',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  emojiButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
  },
  emojiButtonActive: {
    backgroundColor: '#007AFF',
  },
  emojiButtonText: {
    fontSize: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
