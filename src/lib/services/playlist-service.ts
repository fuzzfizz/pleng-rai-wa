// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Playlist Service
// ==========================================

import { supabase, getServiceSupabase } from "@/lib/supabase";
import { mapSongFromRow } from "@/lib/services/song-service";
import type { Playlist, Song, UserProfile } from "@/types";
import type {
  PlaylistRow,
  PlaylistInsert,
  PlaylistUpdate,
  PlaylistSongInsert,
  ProfileRow,
  SongRow,
  GenreRow,
} from "@/types/database";

export interface CreatePlaylistInput {
  title: string;
  description?: string;
  isPublic?: boolean;
  songIds: string[];
}

export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
  isPublic?: boolean;
  songIds?: string[];
}

/**
 * Validates playlist title.
 * Must be between 1 and 60 characters after trimming.
 */
export function validatePlaylistTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw new Error("Playlist title must be between 1 and 60 characters");
  }
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw new Error("Playlist title must be between 1 and 60 characters");
  }
  return trimmed;
}

/**
 * Resolves the appropriate Supabase client.
 * Uses service role client in server environment when SUPABASE_SERVICE_ROLE_KEY is present,
 * otherwise falls back to the public anon client.
 */
let customClient: any = null;

export function setDbClient(client: any): void {
  customClient = client;
}

export function resetDbClient(): void {
  customClient = null;
}

export function getDbClient() {
  if (customClient) {
    return customClient;
  }
  if (typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return getServiceSupabase();
    } catch {
      return supabase;
    }
  }
  return supabase;
}

/**
 * Maps a database playlist row (with optional joined profile or extra metadata)
 * to the domain Playlist model.
 */
export function mapPlaylistFromRow(
  row: PlaylistRow & {
    profiles?: ProfileRow | null;
    userProfile?: UserProfile | null;
    authorName?: string;
    authorAvatar?: string;
    songCount?: number;
    song_count?: number;
    playlist_songs?: unknown[];
  },
  songCount?: number,
  profile?: ProfileRow | UserProfile | null
): Playlist {
  const prof = profile || row.userProfile || row.profiles;

  const authorName =
    (prof as UserProfile)?.displayName ||
    (prof as ProfileRow)?.display_name ||
    row.authorName ||
    undefined;

  const authorAvatar =
    prof?.avatar ||
    row.authorAvatar ||
    undefined;

  const userProfile: UserProfile | undefined = prof
    ? {
        id: (prof as UserProfile).id || (prof as ProfileRow).id,
        displayName:
          (prof as UserProfile).displayName ||
          (prof as ProfileRow).display_name ||
          "",
        avatar: prof.avatar || "🦊",
        createdAt: (prof as UserProfile).createdAt || (prof as ProfileRow).created_at,
        updatedAt: (prof as UserProfile).updatedAt || (prof as ProfileRow).updated_at,
      }
    : undefined;

  let computedSongCount = 0;
  if (typeof songCount === "number") {
    computedSongCount = songCount;
  } else if (typeof row.songCount === "number") {
    computedSongCount = row.songCount;
  } else if (typeof row.song_count === "number") {
    computedSongCount = row.song_count;
  } else if (Array.isArray(row.playlist_songs)) {
    computedSongCount = row.playlist_songs.length;
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    isPublic: row.is_public,
    songCount: computedSongCount,
    createdAt: row.created_at,
    updatedAt: (row as any).updated_at ?? undefined,
    authorName,
    authorAvatar,
    userProfile,
  };
}

export class PlaylistService {
  static setClient = setDbClient;
  static resetClient = resetDbClient;
  static getClient = getDbClient;

  /**
   * Retrieves all playlists created by a specific user, ordered newest first.
   */
  static async getUserPlaylists(userId: string): Promise<Playlist[]> {
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      throw new Error("User ID is required");
    }

    const cleanUserId = userId.trim();
    const client = this.getClient();

