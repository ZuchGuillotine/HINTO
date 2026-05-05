-- HINTO platform identity baseline for AWS/RDS production.
-- This migration is intentionally independent of Supabase Auth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS platform_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email text,
  display_name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_users_primary_email_lower
  ON platform_users (lower(primary_email))
  WHERE primary_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  app_key text NOT NULL,
  app_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_key, app_user_id),
  UNIQUE (platform_user_id, app_key)
);

CREATE INDEX IF NOT EXISTS idx_app_users_platform_user_id
  ON app_users(platform_user_id);

CREATE TABLE IF NOT EXISTS auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  provider_email text,
  provider_email_verified boolean NOT NULL DEFAULT false,
  provider_username text,
  provider_display_name text,
  provider_avatar_url text,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id),
  UNIQUE (platform_user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_platform_user_id
  ON auth_identities(platform_user_id);

CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_email_lower
  ON auth_identities(provider, lower(provider_email))
  WHERE provider_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  app_key text,
  refresh_token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_platform_user_active
  ON auth_sessions(platform_user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  app_key text,
  provider text NOT NULL,
  event_type text NOT NULL,
  success boolean NOT NULL,
  ip_address inet,
  user_agent text,
  error_code text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_platform_user_id
  ON auth_login_events(platform_user_id);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_created_at
  ON auth_login_events(created_at DESC);

CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  provider text NOT NULL,
  app_key text,
  redirect_uri text,
  code_verifier_hash text,
  nonce_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_provider_expires
  ON oauth_states(provider, expires_at);

CREATE TABLE IF NOT EXISTS email_magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  app_key text,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'sign_in'
    CHECK (purpose IN ('sign_in', 'link_identity', 'email_verify')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_magic_links_email_lower
  ON email_magic_links(lower(email), expires_at);

CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  consent_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'revoked')),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_user_id, consent_key)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_platform_status
  ON user_consents(platform_user_id, status);

CREATE TABLE IF NOT EXISTS data_sharing_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  source_app_key text NOT NULL,
  target_app_key text NOT NULL,
  grant_type text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (platform_user_id, source_app_key, target_app_key, grant_type)
);

CREATE INDEX IF NOT EXISTS idx_data_sharing_grants_platform_status
  ON data_sharing_grants(platform_user_id, status);

CREATE INDEX IF NOT EXISTS idx_data_sharing_grants_target_app
  ON data_sharing_grants(target_app_key, status);
