-- Allow repeated rank-feed votes while keeping per-user vote caps enforceable in the API.

ALTER TABLE feed_submission_votes
  DROP CONSTRAINT IF EXISTS feed_submission_votes_feed_submission_id_voter_profile_id_key;

CREATE INDEX IF NOT EXISTS idx_feed_submission_votes_submission_voter
  ON feed_submission_votes(feed_submission_id, voter_profile_id, created_at DESC);
