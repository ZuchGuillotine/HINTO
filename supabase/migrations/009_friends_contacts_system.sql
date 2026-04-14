-- Migration: Friends and Contacts System
-- Adds tables for user-to-user relationships and non-registered contacts
-- This enables the social features of the app for friend voting and connections

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- FRIENDSHIPS TABLE
-- ==============================================

-- Table for tracking user-to-user friendships/connections
CREATE TABLE public.friendships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    addressee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Prevent self-friending
    CHECK (requester_id != addressee_id),
    
    -- Prevent duplicate friendship requests between same users
    UNIQUE(requester_id, addressee_id)
);

-- ==============================================
-- CONTACTS TABLE
-- ==============================================

-- Table for storing non-registered contacts (friends who haven't signed up)
CREATE TABLE public.contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    email TEXT CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    phone TEXT,
    notes TEXT CHECK (char_length(notes) <= 500),
    
    -- Contact status
    is_invited BOOLEAN DEFAULT FALSE,
    invite_sent_at TIMESTAMP WITH TIME ZONE,
    invite_count INTEGER DEFAULT 0,
    
    -- Privacy settings
    can_view_situationships BOOLEAN DEFAULT TRUE,
    can_vote BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- At least email or phone must be provided
    CHECK (email IS NOT NULL OR phone IS NOT NULL),
    
    -- Prevent duplicate contacts per user
    UNIQUE(owner_id, email),
    UNIQUE(owner_id, phone)
);

-- ==============================================
-- FRIEND GROUPS TABLE (Optional Enhancement)
-- ==============================================

-- Table for organizing friends into groups (close friends, family, etc.)
CREATE TABLE public.friend_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
    description TEXT CHECK (char_length(description) <= 200),
    color TEXT DEFAULT '#3B82F6', -- Default blue color
    emoji TEXT,
    
    -- Group settings
    can_view_situationships BOOLEAN DEFAULT TRUE,
    can_vote BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Prevent duplicate group names per user
    UNIQUE(owner_id, name)
);

-- ==============================================
-- FRIEND GROUP MEMBERS TABLE
-- ==============================================

-- Junction table for friend group memberships
CREATE TABLE public.friend_group_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Either member_id or contact_id must be set, but not both
    CHECK (
        (member_id IS NOT NULL AND contact_id IS NULL) OR 
        (member_id IS NULL AND contact_id IS NOT NULL)
    ),
    
    -- Prevent duplicate memberships
    UNIQUE(group_id, member_id),
    UNIQUE(group_id, contact_id)
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Friendships indexes
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);

CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

CREATE INDEX idx_friendships_status ON public.friendships(status);

CREATE INDEX idx_friendships_requested_at ON public.friendships(requested_at);

-- Composite index for finding friendship between two users
CREATE INDEX idx_friendships_users ON public.friendships(requester_id, addressee_id);

CREATE INDEX idx_friendships_users_reverse ON public.friendships(addressee_id, requester_id);

-- Contacts indexes
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);

CREATE INDEX idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;

CREATE INDEX idx_contacts_phone ON public.contacts(phone) WHERE phone IS NOT NULL;

CREATE INDEX idx_contacts_invited ON public.contacts(is_invited);

-- Friend groups indexes
CREATE INDEX idx_friend_groups_owner ON public.friend_groups(owner_id);

CREATE INDEX idx_friend_groups_name ON public.friend_groups(owner_id, name);

-- Friend group members indexes
CREATE INDEX idx_friend_group_members_group ON public.friend_group_members(group_id);

CREATE INDEX idx_friend_group_members_member ON public.friend_group_members(member_id);

CREATE INDEX idx_friend_group_members_contact ON public.friend_group_members(contact_id);

-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on all new tables
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.friend_group_members ENABLE ROW LEVEL SECURITY;

-- FRIENDSHIPS POLICIES
-- Users can view friendships where they are involved
CREATE POLICY "Users can view own friendships" ON public.friendships
    FOR SELECT USING (
        auth.uid() = requester_id OR 
        auth.uid() = addressee_id
    );

-- Users can create friendship requests to others
CREATE POLICY "Users can create friendship requests" ON public.friendships
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Users can update friendships where they are the addressee (accept/reject)
CREATE POLICY "Users can respond to friendship requests" ON public.friendships
    FOR UPDATE USING (auth.uid() = addressee_id);

-- Users can delete friendships they initiated
CREATE POLICY "Users can delete own friendship requests" ON public.friendships
    FOR DELETE USING (auth.uid() = requester_id);

