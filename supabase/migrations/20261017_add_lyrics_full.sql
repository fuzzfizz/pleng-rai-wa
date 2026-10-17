-- Add lyrics_full column to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics_full TEXT;
