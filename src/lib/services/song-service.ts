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
    album: row.album ?? undefined,
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
    lyricsFull: row.lyrics_full ?? (row.metadata as any)?.lyricsFull ?? (row.metadata as any)?.lyrics_full ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  };
}

/**
 * Maps a Song domain model or partial object to a Supabase insert row.
 */
export function mapSongToRow(song: Partial<Song> | Record<string, any>): SongInsert {
  const s = song as any;
  const title = (s.title ?? s.title) as string | undefined;
  const artist = (s.artist ?? s.artist) as string | undefined;
  const audioUrl = (s.audioUrl ?? s.audio_url) as string | undefined;

  if (!title || !artist || !audioUrl) {
    throw new Error("Missing required song fields: title, artist, audioUrl");
  }

  const insertData: SongInsert = {
    title,
    artist,
    audio_url: audioUrl,
  };

  if (s.id !== undefined) insertData.id = s.id;
  if (s.album !== undefined) insertData.album = s.album;
  if (s.aliases !== undefined) insertData.aliases = s.aliases;
  
  if (s.releaseYear !== undefined) insertData.release_year = s.releaseYear;
  else if (s.release_year !== undefined) insertData.release_year = s.release_year as number;

  if (s.genreId !== undefined) insertData.genre_id = s.genreId;
  else if (s.genre_id !== undefined) insertData.genre_id = s.genre_id as string;

  if (s.era !== undefined) insertData.era = s.era;

  if (s.hookStartSec !== undefined) insertData.hook_start_sec = s.hookStartSec;
  else if (s.hook_start_sec !== undefined) insertData.hook_start_sec = s.hook_start_sec as number;

  if (s.hookEndSec !== undefined) insertData.hook_end_sec = s.hookEndSec;
  else if (s.hook_end_sec !== undefined) insertData.hook_end_sec = s.hook_end_sec as number;

  if (s.durationSec !== undefined) insertData.duration_sec = s.durationSec;
  else if (s.duration_sec !== undefined) insertData.duration_sec = s.duration_sec as number;

  if (s.lyricsIntro !== undefined) insertData.lyrics_intro = s.lyricsIntro;
  else if (s.lyrics_intro !== undefined) insertData.lyrics_intro = s.lyrics_intro as string;

  if (s.lyricsChorus !== undefined) insertData.lyrics_chorus = s.lyricsChorus;
  else if (s.lyrics_chorus !== undefined) insertData.lyrics_chorus = s.lyrics_chorus as string;

  if (s.lyricsFull !== undefined) insertData.lyrics_full = s.lyricsFull;
  else if (s.lyrics_full !== undefined) insertData.lyrics_full = s.lyrics_full as string;

  if (s.metadata !== undefined) {
    insertData.metadata = { ...((s.metadata as Record<string, unknown>) || {}) } as SongInsert["metadata"];
  }

  if (insertData.lyrics_full) {
    insertData.metadata = {
      ...((insertData.metadata as Record<string, unknown>) || {}),
      lyricsFull: insertData.lyrics_full,
    } as SongInsert["metadata"];
  }

  return insertData;
}

export interface SongFilter {
  genreId?: string;
  limit?: number;
  era?: string;
  artist?: string;
  artists?: string[];
  album?: string;
  albums?: string[];
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

  if (filter?.albums && filter.albums.length > 0) {
    query = query.in("album", filter.albums);
  } else if (filter?.album) {
    query = query.eq("album", filter.album);
  }

