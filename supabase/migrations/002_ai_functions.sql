-- AI-related database functions
-- Add this to your Supabase SQL editor after the initial schema

-- Function to increment AI usage safely
CREATE OR REPLACE FUNCTION increment_ai_usage(
    p_user_id UUID,
    p_date DATE
)
RETURNS void AS $$
BEGIN
    -- Try to update existing record
    UPDATE public.daily_usage 
    SET ai_messages_used = ai_messages_used + 1
    WHERE user_id = p_user_id AND date = p_date;
    
    -- If no record exists, insert new one
    IF NOT FOUND THEN
        INSERT INTO public.daily_usage (user_id, date, ai_messages_used)
        VALUES (p_user_id, p_date, 1)
        ON CONFLICT (user_id, date) 
        DO UPDATE SET ai_messages_used = daily_usage.ai_messages_used + 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's AI usage stats
CREATE OR REPLACE FUNCTION get_ai_usage_stats(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    messages_used INTEGER,
    subscription_tier TEXT,
    daily_limit INTEGER,
    messages_remaining INTEGER,
    is_at_limit BOOLEAN
) AS $$
DECLARE
    v_subscription_tier TEXT;
    v_messages_used INTEGER;
    v_daily_limit INTEGER;
BEGIN
    -- Get user's subscription tier
    SELECT profiles.subscription_tier INTO v_subscription_tier
    FROM public.profiles
    WHERE profiles.id = p_user_id;
    
    -- Set daily limit based on tier
    v_daily_limit := CASE 
        WHEN v_subscription_tier = 'premium' THEN 100
        ELSE 10
    END;
    
    -- Get messages used today
    SELECT COALESCE(daily_usage.ai_messages_used, 0) INTO v_messages_used
    FROM public.daily_usage
    WHERE daily_usage.user_id = p_user_id AND daily_usage.date = p_date;
    
    -- Return stats
    RETURN QUERY SELECT 
        COALESCE(v_messages_used, 0),
        COALESCE(v_subscription_tier, 'free'),
        v_daily_limit,
        GREATEST(0, v_daily_limit - COALESCE(v_messages_used, 0)),
        COALESCE(v_messages_used, 0) >= v_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation summary for analytics
CREATE OR REPLACE FUNCTION get_conversation_summary(
    p_conversation_id UUID
)
RETURNS TABLE (
    message_count INTEGER,
    total_tokens INTEGER,
    conversation_duration INTERVAL,
    user_message_count INTEGER,
    ai_message_count INTEGER,
    flagged_messages INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as message_count,
        SUM(tokens_used)::INTEGER as total_tokens,
        MAX(created_at) - MIN(created_at) as conversation_duration,
        COUNT(*) FILTER (WHERE is_user = true)::INTEGER as user_message_count,
        COUNT(*) FILTER (WHERE is_user = false)::INTEGER as ai_message_count,
        COUNT(*) FILTER (WHERE moderation_flagged = true)::INTEGER as flagged_messages
    FROM public.ai_messages
    WHERE conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old conversations (for GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_conversations(
    p_days_old INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete conversations older than specified days
    WITH deleted AS (
        DELETE FROM public.ai_conversations
        WHERE created_at < NOW() - INTERVAL '1 day' * p_days_old
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for AI-related tables (if not already set)

-- Allow users to call the usage functions
GRANT EXECUTE ON FUNCTION increment_ai_usage(UUID, DATE) TO authenticated;

GRANT EXECUTE ON FUNCTION get_ai_usage_stats(UUID, DATE) TO authenticated;

GRANT EXECUTE ON FUNCTION get_conversation_summary(UUID) TO authenticated;

-- Only allow admins to cleanup conversations
GRANT EXECUTE ON FUNCTION cleanup_old_conversations(INTEGER) TO service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created 
ON public.ai_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_messages_moderation 
ON public.ai_messages(moderation_flagged) WHERE moderation_flagged = true;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_situationship 
ON public.ai_conversations(user_id, situationship_id);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date 
ON public.daily_usage(user_id, date);

-- Create a view for conversation analytics (admin only)
CREATE OR REPLACE VIEW ai_conversation_analytics AS
SELECT 
    c.id,
    c.user_id,
    c.situationship_id,
    c.created_at,
    COUNT(m.id) as message_count,
    SUM(m.tokens_used) as total_tokens,
    COUNT(*) FILTER (WHERE m.is_user = true) as user_messages,
    COUNT(*) FILTER (WHERE m.is_user = false) as ai_messages,
    COUNT(*) FILTER (WHERE m.moderation_flagged = true) as flagged_messages,
    MAX(m.created_at) as last_message_at
FROM public.ai_conversations c
LEFT JOIN public.ai_messages m ON c.id = m.conversation_id
GROUP BY c.id, c.user_id, c.situationship_id, c.created_at;

-- RLS for the analytics view (admin only)
ALTER VIEW ai_conversation_analytics OWNER TO postgres;

COMMIT;
