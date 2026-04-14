-- Migration: Add voting-specific database functions
-- Generated: Sprint 4 - Voting & Real-time

-- Function to generate unique invite codes for voting sessions
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code text;
  exists_count integer;
BEGIN
  LOOP
    -- Generate an 8-character alphanumeric code
    code := upper(
      substring(
        encode(gen_random_bytes(6), 'base64'),
        1, 8
      )
    );
    
    -- Replace any non-alphanumeric characters
    code := regexp_replace(code, '[^A-Z0-9]', chr(65 + floor(random() * 26)::int), 'g');
    
    -- Ensure it's exactly 8 characters
    IF length(code) < 8 THEN
      code := code || repeat('A', 8 - length(code));
    END IF;
    code := left(code, 8);
    
    -- Check if this code already exists
    SELECT count(*) INTO exists_count
    FROM voting_sessions
    WHERE invite_code = code;
    
    -- If unique, return it
    IF exists_count = 0 THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Function to clean up expired voting sessions
CREATE OR REPLACE FUNCTION cleanup_expired_voting_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate expired voting sessions
  UPDATE voting_sessions
  SET is_active = false
  WHERE is_active = true
    AND expires_at < now();
    
  -- Optionally delete very old sessions (older than 30 days)
  -- Uncomment if you want automatic cleanup
  -- DELETE FROM voting_sessions
  -- WHERE created_at < now() - interval '30 days';
END;
$$;

-- Function to get voting session statistics
CREATE OR REPLACE FUNCTION get_voting_session_stats(session_id uuid)
RETURNS TABLE (
  total_votes bigint,
  best_fit_votes bigint,
  not_the_one_votes bigint,
  unique_voters bigint,
  situationships_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT count(*) FROM votes WHERE voting_session_id = session_id) as total_votes,
    (SELECT count(*) FROM votes WHERE voting_session_id = session_id AND vote_type = 'best_fit') as best_fit_votes,
    (SELECT count(*) FROM votes WHERE voting_session_id = session_id AND vote_type = 'not_the_one') as not_the_one_votes,
    (
      SELECT count(DISTINCT COALESCE(voter_id::text, voter_name))
      FROM votes 
      WHERE voting_session_id = session_id
        AND (voter_id IS NOT NULL OR voter_name IS NOT NULL)
    ) as unique_voters,
    (
      SELECT count(*)
      FROM situationships s
      JOIN voting_sessions vs ON vs.owner_id = s.user_id
      WHERE vs.id = session_id AND s.is_active = true
    ) as situationships_count;
END;
$$;

-- Function to get vote results with ranking
CREATE OR REPLACE FUNCTION get_vote_results_with_ranking(session_id uuid)
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
      s.id as situationship_id,
      s.name as situationship_name,
      s.emoji as situationship_emoji,
      count(CASE WHEN v.vote_type = 'best_fit' THEN 1 END) as best_fit_count,
      count(CASE WHEN v.vote_type = 'not_the_one' THEN 1 END) as not_the_one_count,
      count(v.id) as total_votes,
      count(CASE WHEN v.vote_type = 'best_fit' THEN 1 END) - count(CASE WHEN v.vote_type = 'not_the_one' THEN 1 END) as score
    FROM situationships s
    JOIN voting_sessions vs ON vs.owner_id = s.user_id
    LEFT JOIN votes v ON v.situationship_id = s.id AND v.voting_session_id = session_id
    WHERE vs.id = session_id AND s.is_active = true
    GROUP BY s.id, s.name, s.emoji
  ),
  ranked_results AS (
    SELECT 
      *,
      row_number() OVER (ORDER BY score DESC, total_votes DESC, situationship_name ASC) as rank_position
    FROM vote_counts
  )
  SELECT * FROM ranked_results ORDER BY rank_position;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_votes_session_id ON votes(voting_session_id);

CREATE INDEX IF NOT EXISTS idx_votes_situationship_id ON votes(situationship_id);

CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_invite_code ON voting_sessions(invite_code);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_owner_id ON voting_sessions(owner_id);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_expires_at ON voting_sessions(expires_at);

-- Set up row level security for real-time subscriptions
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for voting_sessions
DROP POLICY IF EXISTS "Users can view active voting sessions" ON voting_sessions;

CREATE POLICY "Users can view active voting sessions" ON voting_sessions
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can manage their own voting sessions" ON voting_sessions;

CREATE POLICY "Users can manage their own voting sessions" ON voting_sessions
  FOR ALL USING (auth.uid() = owner_id);

-- RLS policies for votes
DROP POLICY IF EXISTS "Users can view votes for active sessions" ON votes;

CREATE POLICY "Users can view votes for active sessions" ON votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM voting_sessions vs 
      WHERE vs.id = voting_session_id 
      AND vs.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can create votes for active sessions" ON votes;

CREATE POLICY "Users can create votes for active sessions" ON votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM voting_sessions vs 
      WHERE vs.id = voting_session_id 
      AND vs.is_active = true 
      AND vs.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Session owners can view all votes" ON votes;

CREATE POLICY "Session owners can view all votes" ON votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM voting_sessions vs 
      WHERE vs.id = voting_session_id 
      AND vs.owner_id = auth.uid()
    )
  );
