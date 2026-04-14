-- Migration: Image Storage System
-- Adds image metadata tables and image fields to existing tables
-- Enables photo uploads for situationships, profiles, and voting sessions

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- IMAGES TABLE (Replace old version from migration 005)
-- ==============================================

-- Drop the old images table from migration 005 to replace with improved version
DROP TABLE IF EXISTS public.images CASCADE;

-- Table for storing image metadata and references
CREATE TABLE public.images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- File information
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif')),
    
    -- Storage information
    storage_bucket TEXT NOT NULL DEFAULT 'images',
    storage_path TEXT NOT NULL,
    public_url TEXT,
    
    -- Image dimensions and metadata
    width INTEGER CHECK (width > 0),
    height INTEGER CHECK (height > 0),
    alt_text TEXT CHECK (char_length(alt_text) <= 200),
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Content moderation
    moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
    moderation_flags TEXT[],
    
    -- Usage tracking
    usage_type TEXT NOT NULL CHECK (usage_type IN ('profile_avatar', 'situationship_photo', 'voting_session_image', 'general')),
    usage_context JSONB, -- Additional context about where/how the image is used
    
    -- Image variants (thumbnails, optimized versions)
    variants JSONB, -- Store URLs/paths for different sizes: {thumbnail: "...", medium: "...", large: "..."}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure unique storage paths
    UNIQUE(storage_bucket, storage_path)
);

-- ==============================================
-- IMAGE ATTACHMENTS TABLE
-- ==============================================

-- Junction table for linking images to various entities
CREATE TABLE public.image_attachments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    image_id UUID REFERENCES public.images(id) ON DELETE CASCADE NOT NULL,
    
    -- Polymorphic attachment (can attach to different types of entities)
    entity_type TEXT NOT NULL CHECK (entity_type IN ('situationship', 'profile', 'voting_session', 'ai_conversation')),
    entity_id UUID NOT NULL,
    
    -- Attachment metadata
    attachment_order INTEGER DEFAULT 0, -- For ordering multiple images
    is_primary BOOLEAN DEFAULT FALSE, -- Primary image for the entity
    caption TEXT CHECK (char_length(caption) <= 300),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Prevent duplicate attachments
    UNIQUE(image_id, entity_type, entity_id)
);

-- ==============================================
-- ADD IMAGE FIELDS TO EXISTING TABLES
-- ==============================================

-- Add image fields to situationships table
ALTER TABLE public.situationships 
ADD COLUMN primary_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,
ADD COLUMN image_count INTEGER DEFAULT 0,
ADD COLUMN has_images BOOLEAN GENERATED ALWAYS AS (image_count > 0) STORED;

-- Add image fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN profile_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL;

-- Add image fields to voting sessions table
ALTER TABLE public.voting_sessions 
ADD COLUMN cover_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL;

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Images table indexes
CREATE INDEX idx_images_owner ON public.images(owner_id);

CREATE INDEX idx_images_usage_type ON public.images(usage_type);

CREATE INDEX idx_images_moderation_status ON public.images(moderation_status);

CREATE INDEX idx_images_processing_status ON public.images(processing_status);

CREATE INDEX idx_images_storage_bucket ON public.images(storage_bucket);

CREATE INDEX idx_images_mime_type ON public.images(mime_type);

CREATE INDEX idx_images_created_at ON public.images(created_at);

-- Partial index for pending moderation
CREATE INDEX idx_images_pending_moderation ON public.images(created_at) 
WHERE moderation_status = 'pending';

-- Image attachments indexes
CREATE INDEX idx_image_attachments_image ON public.image_attachments(image_id);

CREATE INDEX idx_image_attachments_entity ON public.image_attachments(entity_type, entity_id);

CREATE INDEX idx_image_attachments_primary ON public.image_attachments(entity_type, entity_id, is_primary) 
WHERE is_primary = TRUE;

CREATE INDEX idx_image_attachments_order ON public.image_attachments(entity_type, entity_id, attachment_order);

-- New foreign key indexes
CREATE INDEX idx_situationships_primary_image ON public.situationships(primary_image_id);

CREATE INDEX idx_profiles_profile_image ON public.profiles(profile_image_id);

CREATE INDEX idx_voting_sessions_cover_image ON public.voting_sessions(cover_image_id);

-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on new tables
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.image_attachments ENABLE ROW LEVEL SECURITY;

-- IMAGES POLICIES
-- Users can view their own images and images attached to public content they can see
CREATE POLICY "Users can view own images" ON public.images
    FOR SELECT USING (auth.uid() = owner_id);

