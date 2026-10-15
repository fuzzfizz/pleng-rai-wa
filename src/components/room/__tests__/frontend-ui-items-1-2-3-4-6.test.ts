import { describe, it, expect } from "vitest";
import { calculateSliceRemainingTime } from "../game-view";
import {
  formatRoundWinnerAnnouncement,
  getSortedRevealPlayers,
} from "../round-reveal-card";
import { getSongFilterLabel } from "@/components/common/song-source-modal";
import {
  prepareSettingsPayload,
  MAX_PLAYERS_OPTIONS,
} from "../host-settings-modal";
import {
  reduceRoomRealtimeEvent,
  createInitialRoomRealtimeState,
} from "@/hooks/use-room-realtime";
import type { Player, SongFilterConfig } from "@/types";

describe("Frontend UI/UX Items 1, 2, 3, 4, 6 Improvements", () => {
  // ---------------------------------------------------------------------------
  // Item 6: Live Audio Slice Countdown Display
  // ---------------------------------------------------------------------------
  describe("Item 6: Audio Slice Countdown Calculation", () => {
    it("calculates remaining seconds accurately during playback", () => {
      expect(calculateSliceRemainingTime(0, 2.0)).toBe(2.0);
      expect(calculateSliceRemainingTime(0.5, 2.0)).toBe(1.5);
      expect(calculateSliceRemainingTime(1.9, 2.0)).toBeCloseTo(0.1, 5);
      expect(calculateSliceRemainingTime(2.0, 2.0)).toBe(0);
    });

    it("clamps remaining time to 0 when audio position exceeds slice duration", () => {
      expect(calculateSliceRemainingTime(2.5, 2.0)).toBe(0);
      expect(calculateSliceRemainingTime(10, 5)).toBe(0);
    });

    it("handles zero, negative, or invalid durations gracefully", () => {
      expect(calculateSliceRemainingTime(1.0, 0)).toBe(0);
      expect(calculateSliceRemainingTime(1.0, -2.0)).toBe(0);
      expect(calculateSliceRemainingTime(1.0, NaN)).toBe(0);
    });

    it("handles negative or invalid currentTime by defaulting to zero", () => {
      expect(calculateSliceRemainingTime(-1.0, 2.0)).toBe(2.0);
      expect(calculateSliceRemainingTime(NaN, 5.0)).toBe(5.0);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 2: Multi-Winner Display in Round Reveal
  // ---------------------------------------------------------------------------
  describe("Item 2: Multi-Winner Display & Announcement Formatting", () => {
    it("formats announcement for multiple winners in wait_all mode", () => {
      const winners = [
        { playerId: "p1", displayName: "สมชาย", scoreDelta: 100 },
        { playerId: "p2", displayName: "สมหญิง", scoreDelta: 100 },
        { playerId: "p3", displayName: "แอนนา", scoreDelta: 80 },
      ];
      const announcement = formatRoundWinnerAnnouncement(null, winners);
      expect(announcement).toBe("🎉 ผู้ตอบถูกในรอบนี้ (3 คน)");
    });

    it("formats announcement for a single winner from winners array", () => {
      const winners = [{ playerId: "p1", displayName: "สมชาย", scoreDelta: 150 }];
      const announcement = formatRoundWinnerAnnouncement(null, winners);
      expect(announcement).toBe("🎉 สมชาย ตอบถูก! (+150 คะแนน)");
    });

    it("formats backward-compatible announcement for legacy winner object", () => {
      const legacyWinner = {
        playerId: "p1",
        displayName: "แอนนา",
        answerText: "เพลงรัก",
        scoreDelta: 200,
      };
      const announcement = formatRoundWinnerAnnouncement(legacyWinner);
      expect(announcement).toBe("🎉 แอนนา ตอบถูก! (+200 คะแนน)");
    });

    it("falls back to default +100 points when scoreDelta is missing or undefined", () => {
      const legacyWinner = {
        playerId: "p1",
        displayName: "ก้อง",
        answerText: "เพลง",
        scoreDelta: undefined as any,
      };
      const announcement = formatRoundWinnerAnnouncement(legacyWinner);
      expect(announcement).toBe("🎉 ก้อง ตอบถูก! (+100 คะแนน)");
    });

    it("returns skip/no-winner text when there are no winners", () => {
      expect(formatRoundWinnerAnnouncement(null, [])).toBe("🏳️ ข้ามข้อนี้ / ไม่มีใครได้คะแนนในรอบนี้");
      expect(formatRoundWinnerAnnouncement(null)).toBe("🏳️ ข้ามข้อนี้ / ไม่มีใครได้คะแนนในรอบนี้");
    });

    it("populates roundWinners in use-room-realtime reducer on round_reveal event", () => {
      const initialState = createInitialRoomRealtimeState("ROOM1");
      const multiWinners = [
        { playerId: "p1", displayName: "Player 1", scoreDelta: 100 },
        { playerId: "p2", displayName: "Player 2", scoreDelta: 90 },
      ];

      const state = reduceRoomRealtimeEvent(
        initialState,
        {
          type: "broadcast",
          event: "round_reveal",
          payload: {
            song: { id: "song1", title: "Test Song", artist: "Artist" },
            winnerPlayerId: "p1",
            winnerDisplayName: "Player 1",
            winners: multiWinners,
            scoreDelta: 100,
          },
        },
        { playSounds: false }
      );

      expect(state.roundWinners).toEqual(multiWinners);
    });

    it("creates fallback roundWinners array if broadcast payload does not contain winners array", () => {
      const initialState = createInitialRoomRealtimeState("ROOM1");

      const state = reduceRoomRealtimeEvent(
        initialState,
        {
          type: "broadcast",
          event: "round_reveal",
          payload: {
            song: { id: "song1", title: "Test Song", artist: "Artist" },
            winnerPlayerId: "p1",
            winnerDisplayName: "Single Champion",
            scoreDelta: 120,
          },
        },
        { playSounds: false }
      );

      expect(state.roundWinners).toEqual([
        { playerId: "p1", displayName: "Single Champion", scoreDelta: 120, answerText: "" },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 3: Round Reveal Leaderboard Standings
  // ---------------------------------------------------------------------------
  describe("Item 3: Round Reveal Leaderboard Player Sorting", () => {
    it("sorts players descending by score", () => {
      const mockPlayers: Player[] = [
        { id: "p1", displayName: "Alice", isHost: false, isReady: true, score: 300, sessionToken: "t1", lastSeenAt: "" },
        { id: "p2", displayName: "Bob", isHost: false, isReady: true, score: 750, sessionToken: "t2", lastSeenAt: "" },
        { id: "p3", displayName: "Charlie", isHost: true, isReady: true, score: 500, sessionToken: "t3", lastSeenAt: "" },
      ];

      const sorted = getSortedRevealPlayers(mockPlayers);
      expect(sorted.map((p) => p.displayName)).toEqual(["Bob", "Charlie", "Alice"]);
      expect(sorted.map((p) => p.score)).toEqual([750, 500, 300]);
    });

    it("handles players with zero or undefined scores gracefully", () => {
      const mockPlayers: Player[] = [
        { id: "p1", displayName: "Zero", isHost: false, isReady: true, score: 0, sessionToken: "t1", lastSeenAt: "" },
        { id: "p2", displayName: "Leader", isHost: true, isReady: true, score: 100, sessionToken: "t2", lastSeenAt: "" },
        { id: "p3", displayName: "Undefined", isHost: false, isReady: true, score: undefined as any, sessionToken: "t3", lastSeenAt: "" },
      ];

      const sorted = getSortedRevealPlayers(mockPlayers);
      expect(sorted[0].displayName).toBe("Leader");
      expect(sorted).toHaveLength(3);
    });

    it("returns empty array when players is empty or undefined", () => {
      expect(getSortedRevealPlayers([])).toEqual([]);
      expect(getSortedRevealPlayers(undefined as any)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 4: Song Source Modal UX Enhancement
  // ---------------------------------------------------------------------------
  describe("Item 4: Song Filter Labels & Multi-Era / Multi-Genre UX", () => {
    it("formats 'all' filter label correctly", () => {
      const filter: SongFilterConfig = { type: "all" };
      expect(getSongFilterLabel(filter)).toBe("🎲 สุ่มเพลงทั้งหมด");
      expect(getSongFilterLabel(undefined)).toBe("🎲 สุ่มเพลงทั้งหมด");
    });

    it("formats single and multi-genre filter labels", () => {
      const single: SongFilterConfig = { type: "genre", genreId: "pop", genreName: "ป็อป" };
      expect(getSongFilterLabel(single)).toBe("🎸 แนวเพลง: ป็อป");

      const multi: SongFilterConfig = {
        type: "genre",
        genreIds: ["pop", "rock", "indie"],
        genreNames: ["ป็อป", "ร็อค", "อินดี้"],
      };
      expect(getSongFilterLabel(multi)).toBe("🎸 แนวเพลง (3 หมวด): ป็อป, ร็อค, อินดี้");
    });

    it("formats single and multi-era filter labels", () => {
      const single: SongFilterConfig = { type: "era", era: "90s" };
      expect(getSongFilterLabel(single)).toContain("ยุค 90s");

      const multi: SongFilterConfig = {
        type: "era",
        eraIds: ["90s", "2000s"],
      };
      expect(getSongFilterLabel(multi)).toBe("📼 ยุคเพลง (2 ยุค): 90s, 2000s");
    });

    it("shows 'ทุกยุคสมัย' when all 4 era options are selected", () => {
      const allEras: SongFilterConfig = {
        type: "era",
        eraIds: ["90s", "2000s", "2010s", "2020s"],
      };
      expect(getSongFilterLabel(allEras)).toBe("📼 ยุคเพลง: ทุกยุคสมัย (4 ยุค)");
    });

    it("formats artist and playlist filter labels", () => {
      const artist: SongFilterConfig = { type: "artist", artist: "Tilly Birds" };
      expect(getSongFilterLabel(artist)).toBe("🎤 ศิลปิน: Tilly Birds");

      const playlist: SongFilterConfig = { type: "playlist", playlistId: "pl-123" };
      expect(getSongFilterLabel(playlist, "เพลงฮิต 2024")).toBe("🎶 เพลย์ลิสต์: เพลงฮิต 2024");
      expect(getSongFilterLabel(playlist)).toBe("🎶 ใช้เพลย์ลิสต์");
    });
  });

  // ---------------------------------------------------------------------------
  // Item 1 & Audio Slice Option: Host Settings Modal
  // ---------------------------------------------------------------------------
  describe("Item 1 & Audio Slice Option: Max Players & Slice Random Region Settings", () => {
    it("defines standard max players preset options", () => {
      expect(MAX_PLAYERS_OPTIONS.map((o) => o.value)).toEqual([4, 8, 12]);
      expect(MAX_PLAYERS_OPTIONS.find((o) => o.value === 8)?.label).toContain("แนะนำ");
    });

    it("preserves valid maxPlayers within range 2 to 20", () => {
      const p1 = prepareSettingsPayload({ maxPlayers: 4 });
      expect(p1.maxPlayers).toBe(4);

      const p2 = prepareSettingsPayload({ maxPlayers: 12 });
      expect(p2.maxPlayers).toBe(12);
    });

    it("normalizes invalid or out-of-range maxPlayers", () => {
      // Under minimum (2) -> defaults to 8
      expect(prepareSettingsPayload({ maxPlayers: 1 }).maxPlayers).toBe(8);
      expect(prepareSettingsPayload({ maxPlayers: 0 }).maxPlayers).toBe(8);
      expect(prepareSettingsPayload({ maxPlayers: -5 }).maxPlayers).toBe(8);
      expect(prepareSettingsPayload({ maxPlayers: NaN }).maxPlayers).toBe(8);

      // Above maximum (20) -> clamped to 20
      expect(prepareSettingsPayload({ maxPlayers: 50 }).maxPlayers).toBe(20);
    });

    it("preserves sliceRandomRegion when set to 'hook' or 'entire_song'", () => {
      const p1 = prepareSettingsPayload({ sliceRandomRegion: "hook" });
      expect(p1.sliceRandomRegion).toBe("hook");

      const p2 = prepareSettingsPayload({ sliceRandomRegion: "entire_song" });
      expect(p2.sliceRandomRegion).toBe("entire_song");
    });

    it("normalizes unknown sliceRandomRegion values to 'hook'", () => {
      const p1 = prepareSettingsPayload({ sliceRandomRegion: "intro" as any });
      expect(p1.sliceRandomRegion).toBe("hook");

      const p2 = prepareSettingsPayload({ sliceRandomRegion: "random_unknown" as any });
      expect(p2.sliceRandomRegion).toBe("hook");
    });
  });
});
