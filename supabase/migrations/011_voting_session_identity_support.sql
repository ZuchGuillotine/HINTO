-- Restart migration: add idempotent public-vote support for restart-era voting routes.
-- Assumes the donor schema baseline already created voting_sessions and votes.

ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS voter_identity TEXT;

UPDATE public.votes
SET voter_identity = voter_id::text
WHERE voter_identity IS NULL
  AND voter_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_session_voter_identity_vote_type
  ON public.votes(voting_session_id, voter_identity, vote_type)
  WHERE voter_identity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_votes_session_voter_identity
  ON public.votes(voting_session_id, voter_identity)
  WHERE voter_identity IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_vote_results_with_ranking(session_id uuid)
RETURNS TABLE (
  situationship_id uuid,
  situationship_name text,
  situationship_emoji text,
  best_fit_count bigint,
  not_the_one_count bigint,
  total_votes bigint,
  score bigint,
  rank_position bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH vote_counts AS (
    SELECT
      s.id AS situationship_id,
      s.name AS situationship_name,
      s.emoji AS situationship_emoji,
      count(CASE WHEN v.vote_type = 'best_fit' THEN 1 END) AS best_fit_count,
      count(CASE WHEN v.vote_type = 'not_the_one' THEN 1 END) AS not_the_one_count,
      count(v.id) AS total_votes,
      count(CASE WHEN v.vote_type = 'best_fit' THEN 1 END)
        - count(CASE WHEN v.vote_type = 'not_the_one' THEN 1 END) AS score
    FROM public.situationships s
    JOIN public.voting_sessions vs ON vs.owner_id = s.user_id
    LEFT JOIN public.votes v
      ON v.situationship_id = s.id
      AND v.voting_session_id = session_id
    WHERE vs.id = session_id
      AND s.is_active = true
    GROUP BY s.id, s.name, s.emoji, s.rank
  ),
  ranked AS (
    SELECT
      *,
      row_number() OVER (
        ORDER BY score DESC, total_votes DESC, situationship_name ASC
      ) AS rank_position
    FROM vote_counts
  )
  SELECT * FROM ranked ORDER BY rank_position;
END;
$$;
