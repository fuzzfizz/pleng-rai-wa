// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Song & Genre Service
// ==========================================

import { supabase, getServiceSupabase } from "@/lib/supabase";
import type { Song, Genre } from "@/types";
import type { SongRow, GenreRow, SongInsert } from "@/types/database";

let customClient: any = null;

export function setDbClient(client: any): void {
  customClient = client;
}

export function resetDbClient(): void {
  customClient = null;
}

/**
 * Resolves the appropriate Supabase client.
 * Uses service role client in server environment when SUPABASE_SERVICE_ROLE_KEY is present,
 * otherwise falls back to the public anon client.
 */
function getDbClient(): typeof supabase {
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
 * Maps a database genre row to the frontend Genre domain model.
 */
export function mapGenreFromRow(row: GenreRow, songCount?: number): Genre {
  return {
    id: row.id,
    nameTh: row.name_th,
    nameEn: row.name_en,
    slug: row.slug,
    icon: row.icon ?? undefined,
    songCount: songCount,
  };
}

/**
 * Maps a database song row (with joined genre row) to the frontend Song domain model.
 */
export function mapSongFromRow(row: SongRow & { genres?: GenreRow | null }): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    releaseYear: row.release_year ?? undefined,
    genreId: row.genre_id ?? undefined,
    genre: row.genres ? mapGenreFromRow(row.genres) : undefined,
    era: row.era ?? undefined,
    audioUrl: row.audio_url,
    hookStartSec: row.hook_start_sec ?? 0,
    hookEndSec: row.hook_end_sec ?? 0,
    durationSec: row.duration_sec ?? 0,
    lyricsIntro: row.lyrics_intro ?? undefined,
    lyricsChorus: row.lyrics_chorus ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  };
}

/**
 * Maps a Song domain model or partial object to a Supabase insert row.
 */
export function mapSongToRow(song: Partial<Song> & Record<string, unknown>): SongInsert {
  const title = (song.title ?? song.title) as string | undefined;
  const artist = (song.artist ?? song.artist) as string | undefined;
  const audioUrl = (song.audioUrl ?? song.audio_url) as string | undefined;

  if (!title || !artist || !audioUrl) {
    throw new Error("Missing required song fields: title, artist, audioUrl");
  }

  const insertData: SongInsert = {
    title,
    artist,
    audio_url: audioUrl,
  };

  if (song.id !== undefined) insertData.id = song.id;
  if (song.aliases !== undefined) insertData.aliases = song.aliases;
  
  if (song.releaseYear !== undefined) insertData.release_year = song.releaseYear;
  else if (song.release_year !== undefined) insertData.release_year = song.release_year as number;

  if (song.genreId !== undefined) insertData.genre_id = song.genreId;
  else if (song.genre_id !== undefined) insertData.genre_id = song.genre_id as string;

  if (song.era !== undefined) insertData.era = song.era;

  if (song.hookStartSec !== undefined) insertData.hook_start_sec = song.hookStartSec;
  else if (song.hook_start_sec !== undefined) insertData.hook_start_sec = song.hook_start_sec as number;

  if (song.hookEndSec !== undefined) insertData.hook_end_sec = song.hookEndSec;
  else if (song.hook_end_sec !== undefined) insertData.hook_end_sec = song.hook_end_sec as number;

  if (song.durationSec !== undefined) insertData.duration_sec = song.durationSec;
  else if (song.duration_sec !== undefined) insertData.duration_sec = song.duration_sec as number;

  if (song.lyricsIntro !== undefined) insertData.lyrics_intro = song.lyricsIntro;
  else if (song.lyrics_intro !== undefined) insertData.lyrics_intro = song.lyrics_intro as string;

  if (song.lyricsChorus !== undefined) insertData.lyrics_chorus = song.lyricsChorus;
  else if (song.lyrics_chorus !== undefined) insertData.lyrics_chorus = song.lyrics_chorus as string;

  if (song.metadata !== undefined) insertData.metadata = song.metadata as SongInsert["metadata"];

  return insertData;
}

export interface SongFilter {
  genreId?: string;
  limit?: number;
  era?: string;
  artist?: string;
  yearStart?: number;
  yearEnd?: number;
  searchQuery?: string;
}

/**
 * Fetches all available genres ordered by name.
 */
