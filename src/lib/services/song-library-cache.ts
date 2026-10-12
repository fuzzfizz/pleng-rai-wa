// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Client Song Library Cache
// Loads songs from /api/songs with memory & sessionStorage caching
// ==========================================

import type { Song } from "@/types";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";

const CACHE_KEY = "pleng_public_songs_cache_v1";

let inMemorySongsCache: Song[] | null = null;
let pendingFetchPromise: Promise<Song[]> | null = null;

export async function loadPublicSongLibrary(): Promise<Song[]> {
  // 1. Return in-memory cache if available with more than demo songs
  if (inMemorySongsCache && inMemorySongsCache.length > 3) {
    return inMemorySongsCache;
  }

  // 2. Check browser sessionStorage
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 3) {
          inMemorySongsCache = parsed;
          return parsed;
        }
      }
    } catch {}
  }

  // 3. De-duplicate concurrent fetch calls
  if (pendingFetchPromise) {
    return pendingFetchPromise;
  }

  pendingFetchPromise = (async () => {
    try {
      const res = await fetch("/api/songs?limit=500");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
          inMemorySongsCache = data.songs;
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(data.songs));
            } catch {}
          }
          return data.songs;
        }
      }
    } catch (err) {
      console.warn("[SongLibraryCache] Failed to load public songs from /api/songs:", err);
    } finally {
      pendingFetchPromise = null;
    }

    return inMemorySongsCache && inMemorySongsCache.length > 0
      ? inMemorySongsCache
      : DEMO_SONGS;
  })();

  return pendingFetchPromise;
}

export function getCachedSongLibrary(): Song[] | null {
  return inMemorySongsCache;
}
