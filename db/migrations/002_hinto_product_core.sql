-- RDS-compatible HINTO product schema adapted from the existing Supabase
-- Postgres migrations. Supabase-only auth/storage/RLS objects are intentionally
-- excluded; the HINTO HTTP API owns authorization in AWS.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  email text,
  name text NOT NULL,
  display_name text,
  username text NOT NULL,
  avatar_url text,
  bio text,
  age integer,
  age_verified boolean NOT NULL DEFAULT false,
  privacy text NOT NULL DEFAULT 'private'
    CHECK (privacy IN ('public', 'private', 'mutuals_only')),
  is_public boolean NOT NULL DEFAULT false,
  mutuals_only boolean NOT NULL DEFAULT false,
  subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium')),
  profile_image_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON profiles (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_platform_user_id
  ON profiles(platform_user_id)
  WHERE platform_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS situationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 10),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 50),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  rank integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  primary_image_id uuid,
  image_count integer NOT NULL DEFAULT 0,
  has_images boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_situationships_user_rank
  ON situationships(user_id, rank, created_at);

CREATE INDEX IF NOT EXISTS idx_situationships_user_updated_active
  ON situationships(user_id, updated_at DESC)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS update_situationships_updated_at ON situationships;
CREATE TRIGGER update_situationships_updated_at
  BEFORE UPDATE ON situationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS voting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT 'Rate my situationships',
  description text,
  is_anonymous boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_owner_id
  ON voting_sessions(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_invite_code
  ON voting_sessions(invite_code);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_expires_at
  ON voting_sessions(expires_at);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_session_id uuid NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  situationship_id uuid NOT NULL REFERENCES situationships(id) ON DELETE CASCADE,
  voter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  voter_identity text,
  voter_name text,
  vote_type text NOT NULL CHECK (vote_type IN ('best_fit', 'not_the_one')),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 140),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP INDEX IF EXISTS idx_votes_session_voter_identity;

CREATE INDEX IF NOT EXISTS idx_votes_session_voter_identity
  ON votes(voting_session_id, voter_identity)
  WHERE voter_identity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_votes_session_id ON votes(voting_session_id);
CREATE INDEX IF NOT EXISTS idx_votes_situationship_id ON votes(situationship_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id);

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'declined', 'blocked')),
  requested_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester_status
  ON friendships(requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status
  ON friendships(addressee_id, status);

DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  situationship_id uuid REFERENCES situationships(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON ai_conversations(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_user boolean NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  moderation_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON ai_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('profile', 'situationship', 'vote', 'message')),
  content_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  moderator_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);

CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  ai_messages_used integer NOT NULL DEFAULT 0,
  votes_created integer NOT NULL DEFAULT 0,
  voting_sessions_created integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, date)
);

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
BEGIN
  LOOP
    code := upper(substring(regexp_replace(encode(gen_random_bytes(6), 'base64'), '[^a-zA-Z0-9]', '', 'g'), 1, 8));
    IF length(code) < 8 THEN
      code := code || repeat('A', 8 - length(code));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM voting_sessions WHERE invite_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;