-- Users can view images attached to situationships they can see
CREATE POLICY "Users can view attached images" ON public.images
    FOR SELECT USING (
        id IN (
            SELECT ia.image_id 
            FROM public.image_attachments ia
            JOIN public.situationships s ON ia.entity_id = s.id 
            WHERE ia.entity_type = 'situationship'
            AND (s.user_id = auth.uid() OR s.is_active = TRUE) -- Owner or public
        )
    );

-- Users can create their own images
CREATE POLICY "Users can create own images" ON public.images
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Users can update their own images
CREATE POLICY "Users can update own images" ON public.images
    FOR UPDATE USING (auth.uid() = owner_id);

-- Users can delete their own images
CREATE POLICY "Users can delete own images" ON public.images
    FOR DELETE USING (auth.uid() = owner_id);

-- IMAGE ATTACHMENTS POLICIES
-- Users can view attachments for content they can access
CREATE POLICY "Users can view relevant attachments" ON public.image_attachments
    FOR SELECT USING (
        -- Can view if they own the image
        image_id IN (SELECT id FROM public.images WHERE owner_id = auth.uid())
        OR
        -- Can view if attached to content they can access
        (entity_type = 'situationship' AND entity_id IN (
            SELECT id FROM public.situationships 
            WHERE user_id = auth.uid() OR is_active = TRUE
        ))
        OR
        (entity_type = 'profile' AND entity_id = auth.uid())
        OR
        (entity_type = 'voting_session' AND entity_id IN (
            SELECT id FROM public.voting_sessions 
            WHERE owner_id = auth.uid() OR (is_active = TRUE AND expires_at > NOW())
        ))
    );

-- Users can create attachments for their own images and content
CREATE POLICY "Users can create own attachments" ON public.image_attachments
    FOR INSERT WITH CHECK (
        -- Must own the image
        image_id IN (SELECT id FROM public.images WHERE owner_id = auth.uid())
        AND
        -- Must own or have access to the entity
        (
            (entity_type = 'situationship' AND entity_id IN (
                SELECT id FROM public.situationships WHERE user_id = auth.uid()
            ))
            OR
            (entity_type = 'profile' AND entity_id = auth.uid())
            OR
            (entity_type = 'voting_session' AND entity_id IN (
                SELECT id FROM public.voting_sessions WHERE owner_id = auth.uid()
            ))
        )
    );

-- Users can update attachments for their own content
CREATE POLICY "Users can update own attachments" ON public.image_attachments
    FOR UPDATE USING (
        image_id IN (SELECT id FROM public.images WHERE owner_id = auth.uid())
    );

-- Users can delete attachments for their own content
CREATE POLICY "Users can delete own attachments" ON public.image_attachments
    FOR DELETE USING (
        image_id IN (SELECT id FROM public.images WHERE owner_id = auth.uid())
    );

-- ==============================================
-- FUNCTIONS FOR IMAGE MANAGEMENT
-- ==============================================

-- Function to update image count for situationships
CREATE OR REPLACE FUNCTION update_situationship_image_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update image count for the affected situationship
    IF TG_OP = 'INSERT' AND NEW.entity_type = 'situationship' THEN
        UPDATE public.situationships 
        SET image_count = (
            SELECT COUNT(*) 
            FROM public.image_attachments 
            WHERE entity_type = 'situationship' AND entity_id = NEW.entity_id
        )
        WHERE id = NEW.entity_id;
        
        -- Set as primary image if it's the first one and marked as primary
        IF NEW.is_primary THEN
            UPDATE public.situationships 
            SET primary_image_id = NEW.image_id 
            WHERE id = NEW.entity_id;
        END IF;
        
    ELSIF TG_OP = 'DELETE' AND OLD.entity_type = 'situationship' THEN
        UPDATE public.situationships 
        SET image_count = (
            SELECT COUNT(*) 
            FROM public.image_attachments 
            WHERE entity_type = 'situationship' AND entity_id = OLD.entity_id
        )
        WHERE id = OLD.entity_id;
        
        -- Clear primary image if this was the primary
        IF OLD.is_primary THEN
            UPDATE public.situationships 
            SET primary_image_id = (
                SELECT ia.image_id 
                FROM public.image_attachments ia
                WHERE ia.entity_type = 'situationship' 
                AND ia.entity_id = OLD.entity_id 
                ORDER BY ia.attachment_order, ia.created_at 
                LIMIT 1
            )
            WHERE id = OLD.entity_id;
        END IF;
        
    ELSIF TG_OP = 'UPDATE' AND NEW.entity_type = 'situationship' THEN
        -- Handle primary image changes
        IF NEW.is_primary AND NOT OLD.is_primary THEN
            -- Unset other primary images for this entity
            UPDATE public.image_attachments 
            SET is_primary = FALSE 
            WHERE entity_type = 'situationship' 
            AND entity_id = NEW.entity_id 
            AND id != NEW.id;
            
            -- Set this image as primary
            UPDATE public.situationships 
            SET primary_image_id = NEW.image_id 
            WHERE id = NEW.entity_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update image counts
