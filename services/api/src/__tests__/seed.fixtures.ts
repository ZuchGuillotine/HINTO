/**
 * Dev seed fixtures for repeatable local development.
 *
 * These fixtures can be loaded into a local Supabase instance
 * via `npx ts-node services/api/src/__tests__/seed.fixtures.ts`
 * or imported by integration tests that run against a real DB.
 *
 * For unit tests, use the mock helpers in ./helpers/supabase.ts instead.
 */

export const SEED_USERS = {
  alice: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'alice@example.com',
    password: 'test-password-alice-123',
  },
  bob: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'bob@example.com',
    password: 'test-password-bob-456',
  },
  carol: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'carol@example.com',
    password: 'test-password-carol-789',
  },
} as const;

export const SEED_PROFILES = {
  alice: {
    id: SEED_USERS.alice.id,
    username: 'alice',
    display_name: 'Alice Test',
    email: SEED_USERS.alice.email,
    bio: 'Testing queen',
    avatar_url: null,
    privacy: 'public',
    subscription_tier: 'free',
  },
  bob: {
    id: SEED_USERS.bob.id,
    username: 'bob',
    display_name: 'Bob Test',
    email: SEED_USERS.bob.email,
    bio: 'Just vibing',
    avatar_url: null,
    privacy: 'private',
    subscription_tier: 'free',
  },
  carol: {
    id: SEED_USERS.carol.id,
    username: 'carol',
    display_name: 'Carol Test',
    email: SEED_USERS.carol.email,
    bio: null,
    avatar_url: null,
    privacy: 'mutuals_only',
    subscription_tier: 'premium',
  },
} as const;

export const SEED_SITUATIONSHIPS = {
  alice_alex: {
    id: 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
    user_id: SEED_USERS.alice.id,
    name: 'Alex',
    emoji: '🔥',
    category: 'dating',
    description: 'Met at coffee shop',
    rank: 0,
    status: 'active',
  },
  alice_jordan: {
    id: 'aaaaaaaa-0001-0001-0002-aaaaaaaaaaaa',
    user_id: SEED_USERS.alice.id,
    name: 'Jordan',
    emoji: '💜',
    category: 'talking',
    description: 'From the gym',
    rank: 1,
    status: 'active',
  },
  alice_sam: {
    id: 'aaaaaaaa-0001-0001-0003-aaaaaaaaaaaa',
    user_id: SEED_USERS.alice.id,
    name: 'Sam',
    emoji: '✨',
    category: 'complicated',
    description: 'Ex but still around',
    rank: 2,
    status: 'active',
  },
  bob_taylor: {
    id: 'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb',
    user_id: SEED_USERS.bob.id,
    name: 'Taylor',
    emoji: '🌙',
    category: 'dating',
    description: null,
    rank: 0,
    status: 'active',
  },
} as const;

export const SEED_AUTH_IDENTITIES = {
  alice_apple: {
    user_id: SEED_USERS.alice.id,
    provider: 'apple',
    provider_user_id: 'apple-alice-001',
    provider_email: SEED_USERS.alice.email,
    is_primary: true,
  },
  bob_facebook: {
    user_id: SEED_USERS.bob.id,
    provider: 'facebook',
    provider_user_id: 'fb-bob-001',
    provider_email: SEED_USERS.bob.email,
    is_primary: true,
  },
} as const;

/**
 * Generates SQL INSERT statements for seeding a local Supabase instance.
 */
export function generateSeedSQL(): string {
  const lines: string[] = [
    '-- HINTO dev seed fixtures',
    '-- Run against a local Supabase instance for development',
    '',
    '-- Profiles',
  ];

  for (const profile of Object.values(SEED_PROFILES)) {
    lines.push(
      `INSERT INTO public.profiles (id, username, display_name, email, bio, avatar_url, privacy, subscription_tier)` +
        ` VALUES ('${profile.id}', '${profile.username}', '${profile.display_name}', '${profile.email}', ${profile.bio ? `'${profile.bio}'` : 'NULL'}, NULL, '${profile.privacy}', '${profile.subscription_tier}')` +
        ` ON CONFLICT (id) DO NOTHING;`,
    );
  }

  lines.push('', '-- Situationships');

  for (const sit of Object.values(SEED_SITUATIONSHIPS)) {
    lines.push(
      `INSERT INTO public.situationships (id, user_id, name, emoji, category, description, rank, status)` +
        ` VALUES ('${sit.id}', '${sit.user_id}', '${sit.name}', '${sit.emoji}', '${sit.category}', ${sit.description ? `'${sit.description}'` : 'NULL'}, ${sit.rank}, '${sit.status}')` +
        ` ON CONFLICT (id) DO NOTHING;`,
    );
  }

  lines.push('', '-- Auth identities');

  for (const ident of Object.values(SEED_AUTH_IDENTITIES)) {
    lines.push(
      `INSERT INTO public.auth_identities (user_id, provider, provider_user_id, provider_email, is_primary)` +
        ` VALUES ('${ident.user_id}', '${ident.provider}', '${ident.provider_user_id}', '${ident.provider_email}', ${ident.is_primary})` +
        ` ON CONFLICT (user_id, provider) DO NOTHING;`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

// When run directly, print the SQL to stdout
if (require.main === module) {
  console.log(generateSeedSQL());
}
