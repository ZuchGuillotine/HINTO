-- Migration: Performance Optimizations and Missing Indexes
-- Adds additional indexes, constraints, and optimizations for better performance
-- This migration focuses on query optimization and database performance

-- ==============================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ==============================================

-- Situationships table optimizations
CREATE INDEX IF NOT EXISTS idx_situationships_user_active ON public.situationships(user_id, is_active) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_situationships_rank_order ON public.situationships(user_id, rank) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_situationships_category ON public.situationships(category);

CREATE INDEX IF NOT EXISTS idx_situationships_created_recent ON public.situationships(created_at DESC);

-- Voting sessions optimizations
CREATE INDEX IF NOT EXISTS idx_voting_sessions_active_expires ON public.voting_sessions(is_active, expires_at) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_voting_sessions_owner_active ON public.voting_sessions(owner_id, is_active);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_recent ON public.voting_sessions(created_at DESC);

-- Votes table optimizations
CREATE INDEX IF NOT EXISTS idx_votes_session_created ON public.votes(voting_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_votes_situationship_type ON public.votes(situationship_id, vote_type);

CREATE INDEX IF NOT EXISTS idx_votes_voter_created ON public.votes(voter_id, created_at) 
WHERE voter_id IS NOT NULL;

-- AI conversations and messages optimizations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated ON public.ai_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_situationship ON public.ai_conversations(situationship_id) 
WHERE situationship_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON public.ai_messages(conversation_id, created_at);

-- CREATE INDEX IF NOT EXISTS idx_ai_messages_user_recent ON public.ai_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_tokens ON public.ai_messages(tokens_used) 
WHERE tokens_used > 0;

-- Profiles table optimizations
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);

CREATE INDEX IF NOT EXISTS idx_profiles_age_verified ON public.profiles(age_verified) 
WHERE age_verified = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON public.profiles(is_public) 
WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username)) 
WHERE username IS NOT NULL;

-- Blocks table optimizations
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_created ON public.blocks(blocker_id, created_at);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked_created ON public.blocks(blocked_id, created_at);

-- Reports table optimizations
CREATE INDEX IF NOT EXISTS idx_reports_content_status ON public.reports(content_type, content_id, status);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports(status, created_at);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_created ON public.reports(reporter_id, created_at) 
WHERE reporter_id IS NOT NULL;

-- Daily usage optimizations
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date_desc ON public.daily_usage(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_usage_date_recent ON public.daily_usage(date);

-- ==============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ==============================================

-- For voting analytics queries
CREATE INDEX IF NOT EXISTS idx_votes_session_situationship_type ON public.votes(voting_session_id, situationship_id, vote_type);

-- For user content queries
CREATE INDEX IF NOT EXISTS idx_situationships_user_rank_active ON public.situationships(user_id, rank, is_active);

-- For moderation queries
CREATE INDEX IF NOT EXISTS idx_reports_status_type_created ON public.reports(status, content_type, created_at);

-- For AI usage tracking
-- CREATE INDEX IF NOT EXISTS idx_ai_messages_user_date_count ON public.ai_messages(user_id, DATE(created_at));

-- ==============================================
-- FOREIGN KEY CONSTRAINTS VALIDATION
-- ==============================================

-- Ensure all foreign key constraints exist and are properly indexed
-- Most of these should already exist, but we'll check/create them

-- Validate situationships foreign keys
DO $$
BEGIN
    -- Check if foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'situationships_user_id_fkey' 
        AND table_name = 'situationships'
    ) THEN
        ALTER TABLE public.situationships 
        ADD CONSTRAINT situationships_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ==============================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ==============================================

-- Active voting sessions only
CREATE INDEX IF NOT EXISTS idx_voting_sessions_active_only ON public.voting_sessions(owner_id, expires_at) 
WHERE is_active = TRUE;

-- Public situationships for discovery
CREATE INDEX IF NOT EXISTS idx_situationships_public_only ON public.situationships(user_id, rank) 
WHERE is_active = TRUE;

