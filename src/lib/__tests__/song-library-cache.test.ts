import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadPublicSongLibrary,
  getCachedSongLibrary,
  _resetSongLibraryCacheForTesting,
} from "@/lib/services/song-library-cache";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("song-library-cache", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  let mockSessionStorage: MemoryStorage;

  const mockSongs = [
    { id: "1", title: "Song 1", artist: "Artist 1" },
    { id: "2", title: "Song 2", artist: "Artist 2" },
    { id: "3", title: "Song 3", artist: "Artist 3" },
    { id: "4", title: "Song 4", artist: "Artist 4" },
  ];

  beforeEach(() => {
    _resetSongLibraryCacheForTesting();
    mockSessionStorage = new MemoryStorage();
    (globalThis as any).window = {
      sessionStorage: mockSessionStorage,
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
    _resetSongLibraryCacheForTesting();
  });

  it("removes legacy cache from sessionStorage upon loading and does not write to sessionStorage", async () => {
    mockSessionStorage.setItem("pleng_public_songs_cache_v1", JSON.stringify(mockSongs));
    expect(mockSessionStorage.getItem("pleng_public_songs_cache_v1")).not.toBeNull();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, songs: mockSongs }),
    });
    globalThis.fetch = fetchMock as any;

    const songs = await loadPublicSongLibrary();

    // 1. Legacy sessionStorage should be removed
    expect(mockSessionStorage.getItem("pleng_public_songs_cache_v1")).toBeNull();
    // 2. Fetch should have been called
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 3. Songs returned should match mock
    expect(songs).toEqual(mockSongs);
    // 4. In-memory cache should be populated
    expect(getCachedSongLibrary()).toEqual(mockSongs);
    // 5. sessionStorage still must NOT have the item written back
    expect(mockSessionStorage.getItem("pleng_public_songs_cache_v1")).toBeNull();
  });

  it("uses in-memory cache on subsequent calls without fetching again", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, songs: mockSongs }),
    });
    globalThis.fetch = fetchMock as any;

    const first = await loadPublicSongLibrary();
    const second = await loadPublicSongLibrary();

    expect(first).toEqual(mockSongs);
    expect(second).toEqual(mockSongs);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedSongLibrary()).toEqual(mockSongs);
  });

  it("de-duplicates concurrent calls into a single fetch request", async () => {
    let resolveFetch: (val: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    globalThis.fetch = fetchMock as any;

    const call1 = loadPublicSongLibrary();
    const call2 = loadPublicSongLibrary();
    const call3 = loadPublicSongLibrary();

    resolveFetch!({
      ok: true,
      json: async () => ({ success: true, songs: mockSongs }),
    });

    const [res1, res2, res3] = await Promise.all([call1, call2, call3]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(mockSongs);
    expect(res2).toEqual(mockSongs);
    expect(res3).toEqual(mockSongs);
  });

  it("falls back to DEMO_SONGS if fetch fails and cache is empty", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    globalThis.fetch = fetchMock as any;

    const songs = await loadPublicSongLibrary();
    expect(songs).toEqual(DEMO_SONGS);
    expect(getCachedSongLibrary()).toBeNull();
  });

  it("handles environment without window gracefully (SSR)", async () => {
    delete (globalThis as any).window;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, songs: mockSongs }),
    });
    globalThis.fetch = fetchMock as any;

    const songs = await loadPublicSongLibrary();
    expect(songs).toEqual(mockSongs);
    expect(getCachedSongLibrary()).toEqual(mockSongs);
  });
});
