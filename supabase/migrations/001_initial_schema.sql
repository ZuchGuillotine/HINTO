-- HNNT Database Schema
-- Initial migration for Sprint 1
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================
-- USERS & PROFILES
-- ==============================================

-- User profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    avatar_url TEXT,
    age INTEGER,
    age_verified BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    mutuals_only BOOLEAN DEFAULT FALSE,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================
-- SITUATIONSHIPS
-- ==============================================

-- Situationships table
CREATE TABLE public.situationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    emoji TEXT NOT NULL CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 10),
    category TEXT NOT NULL CHECK (char_length(category) >= 1 AND char_length(category) <= 50),
    description TEXT CHECK (char_length(description) <= 500),
    rank INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure unique ranks per user
    UNIQUE(user_id, rank)
);

-- ==============================================
-- VOTING SYSTEM
-- ==============================================

-- Voting sessions table
CREATE TABLE public.voting_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT 'Rate my situationships',
    description TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Votes table
CREATE TABLE public.votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    voting_session_id UUID REFERENCES public.voting_sessions(id) ON DELETE CASCADE NOT NULL,
    situationship_id UUID REFERENCES public.situationships(id) ON DELETE CASCADE NOT NULL,
    voter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL for anonymous votes
    voter_name TEXT, -- For anonymous voters
    vote_type TEXT NOT NULL CHECK (vote_type IN ('best_fit', 'not_the_one')),
    comment TEXT CHECK (char_length(comment) <= 140),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Prevent duplicate votes from same voter on same situationship in same session
    UNIQUE(voting_session_id, situationship_id, voter_id)
);

-- ==============================================
-- AI CHAT SYSTEM
-- ==============================================

-- AI chat conversations
CREATE TABLE public.ai_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    situationship_id UUID REFERENCES public.situationships(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- AI chat messages
CREATE TABLE public.ai_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_user BOOLEAN NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    moderation_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================
-- SAFETY & MODERATION
-- ==============================================

-- User blocks table
CREATE TABLE public.blocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Prevent blocking yourself
    CHECK (blocker_id != blocked_id),
    
    -- Prevent duplicate blocks
    UNIQUE(blocker_id, blocked_id)
);

-- Content reports table
CREATE TABLE public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('profile', 'situationship', 'vote', 'message')),
    content_id UUID NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    moderator_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================
-- USAGE TRACKING & ANALYTICS
-- ==============================================

-- Daily usage tracking for rate limiting
CREATE TABLE public.daily_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_messages_used INTEGER DEFAULT 0,
    votes_created INTEGER DEFAULT 0,
    voting_sessions_created INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- One record per user per day
    UNIQUE(user_id, date)
);

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_situationships_updated_at BEFORE UPDATE ON public.situationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
    );
    
    -- Initialize daily usage for new user
    INSERT INTO public.daily_usage (user_id, date)
    VALUES (NEW.id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to enforce free tier limits
CREATE OR REPLACE FUNCTION public.check_free_tier_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_tier TEXT;
    situationship_count INTEGER;
BEGIN
    -- Get user's subscription tier
    SELECT subscription_tier INTO user_tier 
    FROM public.profiles 
    WHERE id = NEW.user_id;
    
    -- Only check limits for free tier users
    IF user_tier = 'free' THEN
        -- Count existing situationships
        SELECT COUNT(*) INTO situationship_count
        FROM public.situationships
        WHERE user_id = NEW.user_id AND is_active = TRUE;
        
        -- Enforce 5 situationship limit for free tier
        IF situationship_count >= 5 THEN
            RAISE EXCEPTION 'Free tier users are limited to 5 situationships. Please upgrade to add more.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to enforce free tier limits
CREATE TRIGGER enforce_free_tier_limits
    BEFORE INSERT ON public.situationships
    FOR EACH ROW EXECUTE FUNCTION public.check_free_tier_limits();

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    done BOOL := FALSE;
BEGIN
    WHILE NOT done LOOP
        -- Generate 8-character alphanumeric code
        code := encode(gen_random_bytes(6), 'base64');
        code := regexp_replace(code, '[^a-zA-Z0-9]', '', 'g');
        code := upper(substring(code, 1, 8));
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM public.voting_sessions WHERE invite_code = code) THEN
            done := TRUE;
        END IF;
    END LOOP;
    
    RETURN code;