-- Pending moderation content
CREATE INDEX IF NOT EXISTS idx_reports_pending_moderation ON public.reports(created_at) 
WHERE status = 'pending';

-- Recent AI messages for rate limiting
-- CREATE INDEX IF NOT EXISTS idx_ai_messages_recent_by_user ON public.ai_messages(user_id);

-- ==============================================
-- ADVANCED QUERY OPTIMIZATIONS
-- ==============================================

-- Function to analyze and update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS VOID AS $$
BEGIN
    -- Update statistics for better query planning
    ANALYZE public.profiles;
    ANALYZE public.situationships;
    ANALYZE public.voting_sessions;
    ANALYZE public.votes;
    ANALYZE public.ai_conversations;
    ANALYZE public.ai_messages;
    ANALYZE public.blocks;
    ANALYZE public.reports;
    ANALYZE public.daily_usage;
    
    -- Update statistics for new tables if they exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friendships') THEN
        ANALYZE public.friendships;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contacts') THEN
        ANALYZE public.contacts;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'images') THEN
        ANALYZE public.images;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'image_attachments') THEN
        ANALYZE public.image_attachments;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- MATERIALIZED VIEWS FOR EXPENSIVE QUERIES
-- ==============================================

-- Materialized view for vote statistics (if needed for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.vote_statistics AS
SELECT 
    s.id as situationship_id,
    s.user_id,
    s.name as situationship_name,
    COUNT(v.id) as total_votes,
    COUNT(v.id) FILTER (WHERE v.vote_type = 'best_fit') as best_fit_votes,
    COUNT(v.id) FILTER (WHERE v.vote_type = 'not_the_one') as not_the_one_votes,
    AVG(CASE 
        WHEN v.vote_type = 'best_fit' THEN 1 
        WHEN v.vote_type = 'not_the_one' THEN -1 
        ELSE 0 
    END) as vote_score,
    MAX(v.created_at) as last_vote_at
FROM public.situationships s
LEFT JOIN public.votes v ON s.id = v.situationship_id
GROUP BY s.id, s.user_id, s.name;

-- Index on the materialized view
CREATE INDEX IF NOT EXISTS idx_vote_statistics_user ON public.vote_statistics(user_id);

CREATE INDEX IF NOT EXISTS idx_vote_statistics_score ON public.vote_statistics(vote_score DESC);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.vote_statistics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ==============================================

-- Function to get user's situationships with vote counts (optimized)
CREATE OR REPLACE FUNCTION get_user_situationships_with_votes(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    emoji TEXT,
    category TEXT,
    description TEXT,
    rank INTEGER,
    total_votes BIGINT,
    best_fit_votes BIGINT,
    not_the_one_votes BIGINT,
    vote_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.emoji,
        s.category,
        s.description,
        s.rank,
        COALESCE(COUNT(v.id), 0) as total_votes,
        COALESCE(COUNT(v.id) FILTER (WHERE v.vote_type = 'best_fit'), 0) as best_fit_votes,
        COALESCE(COUNT(v.id) FILTER (WHERE v.vote_type = 'not_the_one'), 0) as not_the_one_votes,
        COALESCE(AVG(CASE 
            WHEN v.vote_type = 'best_fit' THEN 1.0 
            WHEN v.vote_type = 'not_the_one' THEN -1.0 
            ELSE 0.0 
        END), 0.0) as vote_score
    FROM public.situationships s
    LEFT JOIN public.votes v ON s.id = v.situationship_id
    WHERE s.user_id = p_user_id AND s.is_active = TRUE
    GROUP BY s.id, s.name, s.emoji, s.category, s.description, s.rank
    ORDER BY s.rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent activity for a user (optimized)
CREATE OR REPLACE FUNCTION get_user_recent_activity(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    activity_type TEXT,
    activity_id UUID,
    activity_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    (
        SELECT 
            'situationship_created'::TEXT as activity_type,
            s.id as activity_id,
            jsonb_build_object('name', s.name, 'emoji', s.emoji, 'category', s.category) as activity_data,
            s.created_at
        FROM public.situationships s
        WHERE s.user_id = p_user_id
        AND s.created_at > NOW() - INTERVAL '30 days'
        
        UNION ALL
        
        SELECT 
            'ai_conversation_started'::TEXT as activity_type,
            ac.id as activity_id,
            jsonb_build_object('title', ac.title) as activity_data,
            ac.created_at
        FROM public.ai_conversations ac
        WHERE ac.user_id = p_user_id
        AND ac.created_at > NOW() - INTERVAL '30 days'
        
        UNION ALL
        
        SELECT 
            'voting_session_created'::TEXT as activity_type,
            vs.id as activity_id,
            jsonb_build_object('title', vs.title, 'invite_code', vs.invite_code) as activity_data,
            vs.created_at
        FROM public.voting_sessions vs
        WHERE vs.owner_id = p_user_id
        AND vs.created_at > NOW() - INTERVAL '30 days'
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- PERFORMANCE MONITORING
-- ==============================================

-- Function to get database performance statistics
CREATE OR REPLACE FUNCTION get_performance_stats()
RETURNS TABLE(
    table_name TEXT,
    total_size TEXT,
    index_size TEXT,
    row_count BIGINT,
    seq_scans BIGINT,
    index_scans BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        seq_scan as seq_scans,
        idx_scan as index_scans
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- MAINTENANCE FUNCTIONS
-- ==============================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
    table_name TEXT,
    deleted_count BIGINT
) AS $$
DECLARE
    deleted_votes BIGINT;
    deleted_sessions BIGINT;
    deleted_messages BIGINT;
    deleted_usage BIGINT;
BEGIN
    -- Clean up votes from expired sessions (older than 30 days)
    DELETE FROM public.votes 
    WHERE voting_session_id IN (
        SELECT id FROM public.voting_sessions 
        WHERE expires_at < NOW() - INTERVAL '30 days'
    );
    GET DIAGNOSTICS deleted_votes = ROW_COUNT;
    
    -- Clean up expired voting sessions (older than 30 days)
    DELETE FROM public.voting_sessions 
    WHERE expires_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_sessions = ROW_COUNT;
    
    -- Clean up old AI messages (older than 90 days)
    DELETE FROM public.ai_messages 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_messages = ROW_COUNT;
    
    -- Clean up old usage analytics (older than 1 year)
    DELETE FROM public.daily_usage 
    WHERE date < CURRENT_DATE - INTERVAL '1 year';
    GET DIAGNOSTICS deleted_usage = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('votes', deleted_votes),
        ('voting_sessions', deleted_sessions),
        ('ai_messages', deleted_messages),
        ('daily_usage', deleted_usage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- VACUUM AND MAINTENANCE AUTOMATION
-- ==============================================

-- Function to perform routine maintenance
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Update table statistics
    PERFORM update_table_statistics();
    
    -- Refresh materialized views
    PERFORM refresh_materialized_views();
    
    -- Clean up orphaned images (if image system is enabled)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'images') THEN
        PERFORM cleanup_orphaned_images();
    END IF;
    
    result := 'Maintenance completed successfully at ' || NOW();
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON FUNCTION update_table_statistics() IS 'Updates PostgreSQL statistics for all tables to improve query planning';

COMMENT ON FUNCTION refresh_materialized_views() IS 'Refreshes all materialized views for up-to-date aggregated data';

COMMENT ON FUNCTION get_user_situationships_with_votes(UUID) IS 'Optimized function to get user situationships with vote statistics';

COMMENT ON FUNCTION get_user_recent_activity(UUID, INTEGER) IS 'Returns recent user activity across multiple tables';

COMMENT ON FUNCTION get_performance_stats() IS 'Returns database performance statistics for monitoring';

COMMENT ON FUNCTION cleanup_old_data() IS 'Cleans up old data to maintain database performance';

COMMENT ON FUNCTION perform_maintenance() IS 'Performs routine database maintenance tasks';

COMMIT;
