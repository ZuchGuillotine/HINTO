import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  // S3 bucket for user avatars and other media
  content: {
    access: 'private', // Only authenticated users can access
    rules: {
      // User avatars (profile pictures)
      avatars: {
        prefix: 'avatars/',
        access: 'private',
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        // Only allow users to access their own avatar
        ownerAccess: true,
      },
      // Shareable images (ranked lists)
      shares: {
        prefix: 'shares/',
        access: 'public', // Shareable images need public access
        maxSize: 2 * 1024 * 1024, // 2MB
        allowedMimeTypes: ['image/png'],
        // Allow temporary public access for sharing
        publicAccess: {
          duration: 24 * 60 * 60, // 24 hours in seconds
        },
      },
      // Chat attachments (if we add this feature)
      attachments: {
        prefix: 'attachments/',
        access: 'private',
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
        // Only allow access to users in the chat
        ownerAccess: true,
      },
    },
  },
}); 