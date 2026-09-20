-- Friends, share invites, and consent-based discovery foundations.
--
-- The API owns authorization. These tables intentionally avoid storing raw
-- phone/email contact values; contact matching should use server-side HMACs.

CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique_pair_active
  ON friendships (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  )
  WHERE status IN ('pending', 'accepted');

CREATE TABLE IF NOT EXISTS profile_discovery_settings (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  discoverable_by_contacts boolean NOT NULL DEFAULT true,
  discoverable_by_mutuals boolean NOT NULL DEFAULT true,
  allow_friend_requests boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS update_profile_discovery_settings_updated_at
  ON profile_discovery_settings;
CREATE TRIGGER update_profile_discovery_settings_updated_at
  BEFORE UPDATE ON profile_discovery_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS profile_contact_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email')),
  normalized_hmac text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  discoverable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (contact_type, normalized_hmac)
);

CREATE INDEX IF NOT EXISTS idx_profile_contact_points_profile
  ON profile_contact_points(profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_contact_points_matchable
  ON profile_contact_points(contact_type, normalized_hmac)
  WHERE is_verified = true AND discoverable = true;

CREATE TABLE IF NOT EXISTS contact_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('ios_contacts', 'manual_contact_picker', 'web_manual')),
  selected_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()) + interval '30 days'
);

CREATE INDEX IF NOT EXISTS idx_contact_import_batches_profile_created
  ON contact_import_batches(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS friend_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggested_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('contacts', 'mutual_friend', 'shared_invite', 'shared_voter', 'provider_link')),
  reason_code text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'dismissed', 'requested', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()) + interval '30 days',
  CHECK (profile_id <> suggested_profile_id),
  UNIQUE (profile_id, suggested_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_suggestions_profile_active
  ON friend_suggestions(profile_id, score DESC, created_at DESC)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION generate_share_invite_token()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  token text;
BEGIN
  LOOP
    token := lower(substring(regexp_replace(encode(gen_random_bytes(12), 'base64'), '[^a-zA-Z0-9]', '', 'g'), 1, 16));
    IF length(token) < 16 THEN
      token := token || lower(substring(encode(gen_random_bytes(4), 'hex'), 1, 16 - length(token)));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM share_invites WHERE invite_token = token) THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS share_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_token text UNIQUE NOT NULL DEFAULT generate_share_invite_token(),
  target_type text NOT NULL
    CHECK (target_type IN ('voting_session', 'feed_submission', 'friend_invite')),
  target_id uuid,
  channel text NOT NULL DEFAULT 'unknown'
    CHECK (channel IN ('sms', 'ios_share', 'web_share', 'copy_link', 'unknown')),
  recipient_contact_hmac text,
  clicked_at timestamptz,
  converted_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()) + interval '14 days'
);

CREATE INDEX IF NOT EXISTS idx_share_invites_inviter_created
  ON share_invites(inviter_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_invites_target
  ON share_invites(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_share_invites_convertible
  ON share_invites(invite_token, expires_at)
  WHERE converted_profile_id IS NULL;
