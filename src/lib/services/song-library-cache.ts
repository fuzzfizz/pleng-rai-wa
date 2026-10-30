// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Client Song Library Cache
// Loads songs from /api/songs with in-memory caching
// ==========================================

import type { Song } from "@/types";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";

const CACHE_KEY = "pleng_public_songs_cache_v1";

let inMemorySongsCache: Song[] | null = null;
let pendingFetchPromise: Promise<Song[]> | null = null;

export interface LoadPublicSongLibraryOptions {
  forceRefresh?: boolean;
}

export async function loadPublicSongLibrary(
  options?: LoadPublicSongLibraryOptions
): Promise<Song[]> {
  // 1. Return in-memory cache if available with at least 1 song, unless forceRefresh is true
  if (inMemorySongsCache && inMemorySongsCache.length > 0 && !options?.forceRefresh) {
    return inMemorySongsCache;
  }

  // If forceRefresh is requested, clear pending promise to ensure fresh fetch
  if (options?.forceRefresh) {
    pendingFetchPromise = null;
  }

  // 2. Safe cleanup of legacy sessionStorage cache
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(CACHE_KEY);
    } catch {}
  }

  // 3. De-duplicate concurrent fetch calls (unless forceRefresh is true)
  if (pendingFetchPromise && !options?.forceRefresh) {
    return pendingFetchPromise;
  }

  let currentPromise: Promise<Song[]> | null = null;
  const fetchPromise = (async () => {
    try {
      const res = await fetch("/api/songs?limit=500");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
          inMemorySongsCache = data.songs;
          return data.songs;
        }
      }
    } catch (err) {
      console.warn("[SongLibraryCache] Failed to load public songs from /api/songs:", err);
    } finally {
      if (pendingFetchPromise === currentPromise) {
        pendingFetchPromise = null;
      }
    }

    return inMemorySongsCache && inMemorySongsCache.length > 0
      ? inMemorySongsCache
      : DEMO_SONGS;
  })();

  currentPromise = fetchPromise;
  pendingFetchPromise = fetchPromise;
  return fetchPromise;
}

export function getCachedSongLibrary(): Song[] | null {
  return inMemorySongsCache;
}

export function invalidateSongLibraryCache(): void {
  inMemorySongsCache = null;
  pendingFetchPromise = null;
}

/**
 * Reset internal cache for unit testing
 */
export function _resetSongLibraryCacheForTesting(): void {
  invalidateSongLibraryCache();
}
