-- Migration: Add allow_outsiders column to fest table
-- This enables fests to allow non-Christ University members to register

ALTER TABLE public.fest
ADD COLUMN IF NOT EXISTS allow_outsiders boolean DEFAULT false;

COMMENT ON COLUMN public.fest.allow_outsiders IS 'Whether this fest allows outsider (non-Christ University) registrations. When true, events under this fest inherit outsider access without individual CSO approval.';
