-- Migration: Create missing profiles table
-- This addresses the "relation public.profiles does not exist" error
-- The auth service expects this table structure based on lib/auth.ts

-- Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- Create indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON public.profiles(is_public);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create RLS policies
-- Users can view public profiles or their own profile
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (is_public = TRUE OR auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (handled by trigger)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to update updated_at timestamp (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at (if it doesn't exist)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration (create profile on auth user creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user registration (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT ALL ON public.profiles TO authenticated;

-- Allow anonymous users to read public profiles (for public features)
GRANT SELECT ON public.profiles TO anon;

-- Add comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users with app-specific data';

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up';

-- Fix foreign key references in existing tables to point to profiles table
-- Update situationships table to reference profiles instead of profiles (if it exists)
DO $$
BEGIN
    -- Check if situationships table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'situationships') THEN
        -- Drop existing foreign key constraint if it exists
        ALTER TABLE public.situationships DROP CONSTRAINT IF EXISTS situationships_user_id_fkey;
        
        -- Add new foreign key constraint pointing to profiles table
        ALTER TABLE public.situationships ADD CONSTRAINT situationships_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if ai_conversations table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_conversations') THEN
        -- Drop existing foreign key constraint if it exists
        ALTER TABLE public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey;
        
        -- Add new foreign key constraint pointing to profiles table
        ALTER TABLE public.ai_conversations ADD CONSTRAINT ai_conversations_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if voting_sessions table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'voting_sessions') THEN
        -- Drop existing foreign key constraint if it exists
        ALTER TABLE public.voting_sessions DROP CONSTRAINT IF EXISTS voting_sessions_owner_id_fkey;
        
        -- Add new foreign key constraint pointing to profiles table
        ALTER TABLE public.voting_sessions ADD CONSTRAINT voting_sessions_owner_id_fkey 
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if votes table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'votes') THEN
        -- Drop existing foreign key constraint if it exists
        ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_id_fkey;
        
        -- Add new foreign key constraint pointing to profiles table
        ALTER TABLE public.votes ADD CONSTRAINT votes_voter_id_fkey 
        FOREIGN KEY (voter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    
    -- Check if blocks table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'blocks') THEN
        -- Drop existing foreign key constraints if they exist
        ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_blocker_id_fkey;
        ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_blocked_id_fkey;
        
        -- Add new foreign key constraints pointing to profiles table
        ALTER TABLE public.blocks ADD CONSTRAINT blocks_blocker_id_fkey 
        FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        ALTER TABLE public.blocks ADD CONSTRAINT blocks_blocked_id_fkey 
        FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if reports table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reports') THEN
        -- Drop existing foreign key constraints if they exist
        ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
        ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey;
        
        -- Add new foreign key constraints pointing to profiles table
        ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_id_fkey 
        FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        ALTER TABLE public.reports ADD CONSTRAINT reports_reported_user_id_fkey 
        FOREIGN KEY (reported_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if daily_usage table exists and update foreign key
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_usage') THEN
        -- Drop existing foreign key constraint if it exists
        ALTER TABLE public.daily_usage DROP CONSTRAINT IF EXISTS daily_usage_user_id_fkey;
        
        -- Add new foreign key constraint pointing to profiles table
        ALTER TABLE public.daily_usage ADD CONSTRAINT daily_usage_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

COMMIT;