CREATE TRIGGER update_situationship_image_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.image_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_situationship_image_count();

-- Function to ensure only one primary image per entity
CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting an image as primary, unset others for the same entity
    IF NEW.is_primary THEN
        UPDATE public.image_attachments 
        SET is_primary = FALSE 
        WHERE entity_type = NEW.entity_type 
        AND entity_id = NEW.entity_id 
        AND id != NEW.id 
        AND is_primary = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure single primary image
CREATE TRIGGER ensure_single_primary_image_trigger
    BEFORE INSERT OR UPDATE ON public.image_attachments
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_image();

-- Function to clean up orphaned images
CREATE OR REPLACE FUNCTION cleanup_orphaned_images()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete images that have no attachments and are older than 24 hours
    DELETE FROM public.images 
    WHERE id NOT IN (
        SELECT DISTINCT image_id 
        FROM public.image_attachments 
        WHERE image_id IS NOT NULL
    )
    AND id NOT IN (
        SELECT primary_image_id 
        FROM public.situationships 
        WHERE primary_image_id IS NOT NULL
        UNION
        SELECT profile_image_id 
        FROM public.profiles 
        WHERE profile_image_id IS NOT NULL
        UNION
        SELECT cover_image_id 
        FROM public.voting_sessions 
        WHERE cover_image_id IS NOT NULL
    )
    AND created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get image variants for display
CREATE OR REPLACE FUNCTION get_image_url(image_id UUID, variant TEXT DEFAULT 'original')
RETURNS TEXT AS $$
DECLARE
    image_record RECORD;
    variant_url TEXT;
BEGIN
    SELECT * INTO image_record FROM public.images WHERE id = image_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- If requesting original or no variants exist, return public_url
    IF variant = 'original' OR image_record.variants IS NULL THEN
        RETURN image_record.public_url;
    END IF;
    
    -- Try to get the requested variant
    variant_url := image_record.variants ->> variant;
    
    -- Fall back to original if variant doesn't exist
    RETURN COALESCE(variant_url, image_record.public_url);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ==============================================

-- Apply updated_at trigger to images table
CREATE TRIGGER update_images_updated_at 
    BEFORE UPDATE ON public.images 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- VIEWS FOR COMMON QUERIES
-- ==============================================

-- View for situationships with their primary images
CREATE VIEW public.situationships_with_images AS
SELECT 
    s.*,
    i.id as image_id,
    i.public_url as primary_image_url,
    i.alt_text as primary_image_alt,
    i.width as primary_image_width,
    i.height as primary_image_height,
    i.variants as primary_image_variants
FROM public.situationships s
LEFT JOIN public.images i ON s.primary_image_id = i.id;

-- ==============================================
-- INITIAL CONSTRAINTS AND VALIDATIONS
-- ==============================================

-- Ensure image file sizes are reasonable (max 10MB)
ALTER TABLE public.images ADD CONSTRAINT chk_image_file_size 
CHECK (file_size <= 10485760);

-- 10MB in bytes

-- Ensure image dimensions are reasonable
ALTER TABLE public.images ADD CONSTRAINT chk_image_dimensions 
CHECK (
    (width IS NULL AND height IS NULL) OR 
    (width >= 1 AND width <= 10000 AND height >= 1 AND height <= 10000)
);

-- Ensure attachment order is non-negative
ALTER TABLE public.image_attachments ADD CONSTRAINT chk_attachment_order 
CHECK (attachment_order >= 0);

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE public.images IS 'Image metadata and storage information for all uploaded images';

COMMENT ON TABLE public.image_attachments IS 'Junction table linking images to various entities (situationships, profiles, etc.)';

COMMENT ON FUNCTION update_situationship_image_count() IS 'Updates image count and primary image for situationships when attachments change';

COMMENT ON FUNCTION ensure_single_primary_image() IS 'Ensures only one primary image exists per entity';

COMMENT ON FUNCTION cleanup_orphaned_images() IS 'Removes orphaned images that are no longer attached to any entity';

COMMENT ON FUNCTION get_image_url(UUID, TEXT) IS 'Returns the appropriate image URL for a given variant';

COMMIT;