  if (filter?.artists && filter.artists.length > 0) {
    const orCondition = filter.artists.map((a) => `artist.ilike.%${a}%`).join(",");
    query = query.or(orCondition);
  } else if (filter?.artist) {
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
  if (song.album !== undefined) updateData.album = song.album;
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
  if (song.lyricsFull !== undefined) updateData.lyrics_full = song.lyricsFull;
  else if ((song as any).lyrics_full !== undefined) updateData.lyrics_full = (song as any).lyrics_full as string;

  if (song.metadata !== undefined) {
    updateData.metadata = { ...((song.metadata as Record<string, unknown>) || {}) } as SongInsert["metadata"];
  }

  if (updateData.lyrics_full) {
    updateData.metadata = {
      ...((updateData.metadata as Record<string, unknown>) || {}),
      lyricsFull: updateData.lyrics_full,
    } as SongInsert["metadata"];
  }

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
  genreIds?: string[];
  era?: string;
  eraIds?: string[];
  artist?: string;
  artists?: string[];
  album?: string;
  albums?: string[];
  yearStart?: number;
  yearEnd?: number;
  playlistId?: string | null;
  excludeIds?: string[];
  fallbackOnEmpty?: boolean;
  hasLyrics?: boolean;
}

export function songHasLyrics(s: any): boolean {
  return Boolean(
    s?.lyricsChorus?.trim() ||
    s?.lyricsIntro?.trim() ||
    s?.lyricsFull?.trim() ||
    s?.lyrics_chorus?.trim() ||
    s?.lyrics_intro?.trim() ||
    s?.lyrics_full?.trim()
  );
}

export interface AlbumFilterOption {
  name: string;
  artist?: string;
  songCount: number;
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
  albums?: AlbumFilterOption[];
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
      .select("artist, genre_id, era, release_year, album")
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
    album?: string | null;
  }>) || [];

  const rawArtists = songRows
    .map((r) => r.artist?.trim())
    .filter((a): a is string => Boolean(a && a.length > 0));

  const uniqueArtists = Array.from(new Set(rawArtists)).sort((a, b) =>
    a.localeCompare(b, "th")
  );

  const albumMap = new Map<string, { artist: string; count: number }>();
  for (const song of songRows) {
    const albumName = (song as any).album?.trim();
    if (albumName) {
      const existing = albumMap.get(albumName);
      if (existing) {
        existing.count += 1;
      } else {
        albumMap.set(albumName, {
          artist: song.artist?.trim() || "",
          count: 1,
        });
      }
    }
  }
  const uniqueAlbums: AlbumFilterOption[] = Array.from(albumMap.entries())
    .map(([name, val]) => ({
      name,
      artist: val.artist,
      songCount: val.count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

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
    albums: uniqueAlbums,
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

    let playlistSongs = (
      (data as unknown as Array<{
        order_num: number;
        songs: (SongRow & { genres?: GenreRow | null }) | null;
      }>) || []
    )
      .filter((row) => row && row.songs)
      .map((row) => mapSongFromRow(row.songs!));

    if (options?.hasLyrics) {
      playlistSongs = playlistSongs.filter(songHasLyrics);
    }

    // Fallback if no songs are in playlist
    if (playlistSongs.length === 0) {
      if (options.fallbackOnEmpty === false) {
        return [];
      }
      // Fall back to general song pool
      return getRandomSongs(count, {
        genreId: options.genreId,
        genreIds: options.genreIds,
        era: options.era,
        eraIds: options.eraIds,
        artist: options.artist,
        artists: options.artists,
        album: options.album,
        albums: options.albums,
        yearStart: options.yearStart,
        yearEnd: options.yearEnd,
        excludeIds: options.excludeIds,
        hasLyrics: options.hasLyrics,
      });
    }

    let availableSongs = playlistSongs;

    if (options.excludeIds && options.excludeIds.length > 0) {
      const excludeSet = new Set(options.excludeIds);
      const filtered = playlistSongs.filter((s) => !excludeSet.has(s.id));

      if (filtered.length === 0) {
        // When unplayed songs are exhausted, do not recycle during gameplay
        return [];
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

  if (options?.hasLyrics && typeof (query as any).or === "function") {
    query = query.or("lyrics_chorus.neq.'',lyrics_intro.neq.'',lyrics_full.neq.''");
  }

  if (options?.genreIds && options.genreIds.length > 0) {
    query = query.in("genre_id", options.genreIds);
  } else if (options?.genreId) {
    query = query.eq("genre_id", options.genreId);
  }

  if (options?.eraIds && options.eraIds.length > 0) {
    query = query.in("era", options.eraIds);
  } else if (options?.era) {
    query = query.eq("era", options.era);
  }

  if (options?.albums && options.albums.length > 0) {
    query = query.in("album", options.albums);
  } else if (options?.album) {
    query = query.eq("album", options.album);
  }

  if (options?.artists && options.artists.length > 0) {
    const orCondition = options.artists.map((a) => `artist.ilike.%${a}%`).join(",");
    query = query.or(orCondition);
  } else if (options?.artist) {
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

  if (options?.hasLyrics) {
    songs = songs.filter(songHasLyrics);
  }

  const hasFilters = Boolean(
    (options?.genreIds && options.genreIds.length > 0) ||
    options?.genreId ||
    (options?.eraIds && options.eraIds.length > 0) ||
    options?.era ||
    (options?.artists && options.artists.length > 0) ||
    options?.artist ||
    (options?.albums && options.albums.length > 0) ||
    Boolean(options?.album) ||
    options?.yearStart !== undefined ||
    options?.yearEnd !== undefined
  );

  // If filtered query returns 0 songs, gracefully fall back to full pool if fallbackOnEmpty !== false
  if (songs.length === 0 && hasFilters && options?.fallbackOnEmpty !== false) {
    return getRandomSongs(count, {
      excludeIds: options?.excludeIds,
      fallbackOnEmpty: false,
      hasLyrics: options?.hasLyrics,
    });
  }

  if (options?.excludeIds && options.excludeIds.length > 0) {
    const excludeSet = new Set(options.excludeIds);
    const unplayed = songs.filter((s) => !excludeSet.has(s.id));

    if (unplayed.length === 0) {
      // When unplayed songs are exhausted, do not recycle during gameplay
      return [];
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
