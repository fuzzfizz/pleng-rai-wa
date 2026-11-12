import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SongSourceModal,
  getSongFilterLabel,
} from "../song-source-modal";
import { prepareSettingsPayload } from "@/components/room/host-settings-modal";
import type { SongFilterConfig } from "@/types";
import * as useAuthHook from "@/hooks/use-auth";

describe("SongSourceModal Album Filter & Integration", () => {
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
  });

  describe("getSongFilterLabel for Album", () => {
    it("formats single album label correctly", () => {
      const filter: SongFilterConfig = {
        type: "album",
        album: "Save My Life",
      };
      expect(getSongFilterLabel(filter)).toBe("💿 อัลบั้ม: Save My Life");
    });

    it("formats multiple albums label correctly", () => {
      const filter: SongFilterConfig = {
        type: "album",
        albums: ["Save My Life", "คราม"],
      };
      expect(getSongFilterLabel(filter)).toBe("💿 อัลบั้ม (2 อัลบั้ม): Save My Life, คราม");
    });

    it("falls back gracefully when album is not specified", () => {
      const filter: SongFilterConfig = {
        type: "album",
      };
      expect(getSongFilterLabel(filter)).toBe("💿 อัลบั้ม: ไม่ระบุ");
    });
  });

  describe("Modal Tabs & Header", () => {
    it("renders all 6 tabs including the Album tab", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          onSelectFilter: () => {},
        })
      );

      expect(html).toContain("สุ่มทั้งหมด");
      expect(html).toContain("ตามยุค");
      expect(html).toContain("แนวเพลง");
      expect(html).toContain("ศิลปิน");
      expect(html).toContain("อัลบั้ม");
      expect(html).toContain("เพลย์ลิสต์");
      expect(html).toContain("💿");
    });

    it("displays album in active pill when currentFilter is album", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: {
            type: "album",
            album: "Save My Life",
            albums: ["Save My Life"],
          },
          onSelectFilter: () => {},
        })
      );

      expect(html).toContain("💿 อัลบั้ม: Save My Life");
    });
  });

  describe("HostSettingsModal prepareSettingsPayload with Album Filter", () => {
    it("preserves album filter configuration in room settings draft", () => {
      const result = prepareSettingsPayload({
        gameMode: "audio-slice",
        answerInputMode: "autocomplete",
        sliceDurationSec: 1.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
        songFilter: {
          type: "album",
          album: "Save My Life",
          albums: ["Save My Life"],
        },
      });

      expect(result.songFilter).toBeDefined();
      expect(result.songFilter?.type).toBe("album");
      expect(result.songFilter?.album).toBe("Save My Life");
      expect(result.songFilter?.albums).toEqual(["Save My Life"]);
    });
  });

  describe("SongService Album mapping and query filtering", () => {
    it("maps album from database row correctly", async () => {
      const { mapSongFromRow, mapSongToRow } = await import("@/lib/services/song-service");
      const mockRow: any = {
        id: "test-song-1",
        title: "ยาพิษ",
        artist: "Bodyslam",
        album: "Save My Life",
        aliases: [],
        release_year: 2007,
        audio_url: "https://example.com/audio.mp3",
        created_at: "2026-01-01T00:00:00Z",
        metadata: {},
      };

      const mapped = mapSongFromRow(mockRow);
      expect(mapped.album).toBe("Save My Life");

      const insertRow = mapSongToRow(mapped);
      expect(insertRow.album).toBe("Save My Life");
    });
  });
});

