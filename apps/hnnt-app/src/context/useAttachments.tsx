import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as ImagePicker from 'expo-image-picker';

export interface Attachment {
  id: string;
  uri: string;
  type: 'image' | 'video';
  name?: string;
  size?: number;
  mimeType?: string;
}

interface AttachmentsContextType {
  attachments: Attachment[];
  loading: boolean;
  error: string | null;
  addAttachment: (attachment: Omit<Attachment, 'id'>) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  pickImage: () => Promise<Attachment | null>;
  takePhoto: () => Promise<Attachment | null>;
}

const AttachmentsContext = createContext<AttachmentsContextType | undefined>(undefined);

interface AttachmentsProviderProps {
  children: ReactNode;
}

export const AttachmentsProvider: React.FC<AttachmentsProviderProps> = ({ children }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAttachment = (attachment: Omit<Attachment, 'id'>) => {
    const newAttachment: Attachment = {
      ...attachment,
      id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setAttachments(prev => [...prev, newAttachment]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  const pickImage = async (): Promise<Attachment | null> => {
    setLoading(true);
    setError(null);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Permission to access media library denied');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const attachment: Attachment = {
          id: `image_${Date.now()}`,
          uri: asset.uri,
          type: 'image',
          name: asset.fileName || 'image.jpg',
          size: asset.fileSize,
          mimeType: asset.mimeType,
        };
        
        addAttachment(attachment);
        return attachment;
      }
      
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick image';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async (): Promise<Attachment | null> => {
    setLoading(true);
    setError(null);

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Permission to access camera denied');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const attachment: Attachment = {
          id: `photo_${Date.now()}`,
          uri: asset.uri,
          type: 'image',
          name: asset.fileName || 'photo.jpg',
          size: asset.fileSize,
          mimeType: asset.mimeType,
        };
        
        addAttachment(attachment);
        return attachment;
      }
      
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const value: AttachmentsContextType = {
    attachments,
    loading,
    error,
    addAttachment,
    removeAttachment,
    clearAttachments,
    pickImage,
    takePhoto,
  };

  return (
    <AttachmentsContext.Provider value={value}>
      {children}
    </AttachmentsContext.Provider>
  );
};

export const useAttachments = (): AttachmentsContextType => {
  const context = useContext(AttachmentsContext);
  if (!context) {
    throw new Error('useAttachments must be used within an AttachmentsProvider');
  }
  return context;
};