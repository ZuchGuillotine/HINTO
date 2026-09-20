-- First-party email/password auth for the AWS/RDS API path.
-- This complements platform_users/auth_identities from 001_platform_identity.sql
-- and lets the HTTP API issue its own bearer sessions without Supabase Auth.

CREATE TABLE IF NOT EXISTS auth_password_credentials (
  platform_user_id uuid PRIMARY KEY REFERENCES platform_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_auth_password_credentials_updated_at
  ON auth_password_credentials;
CREATE TRIGGER update_auth_password_credentials_updated_at
  BEFORE UPDATE ON auth_password_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS access_token_hash text;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_access_token_hash
  ON auth_sessions(access_token_hash)
  WHERE access_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_access_token_active
  ON auth_sessions(access_token_expires_at)
  WHERE revoked_at IS NULL AND access_token_hash IS NOT NULL;
