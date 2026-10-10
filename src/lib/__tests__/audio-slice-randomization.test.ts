import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateSliceStart, type SongHookMetadata } from "@/lib/audio-slice-utils";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as nextRoundHandler } from "@/app/api/room/[code]/next-round/route";
import type { Song } from "@/types";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn(),
    updateRoomRound: vi.fn().mockResolvedValue({}),
    updateRoomRoundState: vi.fn().mockResolvedValue({}),
  },
  DEFAULT_ROOM_SETTINGS: {
    gameMode: "audio-slice",
    answerInputMode: "free-text",
    lyricsType: "chorus",
    voiceGender: "female",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
  },
}));

vi.mock("@/lib/services/song-service", () => ({
  SongService: {
    getRandomSongs: vi.fn(),
  },
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

describe("Audio Slice Randomization Utils", () => {
  describe("calculateSliceStart()", () => {
    it("handles standard song with defined hookStartSec, hookEndSec, and duration", () => {
      const song: SongHookMetadata = {
        hookStartSec: 60,
        hookEndSec: 85,
        duration: 180,
      };

      // With randomFn = 0 (minimum bound)
      const minVal = calculateSliceStart(song, 2.0, () => 0);
      expect(minVal).toBe(60.0);

      // With randomFn = 1 (maximum bound = hookEndSec - durationSec = 85 - 2 = 83)
      const maxVal = calculateSliceStart(song, 2.0, () => 1);
      expect(maxVal).toBe(83.0);

      // With randomFn = 0.5 (middle point = 60 + 0.5 * 23 = 71.5)
      const midVal = calculateSliceStart(song, 2.0, () => 0.5);
      expect(midVal).toBe(71.5);
    });

    it("falls back to default 20-second chorus span when hookEndSec is missing or null", () => {
      const song: SongHookMetadata = {
        hookStartSec: 50,
        hookEndSec: null,
        duration: 200,
      };

      // Chorus estimated end = 50 + 20 = 70. Max start = 70 - 2 = 68.
      const minVal = calculateSliceStart(song, 2.0, () => 0);
      expect(minVal).toBe(50.0);

      const maxVal = calculateSliceStart(song, 2.0, () => 1);
      expect(maxVal).toBe(68.0);
    });

    it("supports durationSec property on Song metadata", () => {
      const song: SongHookMetadata = {
        hookStartSec: 40,
        hookEndSec: 70,
        durationSec: 150,
      };

      const maxVal = calculateSliceStart(song, 3.0, () => 1);
      // 70 - 3 = 67
      expect(maxVal).toBe(67.0);
    });

    it("clamps maxStart to song total duration when chorus ends near or after total duration", () => {
      const song: SongHookMetadata = {
        hookStartSec: 60,
        hookEndSec: 80,
        duration: 65, // Song ends before hookEndSec
      };

      // Total duration is 65. Max start offset cannot exceed 65 - 2 = 63.
      const maxVal = calculateSliceStart(song, 2.0, () => 1);
      expect(maxVal).toBe(63.0);
    });

    it("handles edge cases safely (hookStartSec: 0, corrupted hookEndSec, duration <= durationSec)", () => {
      // 1. hookStartSec: 0
      const startZeroSong: SongHookMetadata = {
        hookStartSec: 0,
        hookEndSec: 25,
        duration: 100,
      };
      const zeroMin = calculateSliceStart(startZeroSong, 2.0, () => 0);
      expect(zeroMin).toBe(0.0);
      const zeroMax = calculateSliceStart(startZeroSong, 2.0, () => 1);
      expect(zeroMax).toBe(23.0);

      // 2. Corrupted hookEndSec (hookEndSec <= hookStartSec)
      const corruptedHook: SongHookMetadata = {
        hookStartSec: 40,
        hookEndSec: 20, // Invalid end before start
        duration: 120,
      };
      // Falls back to minStart + 20 = 60, maxStart = 60 - 2 = 58
      const fallbackMin = calculateSliceStart(corruptedHook, 2.0, () => 0);
      expect(fallbackMin).toBe(40.0);
      const fallbackMax = calculateSliceStart(corruptedHook, 2.0, () => 1);
      expect(fallbackMax).toBe(58.0);

      // 3. Very short song (duration <= durationSec)
      const shortSong: SongHookMetadata = {
        hookStartSec: 0,
        hookEndSec: 2,
        duration: 1.5,
      };
      const shortResult = calculateSliceStart(shortSong, 2.0);
      expect(shortResult).toBe(0);

      // 4. Null / undefined input
      expect(calculateSliceStart(null as any)).toBe(0);
      expect(calculateSliceStart(undefined as any)).toBe(0);
    });

    it("produces dynamic pseudo-random variance within range across multiple invocations", () => {
      const song: SongHookMetadata = {
        hookStartSec: 60,
        hookEndSec: 90,
        duration: 180,
      };

      const results = new Set<number>();
      for (let i = 0; i < 50; i++) {
        const val = calculateSliceStart(song, 2.0);
        expect(val).toBeGreaterThanOrEqual(60.0);
        expect(val).toBeLessThanOrEqual(88.0);
        // Rounded to 1 decimal place
        expect(Math.round(val * 10)).toBe(val * 10);
        results.add(val);
      }

      // Assert that multiple runs did not return the exact same static number
      expect(results.size).toBeGreaterThan(5);
    });

    it("defaults durationSec to 2.0 if not provided or invalid", () => {
      const song: SongHookMetadata = {
        hookStartSec: 10,
        hookEndSec: 30,
        duration: 100,
      };

      // With default durationSec (2.0): maxStart = 30 - 2 = 28
      const maxVal = calculateSliceStart(song, undefined, () => 1);
      expect(maxVal).toBe(28.0);

      const invalidDurationVal = calculateSliceStart(song, -5, () => 1);
      expect(invalidDurationVal).toBe(28.0);
    });
  });

  describe("Multiplayer Next Round Integration", () => {
    const roomCode = "RND123";
    const dummySong: Song = {
      id: "song-dynamic-1",
      title: "เพลงฮิตติดหู",
      artist: "ศิลปินชื่อดัง",
      aliases: ["Hit Song"],
      audioUrl: "https://example.com/audio.mp3",
      hookStartSec: 50,
      hookEndSec: 75,
      durationSec: 200,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      RoomStateStore.clearAll();
    });

    it("generates a synchronized randomized sliceStartSec and builds sliceUrl accordingly", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-uuid-1",
        settings: {
          gameMode: "audio-slice",
          answerInputMode: "free-text",
          sliceDurationSec: 2.0,
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      (SongService.getRandomSongs as any).mockResolvedValue([dummySong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ sessionToken: "host-uuid-1" }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify sliceUrl was generated with a startSec within [50.0, 73.0]
      const urlMatch = data.sliceUrl.match(/start=([0-9.]+)/);
      expect(urlMatch).not.toBeNull();
      const extractedStart = parseFloat(urlMatch[1]);
      expect(extractedStart).toBeGreaterThanOrEqual(50.0);
      expect(extractedStart).toBeLessThanOrEqual(73.0);

      // Verify RoomStateStore has the exact same sliceStartSec stored for room players
      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state).toBeDefined();
      expect(state?.sliceStartSec).toBe(extractedStart);
      expect(state?.sliceUrl).toBe(data.sliceUrl);

      // Verify broadcast sent to all room participants contains the exact same sliceUrl
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "round_start",
        expect.objectContaining({
          sliceUrl: data.sliceUrl,
          durationSec: 2.0,
        })
      );
    });
  });
});
