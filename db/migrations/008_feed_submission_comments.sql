-- Separate Rank feed comments from repeatable vote events and allow nested replies.

CREATE TABLE IF NOT EXISTS feed_submission_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_submission_id uuid NOT NULL REFERENCES feed_submissions(id) ON DELETE CASCADE,
  commenter_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES feed_submission_comments(id) ON DELETE CASCADE,
  vote_type text CHECK (vote_type IS NULL OR vote_type IN ('best_fit', 'not_the_one')),
  voter_vote_count integer NOT NULL DEFAULT 0 CHECK (voter_vote_count >= 0),
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 140),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feed_submission_comments_submission_created
  ON feed_submission_comments(feed_submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_submission_comments_parent
  ON feed_submission_comments(parent_comment_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_feed_submission_comments_commenter
  ON feed_submission_comments(commenter_profile_id, created_at DESC);

INSERT INTO feed_submission_comments(
  id,
  feed_submission_id,
  commenter_profile_id,
  vote_type,
  voter_vote_count,
  comment,
  created_at
)
SELECT commented.id,
       commented.feed_submission_id,
       commented.voter_profile_id,
       commented.vote_type,
       commenter_votes.vote_count,
       commented.comment,
       commented.created_at
  FROM feed_submission_votes commented
  JOIN LATERAL (
    SELECT COUNT(*)::integer AS vote_count
      FROM feed_submission_votes voter_votes
     WHERE voter_votes.feed_submission_id = commented.feed_submission_id
       AND voter_votes.voter_profile_id = commented.voter_profile_id
       AND voter_votes.vote_type = commented.vote_type
  ) commenter_votes ON true
 WHERE commented.comment IS NOT NULL
ON CONFLICT (id) DO NOTHING;
