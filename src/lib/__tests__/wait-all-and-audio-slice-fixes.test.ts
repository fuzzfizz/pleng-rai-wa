import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as answerHandler } from "@/app/api/room/[code]/answer/route";
import { POST as surrenderHandler } from "@/app/api/room/[code]/surrender/route";
import { NextRequest } from "next/server";
import type { Song, RoomSettings } from "@/types";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue(true),
    updateRoomRoundState: vi.fn().mockResolvedValue(true),
  },
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

describe("Audio Slice & Wait-All Multiplayer Mode Fixes", () => {
  const roomCode = "FIX123";

  const dummySong: Song = {
    id: "song-1",
    title: "รักแรก",
    artist: "NONT TANONT",
    aliases: ["First Love", "รักแรก (First Love)"],
    releaseYear: 2022,
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
    durationSec: 200,
    genre: { id: "g1", slug: "pop", nameTh: "ป็อป", nameEn: "Pop" },
  };

  const waitAllSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    answerResolutionMode: "wait_all",
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    playerCount: 2,
    sliceDurationSec: 2.0,
  };

  const raceSettings: RoomSettings = {
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
    const globalStates = (globalThis as any).__roomRoundStates as Map<string, any> | undefined;
    if (globalStates) {
      globalStates.delete(roomCode);
    }
  });

  describe("Feature: Answer Resolution Modes ('race' vs 'wait_all')", () => {
    it("In 'race' mode, the first correct answer reveals immediately and awards points", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, raceSettings);

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแรก", {
        gameMode: "audio-slice",
        roomSettings: raceSettings,
        totalPlayers: 2,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.waitingForOthers).toBeFalsy();
      expect(res.scoreDelta).toBe(100);
      expect(res.roundState?.roundStatus).toBe("revealing");
      expect(res.roundState?.winnerPlayerId).toBe("p1");
    });

    it("In 'wait_all' mode, first correct answer records submission, waits for others, and does NOT reveal", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, waitAllSettings);

      // Player 1 answers correctly
      const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแรก", {
        gameMode: "audio-slice",
        roomSettings: waitAllSettings,
        totalPlayers: 2,
      });

      expect(res1.success).toBe(true);
      expect(res1.isCorrect).toBe(true);
      expect(res1.waitingForOthers).toBe(true);
      expect(res1.scoreDelta).toBe(100);
      expect(res1.newScore).toBe(100);

      const state1 = RoomStateStore.getRoomRoundState(roomCode);
      // Status MUST stay question_active so player 2 can still answer!
      expect(state1?.roundStatus).toBe("question_active");
      expect(state1?.excludedPlayerIds).toContain("p1");
      expect(state1?.playerSubmissions?.["p1"]?.isCorrect).toBe(true);

      // Player 1 tries to answer again -> blocked
      const res1Retry = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแรก", {
        gameMode: "audio-slice",
        roomSettings: waitAllSettings,
        totalPlayers: 2,
      });
      expect(res1Retry.success).toBe(false);
      expect(res1Retry.reason).toBe("already_guessed_wrong");

      // Player 2 answers wrong -> now all players have submitted -> reveals!
      const res2 = RoomStateStore.submitAnswer(roomCode, "p2", "Player 2", "เพลงผิด", {
        gameMode: "audio-slice",
        roomSettings: waitAllSettings,
        totalPlayers: 2,
      });

      expect(res2.success).toBe(true);
      expect(res2.isCorrect).toBe(false);
      expect(res2.waitingForOthers).toBe(false);
      expect(res2.shouldReveal).toBe(true);

      const stateFinal = RoomStateStore.getRoomRoundState(roomCode);
      expect(stateFinal?.roundStatus).toBe("revealing");
      // Player 1 is the winner because player 1 answered correctly!
      expect(stateFinal?.winnerPlayerId).toBe("p1");
      expect(stateFinal?.scores["p1"]).toBe(100);
      expect(stateFinal?.scores["p2"]).toBe(0);
    });

    it("In 'wait_all' mode via /api/room/[code]/answer endpoint, broadcasts player_submitted without revealing until all done", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: waitAllSettings,
        players: [{ id: "p1", displayName: "P1" }, { id: "p2", displayName: "P2" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, waitAllSettings);

      // Player 1 submits correct answer
      const req1 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          answerText: "รักแรก",
          totalPlayers: 2,
        }),
      });

      const res1 = await answerHandler(req1, { params: Promise.resolve({ code: roomCode }) });
      const data1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data1.isCorrect).toBe(true);
      expect(data1.waitingForOthers).toBe(true);

      // Broadcasts player_submitted, NOT round_reveal yet
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "player_submitted",
        expect.objectContaining({ playerId: "p1" })
      );
      expect(RealtimeBroadcastService.broadcast).not.toHaveBeenCalledWith(
        roomCode,
        "round_reveal",
        expect.anything()
      );

      // Now Player 2 surrenders
      const req2 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p2",
          displayName: "Player 2",
          totalPlayers: 2,
          reason: "timed_out",
        }),
      });

      const res2 = await surrenderHandler(req2, { params: Promise.resolve({ code: roomCode }) });
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.allExcluded).toBe(true);

      // Now round_reveal is broadcasted with winnerPlayerId: "p1"
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "round_reveal",
        expect.objectContaining({
          winnerPlayerId: "p1",
          scores: expect.objectContaining({ p1: 100 }),
        })
      );
    });
  });

  describe("Timeout vs Surrender Distinction & TV View Filtering", () => {
    it("Dedicated /surrender endpoint respects reason: 'timed_out' and broadcasts proper event payload", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: raceSettings,
        players: [{ id: "p1", displayName: "P1" }, { id: "p2", displayName: "P2" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, raceSettings);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          totalPlayers: 2,
          reason: "timed_out",
        }),
      });

      const res = await surrenderHandler(req, { params: Promise.resolve({ code: roomCode }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reason).toBe("timed_out");
      expect(data.message).toBe("หมดเวลาตอบในข้อนี้แล้ว");

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "player_surrendered",
        expect.objectContaining({
          playerId: "p1",
          reason: "timed_out",
        })
      );
    });

    it("Resolves reveal without deadlock when 2 active players surrender with TV view spectator present", async () => {
      // In a real room with 2 players and 1 TV view, totalPlayers for gameplay is strictly 2 (human players)
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "p1",
        settings: raceSettings,
        players: [
          { id: "p1", displayName: "Player 1" },
          { id: "p2", displayName: "Player 2" },
          { id: "tv-1", displayName: "จอทีวี (TV)", avatarUrl: "📺" },
        ],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, raceSettings);

      // Player 1 times out (totalPlayers sent = 2, excluding TV view)
      const req1 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({ playerId: "p1", displayName: "Player 1", totalPlayers: 2, reason: "timed_out" }),
      });
      const res1 = await surrenderHandler(req1, { params: Promise.resolve({ code: roomCode }) });
      const data1 = await res1.json();
      expect(data1.allExcluded).toBe(false);

      // Player 2 times out
      const req2 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/surrender`, {
        method: "POST",
        body: JSON.stringify({ playerId: "p2", displayName: "Player 2", totalPlayers: 2, reason: "timed_out" }),
      });
      const res2 = await surrenderHandler(req2, { params: Promise.resolve({ code: roomCode }) });
      const data2 = await res2.json();
      expect(data2.allExcluded).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.roundStatus).toBe("revealing");
      expect(state?.winnerPlayerId).toBeNull();
    });
  });
});
