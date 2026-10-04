-- =============================================================================
-- เพลงไรวะ (Pleng-Rai-Wa) - Initial Database Schema
-- Migration: 20261004_initial_schema.sql
-- =============================================================================

-- Enable pgcrypto for UUID generation if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Table: genres
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.genres (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_th TEXT NOT NULL,
    name_en TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT
);

-- -----------------------------------------------------------------------------
-- 2. Table: songs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    release_year INT,
    genre_id UUID REFERENCES public.genres(id) ON DELETE SET NULL,
    era TEXT,
    audio_url TEXT NOT NULL,
    hook_start_sec FLOAT DEFAULT 0,
    hook_end_sec FLOAT DEFAULT 0,
    duration_sec FLOAT DEFAULT 0,
    lyrics_intro TEXT,
    lyrics_chorus TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. Table: playlists
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. Table: playlist_songs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlist_songs (
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE,
    order_num INT DEFAULT 0,
    PRIMARY KEY (playlist_id, song_id)
);

-- -----------------------------------------------------------------------------
-- 5. Table: rooms
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    host_player_id TEXT NOT NULL,
    status TEXT DEFAULT 'lobby',
    settings JSONB DEFAULT '{}'::jsonb,
    current_song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
    played_song_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_songs_genre_id ON public.songs(genre_id);
CREATE INDEX IF NOT EXISTS idx_songs_title ON public.songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON public.songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_release_year ON public.songs(release_year);
CREATE INDEX IF NOT EXISTS idx_songs_era ON public.songs(era);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON public.playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON public.playlist_songs(song_id);

CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON public.rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- -----------------------------------------------------------------------------
-- Trigger: rooms.updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_rooms_updated_at ON public.rooms;
CREATE TRIGGER set_rooms_updated_at
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- 1. Genres policies
-- Allow public read access for all users
CREATE POLICY "Allow public read for genres" ON public.genres
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to genres" ON public.genres
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- 2. Songs policies
-- Allow public read access for all users
CREATE POLICY "Allow public read for songs" ON public.songs
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to songs" ON public.songs
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- 3. Playlists policies
-- Public can read public playlists
CREATE POLICY "Allow public read for public playlists" ON public.playlists
    FOR SELECT USING (is_public = true);

-- Users can view their own playlists
CREATE POLICY "Allow users to view own playlists" ON public.playlists
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can insert their own playlists
CREATE POLICY "Allow users to insert own playlists" ON public.playlists
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own playlists
CREATE POLICY "Allow users to update own playlists" ON public.playlists
    FOR UPDATE USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own playlists
CREATE POLICY "Allow users to delete own playlists" ON public.playlists
    FOR DELETE USING (auth.uid()::text = user_id);

-- Allow service role full access
CREATE POLICY "Allow service role full access to playlists" ON public.playlists
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- 4. Playlist Songs policies
-- Public can read playlist songs
CREATE POLICY "Allow public read for playlist songs" ON public.playlist_songs
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to playlist songs" ON public.playlist_songs
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- 5. Rooms policies (allow public read & participate for active games)
CREATE POLICY "Allow public read for rooms" ON public.rooms
    FOR SELECT USING (true);

CREATE POLICY "Allow public create rooms" ON public.rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update rooms" ON public.rooms
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to rooms" ON public.rooms
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- -----------------------------------------------------------------------------
-- Default Seed Genres for Thai Music
-- -----------------------------------------------------------------------------
INSERT INTO public.genres (name_th, name_en, slug, icon) VALUES
    ('ร็อค', 'Rock', 'rock', '🎸'),
    ('ป็อป', 'Pop', 'pop', '🎤'),
    ('ที-ป็อป', 'T-Pop', 't-pop', '✨'),
    ('อินดี้ / อัลเทอร์เนทีฟ', 'Indie / Alternative', 'indie-alt', '🎧'),
    ('ลูกทุ่ง / ลูกกรุง', 'Luk Thung / Luk Krung', 'lukthung', '🪗'),
    ('เพื่อชีวิต', 'Songs for Life (Phua Cheewit)', 'phua-cheewit', '🪕'),
    ('ยุค 90s', '90s Thai Hits', '90s', '📼'),
    ('ยุค 2000s', '2000s Thai Hits', '2000s', '💿')
ON CONFLICT (slug) DO UPDATE SET
    name_th = EXCLUDED.name_th,
    name_en = EXCLUDED.name_en,
    icon = EXCLUDED.icon;
