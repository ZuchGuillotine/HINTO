-- Friends feed submissions and voting for the AWS/RDS product path.

ALTER TABLE media_assets
  DROP CONSTRAINT IF EXISTS media_assets_target_type_check;

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_target_type_check
  CHECK (target_type IN ('profile_avatar', 'situationship_image', 'feed_submission_image'));

CREATE TABLE IF NOT EXISTS feed_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  situationship_id uuid NOT NULL REFERENCES situationships(id) ON DELETE CASCADE,
  body text CHECK (body IS NULL OR char_length(body) <= 500),
  image_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  image_url text,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feed_submissions_author_created
  ON feed_submissions(author_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_submissions_situationship
  ON feed_submissions(situationship_id);

CREATE INDEX IF NOT EXISTS idx_feed_submissions_active_expires
  ON feed_submissions(is_active, expires_at DESC, created_at DESC);

DROP TRIGGER IF EXISTS update_feed_submissions_updated_at ON feed_submissions;
CREATE TRIGGER update_feed_submissions_updated_at
  BEFORE UPDATE ON feed_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS feed_submission_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_submission_id uuid NOT NULL REFERENCES feed_submissions(id) ON DELETE CASCADE,
  voter_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('best_fit', 'not_the_one')),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 140),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feed_submission_votes_submission
  ON feed_submission_votes(feed_submission_id);

CREATE INDEX IF NOT EXISTS idx_feed_submission_votes_voter
  ON feed_submission_votes(voter_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_submission_votes_submission_voter
  ON feed_submission_votes(feed_submission_id, voter_profile_id, created_at DESC);