    const { data: playlists, error } = await client
      .from("playlists")
      .select("*")
      .eq("user_id", cleanUserId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user playlists: ${error.message}`);
    }

    if (!playlists || playlists.length === 0) {
      return [];
    }

    // Fetch author profile
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", cleanUserId)
      .maybeSingle();

    // Fetch song counts for these playlists
    const playlistIds = playlists.map((p: PlaylistRow) => p.id);
    const { data: playlistSongs, error: songsError } = await client
      .from("playlist_songs")
      .select("playlist_id")
      .in("playlist_id", playlistIds);

    if (songsError) {
      throw new Error(`Failed to fetch playlist songs count: ${songsError.message}`);
    }

    const countMap = new Map<string, number>();
    for (const item of playlistSongs || []) {
      countMap.set(item.playlist_id, (countMap.get(item.playlist_id) || 0) + 1);
    }

    return playlists.map((row: PlaylistRow) =>
      mapPlaylistFromRow(row, countMap.get(row.id) || 0, profile)
    );
  }

  /**
   * Retrieves public playlists with an optional limit, ordered newest first.
   */
  static async getPublicPlaylists(limit?: number): Promise<Playlist[]> {
    const client = this.getClient();

    let query = client
      .from("playlists")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (typeof limit === "number" && limit > 0) {
      query = query.limit(limit);
    }

    const { data: playlists, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch public playlists: ${error.message}`);
    }

    if (!playlists || playlists.length === 0) {
      return [];
    }

    // Fetch unique user profiles for author attribution
    const userIds = Array.from(new Set(playlists.map((p: PlaylistRow) => p.user_id)));
    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("*")
      .in("id", userIds);

    if (profilesError) {
      throw new Error(`Failed to fetch playlist authors: ${profilesError.message}`);
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const prof of profiles || []) {
      profileMap.set(prof.id, prof);
    }

    // Fetch song counts
    const playlistIds = playlists.map((p: PlaylistRow) => p.id);
    const { data: playlistSongs, error: songsError } = await client
      .from("playlist_songs")
      .select("playlist_id")
      .in("playlist_id", playlistIds);

    if (songsError) {
      throw new Error(`Failed to fetch playlist songs count: ${songsError.message}`);
    }

    const countMap = new Map<string, number>();
    for (const item of playlistSongs || []) {
      countMap.set(item.playlist_id, (countMap.get(item.playlist_id) || 0) + 1);
    }

    return playlists.map((row: PlaylistRow) =>
      mapPlaylistFromRow(row, countMap.get(row.id) || 0, profileMap.get(row.user_id) || null)
    );
  }

  /**
   * Retrieves a single playlist by ID along with its assigned songs in sequence order.
   */
  static async getPlaylistById(
    id: string
  ): Promise<{ playlist: Playlist; songs: Song[] } | null> {
    if (!id || typeof id !== "string" || !id.trim()) {
      return null;
    }

    const cleanId = id.trim();
    const client = this.getClient();

    const { data: playlistRow, error: playlistError } = await client
      .from("playlists")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (playlistError) {
      throw new Error(`Failed to fetch playlist by ID: ${playlistError.message}`);
    }

    if (!playlistRow) {
      return null;
    }

    // Fetch author profile
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", playlistRow.user_id)
      .maybeSingle();

    // Fetch playlist songs in order_num sequence
    const { data: songRows, error: songsError } = await client
      .from("playlist_songs")
      .select("order_num, songs(*, genres(id, name_th, name_en, slug, icon))")
      .eq("playlist_id", cleanId)
      .order("order_num", { ascending: true });

    if (songsError) {
      throw new Error(`Failed to fetch playlist songs: ${songsError.message}`);
    }

    const songs: Song[] = [];
    for (const item of (songRows || []) as Array<{
      order_num: number;
      songs: (SongRow & { genres?: GenreRow | null }) | null;
    }>) {
      if (item && item.songs) {
        songs.push(mapSongFromRow(item.songs));
      }
    }

    const playlist = mapPlaylistFromRow(playlistRow, songs.length, profile);

    return { playlist, songs };
  }

  /**
   * Creates a new playlist and inserts its song associations preserving input order.
   */
  static async createPlaylist(
    userId: string,
    input: CreatePlaylistInput
  ): Promise<Playlist> {
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      throw new Error("User ID is required");
    }

    const validatedTitle = validatePlaylistTitle(input?.title);
    const cleanUserId = userId.trim();
    const client = this.getClient();

    const insertData: PlaylistInsert = {
      user_id: cleanUserId,
      title: validatedTitle,
      description: input.description?.trim() || null,
      is_public: input.isPublic ?? true,
    };

    const { data: createdPlaylist, error: insertError } = await client
      .from("playlists")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create playlist: ${insertError.message}`);
    }

    const songIds = Array.isArray(input.songIds) ? input.songIds : [];
    // Deduplicate while preserving first occurrence order
    const uniqueSongIds = Array.from(new Set(songIds.filter(Boolean)));

    if (uniqueSongIds.length > 0) {
      const playlistSongs: PlaylistSongInsert[] = uniqueSongIds.map((songId, index) => ({
        playlist_id: createdPlaylist.id,
        song_id: songId,
        order_num: index + 1,
      }));

      const { error: songsError } = await client
        .from("playlist_songs")
        .insert(playlistSongs);

      if (songsError) {
        throw new Error(`Failed to add songs to playlist: ${songsError.message}`);
      }
    }

    // Fetch author profile
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", cleanUserId)
      .maybeSingle();

    return mapPlaylistFromRow(createdPlaylist, uniqueSongIds.length, profile);
  }

  /**
   * Updates an existing playlist and optionally replaces its song assignments.
   * Enforces owner authorization.
   */
  static async updatePlaylist(
    id: string,
    userId: string,
    input: UpdatePlaylistInput
  ): Promise<Playlist> {
    if (!id || typeof id !== "string" || !id.trim()) {
      throw new Error("Playlist ID is required");
    }

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      throw new Error("User ID is required");
    }

    if (input.title !== undefined) {
      validatePlaylistTitle(input.title);
    }

    const cleanId = id.trim();
    const cleanUserId = userId.trim();
    const client = this.getClient();

    // Check playlist existence and ownership
    const { data: existing, error: fetchError } = await client
      .from("playlists")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch playlist: ${fetchError.message}`);
    }

    if (!existing) {
      throw new Error("Playlist not found");
    }

    if (existing.user_id !== cleanUserId) {
      throw new Error("Unauthorized: you do not own this playlist");
    }

    const updateData: PlaylistUpdate = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description.trim() || null;
    if (input.isPublic !== undefined) updateData.is_public = input.isPublic;

    let updatedRow = existing;
    if (Object.keys(updateData).length > 0) {
      const { data, error: updateError } = await client
        .from("playlists")
        .update(updateData)
        .eq("id", cleanId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update playlist: ${updateError.message}`);
      }
      updatedRow = data;
    }

    let finalSongCount = 0;
    if (input.songIds !== undefined) {
      // Delete existing playlist songs
      const { error: deleteError } = await client
        .from("playlist_songs")
        .delete()
        .eq("playlist_id", cleanId);

      if (deleteError) {
        throw new Error(`Failed to remove old playlist songs: ${deleteError.message}`);
      }

      const uniqueSongIds = Array.from(new Set(input.songIds.filter(Boolean)));
      if (uniqueSongIds.length > 0) {
        const playlistSongs: PlaylistSongInsert[] = uniqueSongIds.map((songId, index) => ({
          playlist_id: cleanId,
          song_id: songId,
          order_num: index + 1,
        }));

        const { error: insertError } = await client
          .from("playlist_songs")
          .insert(playlistSongs);

        if (insertError) {
          throw new Error(`Failed to update playlist songs: ${insertError.message}`);
        }
      }
      finalSongCount = uniqueSongIds.length;
    } else {
      // Count existing songs in playlist
      const { count, error: countError } = await client
        .from("playlist_songs")
        .select("*", { count: "exact", head: true })
        .eq("playlist_id", cleanId);

      if (countError) {
        throw new Error(`Failed to count playlist songs: ${countError.message}`);
      }
      finalSongCount = count ?? 0;
    }

    // Fetch author profile
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", cleanUserId)
      .maybeSingle();

    return mapPlaylistFromRow(updatedRow, finalSongCount, profile);
  }

  /**
   * Deletes a playlist by ID. Enforces owner authorization.
   */
  static async deletePlaylist(id: string, userId: string): Promise<boolean> {
    if (!id || typeof id !== "string" || !id.trim()) {
      throw new Error("Playlist ID is required");
    }

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      throw new Error("User ID is required");
    }

    const cleanId = id.trim();
    const cleanUserId = userId.trim();
    const client = this.getClient();

    const { data: existing, error: fetchError } = await client
      .from("playlists")
      .select("id, user_id")
      .eq("id", cleanId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch playlist: ${fetchError.message}`);
    }

    if (!existing) {
      throw new Error("Playlist not found");
    }

    if (existing.user_id !== cleanUserId) {
      throw new Error("Unauthorized: you do not own this playlist");
    }

    const { error: deleteError } = await client
      .from("playlists")
      .delete()
      .eq("id", cleanId);

    if (deleteError) {
      throw new Error(`Failed to delete playlist: ${deleteError.message}`);
    }

    return true;
  }
}
