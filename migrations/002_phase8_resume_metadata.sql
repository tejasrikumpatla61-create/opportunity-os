-- Migration: Phase 8 Resume Metadata
-- Safe, idempotent schema migration for OpportunityOS

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS resume_file_path text,
ADD COLUMN IF NOT EXISTS resume_file_name text,
ADD COLUMN IF NOT EXISTS resume_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS resume_text text;
