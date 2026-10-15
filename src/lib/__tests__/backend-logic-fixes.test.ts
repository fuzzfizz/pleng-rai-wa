import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_ROOM_SETTINGS, RoomService } from "@/lib/services/room-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { calculateSliceStart, type SongHookMetadata } from "@/lib/audio-slice-utils";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as joinHandler } from "@/app/api/room/join/route";
import { POST as answerHandler } from "@/app/api/room/[code]/answer/route";
import { POST as nextRoundHandler } from "@/app/api/room/[code]/next-round/route";
import { SongService } from "@/lib/services/song-service";
import { NextRequest } from "next/server";
import type { Song, RoomSettings } from "@/types";

// Mock RoomService, SongService, and RealtimeBroadcastService
vi.mock("@/lib/services/room-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/room-service")>();
  return {
    ...actual,
    RoomService: {
      getRoomByCode: vi.fn(),
      updateRoomStatus: vi.fn().mockResolvedValue({}),
      updateRoomSettings: vi.fn().mockResolvedValue({}),
      updateRoomRound: vi.fn().mockResolvedValue({}),
      updateRoomRoundState: vi.fn().mockResolvedValue({}),
    },
  };
});

vi.mock("@/lib/services/song-service", () => ({
  SongService: {
    getRandomSongs: vi.fn(),
    getSongById: vi.fn(),
  },
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

describe("Backend Logic & Architecture Fixes (Items 1, 2, 5, 6)", () => {
  const roomCode = "FIX1256";
  const dummySong: Song = {
    id: "song-backend-1",
    title: "รักแท้ยังไง",
    artist: "น้ำชา ชีรณัฐ",
    aliases: ["รักแท้", "Rak Tae Yang Ngai"],
    audioUrl: "https://example.com/raktae.mp3",
    hookStartSec: 50,
    hookEndSec: 75,
    durationSec: 210,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  // =========================================================================
  // 1. Types & Settings Updates
  // =========================================================================
  describe("1. Types & Settings Updates", () => {
    it("has DEFAULT_ROOM_SETTINGS.maxPlayers set to 8", () => {
      expect(DEFAULT_ROOM_SETTINGS.maxPlayers).toBe(8);
    });

    it("has DEFAULT_ROOM_SETTINGS.sliceRandomRegion set to 'hook'", () => {
      expect(DEFAULT_ROOM_SETTINGS.sliceRandomRegion).toBe("hook");
    });
  });

  // =========================================================================
  // 2. Max Players Validation (/api/room/join)
  // =========================================================================
  describe("2. Max Players Validation (/api/room/join)", () => {
    it("rejects new joiners when room player count reaches default maxPlayers (8)", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        id: "room-uuid",
        room_code: "MAX008",
        status: "lobby",
        host_player_id: "host-uuid",
        settings: {
          maxPlayers: 8,
          playerCount: 8,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/room/join", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "MAX008",
          displayName: "ผู้เล่นคนที่เก้า",
        }),
      });

      const res = await joinHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.isRoomFull).toBe(true);
      expect(json.error).toContain("ห้องนี้มีผู้เล่นเต็มแล้ว (สูงสุด 8 คน)");
    });

    it("rejects new joiners based on room.players.length >= maxPlayers", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        id: "room-uuid",
        room_code: "MAX005",
        status: "lobby",
        host_player_id: "host-uuid",
        players: Array.from({ length: 5 }, (_, i) => ({ id: `p-${i}`, displayName: `Player ${i}` })),
        settings: {
          maxPlayers: 5,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/room/join", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "MAX005",
          displayName: "Player 6",
        }),
      });

      const res = await joinHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.isRoomFull).toBe(true);
      expect(json.error).toContain("ห้องนี้มีผู้เล่นเต็มแล้ว (สูงสุด 5 คน)");
    });

    it("allows host to rejoin/reconnect even if room is full", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        id: "room-uuid",
        room_code: "MAX008",
        status: "lobby",
        host_player_id: "host-uuid",
        settings: {
          maxPlayers: 8,
          playerCount: 8,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/room/join", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "MAX008",
          displayName: "Host Player",
          existingSessionToken: "host-uuid",
        }),
      });

      const res = await joinHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.isHost).toBe(true);
    });

    it("allows reconnecting players to rejoin even if room is full", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        id: "room-uuid",
        room_code: "MAX008",
        status: "lobby",
        host_player_id: "host-uuid",
        settings: {
          maxPlayers: 8,
          playerCount: 8,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/room/join", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "MAX008",
          displayName: "Reconnecting Player",
          existingPlayerId: "player-uuid-1",
          existingSessionToken: "player-token-1",
        }),
      });

      const res = await joinHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.playerId).toBe("player-uuid-1");
    });

    it("allows new player when room is not full and increments playerCount", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        id: "room-uuid",
        room_code: "ROOMOK",
        status: "lobby",
        host_player_id: "host-uuid",
        settings: {
          maxPlayers: 8,
          playerCount: 3,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/room/join", {
        method: "POST",
        body: JSON.stringify({
          roomCode: "ROOMOK",
          displayName: "น้องสี่",
        }),
      });

      const res = await joinHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(RoomService.updateRoomSettings).toHaveBeenCalledWith(
        "ROOMOK",
        expect.objectContaining({ playerCount: 4 })
      );
    });
  });

  // =========================================================================
  // 3. Slicing Randomization Scope (entire_song vs hook)
  // =========================================================================
  describe("3. Slicing Randomization Scope", () => {
    it("randomizes across entire song duration bounded by 15% and 90% when sliceRegion is 'entire_song'", () => {
      const song: SongHookMetadata = {
        hookStartSec: 60,
        hookEndSec: 80,
        durationSec: 180,
      };

      // entire_song with randomFn = 0 (min start) -> 180 * 0.15 = 27.0
      const minVal = calculateSliceStart(song, 2.0, () => 0, "entire_song");
      expect(minVal).toBe(27.0);

      // entire_song with randomFn = 1 (max start) -> 180 * 0.90 = 162.0
      const maxVal = calculateSliceStart(song, 2.0, () => 1, "entire_song");
      expect(maxVal).toBe(162.0);

      // entire_song with randomFn = 0.5 (mid start) -> 27 + 0.5 * (162 - 27) = 94.5
      const midVal = calculateSliceStart(song, 2.0, () => 0.5, "entire_song");
      expect(midVal).toBe(94.5);
    });

    it("falls back to 180s duration when song duration is missing in 'entire_song' mode (max 90% = 162.0)", () => {
      const song: SongHookMetadata = {
        hookStartSec: 40,
        hookEndSec: 60,
      };

      const maxVal = calculateSliceStart(song, 2.0, () => 1, "entire_song");
      expect(maxVal).toBe(162.0); // 180 * 0.90
    });

    it("retains chorus-bounded randomization when sliceRegion is 'hook' (default)", () => {
      const song: SongHookMetadata = {
        hookStartSec: 60,
        hookEndSec: 85,
        durationSec: 200,
      };

      const minVal = calculateSliceStart(song, 2.0, () => 0, "hook");
      expect(minVal).toBe(60.0);

      const maxVal = calculateSliceStart(song, 2.0, () => 1, "hook");
      expect(maxVal).toBe(83.0); // 85 - 2
    });

    it("passes settings.sliceRandomRegion to calculateSliceStart in next-round API route", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: "RNDREG",
        status: "playing",
        host_player_id: "host-1",
        played_song_ids: [],
        settings: {
          gameMode: "audio-slice",
          sliceDurationSec: 2.0,
          sliceRandomRegion: "entire_song",
        },
      });

      (SongService.getRandomSongs as any).mockResolvedValue([
        {
          id: "song-rnd-1",
          title: "Test Song",
          artist: "Test Artist",
          hookStartSec: 50,
          hookEndSec: 70,
          durationSec: 100,
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/room/RNDREG/next-round", {
        method: "POST",
        headers: {
          authorization: "Bearer host-1",
        },
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: "RNDREG" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.sliceUrl).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Fix 403 Forbidden on round 7 in multiple-choice / direct answer
  // =========================================================================
  describe("4. Fix 403 Forbidden on round 7 in multiple-choice / direct answer", () => {
    it("synchronizes stale 'revealing' roundStatus to 'question_active' in ensureRoundState", async () => {
      // Setup: Room state in memory has status 'revealing' from round 6
      const existingState = RoomStateStore.initRound(
        roomCode,
        6,
        dummySong,
        {
          gameMode: "audio-slice",
          answerInputMode: "multiple-choice",
          sliceDurationSec: 2.0,
          roundTimeoutSec: 15,
          totalRounds: 10,
          targetScore: 0,
        }
      );
      existingState.roundStatus = "revealing";

      // Room in DB has now progressed to round 7 and is 'question_active'
      const roomDb = {
        room_code: roomCode,
        status: "question_active",
        host_player_id: "host-1",
        current_song_id: dummySong.id,
        played_song_ids: Array.from({ length: 7 }, (_, i) => `s-${i}`),
        settings: {
          gameMode: "audio-slice",
          answerInputMode: "multiple-choice",
          round_state: {
            currentRound: 7,
            roundStatus: "question_active",
            currentSong: dummySong,
          },
        },
      };

      const hydrated = await RoomStateStore.ensureRoundState(roomCode, roomDb);
      expect(hydrated).toBeDefined();
      expect(hydrated?.currentRound).toBe(7);
      expect(hydrated?.roundStatus).toBe("question_active");
    });

    it("prevents 403 Forbidden in /api/room/[code]/answer when in-memory roundStatus is 'revealing' but room is 'question_active'", async () => {
      // In-memory store still has 'revealing' from round 6
      const inMemoryState = RoomStateStore.initRound(
        "RND007",
        7,
        dummySong,
        {
          gameMode: "audio-slice",
          answerInputMode: "multiple-choice",
          sliceDurationSec: 2.0,
          roundTimeoutSec: 15,
          totalRounds: 10,
          targetScore: 0,
        }
      );
      inMemoryState.roundStatus = "revealing"; // Stale revealing state from previous round

      // Room in DB is in 'question_active' for round 7
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: "RND007",
        status: "question_active",
        host_player_id: "host-1",
        current_song_id: dummySong.id,
        played_song_ids: ["s1", "s2", "s3", "s4", "s5", "s6", "s7"],
        settings: {
          gameMode: "audio-slice",
          answerInputMode: "multiple-choice",
          round_state: {
            currentRound: 7,
            roundStatus: "question_active",
            currentSong: dummySong,
          },
        },
      });

      const req = new NextRequest("http://localhost:3000/api/room/RND007/answer", {
        method: "POST",
        body: JSON.stringify({
          playerId: "player-7",
          displayName: "Player 7",
          answerText: "รักแท้ยังไง",
          totalPlayers: 2,
        }),
      });

      const res = await answerHandler(req, {
        params: Promise.resolve({ code: "RND007" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.isCorrect).toBe(true);
    });
  });

  // =========================================================================
  // 5. Multi-Winner Array in Wait-for-All Mode
  // =========================================================================
  describe("5. Multi-Winner Array in Wait-for-All Mode", () => {
    it("collects all correct submissions into winners array in RoomStateStore.submitAnswer", () => {
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        answerInputMode: "multiple-choice",
        answerResolutionMode: "wait_all",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
        playerCount: 2,
      };

      RoomStateStore.initRound("WAITALL", 1, dummySong, settings);

      // Player 1 answers correctly -> waiting for others
      const result1 = RoomStateStore.submitAnswer(
        "WAITALL",
        "p1",
        "Player 1",
        "รักแท้ยังไง",
        { roomSettings: settings, totalPlayers: 2 }
      );
      expect(result1.success).toBe(true);
      expect(result1.isCorrect).toBe(true);
      expect(result1.waitingForOthers).toBe(true);
      expect(result1.shouldReveal).toBe(false);

      // Player 2 answers correctly -> reveals round with BOTH players in winners array
      const result2 = RoomStateStore.submitAnswer(
        "WAITALL",
        "p2",
        "Player 2",
        "รักแท้ยังไง",
        { roomSettings: settings, totalPlayers: 2 }
      );
      expect(result2.success).toBe(true);
      expect(result2.isCorrect).toBe(true);
      expect(result2.shouldReveal).toBe(true);
      expect(result2.winners).toBeDefined();
      expect(result2.winners).toHaveLength(2);

      const winnerIds = result2.winners?.map((w) => w.playerId);
      expect(winnerIds).toContain("p1");
      expect(winnerIds).toContain("p2");
      expect(result2.roundState?.winners).toHaveLength(2);
    });

    it("broadcasts winners array and returns winners in /api/room/[code]/answer route", async () => {
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        answerInputMode: "multiple-choice",
        answerResolutionMode: "wait_all",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
        playerCount: 2,
      };

      const state = RoomStateStore.initRound("APWAIT", 1, dummySong, settings);
      // Pre-populate Player 1's correct answer
      state.playerSubmissions = {
        p1: {
          playerId: "p1",
          displayName: "Player 1",
          answerText: "รักแท้ยังไง",
          isCorrect: true,
          scoreDelta: 100,
          timestamp: new Date().toISOString(),
        },
      };
      state.excludedPlayerIds = ["p1"];

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: "APWAIT",
        status: "question_active",
        host_player_id: "host-1",
        current_song_id: dummySong.id,
        played_song_ids: [dummySong.id],
        settings,
      });

      // Player 2 submits answer via API route
      const req = new NextRequest("http://localhost:3000/api/room/APWAIT/answer", {
        method: "POST",
        body: JSON.stringify({
          playerId: "p2",
          displayName: "Player 2",
          answerText: "รักแท้ยังไง",
          totalPlayers: 2,
        }),
      });

      const res = await answerHandler(req, {
        params: Promise.resolve({ code: "APWAIT" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.winners).toBeDefined();
      expect(json.winners).toHaveLength(2);

      // Verify RealtimeBroadcastService was called with winners
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        "APWAIT",
        "round_reveal",
        expect.objectContaining({
          winners: expect.arrayContaining([
            expect.objectContaining({ playerId: "p1" }),
            expect.objectContaining({ playerId: "p2" }),
          ]),
        })
      );
    });
  });
});
