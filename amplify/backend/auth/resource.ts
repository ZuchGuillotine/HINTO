import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    // OAuth providers to be configured with credentials
    google: true,
    customProviders: {
      snapchat: {
        clientId: process.env.SNAPCHAT_CLIENT_ID,
        clientSecret: process.env.SNAPCHAT_CLIENT_SECRET,
      },
      tiktok: {
        clientId: process.env.TIKTOK_CLIENT_ID,
        clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      },
    },
  },
  // Age verification required
  userAttributes: {
    age: {
      required: true,
      mutable: false, // Age cannot be changed after verification
      min: 18,
    },
    inviteCode: {
      required: true,
      mutable: false, // Invite code is one-time use
    },
    username: {
      required: true,
      mutable: true,
    },
    avatar: {
      required: false,
      mutable: true,
    },
    isPro: {
      required: false,
      mutable: true,
      default: false,
    },
    blockedUsers: {
      required: false,
      mutable: true,
      type: 'list',
    },
  },
  // Optional MFA for additional security
  multifactor: {
    mode: 'OPTIONAL',
  },
  // Password policy
  passwordPolicy: {
    minLength: 8,
    requireNumbers: true,
    requireSpecialCharacters: true,
    requireUppercase: true,
    requireLowercase: true,
  },
}); 