export async function getGenres(): Promise<Genre[]> {
  const client = getDbClient();
  const { data, error } = await client
    .from("genres")
    .select("id, name_th, name_en, slug, icon")
    .order("name_th", { ascending: true });

  if (error) {
    console.error("Error fetching genres:", error.message);
    throw error;
  }

  return (data || []).map((row) => mapGenreFromRow(row as GenreRow));
}

/**
 * Fetches songs with optional filtering by genre, era, search query, or limit.
 */
export async function getSongs(filter?: SongFilter): Promise<Song[]> {
  const client = getDbClient();
  let query = client
    .from("songs")
    .select("*, genres(id, name_th, name_en, slug, icon)")
    .order("created_at", { ascending: false });

  if (filter?.genreId) {
    query = query.eq("genre_id", filter.genreId);
  }

  if (filter?.era) {
    query = query.eq("era", filter.era);
  }

  if (filter?.artist) {
    query = query.ilike("artist", `%${filter.artist}%`);
  }

  if (filter?.yearStart !== undefined) {
    query = query.gte("release_year", filter.yearStart);
  }

  if (filter?.yearEnd !== undefined) {
    query = query.lte("release_year", filter.yearEnd);
  }

  if (filter?.searchQuery) {
    query = query.or(`title.ilike.%${filter.searchQuery}%,artist.ilike.%${filter.searchQuery}%`);
  }

  if (filter?.limit && filter.limit > 0) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching songs:", error.message);
    throw error;
  }

  return ((data as unknown as (SongRow & { genres: GenreRow | null })[]) || []).map((row) =>
    mapSongFromRow(row)
  );
}

/**
 * Fetches a single song by its UUID.
 */
export async function getSongById(id: string): Promise<Song | null> {
  const client = getDbClient();
  const { data, error } = await client
    .from("songs")
    .select("*, genres(id, name_th, name_en, slug, icon)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching song by id ${id}:`, error.message);
    throw error;
  }

  if (!data) return null;
  return mapSongFromRow(data as unknown as SongRow & { genres: GenreRow | null });
}

/**
 * Inserts a new song into the database and returns the created song with relations.
 */
export async function insertSong(song: Partial<Song>): Promise<Song> {
  const client = getDbClient();
  const insertData = mapSongToRow(song);

  const { data, error } = await client
    .from("songs")
    .insert(insertData)
    .select("*, genres(id, name_th, name_en, slug, icon)")
    .single();

  if (error) {
    console.error("Error inserting song:", error.message);
    throw error;
  }

  return mapSongFromRow(data as unknown as SongRow & { genres: GenreRow | null });
}

/**
 * Updates an existing song by UUID.
 */
export async function updateSong(id: string, song: Partial<Song>): Promise<Song> {
  const client = getDbClient();
  const updateData: Partial<SongInsert> = {};

  if (song.title !== undefined) updateData.title = song.title;
  if (song.artist !== undefined) updateData.artist = song.artist;
  if (song.aliases !== undefined) updateData.aliases = song.aliases;
  if (song.releaseYear !== undefined) updateData.release_year = song.releaseYear;
  if (song.genreId !== undefined) updateData.genre_id = song.genreId;
  if (song.era !== undefined) updateData.era = song.era;
  if (song.audioUrl !== undefined) updateData.audio_url = song.audioUrl;
  if (song.hookStartSec !== undefined) updateData.hook_start_sec = song.hookStartSec;
  if (song.hookEndSec !== undefined) updateData.hook_end_sec = song.hookEndSec;
  if (song.durationSec !== undefined) updateData.duration_sec = song.durationSec;
  if (song.lyricsIntro !== undefined) updateData.lyrics_intro = song.lyricsIntro;
  if (song.lyricsChorus !== undefined) updateData.lyrics_chorus = song.lyricsChorus;
  if (song.metadata !== undefined) updateData.metadata = song.metadata as SongInsert["metadata"];

  const { data, error } = await client
    .from("songs")
    .update(updateData)
    .eq("id", id)
    .select("*, genres(id, name_th, name_en, slug, icon)")
    .single();

  if (error) {
    console.error(`Error updating song ${id}:`, error.message);
    throw error;
  }

  return mapSongFromRow(data as unknown as SongRow & { genres: GenreRow | null });
}

/**
 * Deletes a song by its UUID.
 * Returns true if a song was deleted, false otherwise.
 */
