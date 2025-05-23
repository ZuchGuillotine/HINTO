export type SocialLinks = {
  instagram?: string | null;
  twitter?: string | null;
  snapchat?: string | null;
  tiktok?: string | null;
};

export type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  displayName?: string | null;
  location?: string | null;
  website?: string | null;
  socialLinks?: SocialLinks | null;
  isPrivate: boolean;
  mutualsOnly: boolean;
  plan: 'FREE' | 'PRO';
  createdAt: string;
  updatedAt: string;
};

export type UpdateUserInput = {
  id: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  displayName?: string | null;
  location?: string | null;
  website?: string | null;
  socialLinks?: SocialLinks | null;
  isPrivate?: boolean;
  mutualsOnly?: boolean;
  plan?: 'FREE' | 'PRO';
};

export type Situationship = {
  id: string;
  owner: string;
  name: string;
  emoji?: string | null;
  category?: string | null;
  avatarUrl?: string | null;
  rankIndex?: number | null;
  sharedWith?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSituationshipInput = {
  name: string;
  emoji?: string | null;
  category?: string | null;
  avatarUrl?: string | null;
  sharedWith?: string[] | null;
  owner: string;
};

export type UpdateSituationshipInput = {
  id: string;
  name?: string;
  emoji?: string | null;
  category?: string | null;
  avatarUrl?: string | null;
  sharedWith?: string[] | null;
};

export type DeleteSituationshipInput = {
  id: string;
}; 