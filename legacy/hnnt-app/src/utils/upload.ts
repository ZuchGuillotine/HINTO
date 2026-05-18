import { uploadData, remove } from '@aws-amplify/storage';
import { getCurrentUser } from '@aws-amplify/auth';
import * as FileSystem from 'expo-file-system';

const AVATAR_PREFIX = 'public/avatars/';

export async function uploadAvatar(uri: string): Promise<string> {
  try {
    // Get the current user for unique file naming
    const { userId } = await getCurrentUser();
    
    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `${userId}_${timestamp}.jpg`;
    const key = `${AVATAR_PREFIX}${filename}`;

    // Read the file
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Upload to S3
    const result = await uploadData({
      key,
      data: uri,
      options: {
        contentType: 'image/jpeg',
      },
    });

    // Return the key which can be used to construct the URL
    return key;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

export async function deleteAvatar(key: string): Promise<void> {
  try {
    await remove({ key });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    throw error;
  }
} 