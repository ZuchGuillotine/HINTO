-- Media metadata and URL mapping for profile/situationship image uploads.

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('profile_avatar', 'situationship_image')),
  target_id uuid,
  storage_provider text NOT NULL CHECK (storage_provider IN ('s3', 'local')),
  storage_bucket text,
  storage_key text NOT NULL,
  public_url text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner_created
  ON media_assets(owner_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_assets_target
  ON media_assets(target_type, target_id, created_at DESC);

ALTER TABLE situationships
  ADD COLUMN IF NOT EXISTS primary_image_url text;

CREATE INDEX IF NOT EXISTS idx_situationships_primary_image_id
  ON situationships(primary_image_id)
  WHERE primary_image_id IS NOT NULL;
