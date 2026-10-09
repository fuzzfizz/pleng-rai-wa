import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as answerHandler } from "../[code]/answer/route";
import { POST as buzzHandler } from "../[code]/buzz/route";
import { POST as hintHandler } from "../[code]/hint/route";
import { POST as skipHandler } from "../[code]/skip/route";
import { NextRequest } from "next/server";
import type { Song } from "@/types";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue({}),
    updateRoomRound: vi.fn().mockResolvedValue({}),
    updateRoomRoundState: vi.fn().mockResolvedValue({}),
  },
  DEFAULT_ROOM_SETTINGS: {
    gameMode: "audio-slice",
    answerInputMode: "multiple-choice",
    lyricsType: "intro",
    voiceGender: "female",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    maxWrongGuesses: 2,
  },
}));

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

describe("Serverless Rehydration & HTTP 403 Prevention", () => {
  const roomCode = "SRV403";
  const dummySong: Song = {
    id: "song-101",
    title: "ฤดูร้อน",
    artist: "Paradox",
    aliases: ["Summer", "Radoo Ron"],
    audioUrl: "https://example.com/summer.mp3",
    hookStartSec: 45,
    hookEndSec: 65,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll(); // Ensure in-memory cache is completely empty (simulating fresh serverless container)
  });

  it("prevents HTTP 403 on direct answer (audio-slice mode) when in-memory store is empty (cold start)", async () => {
    // Room row in DB contains current song and settings
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      status: "question_active",
      host_player_id: "host-1",
      current_song_id: dummySong.id,
      played_song_ids: [dummySong.id],
      songs: dummySong,
      settings: {
        gameMode: "audio-slice",
        answerInputMode: "text",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 5,
        targetScore: 0,
        round_state: {
          currentRound: 1,
          roundStatus: "question_active",
          gameMode: "audio-slice",
          scores: {},
          excludedPlayerIds: [],
          revealedHintLevel: 0,
        },
      },
    });

    // Make sure in-memory store has NOTHING before request
    expect(RoomStateStore.getRoomRoundState(roomCode)).toBeUndefined();

    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
      method: "POST",
      body: JSON.stringify({
        playerId: "player-1",
        displayName: "น้องนก",
        answerText: "ฤดูร้อน",
        totalPlayers: 1,
      }),
    });

    const response = await answerHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    const data = await response.json();

    // MUST NOT return 403 Forbidden!
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isCorrect).toBe(true);
    expect(data.scoreDelta).toBe(100);
    expect(data.newScore).toBe(100);

    // In-memory store should have been rehydrated
    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state).toBeDefined();
    expect(state?.roundStatus).toBe("revealing");
    expect(state?.winnerPlayerId).toBe("player-1");
  });

  it("prevents HTTP 403 in buzzer mode when buzz was locked on another lambda and persisted to DB", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      status: "buzzed",
      host_player_id: "host-1",
      current_song_id: dummySong.id,
      played_song_ids: [dummySong.id],
      songs: dummySong,
      settings: {
        gameMode: "buzzer",
        round_state: {
          currentRound: 1,
          roundStatus: "buzzed",
          gameMode: "buzzer",
          buzzedPlayerId: "buzzer-winner-id",
          buzzedPlayerName: "คนมือกดไว",
          buzzedAt: new Date().toISOString(),
          buzzDeadline: new Date(Date.now() + 10000).toISOString(),
          scores: {},
          excludedPlayerIds: [],
        },
      },
    });

    // Memory is empty on this serverless instance
    expect(RoomStateStore.getRoomRoundState(roomCode)).toBeUndefined();

    // Buzzer winner submits answer
    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
      method: "POST",
      body: JSON.stringify({
        playerId: "buzzer-winner-id",
        displayName: "คนมือกดไว",
        answerText: "ฤดูร้อน",
      }),
    });

    const response = await answerHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isCorrect).toBe(true);
    expect(data.scoreDelta).toBe(100);
  });

  it("still rejects unauthorized non-buzzer holders with 403 in buzzer mode", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      status: "buzzed",
      host_player_id: "host-1",
      current_song_id: dummySong.id,
      played_song_ids: [dummySong.id],
      songs: dummySong,
      settings: {
        gameMode: "buzzer",
        round_state: {
          currentRound: 1,
          roundStatus: "buzzed",
          gameMode: "buzzer",
          buzzedPlayerId: "player-A",
          buzzedPlayerName: "Player A",
          buzzDeadline: new Date(Date.now() + 10000).toISOString(),
          scores: {},
          excludedPlayerIds: [],
        },
      },
    });

    // Player B (did not press buzzer) attempts to submit
    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
      method: "POST",
      body: JSON.stringify({
        playerId: "player-B",
        displayName: "Player B",
        answerText: "ฤดูร้อน",
      }),
    });

    const response = await answerHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("ไม่มีสิทธิ์ตอบคำถาม");
  });

  it("allows surrender on cold start without 403", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      status: "question_active",
      host_player_id: "host-1",
      current_song_id: dummySong.id,
      played_song_ids: [dummySong.id],
      songs: dummySong,
      settings: {
        gameMode: "audio-slice",
        round_state: {
          currentRound: 1,
          roundStatus: "question_active",
          gameMode: "audio-slice",
          scores: {},
          excludedPlayerIds: [],
        },
      },
    });

    expect(RoomStateStore.getRoomRoundState(roomCode)).toBeUndefined();

    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
      method: "POST",
      body: JSON.stringify({
        playerId: "player-giveup",
        displayName: "ผู้ยอมแพ้",
        answerText: "(ยอมแพ้)",
        totalPlayers: 1,
      }),
    });

    const response = await answerHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.isCorrect).toBe(false);

    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state?.excludedPlayerIds).toContain("player-giveup");
  });

  it("rehydrates state when requesting hints on cold start", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      status: "question_active",
      host_player_id: "host-1",
      current_song_id: dummySong.id,
      played_song_ids: [dummySong.id],
      songs: dummySong,
      settings: {
        gameMode: "audio-slice",
        round_state: {
          currentRound: 1,
          roundStatus: "question_active",
          gameMode: "audio-slice",
          scores: {},
          revealedHintLevel: 0,
        },
      },
    });

    expect(RoomStateStore.getRoomRoundState(roomCode)).toBeUndefined();

    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/hint`, {
      method: "POST",
      body: JSON.stringify({ playerId: "player-1" }),
    });

    const response = await hintHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.level).toBe(1);
    expect(data.pointsAvailable).toBe(75);
  });
});
