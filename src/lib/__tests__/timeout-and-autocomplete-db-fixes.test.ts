import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchSongAutocomplete } from "@/lib/answer-checker";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as surrenderHandler } from "@/app/api/room/[code]/surrender/route";
import { GET as publicSongsHandler } from "@/app/api/songs/route";
import { NextRequest } from "next/server";
import type { Song, RoomSettings } from "@/types";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue(true),
    updateRoomRoundState: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/services/song-service", () => ({
  SongService: {
    getSongs: vi.fn().mockResolvedValue([
      {
        id: "s1",
        title: "บัวลอย",
        artist: "Carabao",
        aliases: ["คาราบาว บัวลอย"],
        releaseYear: 1984,
        lyricsIntro: "SECRET INTRO",
        lyricsChorus: "SECRET CHORUS",
      },
      {
        id: "s2",
        title: "จิ๊จ๊ะ",
        artist: "Silly Fools",
        aliases: ["ji ja"],
        releaseYear: 2002,
        lyricsIntro: "SECRET INTRO 2",
        lyricsChorus: "SECRET CHORUS 2",
      },
    ]),
  },
  getSongs: vi.fn().mockResolvedValue([
    {
      id: "s1",
      title: "บัวลอย",
      artist: "Carabao",
      aliases: ["คาราบาว บัวลอย"],
      releaseYear: 1984,
      lyricsIntro: "SECRET INTRO",
      lyricsChorus: "SECRET CHORUS",
    },
    {
      id: "s2",
      title: "จิ๊จ๊ะ",
      artist: "Silly Fools",
      aliases: ["ji ja"],
      releaseYear: 2002,
      lyricsIntro: "SECRET INTRO 2",
      lyricsChorus: "SECRET CHORUS 2",
    },
  ]),
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("@/lib/services/redis-service", () => ({
  RedisService: {
    isRedisAvailable: vi.fn().mockReturnValue(false),
    acquireBuzzerLock: vi.fn().mockResolvedValue({ success: true }),
    getBuzzerLock: vi.fn().mockResolvedValue(null),
    releaseBuzzerLock: vi.fn().mockResolvedValue(true),
    saveRoundState: vi.fn().mockResolvedValue(true),
  },
}));

describe("Timeout and Autocomplete DB Fixes", () => {
  const roomCode = "FIX123";
  const dummySong: Song = {
    id: "song-1",
    title: "บัวลอย",
    artist: "Carabao",
    aliases: ["คาราบาว บัวลอย"],
    releaseYear: 1984,
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
    durationSec: 200,
  };

  const roomSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    answerResolutionMode: "race",
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    playerCount: 2,
    sliceDurationSec: 2.0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.deleteRoom(roomCode);
  });

  describe("Issue 2: Autocomplete empty query & database projection", () => {
    it("returns empty array for empty or whitespace query (autocomplete does not show when nothing typed)", () => {
      const pool: Song[] = [
        dummySong,
        { id: "song-2", title: "ซ่อนกลิ่น", artist: "Palmy", aliases: [], audioUrl: "https://example.com/audio2.mp3" },
      ];

      expect(searchSongAutocomplete("", pool, 5)).toEqual([]);
      expect(searchSongAutocomplete("   ", pool, 5)).toEqual([]);
      expect(searchSongAutocomplete(null as any, pool, 5)).toEqual([]);
      expect(searchSongAutocomplete(undefined as any, pool, 5)).toEqual([]);
    });

    it("public GET /api/songs returns songs without leaking lyrics or secret fields", async () => {
      const req = new NextRequest("http://localhost:3000/api/songs");
      const res = await publicSongsHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.songs)).toBe(true);
      expect(data.songs.length).toBe(2);
      expect(data.songs[0].title).toBe("บัวลอย");
      // Must not leak lyrics
      expect(data.songs[0].lyricsIntro).toBeUndefined();
      expect(data.songs[0].lyricsChorus).toBeUndefined();
    });
  });

  describe("Issue 1: Timeout handling without freezing", () => {
    it("host timeout triggers round reveal after round duration even if other player did not timeout", () => {
      const state = RoomStateStore.initRound(roomCode, 1, dummySong, roomSettings);
      state.startedAt = new Date(Date.now() - 20000).toISOString();

      const res = RoomStateStore.surrenderPlayer(roomCode, "host-1", "HostPlayer", {
        roomSettings,
        totalPlayers: 2,
        reason: "timed_out",
        isHost: true,
      });

      expect(res.success).toBe(true);
      expect(res.allExcluded).toBe(true);
      expect(res.roundState?.roundStatus).toBe("revealing");
    });

    it("non-host timeout triggers reveal if round time has expired", () => {
      const state = RoomStateStore.initRound(roomCode, 1, dummySong, roomSettings);
      // Simulate that the round started 20 seconds ago (longer than slice 2s + timeout 15s)
      state.startedAt = new Date(Date.now() - 20000).toISOString();

      const res = RoomStateStore.surrenderPlayer(roomCode, "guest-1", "GuestPlayer", {
        roomSettings,
        totalPlayers: 2,
        reason: "timed_out",
        isHost: false,
      });

      expect(res.success).toBe(true);
      expect(res.allExcluded).toBe(true);
      expect(res.roundState?.roundStatus).toBe("revealing");
    });

    it("/api/room/[code]/surrender route reveals round when host times out and broadcasts round_reveal", async () => {
      const state = RoomStateStore.initRound(roomCode, 1, dummySong, roomSettings);
      state.startedAt = new Date(Date.now() - 20000).toISOString();

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        status: "question_active",
        settings: roomSettings,
        played_song_ids: [dummySong.id],
      });

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: "host-1",
          displayName: "HostPlayer",
          totalPlayers: 2,
          reason: "timed_out",
          isHost: true,
        }),
      });

      const res = await surrenderHandler(req, { params: Promise.resolve({ code: roomCode }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.allExcluded).toBe(true);
      expect(data.roundStatus).toBe("revealing");

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "round_reveal",
        expect.objectContaining({
          skipped: true,
        })
      );
    });
  });
});