-- CONTACTS POLICIES
-- Users can only manage their own contacts
CREATE POLICY "Users can view own contacts" ON public.contacts
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own contacts" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own contacts" ON public.contacts
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (auth.uid() = owner_id);

-- FRIEND GROUPS POLICIES
-- Users can only manage their own friend groups
CREATE POLICY "Users can view own friend groups" ON public.friend_groups
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own friend groups" ON public.friend_groups
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own friend groups" ON public.friend_groups
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own friend groups" ON public.friend_groups
    FOR DELETE USING (auth.uid() = owner_id);

-- FRIEND GROUP MEMBERS POLICIES
-- Users can view members of their own groups
CREATE POLICY "Users can view own group members" ON public.friend_group_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.friend_groups 
            WHERE id = group_id AND owner_id = auth.uid()
        )
    );

-- Users can add members to their own groups
CREATE POLICY "Users can add members to own groups" ON public.friend_group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.friend_groups 
            WHERE id = group_id AND owner_id = auth.uid()
        )
    );

-- Users can remove members from their own groups
CREATE POLICY "Users can remove members from own groups" ON public.friend_group_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.friend_groups 
            WHERE id = group_id AND owner_id = auth.uid()
        )
    );

-- ==============================================
-- HELPFUL FUNCTIONS
-- ==============================================

-- Function to get mutual friends between two users
CREATE OR REPLACE FUNCTION get_mutual_friends(user1_id UUID, user2_id UUID)
RETURNS TABLE(friend_id UUID, friend_name TEXT, friend_username TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        p.id,
        p.name,
        p.username
    FROM public.profiles p
    WHERE p.id IN (
        -- Friends of user1
        SELECT CASE 
            WHEN f1.requester_id = user1_id THEN f1.addressee_id
            ELSE f1.requester_id
        END
        FROM public.friendships f1
        WHERE (f1.requester_id = user1_id OR f1.addressee_id = user1_id)
        AND f1.status = 'accepted'
        
        INTERSECT
        
        -- Friends of user2
        SELECT CASE 
            WHEN f2.requester_id = user2_id THEN f2.addressee_id
            ELSE f2.requester_id
        END
        FROM public.friendships f2
        WHERE (f2.requester_id = user2_id OR f2.addressee_id = user2_id)
        AND f2.status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if two users are friends
CREATE OR REPLACE FUNCTION are_friends(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.friendships
        WHERE ((requester_id = user1_id AND addressee_id = user2_id) OR
               (requester_id = user2_id AND addressee_id = user1_id))
        AND status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get friendship status between two users
CREATE OR REPLACE FUNCTION get_friendship_status(user1_id UUID, user2_id UUID)
RETURNS TEXT AS $$
DECLARE
    friendship_status TEXT;
BEGIN
    SELECT status INTO friendship_status
    FROM public.friendships
    WHERE (requester_id = user1_id AND addressee_id = user2_id) OR
          (requester_id = user2_id AND addressee_id = user1_id)
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN COALESCE(friendship_status, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ==============================================

-- Apply updated_at triggers to new tables
CREATE TRIGGER update_friendships_updated_at 
    BEFORE UPDATE ON public.friendships 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON public.contacts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friend_groups_updated_at 
    BEFORE UPDATE ON public.friend_groups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- FUNCTION TO UPDATE FRIENDSHIP TIMESTAMPS
-- ==============================================

-- Function to update responded_at when friendship status changes
CREATE OR REPLACE FUNCTION update_friendship_responded_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed from pending to something else, set responded_at
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
        NEW.responded_at = TIMEZONE('utc'::text, NOW());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update responded_at
CREATE TRIGGER update_friendship_responded_at_trigger
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_friendship_responded_at();

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE public.friendships IS 'User-to-user friendship relationships with request/accept flow';

COMMENT ON TABLE public.contacts IS 'Non-registered contacts for users to invite and organize';

COMMENT ON TABLE public.friend_groups IS 'User-created groups for organizing friends and contacts';

COMMENT ON TABLE public.friend_group_members IS 'Junction table for friend group memberships';

COMMENT ON FUNCTION get_mutual_friends(UUID, UUID) IS 'Returns mutual friends between two users';

COMMENT ON FUNCTION are_friends(UUID, UUID) IS 'Checks if two users are friends';

COMMENT ON FUNCTION get_friendship_status(UUID, UUID) IS 'Returns friendship status between two users';

COMMIT;
