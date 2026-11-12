import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SongSourceModal } from "../song-source-modal";
import { SongService } from "@/lib/services/song-service";
import type { Genre } from "@/types";
import * as useAuthHook from "@/hooks/use-auth";

describe("SongSourceModal Empty Filters Filtering (Genres and Eras with songCount === 0)", () => {
  beforeEach(() => {
    vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
      user: null,
      profile: null,
      isLoading: false,
      isGuest: true,
      signInWithEmail: async () => ({ success: true }),
      signUpWithEmail: async () => ({ success: true }),
      signInWithGoogle: async () => ({ success: true }),
      signOut: async () => {},
      updateProfile: async () => ({ success: true }),
      refreshProfile: async () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    SongService.resetDbClient();
  });

  // =========================================================================
  // 1. SongService.getSongFilterOptions
  // =========================================================================
  describe("SongService.getSongFilterOptions", () => {
    it("only returns genres and eras with songCount > 0", async () => {
      const mockGenres = [
        { id: "g-rock", name_th: "ร็อค", name_en: "Rock", slug: "rock", icon: "🎸" },
        { id: "g-jazz", name_th: "แจ๊ส", name_en: "Jazz", slug: "jazz", icon: "🎷" },
        { id: "g-pop", name_th: "ป็อป", name_en: "Pop", slug: "pop", icon: "🎤" },
        { id: "g-90s", name_th: "ยุค 90s", name_en: "90s", slug: "90s", icon: "📼" },
      ];

      const mockSongs = [
        { artist: "Silly Fools", genre_id: "g-rock", era: "90s", release_year: 1998, album: "IQ 180" },
        { artist: "Loso", genre_id: "g-rock", era: "90s", release_year: 1999, album: "Rock & Roll" },
        { artist: "Palmy", genre_id: "g-pop", era: "2000s", release_year: 2001, album: "Stay" },
      ];

      const mockClient = {
        from: (table: string) => {
          if (table === "genres") {
            return {
              select: () => ({
                order: () => Promise.resolve({ data: mockGenres, error: null }),
              }),
            };
          }
          if (table === "songs") {
            return {
              select: (_cols: string, opts?: any) => {
                if (opts?.head) {
                  return Promise.resolve({ count: mockSongs.length, data: null, error: null });
                }
                return {
                  order: () => Promise.resolve({ data: mockSongs, error: null }),
                };
              },
            };
          }
          return {};
        },
      };

      SongService.setDbClient(mockClient);

      const options = await SongService.getSongFilterOptions();

      // Genres verification:
      // g-rock has 2 songs, g-pop has 1 song -> both should be present
      // g-jazz has 0 songs -> should be filtered out
      // g-90s is an era-like genre -> should be filtered out
      expect(options.genres.some((g) => g.id === "g-rock")).toBe(true);
      expect(options.genres.some((g) => g.id === "g-pop")).toBe(true);
      expect(options.genres.some((g) => g.id === "g-jazz")).toBe(false);
      expect(options.genres.some((g) => g.id === "g-90s")).toBe(false);
      expect(options.genres.every((g) => (g.songCount || 0) > 0)).toBe(true);

      const rockGenre = options.genres.find((g) => g.id === "g-rock");
      expect(rockGenre?.songCount).toBe(2);

      const popGenre = options.genres.find((g) => g.id === "g-pop");
      expect(popGenre?.songCount).toBe(1);

      // Eras verification:
      // 90s has 2 songs, 2000s has 1 song -> should be present
      // 2010s and 2020s have 0 songs -> should be filtered out
      expect(options.eras.some((e) => e.id === "90s")).toBe(true);
      expect(options.eras.some((e) => e.id === "2000s")).toBe(true);
      expect(options.eras.some((e) => e.id === "2010s")).toBe(false);
      expect(options.eras.some((e) => e.id === "2020s")).toBe(false);
      expect(options.eras.every((e) => (e.songCount || 0) > 0)).toBe(true);

      const era90s = options.eras.find((e) => e.id === "90s");
      expect(era90s?.songCount).toBe(2);

      const era2000s = options.eras.find((e) => e.id === "2000s");
      expect(era2000s?.songCount).toBe(1);
    });
  });

  // =========================================================================
  // 2. SongSourceModal Genre Filter Rendering
  // =========================================================================
  describe("SongSourceModal Genre Rendering", () => {
    it("renders only genres with songCount > 0 and hides genres with 0 songs", () => {
      const testGenres: Genre[] = [
        { id: "g-rock", nameTh: "ร็อค", nameEn: "Rock", slug: "rock", songCount: 5, icon: "🎸" },
        { id: "g-jazz", nameTh: "แจ๊ส", nameEn: "Jazz", slug: "jazz", songCount: 0, icon: "🎷" },
        { id: "g-pop", nameTh: "ป็อป", nameEn: "Pop", slug: "pop", songCount: 3, icon: "🎤" },
        { id: "g-hiphop", nameTh: "ฮิปฮอป", nameEn: "Hip-Hop", slug: "hiphop", songCount: undefined, icon: "🎧" },
      ];

      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          currentFilter: { type: "genre", genreId: "g-rock", genreName: "ร็อค" },
          genres: testGenres,
          onClose: () => {},
          onSelectFilter: () => {},
        })
      );

      // Visible genres with songCount > 0
      expect(html).toContain("ร็อค");
      expect(html).toMatch(/5(<!-- -->)?\s*เพลง/);
      expect(html).toContain("ป็อป");
      expect(html).toMatch(/3(<!-- -->)?\s*เพลง/);

      // Hidden genres with songCount === 0 or undefined
      expect(html).not.toContain("แจ๊ส");
      expect(html).not.toContain("ฮิปฮอป");
    });
  });

  // =========================================================================
  // 3. SongSourceModal Era Filter Rendering
  // =========================================================================
  describe("SongSourceModal Era Rendering", () => {
    it("renders only eras with songCount > 0 and hides eras with 0 songs", () => {
      const testEraCounts: Record<string, number> = {
        "90s": 12,
        "2000s": 0,
        "2010s": 7,
        "2020s": 0,
      };

      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          currentFilter: { type: "era", era: "90s" },
          eraCounts: testEraCounts,
          onClose: () => {},
          onSelectFilter: () => {},
        })
      );

      // Visible eras with songCount > 0
      expect(html).toContain("ยุค 90s");
      expect(html).toMatch(/12(<!-- -->)?\s*เพลง/);
      expect(html).toContain("ยุค 2010s");
      expect(html).toMatch(/7(<!-- -->)?\s*เพลง/);

      // Hidden eras with songCount === 0
      expect(html).not.toContain("ยุค 2000s");
      expect(html).not.toContain("ยุค 2020s");
    });
  });

  // =========================================================================
  // 4. SongSourceModal Empty States
  // =========================================================================
  describe("SongSourceModal Empty States", () => {
    it("renders empty state message when there are no genres with songs", () => {
      const emptyGenres: Genre[] = [
        { id: "g-rock", nameTh: "ร็อค", nameEn: "Rock", slug: "rock", songCount: 0 },
        { id: "g-jazz", nameTh: "แจ๊ส", nameEn: "Jazz", slug: "jazz", songCount: 0 },
      ];

      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          currentFilter: { type: "genre" },
          genres: emptyGenres,
          onClose: () => {},
          onSelectFilter: () => {},
        })
      );

      expect(html).toContain("ยังไม่มีแนวเพลงที่มีเพลงในฐานข้อมูลขณะนี้");
      expect(html).not.toContain("ร็อค");
      expect(html).not.toContain("แจ๊ส");
    });

    it("renders empty state message when there are no eras with songs", () => {
      const emptyEraCounts: Record<string, number> = {
        "90s": 0,
        "2000s": 0,
        "2010s": 0,
        "2020s": 0,
      };

      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          currentFilter: { type: "era" },
          eraCounts: emptyEraCounts,
          onClose: () => {},
          onSelectFilter: () => {},
        })
      );

      expect(html).toContain("ยังไม่มีเพลงในยุคสมัยใดในฐานข้อมูลขณะนี้");
      expect(html).not.toContain("ยุค 90s");
      expect(html).not.toContain("ยุค 2000s");
      expect(html).not.toContain("ยุค 2010s");
      expect(html).not.toContain("ยุค 2020s");
    });
  });
});
