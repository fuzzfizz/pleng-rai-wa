import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { POST as sliceStepHandler } from "../[code]/slice-step/route";
import type { Song, RoomSettings } from "@/types";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue({}),
    updateRoomRoundState: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/services/redis-service", () => ({
  RedisService: {
    isRedisAvailable: vi.fn().mockReturnValue(false),
    saveRoundState: vi.fn().mockResolvedValue(true),
  },
}));

describe("Progressive Audio Slice Step API Route (/api/room/[code]/slice-step)", () => {
  const dummySong: Song = {
    id: "song-progressive-1",
    title: "ทรงอย่างแบด",
    artist: "Paper Planes",
    aliases: ["Bad Boy"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 15,
    hookEndSec: 35,
  };

  const roomCode = "STEP01";
  const settings: RoomSettings = {
    gameMode: "audio-slice",
    sliceType: "progressive",
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

  it("returns 400 when room code is invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/room/invalid!/slice-step", {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });

    const res = await sliceStepHandler(req, {
      params: Promise.resolve({ code: "invalid!" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("รหัสห้องไม่ถูกต้อง");
  });

  it("returns 400 when body is not valid JSON or missing playerId", async () => {
    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await sliceStepHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("playerId");
  });

  it("returns 404 when room is not found in database", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(null);

    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });

    const res = await sliceStepHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("ไม่พบห้องนี้");
  });

  it("returns 400 when room is not in question_active status", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      host_player_id: "host-1",
      status: "lobby",
      settings,
      players: [{ id: "p1", displayName: "Player 1" }],
    });

    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });

    const res = await sliceStepHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("ไม่ได้อยู่ในสถานะเล่นคำถาม");
  });

  it("advances player slice step from step 1 (0.1s) to step 2 (0.5s, 80 pts)", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      host_player_id: "host-1",
      status: "question_active",
      settings,
      players: [{ id: "p1", displayName: "Player 1" }, { id: "p2", displayName: "Player 2" }],
    });

    RoomStateStore.initRound(roomCode, 1, dummySong, settings, {
      sliceStartSec: 15.0,
      sliceDurationSec: 0.1,
    });

    const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });

    const res = await sliceStepHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.step).toBe(2);
    expect(data.durationSec).toBe(0.5);
    expect(data.points).toBe(80);
    expect(data.sliceUrl).toContain("id=song-progressive-1");
    expect(data.sliceUrl).toContain("start=15");
    expect(data.sliceUrl).toContain("duration=0.5");

    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state?.playerSliceSteps?.["p1"]).toBe(2);
    // Player 2 step should remain un-advanced
    expect(state?.playerSliceSteps?.["p2"]).toBeUndefined();
  });

  it("progresses sequentially through all 5 steps and correctly caps at step 5", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue({
      room_code: roomCode,
      host_player_id: "host-1",
      status: "question_active",
      settings,
      players: [{ id: "p1", displayName: "Player 1" }],
    });

    RoomStateStore.initRound(roomCode, 1, dummySong, settings, {
      sliceStartSec: 20.0,
      sliceDurationSec: 0.1,
    });

    // Step 1 -> 2 (0.5s, 80 pts)
    const req1 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });
    const res1 = await sliceStepHandler(req1, { params: Promise.resolve({ code: roomCode }) });
    const data1 = await res1.json();
    expect(data1.step).toBe(2);
    expect(data1.durationSec).toBe(0.5);
    expect(data1.points).toBe(80);

    // Step 2 -> 3 (1.0s, 60 pts)
    const req2 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });
    const res2 = await sliceStepHandler(req2, { params: Promise.resolve({ code: roomCode }) });
    const data2 = await res2.json();
    expect(data2.step).toBe(3);
    expect(data2.durationSec).toBe(1.0);
    expect(data2.points).toBe(60);

    // Step 3 -> 4 (2.0s, 40 pts)
    const req3 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });
    const res3 = await sliceStepHandler(req3, { params: Promise.resolve({ code: roomCode }) });
    const data3 = await res3.json();
    expect(data3.step).toBe(4);
    expect(data3.durationSec).toBe(2.0);
    expect(data3.points).toBe(40);

    // Step 4 -> 5 (4.0s, 20 pts)
    const req4 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });
    const res4 = await sliceStepHandler(req4, { params: Promise.resolve({ code: roomCode }) });
    const data4 = await res4.json();
    expect(data4.step).toBe(5);
    expect(data4.durationSec).toBe(4.0);
    expect(data4.points).toBe(20);

    // Once at step 5, further calls return success: true with step 5 info
    const req5 = new NextRequest(`http://localhost:3000/api/room/${roomCode}/slice-step`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });
    const res5 = await sliceStepHandler(req5, { params: Promise.resolve({ code: roomCode }) });
    const data5 = await res5.json();
    expect(res5.status).toBe(200);
    expect(data5.success).toBe(true);
    expect(data5.step).toBe(5);
    expect(data5.durationSec).toBe(4.0);
    expect(data5.points).toBe(20);
    expect(data5.sliceUrl).toContain("duration=4");
  });
});
