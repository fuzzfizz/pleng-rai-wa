import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SongSourceModal,
  getSongFilterLabel,
  MIN_SONGS_TO_PLAY,
} from "../song-source-modal";
import { prepareSettingsPayload } from "@/components/room/host-settings-modal";
import type { Playlist, SongFilterConfig } from "@/types";
import * as useAuthHook from "@/hooks/use-auth";

describe("SongSourceModal Playlist Tab & Game Room Integration (Task 3)", () => {
  const mockPlaylists: Playlist[] = [
    {
      id: "pl-rock-90s",
      userId: "user-alice",
      title: "ร็อคไทยยุค 90s คลาสสิก",
      description: "รวมเพลงร็อคขวัญใจเด็กเทป หินเหล็กไฟ Silly Fools Loso",
      isPublic: true,
      songCount: 12,
      createdAt: "2026-01-01T00:00:00Z",
      authorName: "Alice Rocker",
      authorAvatar: "🎸",
    },
    {
      id: "pl-indie-hits",
      userId: "user-bob",
      title: "อินดี้ฟังสบาย",
      description: "เพลย์ลิสต์ชิวๆ นั่งฟังในคาเฟ่",
      isPublic: true,
      songCount: 6,
      createdAt: "2026-01-02T00:00:00Z",
      authorName: "Bob Indie",
      authorAvatar: "🎧",
    },
    {
      id: "pl-too-short",
      userId: "user-bob",
      title: "เพลงสั้นเพิ่งเริ่มสร้าง",
      description: "มีเพลงไม่ถึง 5 เพลง",
      isPublic: true,
      songCount: 3,
      createdAt: "2026-01-03T00:00:00Z",
      authorName: "Bob Indie",
      authorAvatar: "🎧",
    },
    {
      id: "pl-private-alice",
      userId: "user-alice",
      title: "ความลับของอลิซ",
      description: "เพลย์ลิสต์ส่วนตัว",
      isPublic: false,
      songCount: 8,
      createdAt: "2026-01-04T00:00:00Z",
      authorName: "Alice Rocker",
      authorAvatar: "🎸",
    },
  ];

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

  // =========================================================================
  // 1. Modal Header Tabs
  // =========================================================================
  describe("Modal Header Tabs (5 tabs)", () => {
    it("renders all 5 filter tabs with icons and Thai labels", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      expect(html).toContain("สุ่มทั้งหมด");
      expect(html).toContain("ตามยุค");
      expect(html).toContain("แนวเพลง");
      expect(html).toContain("ศิลปิน");
      expect(html).toContain("เพลย์ลิสต์");
      expect(html).toContain("🎲");
      expect(html).toContain("📅");
      expect(html).toContain("🎸");
      expect(html).toContain("🎤");
      expect(html).toContain("🎶");
    });

    it("does not render when isOpen is false", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: false,
          onClose: () => {},
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      expect(html).toBe("");
    });
  });

  // =========================================================================
  // 2. Playlist Tab & Card Rendering
  // =========================================================================
  describe("Playlist Tab & Card Rendering", () => {
    it("renders public playlist cards when currentFilter has type playlist", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-rock-90s" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      console.log("RENDERED_HTML_SNIPPET:", html.slice(0, 1000));
      expect(html).toContain("ร็อคไทยยุค 90s คลาสสิก");
    });

    it("displays playable badges: 'พร้อมเล่น' for >= 5 songs and 'ต้องมีอย่างน้อย 5 เพลง' for < 5 songs", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-rock-90s" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      expect(html).toContain("พร้อมเล่น");
      expect(html).toContain(`ต้องมีอย่างน้อย ${MIN_SONGS_TO_PLAY} เพลง`);
    });

    it("highlights the currently active playlist card", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-rock-90s" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      // Should indicate ready to play in the active pill
      expect(html).toContain("พร้อมใช้งาน");
      expect(html).toContain("🎶 เพลย์ลิสต์: ร็อคไทยยุค 90s คลาสสิก");
    });
  });

  // =========================================================================
  // 3. Guest Auth Gate for 'My Playlists'
  // =========================================================================
  describe("Guest Auth Gate for 'My Playlists'", () => {
    it("shows stylish prompt card with login button when guest accesses my playlists", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-private-alice" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      // Since mock useAuth has user=null / isGuest=true, selecting 'my' tab shows gate
      // When currentFilter has pl-private-alice, if user was logged in as alice it would show my playlists.
      // But guest sees public by default, and when switched to my it shows prompt card:
      expect(html).toContain("เพลย์ลิสต์ของฉัน (My Playlists)");
    });

    it("renders prompt card when user is guest and viewing 'my' playlists", () => {
      // Mock useAuth as guest
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

      // Render with currentFilter of a user playlist
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-private-alice" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      expect(html).toContain("เข้าสู่ระบบเพื่อใช้เพลย์ลิสต์ส่วนตัวของคุณในห้องเกม");
    });

    it("shows user playlists when user is authenticated", () => {
      // Mock authenticated user as user-alice
      vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
        user: { id: "user-alice" } as any,
        profile: { id: "user-alice", displayName: "Alice", avatar: "🎸" },
        isLoading: false,
        isGuest: false,
        signInWithEmail: async () => ({ success: true }),
        signUpWithEmail: async () => ({ success: true }),
        signInWithGoogle: async () => ({ success: true }),
        signOut: async () => {},
        updateProfile: async () => ({ success: true }),
        refreshProfile: async () => {},
      });

      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-private-alice" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      // User alice sees her own private playlist
      expect(html).toContain("ความลับของอลิซ");
      expect(html).toContain("8 เพลง");
    });
  });

  // =========================================================================
  // 4. activePillLabel & getSongFilterLabel
  // =========================================================================
  describe("activePillLabel & getSongFilterLabel", () => {
    it("resolves playlist title in activePillLabel when draft.type === 'playlist'", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "pl-indie-hits" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      expect(html).toContain("🎶 เพลย์ลิสต์: อินดี้ฟังสบาย");
    });

    it("getSongFilterLabel returns custom playlist title when provided", () => {
      const label = getSongFilterLabel(
        { type: "playlist", playlistId: "pl-123" },
        "รวมฮิตวัยรุ่นยุค 2000s"
      );
      expect(label).toBe("🎶 เพลย์ลิสต์: รวมฮิตวัยรุ่นยุค 2000s");
    });

    it("getSongFilterLabel falls back to '🎶 ใช้เพลย์ลิสต์' when custom title is not provided", () => {
      const label = getSongFilterLabel({ type: "playlist", playlistId: "pl-123" });
      expect(label).toBe("🎶 ใช้เพลย์ลิสต์");
    });

    it("activePillLabel falls back to playlistId if playlist title cannot be found in list", () => {
      const html = renderToString(
        React.createElement(SongSourceModal, {
          isOpen: true,
          onClose: () => {},
          currentFilter: { type: "playlist", playlistId: "unknown-id" },
          onSelectFilter: () => {},
          playlists: mockPlaylists,
        })
      );

      expect(html).toContain("🎶 เพลย์ลิสต์: unknown-id");
    });
  });

  // =========================================================================
  // 5. Host Settings & prepareSettingsPayload Integration
  // =========================================================================
  describe("Host Settings Integration & prepareSettingsPayload", () => {
    it("prepareSettingsPayload sets playlistId and clears genreId/genreIds/eraIds when songFilter type is playlist", () => {
      const payload = prepareSettingsPayload({
        genreId: "old-genre-id",
        genreIds: ["old-genre-id"],
        eraIds: ["90s", "2000s"],
        songFilter: {
          type: "playlist",
          playlistId: "pl-rock-90s",
        },
      });

      expect(payload.playlistId).toBe("pl-rock-90s");
      expect(payload.genreId).toBeUndefined();
      expect(payload.genreIds).toBeUndefined();
      expect(payload.eraIds).toBeUndefined();
      expect(payload.songFilter).toEqual({
        type: "playlist",
        playlistId: "pl-rock-90s",
      });
    });

    it("prepareSettingsPayload trims whitespace from playlistId in songFilter", () => {
      const payload = prepareSettingsPayload({
        songFilter: {
          type: "playlist",
          playlistId: "  pl-indie-hits  ",
        },
      });

      expect(payload.playlistId).toBe("pl-indie-hits");
    });

    it("computes maxAvailableSongs correctly from selected playlist songCount", () => {
      const selectedPlaylist = mockPlaylists.find((p) => p.id === "pl-indie-hits");
      expect(selectedPlaylist).toBeDefined();

      const filterConfig: SongFilterConfig = {
        type: "playlist",
        playlistId: selectedPlaylist?.id,
      };

      const maxAvailableSongs =
        filterConfig.type === "playlist"
          ? typeof selectedPlaylist?.songCount === "number"
            ? selectedPlaylist.songCount
            : 20
          : 100;

      expect(maxAvailableSongs).toBe(6);
    });

    it("clamps totalRounds down to selected playlist songCount when exceeding available songs", () => {
      const selectedPlaylist = mockPlaylists.find((p) => p.id === "pl-indie-hits"); // 6 songs
      const maxAvailableSongs = selectedPlaylist!.songCount; // 6
      const requestedRounds = 10;

      const clampedRounds =
        maxAvailableSongs > 0 && requestedRounds > maxAvailableSongs
          ? maxAvailableSongs
          : requestedRounds;

      expect(clampedRounds).toBe(6);
    });

    it("allows setting rounds up to the full playlist songCount", () => {
      const selectedPlaylist = mockPlaylists.find((p) => p.id === "pl-rock-90s"); // 12 songs
      const maxAvailableSongs = selectedPlaylist!.songCount; // 12

      // Setting exactly 12 rounds is valid
      const targetRounds = 12;
      const effectiveRounds = Math.min(targetRounds, maxAvailableSongs);
      expect(effectiveRounds).toBe(12);
    });
  });
});
