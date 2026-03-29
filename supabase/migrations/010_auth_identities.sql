-- Migration: auth_identities and auth_login_events
-- Purpose: Normalize provider linkage for Apple, Meta/Facebook, Snapchat, TikTok, and email/passwordless.
-- Reference: docs/Auth_Model.md

-- ============================================================
-- auth_identities: provider linkage per user
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    provider_email text,
    provider_username text,
    provider_display_name text,
    provider_avatar_url text,
    provider_metadata jsonb DEFAULT '{}'::jsonb,
    linked_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    is_primary boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- One linkage per provider per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_user_provider
    ON public.auth_identities (user_id, provider);

-- Global uniqueness: one provider account maps to one HINTO user
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_uid
    ON public.auth_identities (provider, provider_user_id);

-- Lookup by provider email
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_email
    ON public.auth_identities (provider_email)
    WHERE provider_email IS NOT NULL;

-- ============================================================
-- auth_login_events: audit provider sign-ins and failures
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_login_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider text NOT NULL,
    event_type text NOT NULL,
    success boolean NOT NULL,
    ip_address inet,
    user_agent text,
    error_code text,
    error_detail text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_user_id
    ON public.auth_login_events (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_login_events_created_at
    ON public.auth_login_events (created_at);

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_login_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own identity links
CREATE POLICY auth_identities_select_own ON public.auth_identities
    FOR SELECT
    USING (user_id = auth.uid());

-- Only the API service role can insert/update/delete identity links
CREATE POLICY auth_identities_service_manage ON public.auth_identities
    FOR ALL
    USING (auth.role() = 'service_role');

-- Users can read their own login events
CREATE POLICY auth_login_events_select_own ON public.auth_login_events
    FOR SELECT
    USING (user_id = auth.uid());

-- Only the API service role can insert login events
CREATE POLICY auth_login_events_service_insert ON public.auth_login_events
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- updated_at trigger for auth_identities
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_identities_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auth_identities_updated_at
    BEFORE UPDATE ON public.auth_identities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_identities_updated_at();