export async function deleteSong(id: string): Promise<boolean> {
  const client = getDbClient();
  const { error, count } = await client
    .from("songs")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    console.error(`Error deleting song ${id}:`, error.message);
    throw error;
  }

  return count === null ? true : count > 0;
}

export interface GetRandomSongsOptions {
  genreId?: string;
  era?: string;
  artist?: string;
  yearStart?: number;
  yearEnd?: number;
  playlistId?: string | null;
  excludeIds?: string[];
  fallbackOnEmpty?: boolean;
}

export interface EraFilterOption {
  id: string;
  label: string;
  songCount?: number;
}

export interface SongFilterOptionsResponse {
  genres: Genre[];
  eras: EraFilterOption[];
  artists: string[];
  totalSongs: number;
}

/**
 * Fetches available filter options (genres, eras, distinct artists, and total songs).
 */
export async function getSongFilterOptions(): Promise<SongFilterOptionsResponse> {
  const client = getDbClient();

  const [genresRes, songsRes, countRes] = await Promise.all([
    getGenres().catch(() => []),
    client
      .from("songs")
      .select("artist, genre_id, era, release_year")
      .order("artist", { ascending: true }),
    client
      .from("songs")
      .select("*", { count: "exact", head: true }),
  ]);

  const songRows = (songsRes?.data as Array<{
    artist?: string | null;
    genre_id?: string | null;
    era?: string | null;
    release_year?: number | null;
  }>) || [];

  const rawArtists = songRows
    .map((r) => r.artist?.trim())
    .filter((a): a is string => Boolean(a && a.length > 0));

  const uniqueArtists = Array.from(new Set(rawArtists)).sort((a, b) =>
    a.localeCompare(b, "th")
  );

  // Map to identify era genres (e.g. legacy '90s' or '2000s' genres)
  const eraGenreIds: Record<string, string> = {};
  for (const g of genresRes) {
    if (g.slug === "90s") eraGenreIds[g.id] = "90s";
    if (g.slug === "2000s") eraGenreIds[g.id] = "2000s";
  }

  // Calculate song counts per genre and per era
  const genreCountMap: Record<string, number> = {};
  const eraCountMap: Record<string, number> = {
    "90s": 0,
    "2000s": 0,
    "2010s": 0,
    "2020s": 0,
  };

  for (const song of songRows) {
    if (song.genre_id) {
      genreCountMap[song.genre_id] = (genreCountMap[song.genre_id] || 0) + 1;
    }

    // Determine era
    let era = song.era?.trim();
    if (!era && song.genre_id && eraGenreIds[song.genre_id]) {
      era = eraGenreIds[song.genre_id];
    }
    if (!era && song.release_year) {
      if (song.release_year < 1990) era = "80s";
      else if (song.release_year < 2000) era = "90s";
      else if (song.release_year < 2010) era = "2000s";
      else if (song.release_year < 2020) era = "2010s";
      else era = "2020s";
    }

    if (era) {
      if (era.includes("90")) era = "90s";
      else if (era.includes("2000")) era = "2000s";
      else if (era.includes("2010")) era = "2010s";
      else if (era.includes("2020")) era = "2020s";

      if (era in eraCountMap) {
        eraCountMap[era] = (eraCountMap[era] || 0) + 1;
      }
    }
  }

  // Filter out any genres where slug === '90s' || slug === '2000s' or nameTh.includes('ยุค')
  const filteredGenres: Genre[] = genresRes
    .filter((g) => {
      if (g.slug === "90s" || g.slug === "2000s") return false;
      if (g.nameTh && g.nameTh.includes("ยุค")) return false;
      return true;
    })
    .map((g) => ({
      ...g,
      songCount: genreCountMap[g.id] || 0,
    }));

  const eras: EraFilterOption[] = [
    { id: "90s", label: "ยุค 90s (เทปคาสเซ็ท)", songCount: eraCountMap["90s"] || 0 },
    { id: "2000s", label: "ยุค 2000s (มิลเลนเนียม)", songCount: eraCountMap["2000s"] || 0 },
    { id: "2010s", label: "ยุค 2010s (สตรีมมิ่ง & อินดี้)", songCount: eraCountMap["2010s"] || 0 },
    { id: "2020s", label: "ยุค 2020s (ฮิตติดกระแส)", songCount: eraCountMap["2020s"] || 0 },
  ];

  return {
    genres: filteredGenres,
    eras,
    artists: uniqueArtists,
    totalSongs: countRes?.count ?? songRows.length,
  };
}

