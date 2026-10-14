import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_ROOM_SETTINGS, RoomService } from "@/lib/services/room-service";
import {
  createInitialRoomRealtimeState,
  reduceRoomRealtimeEvent,
} from "@/hooks/use-room-realtime";
import { prepareSettingsPayload } from "@/components/room/host-settings-modal";
import { RoomStateStore } from "@/lib/room-state-store";
import {
  getRandomSongs,
  SongService,
  setDbClient,
  resetDbClient,
} from "@/lib/services/song-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as nextRoundHandler } from "@/app/api/room/[code]/next-round/route";
import type { Song, RoomSettings, Player } from "@/types";
import { NextRequest } from "next/server";

// Mock RoomService and RealtimeBroadcastService for API route testing
vi.mock("@/lib/services/room-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/room-service")>();
  return {
    ...actual,
    RoomService: {
      getRoomByCode: vi.fn(),
      updateRoomStatus: vi.fn().mockResolvedValue({}),
      updateRoomRound: vi.fn().mockResolvedValue({}),
      updateRoomRoundState: vi.fn().mockResolvedValue({}),
    },
  };
});

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

describe("Items 1, 5, 6, 7, and 8 Implementations & Fixes", () => {
  // ---------------------------------------------------------------------------
  // Item 1: Default gameMode changed to "audio-slice"
  // ---------------------------------------------------------------------------
  describe("Item 1: Default Room GameMode", () => {
    it("has DEFAULT_ROOM_SETTINGS.gameMode set to 'audio-slice'", () => {
      expect(DEFAULT_ROOM_SETTINGS.gameMode).toBe("audio-slice");
    });

    it("initializes useRoomRealtime state with gameMode 'audio-slice'", () => {
      const state = createInitialRoomRealtimeState("ROOM01");
      expect(state.gameMode).toBe("audio-slice");
    });
  });

  // ---------------------------------------------------------------------------
  // Item 5: Host Settings normalization for wait_all vs race
  // ---------------------------------------------------------------------------
  describe("Item 5: Host Settings Normalization & Allowed Wrong Guesses", () => {
    it("normalizes maxWrongGuesses to 1 when answerResolutionMode is wait_all and maxWrongGuesses is 0", () => {
      const payload = prepareSettingsPayload({
        answerResolutionMode: "wait_all",
        maxWrongGuesses: 0,
      });

      expect(payload.answerResolutionMode).toBe("wait_all");
      expect(payload.maxWrongGuesses).toBe(1);
    });

    it("preserves positive maxWrongGuesses (e.g. 2, 3) in wait_all mode", () => {
      const payload2 = prepareSettingsPayload({
        answerResolutionMode: "wait_all",
        maxWrongGuesses: 2,
      });
      expect(payload2.maxWrongGuesses).toBe(2);

      const payload3 = prepareSettingsPayload({
        answerResolutionMode: "wait_all",
        maxWrongGuesses: 3,
      });
      expect(payload3.maxWrongGuesses).toBe(3);
    });

    it("allows maxWrongGuesses to be 0 (unlimited) in race mode", () => {
      const payload = prepareSettingsPayload({
        answerResolutionMode: "race",
        maxWrongGuesses: 0,
      });

      expect(payload.answerResolutionMode).toBe("race");
      expect(payload.maxWrongGuesses).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 6: room_settings broadcast synchronization
  // ---------------------------------------------------------------------------
  describe("Item 6: Realtime room_settings broadcast event handling", () => {
    it("updates room settings, gameMode, totalRounds, and host when room_settings is received", () => {
      const myPlayer: Player = {
        id: "p1",
        displayName: "Player 1",
        isHost: true,
        isReady: true,
        score: 0,
        sessionToken: "p1",
        lastSeenAt: new Date().toISOString(),
      };
      const otherPlayer: Player = {
        id: "p2",
        displayName: "Player 2",
        isHost: false,
        isReady: true,
        score: 0,
        sessionToken: "p2",
        lastSeenAt: new Date().toISOString(),
      };

      const initialState = createInitialRoomRealtimeState("ROOM01", myPlayer);
      initialState.players = [myPlayer, otherPlayer];
      initialState.isHost = true;

      // Broadcast event indicating host transferred to p2 and gameMode changed
      const updatedState = reduceRoomRealtimeEvent(initialState, {
        type: "broadcast",
        event: "room_settings",
        payload: {
          settings: {
            gameMode: "ai-lyrics",
            totalRounds: 15,
            answerResolutionMode: "wait_all",
            maxWrongGuesses: 2,
          },
          room: {
            host_player_id: "p2",
            settings: {
              gameMode: "ai-lyrics",
              totalRounds: 15,
              answerResolutionMode: "wait_all",
              maxWrongGuesses: 2,
            },
          },
        },
      });

      expect(updatedState.gameMode).toBe("ai-lyrics");
      expect(updatedState.totalRounds).toBe(15);
      expect(updatedState.room?.settings?.gameMode).toBe("ai-lyrics");
      expect(updatedState.isHost).toBe(false);
      expect(updatedState.myPlayer?.isHost).toBe(false);
      expect(updatedState.players.find((p) => p.id === "p2")?.isHost).toBe(true);
      expect(updatedState.players.find((p) => p.id === "p1")?.isHost).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 7: Multi-wrong guess retry logic & non-exclusion
  // ---------------------------------------------------------------------------
  describe("Item 7: Multi-wrong guess retry support in RoomStateStore & realtime reducer", () => {
    const roomCode = "RETRY01";
    const dummySong: Song = {
      id: "song-ret-1",
      title: "รักแรก",
      artist: "NONT TANONT",
      aliases: ["First Love"],
      audioUrl: "https://example.com/audio.mp3",
      hookStartSec: 30,
      hookEndSec: 50,
    };

    const multiWrongSettings: RoomSettings = {
      gameMode: "audio-slice",
      answerInputMode: "autocomplete",
      answerResolutionMode: "wait_all",
      sliceDurationSec: 2.0,
      roundTimeoutSec: 15,
      totalRounds: 5,
      targetScore: 0,
      maxWrongGuesses: 2,
    };

    beforeEach(() => {
      RoomStateStore.initRound(roomCode, 1, dummySong, multiWrongSettings);
    });

    it("allows retry and does not exclude player when wrong guesses are below maxWrongGuesses", () => {
      // 1st wrong guess
      const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบผิด 1", {
        gameMode: "audio-slice",
        roomSettings: multiWrongSettings,
        totalPlayers: 2,
      });

      expect(res1.success).toBe(true);
      expect(res1.isCorrect).toBe(false);
      expect(res1.canRetry).toBe(true);
      expect(res1.remainingAttempts).toBe(1);

      const state1 = RoomStateStore.getRoomRoundState(roomCode);
      expect(state1?.excludedPlayerIds.includes("p1")).toBe(false);
      expect(state1?.playerWrongCounts["p1"]).toBe(1);

      // 2nd wrong guess (reaches maxWrongGuesses = 2)
      const res2 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบผิด 2", {
        gameMode: "audio-slice",
        roomSettings: multiWrongSettings,
        totalPlayers: 2,
      });

      expect(res2.success).toBe(true);
      expect(res2.isCorrect).toBe(false);
      expect(res2.canRetry).toBe(false);
      expect(res2.remainingAttempts).toBe(0);

      const state2 = RoomStateStore.getRoomRoundState(roomCode);
      expect(state2?.excludedPlayerIds.includes("p1")).toBe(true);
      expect(state2?.playerWrongCounts["p1"]).toBe(2);

      // 3rd attempt: blocked
      const res3 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแรก", {
        gameMode: "audio-slice",
        roomSettings: multiWrongSettings,
        totalPlayers: 2,
      });
      expect(res3.success).toBe(false);
      expect(res3.reason).toBe("already_guessed_wrong");
    });

    it("allows unlimited retries when maxWrongGuesses is 0 in race mode", () => {
      const unlimitedSettings: RoomSettings = {
        ...multiWrongSettings,
        answerResolutionMode: "race",
        maxWrongGuesses: 0,
      };
      RoomStateStore.initRound(roomCode, 1, dummySong, unlimitedSettings);

      for (let i = 1; i <= 4; i++) {
        const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", `ผิดครั้งที่ ${i}`, {
          gameMode: "audio-slice",
          roomSettings: unlimitedSettings,
          totalPlayers: 2,
        });
        expect(res.canRetry).toBe(true);
        expect(res.remainingAttempts).toBe(999);
      }

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.excludedPlayerIds.includes("p1")).toBe(false);
      expect(state?.playerWrongCounts["p1"]).toBe(4);
    });

    it("strictly excludes player on first wrong guess in buzzer mode", () => {
      const buzzerSettings: RoomSettings = {
        ...multiWrongSettings,
        gameMode: "buzzer",
        maxWrongGuesses: 3,
      };
      RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);

      RoomStateStore.buzz(roomCode, "p1", "Player 1");
      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "ผิดในโหมดกดกริ่ง", {
        gameMode: "buzzer",
        roomSettings: buzzerSettings,
        totalPlayers: 2,
      });

      expect(res.isCorrect).toBe(false);
      expect(res.canRetry).toBe(false);
      expect(res.remainingAttempts).toBe(0);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.excludedPlayerIds.includes("p1")).toBe(true);
    });

    it("realtime reducer keeps isExcludedFromBuzz false when wrong_guess event has excluded: false", () => {
      const myPlayer: Player = {
        id: "p1",
        displayName: "Player 1",
        isHost: true,
        isReady: true,
        score: 100,
        sessionToken: "p1",
        lastSeenAt: new Date().toISOString(),
      };

      const initialState = createInitialRoomRealtimeState("RETRY01", myPlayer);

      // Wrong guess with excluded: false
      const stateWithRetry = reduceRoomRealtimeEvent(initialState, {
        type: "broadcast",
        event: "wrong_guess",
        payload: {
          playerId: "p1",
          displayName: "Player 1",
          answerText: "ผิดครั้งแรก",
          excluded: false,
          canRetry: true,
          remainingAttempts: 1,
        },
      });

      expect(stateWithRetry.isExcludedFromBuzz).toBe(false);
      expect(stateWithRetry.excludedPlayerIds).not.toContain("p1");

      // Wrong guess with excluded: true
      const stateExcluded = reduceRoomRealtimeEvent(stateWithRetry, {
        type: "broadcast",
        event: "wrong_guess",
        payload: {
          playerId: "p1",
          displayName: "Player 1",
          answerText: "ผิดครั้งที่สอง",
          excluded: true,
          canRetry: false,
          remainingAttempts: 0,
        },
      });

      expect(stateExcluded.isExcludedFromBuzz).toBe(true);
      expect(stateExcluded.excludedPlayerIds).toContain("p1");
    });
  });

  // ---------------------------------------------------------------------------
  // Item 8: Multi-genre query, song exhaustion without recycling, graceful game over
  // ---------------------------------------------------------------------------
  describe("Item 8: Multi-genre query, song exhaustion without recycling, graceful game over", () => {
    afterEach(() => {
      resetDbClient();
      vi.clearAllMocks();
    });

    it("queries database with query.in('genre_id', genreIds) when multi-genre is selected", async () => {
      let capturedInColumn = "";
      let capturedInValues: any = [];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn((col: string, values: any[]) => {
          capturedInColumn = col;
          capturedInValues = values;
          return mockQueryBuilder;
        }),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: [
              {
                id: "song-1",
                title: "Rock Song",
                artist: "Band A",
                genre_id: "genre-rock",
                audio_url: "https://example.com/a.mp3",
              },
            ],
            error: null,
          }),
      };

      const mockDb = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      setDbClient(mockDb);

      const songs = await getRandomSongs(1, {
        genreIds: ["genre-rock", "genre-pop"],
        fallbackOnEmpty: false,
      });

      expect(mockDb.from).toHaveBeenCalledWith("songs");
      expect(mockQueryBuilder.in).toHaveBeenCalledWith("genre_id", ["genre-rock", "genre-pop"]);
      expect(capturedInColumn).toBe("genre_id");
      expect(capturedInValues).toEqual(["genre-rock", "genre-pop"]);
      expect(songs.length).toBe(1);
      expect(songs[0].id).toBe("song-1");
    });

    it("returns empty array and does NOT recycle played songs when unplayed songs are exhausted", async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: [
              { id: "song-1", title: "Song 1", artist: "Artist 1", audio_url: "https://example.com/1.mp3" },
              { id: "song-2", title: "Song 2", artist: "Artist 2", audio_url: "https://example.com/2.mp3" },
            ],
            error: null,
          }),
      };

      const mockDb = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      setDbClient(mockDb);

      // Both available songs have already been played
      const songs = await getRandomSongs(1, {
        excludeIds: ["song-1", "song-2"],
        fallbackOnEmpty: false,
      });

      // Must return empty array without looping/repeating song-1 or song-2
      expect(songs).toEqual([]);
    });

    it("next-round route gracefully triggers game over with reason 'no_more_songs' when song pool is exhausted", async () => {
      const roomCode = "NOMORE";
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        answerInputMode: "autocomplete",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
        songFilter: {
          type: "genre",
          genreIds: ["g1", "g2"],
        },
      };

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        status: "revealing",
        played_song_ids: ["s1", "s2", "s3"],
        settings,
        players: [{ id: "host-1", displayName: "Host" }],
      });

      // SongService returns empty array (songs exhausted)
      vi.spyOn(SongService, "getRandomSongs").mockResolvedValueOnce([]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.gameOver).toBe(true);
      expect(data.reason).toBe("no_more_songs");
      expect(data.message).toContain("เล่นครบทุกเพลงในคลัง/เพลย์ลิสต์แล้ว (รวม 3 ข้อ) สรุปคะแนนผู้ชนะ!");

      expect(RoomService.updateRoomStatus).toHaveBeenCalledWith(roomCode, "game_over");
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "game_over",
        expect.objectContaining({
          gameOver: true,
          reason: "no_more_songs",
          round: 3,
          totalRounds: 10,
        })
      );
    });
  });
});
