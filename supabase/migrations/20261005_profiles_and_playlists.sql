-- =============================================================================
-- เพลงไรวะ (Pleng-Rai-Wa) - Phase 5 Profiles & Custom Playlists Schema
-- Migration: 20261005_profiles_and_playlists.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table: profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🦊',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching / sorting profiles
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- -----------------------------------------------------------------------------
-- 2. Trigger: profiles.updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. Trigger Function: handle_new_user()
-- Automatically creates a public profile row when a new user signs up in auth.users
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            NULLIF(NEW.raw_user_meta_data->>'name', ''),
            NULLIF(split_part(NEW.email, '@', 1), ''),
            'นักฟังเพลง'
        ),
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'avatar', ''),
            '🦊'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) - profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access for profiles
DROP POLICY IF EXISTS "Allow public read for profiles" ON public.profiles;
CREATE POLICY "Allow public read for profiles" ON public.profiles
    FOR SELECT USING (true);

-- Allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
CREATE POLICY "Allow users to insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own profile
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow service role full access to profiles
DROP POLICY IF EXISTS "Allow service role full access to profiles" ON public.profiles;
CREATE POLICY "Allow service role full access to profiles" ON public.profiles
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- -----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) - playlists & playlist_songs
-- -----------------------------------------------------------------------------
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

-- Additional indexes on playlists
CREATE INDEX IF NOT EXISTS idx_playlists_is_public ON public.playlists(is_public);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON public.playlists(user_id);

-- Playlists Policies
DROP POLICY IF EXISTS "Allow public read for public playlists" ON public.playlists;
CREATE POLICY "Allow public read for public playlists" ON public.playlists
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Allow users to view own playlists" ON public.playlists;
CREATE POLICY "Allow users to view own playlists" ON public.playlists
    FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow users to insert own playlists" ON public.playlists;
CREATE POLICY "Allow users to insert own playlists" ON public.playlists
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow users to update own playlists" ON public.playlists;
CREATE POLICY "Allow users to update own playlists" ON public.playlists
    FOR UPDATE USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow users to delete own playlists" ON public.playlists;
CREATE POLICY "Allow users to delete own playlists" ON public.playlists
    FOR DELETE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Allow service role full access to playlists" ON public.playlists;
CREATE POLICY "Allow service role full access to playlists" ON public.playlists
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );

-- Playlist Songs Policies
DROP POLICY IF EXISTS "Allow public read for playlist songs" ON public.playlist_songs;
CREATE POLICY "Allow public read for playlist songs" ON public.playlist_songs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_songs.playlist_id
              AND (playlists.is_public = true OR playlists.user_id = auth.uid()::text)
        )
    );

DROP POLICY IF EXISTS "Allow users to insert playlist songs for own playlists" ON public.playlist_songs;
CREATE POLICY "Allow users to insert playlist songs for own playlists" ON public.playlist_songs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_songs.playlist_id
              AND playlists.user_id = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Allow users to update playlist songs for own playlists" ON public.playlist_songs;
CREATE POLICY "Allow users to update playlist songs for own playlists" ON public.playlist_songs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_songs.playlist_id
              AND playlists.user_id = auth.uid()::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_songs.playlist_id
              AND playlists.user_id = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Allow users to delete playlist songs for own playlists" ON public.playlist_songs;
CREATE POLICY "Allow users to delete playlist songs for own playlists" ON public.playlist_songs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_songs.playlist_id
              AND playlists.user_id = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Allow service role full access to playlist songs" ON public.playlist_songs;
CREATE POLICY "Allow service role full access to playlist songs" ON public.playlist_songs
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    )
    WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR
        current_user = 'service_role'
    );
