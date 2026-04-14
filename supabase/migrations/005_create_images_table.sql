-- Images table for situationship photos
-- Migration 005: Create images table and storage setup

-- ==============================================
-- IMAGES TABLE
-- ==============================================

-- Images table for storing situationship photos
CREATE TABLE public.images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    situationship_id UUID REFERENCES public.situationships(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL, -- Storage path in Supabase Storage
    file_name TEXT NOT NULL, -- Original filename
    file_size INTEGER NOT NULL, -- File size in bytes
    mime_type TEXT NOT NULL, -- e.g., 'image/jpeg', 'image/png'
    width INTEGER, -- Image width in pixels
    height INTEGER, -- Image height in pixels
    is_primary BOOLEAN DEFAULT FALSE, -- Primary image for the situationship
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Constraints
    CHECK (file_size > 0 AND file_size <= 10485760), -- Max 10MB
    CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp')),
    CHECK (width IS NULL OR width > 0),
    CHECK (height IS NULL OR height > 0)
);

-- ==============================================
-- INDEXES
-- ==============================================

CREATE INDEX idx_images_situationship_id ON public.images(situationship_id);

CREATE INDEX idx_images_user_id ON public.images(user_id);

CREATE INDEX idx_images_is_primary ON public.images(situationship_id, is_primary) WHERE is_primary = TRUE;

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Add trigger for updated_at
CREATE TRIGGER update_images_updated_at 
    BEFORE UPDATE ON public.images 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one primary image per situationship
CREATE OR REPLACE FUNCTION public.ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting an image as primary, unset all others for this situationship
    IF NEW.is_primary = TRUE THEN
        UPDATE public.images 
        SET is_primary = FALSE 
        WHERE situationship_id = NEW.situationship_id 
        AND id != NEW.id 
        AND is_primary = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to ensure only one primary image per situationship
CREATE TRIGGER ensure_single_primary_image
    BEFORE INSERT OR UPDATE ON public.images
    FOR EACH ROW 
    EXECUTE FUNCTION public.ensure_single_primary_image();

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on images table
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Users can only view images for their own situationships
CREATE POLICY "Users can view own situationship images" ON public.images
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.situationships 
            WHERE id = situationship_id AND user_id = auth.uid()
        )
    );

-- Users can only insert images for their own situationships
CREATE POLICY "Users can insert own situationship images" ON public.images
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.situationships 
            WHERE id = situationship_id AND user_id = auth.uid()
        )
    );

-- Users can only update their own images
CREATE POLICY "Users can update own images" ON public.images
    FOR UPDATE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.situationships 
            WHERE id = situationship_id AND user_id = auth.uid()
        )
    );

-- Users can only delete their own images
CREATE POLICY "Users can delete own images" ON public.images
    FOR DELETE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.situationships 
            WHERE id = situationship_id AND user_id = auth.uid()
        )
    );

-- ==============================================
-- STORAGE BUCKET SETUP
-- ==============================================

-- Create storage bucket for situationship images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'situationship-images',
    'situationship-images',
    false, -- Private bucket
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- STORAGE POLICIES
-- ==============================================

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload images to own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'situationship-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to view their own images
CREATE POLICY "Users can view own images" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'situationship-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to update their own images
CREATE POLICY "Users can update own images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'situationship-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'situationship-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

COMMIT;
