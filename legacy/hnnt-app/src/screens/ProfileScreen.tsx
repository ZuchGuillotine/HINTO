import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  useColorScheme,
} from 'react-native';
import { useNavigation, CommonActions, NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUserProfile } from '../context/useUserProfile';
import Header from '../components/Header';
import { signOut } from '../utils/auth';
import { RootStackParamList } from '../navigation/types';
import { uploadAvatar } from '../utils/upload';
import { User, SocialLinks } from '../types/API';

type ProfileScreenNavigationProp = NavigationProp<RootStackParamList, 'Profile'>;

interface ProfileFormData {
  username: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
  socialLinks: SocialLinks;
  isPrivate: boolean;
  mutualsOnly: boolean;
}

interface SocialLinksErrors {
  instagram?: string;
  twitter?: string;
  snapchat?: string;
  tiktok?: string;
}

interface FormErrors {
  username?: string;
  website?: string;
  socialLinks?: SocialLinksErrors;
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, loading, error, updateProfile, deleteProfile } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    username: user?.username || '',
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    socialLinks: user?.socialLinks || {
      instagram: '',
      twitter: '',
      snapchat: '',
      tiktok: '',
    },
    isPrivate: user?.isPrivate ?? true,
    mutualsOnly: user?.mutualsOnly ?? true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Username validation
    if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 30) {
      newErrors.username = 'Username must be less than 30 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    // Website validation
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'Website must be a valid URL starting with http:// or https://';
    }

    // Social links validation
    const socialLinksErrors: SocialLinksErrors = {};
    if (formData.socialLinks.instagram && !/^[a-zA-Z0-9._]+$/.test(formData.socialLinks.instagram)) {
      socialLinksErrors.instagram = 'Invalid Instagram username';
    }
    if (formData.socialLinks.twitter && !/^[a-zA-Z0-9_]+$/.test(formData.socialLinks.twitter)) {
      socialLinksErrors.twitter = 'Invalid Twitter username';
    }
    if (formData.socialLinks.snapchat && !/^[a-zA-Z0-9._-]+$/.test(formData.socialLinks.snapchat)) {
      socialLinksErrors.snapchat = 'Invalid Snapchat username';
    }
    if (formData.socialLinks.tiktok && !/^[a-zA-Z0-9._]+$/.test(formData.socialLinks.tiktok)) {
      socialLinksErrors.tiktok = 'Invalid TikTok username';
    }

    if (Object.keys(socialLinksErrors).length > 0) {
      newErrors.socialLinks = socialLinksErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile(formData);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarPress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsSaving(true);
        const avatarKey = await uploadAvatar(result.assets[0].uri);
        await updateProfile({
          avatarUrl: avatarKey,
        });
        Alert.alert('Success', 'Avatar updated successfully');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update avatar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Onboarding' }],
        })
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleRefresh = () => {
    navigation.dispatch(
      CommonActions.setParams({ refresh: Date.now() })
    );
  };

  const handleDeleteProfile = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteProfile();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Onboarding' }],
                })
              );
            } catch (err) {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.errorText, isDark && styles.darkText]}>
          Failed to load profile
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRefresh}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Header
        title="Profile"
        showBack
        showSave={isEditing}
        onSave={handleSave}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleAvatarPress}
            disabled={!isEditing}
          >
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons
                  name="person"
                  size={40}
                  color={isDark ? '#fff' : '#666'}
                />
              </View>
            )}
            {isEditing && (
              <View style={styles.editOverlay}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.email, isDark && styles.darkText]}>
            {user?.email}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Profile Settings
          </Text>
          
          {isEditing ? (
            <>
              <TextInput
                style={[styles.input, isDark && styles.darkInput, errors.username && styles.inputError]}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                placeholder="Username"
                placeholderTextColor={isDark ? '#666' : '#999'}
              />
              {errors.username && (
                <Text style={styles.errorText}>{errors.username}</Text>
              )}

              <TextInput
                style={[styles.input, isDark && styles.darkInput]}
                value={formData.displayName}
                onChangeText={(text) => setFormData({ ...formData, displayName: text })}
                placeholder="Display Name"
                placeholderTextColor={isDark ? '#666' : '#999'}
              />

              <TextInput
                style={[styles.input, styles.textArea, isDark && styles.darkInput]}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder="Bio"
                placeholderTextColor={isDark ? '#666' : '#999'}
                multiline
                numberOfLines={4}
              />

              <TextInput
                style={[styles.input, isDark && styles.darkInput]}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="Location"
                placeholderTextColor={isDark ? '#666' : '#999'}
              />

              <TextInput
                style={[styles.input, isDark && styles.darkInput, errors.website && styles.inputError]}
                value={formData.website}
                onChangeText={(text) => setFormData({ ...formData, website: text })}
                placeholder="Website (https://...)"
                placeholderTextColor={isDark ? '#666' : '#999'}
                keyboardType="url"
                autoCapitalize="none"
              />
              {errors.website && (
                <Text style={styles.errorText}>{errors.website}</Text>
              )}

              <Text style={[styles.subsectionTitle, isDark && styles.darkText]}>
                Social Links
              </Text>

              <TextInput
                style={[styles.input, isDark && styles.darkInput, errors.socialLinks?.instagram && styles.inputError]}
                value={formData.socialLinks.instagram || ''}
                onChangeText={(text) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, instagram: text || null }
                })}
                placeholder="Instagram Username"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoCapitalize="none"
              />
              {errors.socialLinks?.instagram && (
                <Text style={styles.errorText}>{errors.socialLinks.instagram}</Text>
              )}

              <TextInput
                style={[styles.input, isDark && styles.darkInput, errors.socialLinks?.twitter && styles.inputError]}
                value={formData.socialLinks.twitter || ''}
                onChangeText={(text) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, twitter: text || null }
                })}
                placeholder="Twitter Username"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoCapitalize="none"
              />
              {errors.socialLinks?.twitter && (
                <Text style={styles.errorText}>{errors.socialLinks.twitter}</Text>
              )}

              <TextInput
                style={[styles.input, isDark && styles.darkInput, errors.socialLinks?.snapchat && styles.inputError]}
                value={formData.socialLinks.snapchat || ''}
                onChangeText={(text) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, snapchat: text || null }
                })}
                placeholder="Snapchat Username"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoCapitalize="none"
              />
              {errors.socialLinks?.snapchat && (
                <Text style={styles.errorText}>{errors.socialLinks.snapchat}</Text>
              )}

              <TextInput
                style={[styles.input, isDark && styles.darkInput, errors.socialLinks?.tiktok && styles.inputError]}
                value={formData.socialLinks.tiktok || ''}
                onChangeText={(text) => setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, tiktok: text || null }
                })}
                placeholder="TikTok Username"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoCapitalize="none"
              />
              {errors.socialLinks?.tiktok && (
                <Text style={styles.errorText}>{errors.socialLinks.tiktok}</Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.darkText]}>Username</Text>
                <Text style={[styles.value, isDark && styles.darkText]}>{user?.username}</Text>
              </View>

              {user?.displayName && (
                <View style={styles.row}>
                  <Text style={[styles.label, isDark && styles.darkText]}>Display Name</Text>
                  <Text style={[styles.value, isDark && styles.darkText]}>{user.displayName}</Text>
                </View>
              )}

              {user?.bio && (
                <View style={styles.row}>
                  <Text style={[styles.label, isDark && styles.darkText]}>Bio</Text>
                  <Text style={[styles.value, isDark && styles.darkText]}>{user.bio}</Text>
                </View>
              )}

              {user?.location && (
                <View style={styles.row}>
                  <Text style={[styles.label, isDark && styles.darkText]}>Location</Text>
                  <Text style={[styles.value, isDark && styles.darkText]}>{user.location}</Text>
                </View>
              )}

              {user?.website && (
                <View style={styles.row}>
                  <Text style={[styles.label, isDark && styles.darkText]}>Website</Text>
                  <Text style={[styles.value, isDark && styles.darkText]}>{user.website}</Text>
                </View>
              )}

              {(user?.socialLinks?.instagram || user?.socialLinks?.twitter || 
                user?.socialLinks?.snapchat || user?.socialLinks?.tiktok) && (
                <View style={styles.socialLinksSection}>
                  <Text style={[styles.subsectionTitle, isDark && styles.darkText]}>Social Links</Text>
                  {user.socialLinks?.instagram && (
                    <View style={styles.row}>
                      <Text style={[styles.label, isDark && styles.darkText]}>Instagram</Text>
                      <Text style={[styles.value, isDark && styles.darkText]}>@{user.socialLinks.instagram}</Text>
                    </View>
                  )}
                  {user.socialLinks?.twitter && (
                    <View style={styles.row}>
                      <Text style={[styles.label, isDark && styles.darkText]}>Twitter</Text>
                      <Text style={[styles.value, isDark && styles.darkText]}>@{user.socialLinks.twitter}</Text>
                    </View>
                  )}
                  {user.socialLinks?.snapchat && (
                    <View style={styles.row}>
                      <Text style={[styles.label, isDark && styles.darkText]}>Snapchat</Text>
                      <Text style={[styles.value, isDark && styles.darkText]}>@{user.socialLinks.snapchat}</Text>
                    </View>
                  )}
                  {user.socialLinks?.tiktok && (
                    <View style={styles.row}>
                      <Text style={[styles.label, isDark && styles.darkText]}>TikTok</Text>
                      <Text style={[styles.value, isDark && styles.darkText]}>@{user.socialLinks.tiktok}</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          <View style={styles.row}>
            <Text style={[styles.label, isDark && styles.darkText]}>Private Profile</Text>
            <Switch
              value={formData.isPrivate}
              onValueChange={(value) => setFormData({ ...formData, isPrivate: value })}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, isDark && styles.darkText]}>Mutuals Only</Text>
            <Switch
              value={formData.mutualsOnly}
              onValueChange={(value) => setFormData({ ...formData, mutualsOnly: value })}
              disabled={!isEditing}
            />
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, isEditing ? styles.saveButton : styles.editButton]}
            onPress={isEditing ? handleSave : () => setIsEditing(true)}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isEditing ? 'Save Changes' : 'Edit Profile'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
            disabled={isDeleting}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDeleteProfile}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color="#FF3B30" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            )}
          </TouchableOpacity>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  darkInput: {
    color: '#fff',
    borderBottomColor: '#333',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
  },
  darkText: {
    color: '#fff',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginTop: 24,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  socialLinksSection: {
    marginTop: 16,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
});
