-- Migration: Fix Image Relationships
-- Resolves the foreign key relationship error in the API

-- ==============================================
-- STEP 1: ADD MISSING COLUMNS TO SITUATIONSHIPS
-- ==============================================

-- Add primary_image_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'situationships' 
        AND column_name = 'primary_image_id'
    ) THEN
        ALTER TABLE public.situationships 
        ADD COLUMN primary_image_id UUID;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'situationships' 
        AND column_name = 'image_count'
    ) THEN
        ALTER TABLE public.situationships 
        ADD COLUMN image_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'situationships' 
        AND column_name = 'has_images'
    ) THEN
        ALTER TABLE public.situationships 
        ADD COLUMN has_images BOOLEAN GENERATED ALWAYS AS (image_count > 0) STORED;
    END IF;
END $$;

-- ==============================================
-- STEP 2: CREATE VIEW FOR API COMPATIBILITY
-- ==============================================

-- Drop existing view first (can't change column names with CREATE OR REPLACE)
DROP VIEW IF EXISTS public.situationships_with_images CASCADE;

-- Create the view for situationships with images
-- Using the actual columns that exist in the images table
CREATE VIEW public.situationships_with_images AS
SELECT 
    s.*,
    i.public_url as primary_image_url,
    i.filename as primary_image_filename,
    i.width as primary_image_width,
    i.height as primary_image_height,
    i.mime_type as primary_image_mime_type,
    i.file_size as primary_image_size
FROM public.situationships s
LEFT JOIN public.images i ON s.primary_image_id = i.id;

-- ==============================================
-- STEP 3: ADD FOREIGN KEY CONSTRAINT (if not exists)
-- ==============================================

-- Add foreign key constraint to situationships if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'situationships' 
        AND constraint_name = 'fk_situationships_primary_image'
    ) THEN
        ALTER TABLE public.situationships 
        ADD CONSTRAINT fk_situationships_primary_image 
        FOREIGN KEY (primary_image_id) REFERENCES public.images(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==============================================
-- STEP 4: CREATE INDEXES (if not exist)
-- ==============================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_situationships_primary_image ON public.situationships(primary_image_id);

-- ==============================================
-- STEP 5: UPDATE IMAGE COUNTS
-- ==============================================

-- Update image counts for existing situationships
UPDATE public.situationships 
SET image_count = 0
WHERE image_count IS NULL;

-- ==============================================
-- SUCCESS MESSAGE
-- ==============================================

-- This will show a success message when the script completes
DO $$
BEGIN
    RAISE NOTICE 'Database relationships have been successfully fixed!';
    RAISE NOTICE 'The app should now be able to fetch situationships without errors.';
END $$;

COMMIT;