/**
 * Fetches a random selection of songs for game rounds.
 * Supports filtering by genre, era, artist, year range, or playlist, and exclusion of already played songs.
 */
export async function getRandomSongs(
  count: number,
  options?: GetRandomSongsOptions
): Promise<Song[]> {
  const client = getDbClient();

  if (options?.playlistId) {
    const { data, error } = await client
      .from("playlist_songs")
      .select("order_num, songs(*, genres(id, name_th, name_en, slug, icon))")
      .eq("playlist_id", options.playlistId)
      .order("order_num", { ascending: true });

    if (error) {
      console.error(
        `Error fetching songs for playlist ${options.playlistId}:`,
        error.message
      );
      throw error;
    }

    const playlistSongs = (
      (data as unknown as Array<{
        order_num: number;
        songs: (SongRow & { genres?: GenreRow | null }) | null;
      }>) || []
    )
      .filter((row) => row && row.songs)
      .map((row) => mapSongFromRow(row.songs!));

    // Fallback if no songs are in playlist
    if (playlistSongs.length === 0) {
      if (options.fallbackOnEmpty === false) {
        return [];
      }
      // Fall back to general song pool
      return getRandomSongs(count, {
        genreId: options.genreId,
        era: options.era,
        artist: options.artist,
        yearStart: options.yearStart,
        yearEnd: options.yearEnd,
        excludeIds: options.excludeIds,
      });
    }

    let availableSongs = playlistSongs;

    if (options.excludeIds && options.excludeIds.length > 0) {
      const excludeSet = new Set(options.excludeIds);
      const filtered = playlistSongs.filter((s) => !excludeSet.has(s.id));

      if (filtered.length === 0) {
        // If all songs are excluded, recycle all songs from the playlist
        availableSongs = [...playlistSongs];
      } else {
        availableSongs = filtered;
      }
    }

    // Shuffle with Fisher-Yates without mutating source array
    const shuffled = [...availableSongs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  let query = client
    .from("songs")
    .select("*, genres(id, name_th, name_en, slug, icon)");

  if (options?.genreId) {
    query = query.eq("genre_id", options.genreId);
  }

  if (options?.era) {
    query = query.eq("era", options.era);
  }

  if (options?.artist) {
    query = query.ilike("artist", `%${options.artist}%`);
  }

  if (options?.yearStart !== undefined) {
    query = query.gte("release_year", options.yearStart);
  }

  if (options?.yearEnd !== undefined) {
    query = query.lte("release_year", options.yearEnd);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching random songs:", error.message);
    throw error;
  }

  let songs = ((data as unknown as (SongRow & { genres: GenreRow | null })[]) || []).map((row) =>
    mapSongFromRow(row)
  );

  const hasFilters = Boolean(
    options?.genreId ||
    options?.era ||
    options?.artist ||
    options?.yearStart !== undefined ||
    options?.yearEnd !== undefined
  );

  // If filtered query returns 0 songs, gracefully fall back to full pool if fallbackOnEmpty !== false
  if (songs.length === 0 && hasFilters && options?.fallbackOnEmpty !== false) {
    return getRandomSongs(count, {
      excludeIds: options?.excludeIds,
      fallbackOnEmpty: false,
    });
  }

  if (options?.excludeIds && options.excludeIds.length > 0) {
    const excludeSet = new Set(options.excludeIds);
    const unplayed = songs.filter((s) => !excludeSet.has(s.id));

    if (unplayed.length === 0) {
      // If all songs matching the filter are excluded, recycle all songs
    } else {
      songs = unplayed;
    }
  }

  // Shuffle array using Fisher-Yates
  const shuffled = [...songs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

export class SongService {
  static getRandomSongs = getRandomSongs;
  static getSongs = getSongs;
  static getSongById = getSongById;
  static insertSong = insertSong;
  static updateSong = updateSong;
  static deleteSong = deleteSong;
  static getGenres = getGenres;
  static getSongFilterOptions = getSongFilterOptions;
  static setDbClient = setDbClient;
  static resetDbClient = resetDbClient;
}
