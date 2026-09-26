-- Migration: Phase 6 Live Opportunities and Personalization
-- Safe, idempotent schema migration for OpportunityOS

-- 1. Add missing tracking and verification columns to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS source_name text,
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS source_type text,
ADD COLUMN IF NOT EXISTS discovered_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_verified_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

-- 2. Mark all existing seeded/demo opportunities as is_demo = true
UPDATE public.opportunities
SET is_demo = true,
    status = COALESCE(status, 'active'),
    source_name = COALESCE(source_name, 'OpportunityOS Seed'),
    last_verified_at = COALESCE(last_verified_at, created_at, now())
WHERE is_demo IS NULL OR is_demo = false;

-- 3. Add constraint / index for deduplication if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_source_external_id
ON public.opportunities (source_name, external_id)
WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_status_deadline
ON public.opportunities (status, deadline);

-- 4. Add feed tracking checkpoint column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_feed_checked_at timestamptz DEFAULT now();