END;
$$ language 'plpgsql';

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.situationships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Users can view public profiles or their own profile
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (is_public = TRUE OR auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (handled by trigger)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- SITUATIONSHIPS POLICIES
-- Users can only see their own situationships
CREATE POLICY "Users can view own situationships" ON public.situationships
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only modify their own situationships
CREATE POLICY "Users can insert own situationships" ON public.situationships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own situationships" ON public.situationships
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own situationships" ON public.situationships
    FOR DELETE USING (auth.uid() = user_id);

-- VOTING SESSIONS POLICIES
-- Users can view active voting sessions they own or have access to
CREATE POLICY "Users can view accessible voting sessions" ON public.voting_sessions
    FOR SELECT USING (
        auth.uid() = owner_id OR 
        (is_active = TRUE AND expires_at > NOW())
    );

-- Users can only create their own voting sessions
CREATE POLICY "Users can create own voting sessions" ON public.voting_sessions
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Users can only update their own voting sessions
CREATE POLICY "Users can update own voting sessions" ON public.voting_sessions
    FOR UPDATE USING (auth.uid() = owner_id);

-- VOTES POLICIES
-- Users can view votes in sessions they own or participate in
CREATE POLICY "Users can view relevant votes" ON public.votes
    FOR SELECT USING (
        auth.uid() = voter_id OR
        auth.uid() IN (
            SELECT owner_id FROM public.voting_sessions 
            WHERE id = voting_session_id
        )
    );

-- Users can insert votes in active sessions
CREATE POLICY "Users can vote in active sessions" ON public.votes
    FOR INSERT WITH CHECK (
        (voter_id IS NULL OR auth.uid() = voter_id) AND
        EXISTS (
            SELECT 1 FROM public.voting_sessions 
            WHERE id = voting_session_id 
            AND is_active = TRUE 
            AND expires_at > NOW()
        )
    );

-- AI CONVERSATIONS POLICIES
-- Users can only access their own conversations
CREATE POLICY "Users can view own conversations" ON public.ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON public.ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- AI MESSAGES POLICIES
-- Users can only access messages in their own conversations
CREATE POLICY "Users can view own messages" ON public.ai_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own conversations" ON public.ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

-- BLOCKS POLICIES
-- Users can view blocks they created or that affect them
CREATE POLICY "Users can view relevant blocks" ON public.blocks
    FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

-- Users can create blocks
CREATE POLICY "Users can create blocks" ON public.blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can remove their own blocks
CREATE POLICY "Users can delete own blocks" ON public.blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- REPORTS POLICIES
-- Users can view reports they created
CREATE POLICY "Users can view own reports" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- Users can create reports
CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- DAILY USAGE POLICIES
-- Users can only view their own usage
CREATE POLICY "Users can view own usage" ON public.daily_usage
    FOR SELECT USING (auth.uid() = user_id);

-- System can update usage (handled by triggers/functions)
CREATE POLICY "System can manage usage" ON public.daily_usage
    FOR ALL USING (true);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Profiles indexes
CREATE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;

CREATE INDEX idx_profiles_is_public ON public.profiles(is_public);

-- Situationships indexes
CREATE INDEX idx_situationships_user_id ON public.situationships(user_id);

CREATE INDEX idx_situationships_user_rank ON public.situationships(user_id, rank);

CREATE INDEX idx_situationships_active ON public.situationships(user_id, is_active);

-- Voting sessions indexes
CREATE INDEX idx_voting_sessions_owner ON public.voting_sessions(owner_id);

CREATE INDEX idx_voting_sessions_invite_code ON public.voting_sessions(invite_code);

CREATE INDEX idx_voting_sessions_active ON public.voting_sessions(is_active, expires_at);

-- Votes indexes
CREATE INDEX idx_votes_session ON public.votes(voting_session_id);

CREATE INDEX idx_votes_situationship ON public.votes(situationship_id);

CREATE INDEX idx_votes_voter ON public.votes(voter_id);

-- AI conversations indexes
CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id);

CREATE INDEX idx_ai_conversations_situationship ON public.ai_conversations(situationship_id);

-- AI messages indexes
CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id);

CREATE INDEX idx_ai_messages_created_at ON public.ai_messages(created_at);

-- Blocks indexes
CREATE INDEX idx_blocks_blocker ON public.blocks(blocker_id);

CREATE INDEX idx_blocks_blocked ON public.blocks(blocked_id);

-- Reports indexes
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);

CREATE INDEX idx_reports_reported_user ON public.reports(reported_user_id);

CREATE INDEX idx_reports_status ON public.reports(status);

CREATE INDEX idx_reports_content ON public.reports(content_type, content_id);

-- Daily usage indexes
CREATE INDEX idx_daily_usage_user_date ON public.daily_usage(user_id, date);

-- ==============================================
-- INITIAL DATA
-- ==============================================

-- Insert some default data if needed
-- (This will be handled by the application)

COMMIT;
