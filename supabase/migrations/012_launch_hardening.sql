-- 012_launch_hardening.sql
-- Restart-era hardening found during the launch readiness audit
-- (docs/Launch_Readiness_Audit.md: B3, B16, B17, M1, M5, M11).
-- Idempotent: safe to run more than once.

BEGIN;

-- ------------------------------------------------------------------
-- B3: transactional reorder that respects UNIQUE(user_id, rank)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_situationships(
    p_user_id UUID,
    p_ordered_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_offset INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.situationships
    WHERE user_id = p_user_id;

    IF v_count <> COALESCE(array_length(p_ordered_ids, 1), 0) THEN
        RAISE EXCEPTION 'ordered ids must include every situationship exactly once'
            USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1 FROM unnest(p_ordered_ids) AS id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.situationships s
            WHERE s.id = id AND s.user_id = p_user_id
        )
    ) THEN
        RAISE EXCEPTION 'ordered ids contain an unknown situationship'
            USING ERRCODE = 'P0002';
    END IF;

    -- Phase 1: move every rank out of the way so no swap collides.
    SELECT COALESCE(MAX(rank), 0) + 1000 INTO v_offset
    FROM public.situationships
    WHERE user_id = p_user_id;

    UPDATE public.situationships
    SET rank = rank + v_offset
    WHERE user_id = p_user_id;

    -- Phase 2: assign final ranks from array position.
    UPDATE public.situationships s
    SET rank = ordered.position - 1,
        updated_at = TIMEZONE('utc'::text, NOW())
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
    WHERE s.id = ordered.id AND s.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_situationships(UUID, UUID[]) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------
-- M1: bio column that contracts and clients already expect
-- ------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 300);

-- ------------------------------------------------------------------
-- M5: providers may not return an email (Apple private relay always does,
-- Facebook may not). Keep signup working and let the API fill it later.
-- ------------------------------------------------------------------
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'name', ''),
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
            'New user'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------
-- B16: views bypass RLS. Nothing in the API reads them; remove client access.
-- ------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.situationships_with_images') IS NOT NULL THEN
        REVOKE ALL ON public.situationships_with_images FROM anon, authenticated;
    END IF;
    IF to_regclass('public.ai_conversation_analytics') IS NOT NULL THEN
        REVOKE ALL ON public.ai_conversation_analytics FROM anon, authenticated;
    END IF;
    IF to_regclass('public.vote_statistics') IS NOT NULL THEN
        REVOKE ALL ON public.vote_statistics FROM anon, authenticated;
    END IF;
END $$;

-- ------------------------------------------------------------------
-- B17: invite codes and votes must only be readable through the API.
-- Owners keep read access to their own sessions and votes.
-- ------------------------------------------------------------------
-- Replace every legacy SELECT/INSERT policy on these tables with owner-only
-- access. The API performs public invite lookups and anonymous vote inserts
-- through the service role, so clients never need permissive policies.
DROP POLICY IF EXISTS "Users can view accessible voting sessions" ON public.voting_sessions;
DROP POLICY IF EXISTS "Users can view active voting sessions" ON public.voting_sessions;
DROP POLICY IF EXISTS "Users can manage their own voting sessions" ON public.voting_sessions;
DROP POLICY IF EXISTS "Users can create own voting sessions" ON public.voting_sessions;
DROP POLICY IF EXISTS "Users can update own voting sessions" ON public.voting_sessions;
DROP POLICY IF EXISTS "Owners can read own voting sessions" ON public.voting_sessions;
CREATE POLICY "Owners can read own voting sessions" ON public.voting_sessions
    FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can view relevant votes" ON public.votes;
DROP POLICY IF EXISTS "Users can view votes for active sessions" ON public.votes;
DROP POLICY IF EXISTS "Users can vote in active sessions" ON public.votes;
DROP POLICY IF EXISTS "Users can create votes for active sessions" ON public.votes;
DROP POLICY IF EXISTS "Session owners can view all votes" ON public.votes;
CREATE POLICY "Session owners can view all votes" ON public.votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.voting_sessions vs
            WHERE vs.id = voting_session_id AND vs.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "System can manage usage" ON public.daily_usage;
CREATE POLICY "Users can view own usage" ON public.daily_usage
    FOR SELECT USING (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Moderation tables: make sure RLS is on; the API writes with service role.
-- ------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocks;
CREATE POLICY "Users can view own blocks" ON public.blocks
    FOR SELECT USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON public.ai_messages(conversation_id, created_at);

COMMIT;
