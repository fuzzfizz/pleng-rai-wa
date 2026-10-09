import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as surrenderHandler } from "../[code]/surrender/route";
import { POST as answerHandler } from "../[code]/answer/route";
import { reduceRoomRealtimeEvent, createInitialRoomRealtimeState } from "@/hooks/use-room-realtime";
import type { Song, RoomSettings } from "@/types";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue({}),
    updateRoomRoundState: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/services/redis-service", () => ({
  RedisService: {
    isRedisAvailable: vi.fn().mockReturnValue(false),
    releaseBuzzerLock: vi.fn().mockResolvedValue(true),
    saveRoundState: vi.fn().mockResolvedValue(true),
  },
}));

describe("Surrender System & Fail-Safe Integration", () => {
  const dummySong: Song = {
    id: "song-1",
    title: "รักแรก",
    artist: "NONT TANONT",
    aliases: ["First Love"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 10,
    hookEndSec: 30,
  };

  const roomCode = "SURR01";
  const settings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    playerCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  describe("Dedicated /surrender endpoint", () => {
    it("successfully surrenders for one player without score penalty or revealing when other players remain", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings,
        players: [{ id: "p1", displayName: "Player 1" }, { id: "p2", displayName: "Player 2" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, settings);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          totalPlayers: 2,
        }),
      });

      const res = await surrenderHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.allExcluded).toBe(false);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.excludedPlayerIds).toContain("p1");
      expect(state?.roundStatus).toBe("question_active");

      // Broadcasts player_surrendered but NOT round_reveal
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "player_surrendered",
        expect.objectContaining({ playerId: "p1", allExcluded: false })
      );
      expect(RealtimeBroadcastService.broadcast).not.toHaveBeenCalledWith(
        roomCode,
        "round_reveal",
        expect.anything()
      );
    });

    it("falls back to in-memory state if RoomService.getRoomByCode returns null (zero 404 risk)", async () => {
      // Supabase lookup returns null
      (RoomService.getRoomByCode as any).mockResolvedValue(null);

      // But in-memory state exists
      RoomStateStore.initRound(roomCode, 1, dummySong, settings);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          totalPlayers: 1,
        }),
      });

      const res = await surrenderHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      // Does NOT return 404!
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.allExcluded).toBe(true);
    });

    it("transitions round to revealing when all players have surrendered", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings,
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, settings);

      // Player 1 surrenders
      const req1 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({ playerId: "p1", displayName: "P1", totalPlayers: 2 }),
      });
      await surrenderHandler(req1, { params: Promise.resolve({ code: roomCode }) });

      // Player 2 surrenders
      const req2 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({ playerId: "p2", displayName: "P2", totalPlayers: 2 }),
      });
      const res2 = await surrenderHandler(req2, { params: Promise.resolve({ code: roomCode }) });
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.allExcluded).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.roundStatus).toBe("revealing");
      expect(state?.winnerPlayerId).toBeNull();

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "round_reveal",
        expect.objectContaining({
          skipped: true,
          winnerPlayerId: null,
          song: dummySong,
        })
      );
    });
  });

  describe("Fail-Safe /answer endpoint surrender handler", () => {
    it("handles { isSurrender: true } cleanly via /answer route with 0 score delta and no wrong guess record", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings,
        players: [{ id: "p1", displayName: "Player 1" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, settings);
      const stateBefore = RoomStateStore.getRoomRoundState(roomCode)!;
      stateBefore.scores = { p1: 100 };

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          answerText: "(ยอมแพ้)",
          isSurrender: true,
          totalPlayers: 1,
        }),
      });

      const res = await answerHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isSurrender).toBe(true);
      expect(data.scoreDelta).toBe(0);
      expect(data.scores.p1).toBe(100); // Score remains 100, NOT deducted to 80!

      const stateAfter = RoomStateStore.getRoomRoundState(roomCode);
      expect(stateAfter?.wrongGuesses).toHaveLength(0); // "(ยอมแพ้)" was NOT added to wrongGuesses!
      expect(stateAfter?.roundStatus).toBe("revealing");
    });
  });

  describe("Client Reducer Realtime Synchronization", () => {
    it("sets isExcludedFromBuzz = true when player_surrendered event arrives for current player", () => {
      const initialState = createInitialRoomRealtimeState("SURR01", {
        id: "p1",
        displayName: "My Player",
        isHost: false,
      });

      const nextState = reduceRoomRealtimeEvent(
        initialState,
        {
          type: "broadcast",
          event: "player_surrendered",
          payload: {
            playerId: "p1",
            displayName: "My Player",
            allExcluded: false,
          },
        },
        { playSounds: false }
      );

      expect(nextState.excludedPlayerIds).toContain("p1");
      expect(nextState.isExcludedFromBuzz).toBe(true);
    });

    it("does not exclude current player when another player surrenders", () => {
      const initialState = createInitialRoomRealtimeState("SURR01", {
        id: "p1",
        displayName: "My Player",
        isHost: false,
      });

      const nextState = reduceRoomRealtimeEvent(
        initialState,
        {
          type: "broadcast",
          event: "player_surrendered",
          payload: {
            playerId: "p2",
            displayName: "Other Player",
            allExcluded: false,
          },
        },
        { playSounds: false }
      );

      expect(nextState.excludedPlayerIds).toContain("p2");
      expect(nextState.isExcludedFromBuzz).toBe(false);
    });
  });
});
