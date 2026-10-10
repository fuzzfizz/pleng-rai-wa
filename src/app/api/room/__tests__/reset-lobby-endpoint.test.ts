import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { RedisService } from "@/lib/services/redis-service";
import { POST as resetLobbyHandler } from "../[code]/reset-lobby/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomRound: vi.fn(),
  },
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/services/redis-service", () => ({
  RedisService: {
    deleteRoom: vi.fn().mockResolvedValue(true),
  },
}));

describe("Reset Lobby Endpoint (/api/room/[code]/reset-lobby)", () => {
  const roomCode = "RESET1";
  const hostId = "host-player-123";
  const otherPlayerId = "player-456";

  const mockRoom = {
    room_code: roomCode,
    host_player_id: hostId,
    status: "playing",
    played_song_ids: ["song-1", "song-2"],
    current_song_id: "song-2",
  };

  const mockUpdatedRoom = {
    ...mockRoom,
    status: "lobby",
    played_song_ids: [],
    current_song_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  it("returns 400 when room code is invalid", async () => {
    const req = new NextRequest("http://localhost/api/room/INVALID_CODE/reset-lobby", {
      method: "POST",
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: "TOO_LONG_123" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("รหัสห้องไม่ถูกต้อง");
  });

  it("returns 404 when room does not exist", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(null);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("ไม่พบห้องนี้ในระบบ");
  });

  it("returns 403 when non-host playerId is provided in body", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: otherPlayerId }),
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("ไม่มีสิทธิ์ยกเลิกเกม (เฉพาะ Host เท่านั้น)");
    expect(RoomService.updateRoomRound).not.toHaveBeenCalled();
  });

  it("returns 403 when non-host sessionToken is provided in body", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: otherPlayerId }),
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("ไม่มีสิทธิ์ยกเลิกเกม (เฉพาะ Host เท่านั้น)");
    expect(RoomService.updateRoomRound).not.toHaveBeenCalled();
  });

  it("returns 403 when non-host Bearer token is provided in Authorization header", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${otherPlayerId}`,
      },
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("ไม่มีสิทธิ์ยกเลิกเกม (เฉพาะ Host เท่านั้น)");
    expect(RoomService.updateRoomRound).not.toHaveBeenCalled();
  });

  it("authorizes host via body.playerId and resets room state cleanly", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
    (RoomService.updateRoomRound as any).mockResolvedValue(mockUpdatedRoom);

    const resetRoomSpy = vi.spyOn(RoomStateStore, "resetRoom");

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: hostId }),
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.room).toEqual(mockUpdatedRoom);

    expect(RoomService.updateRoomRound).toHaveBeenCalledWith(roomCode, {
      status: "lobby",
      playedSongIds: [],
      currentSongId: null,
      roundState: null,
    });

    expect(resetRoomSpy).toHaveBeenCalledWith(roomCode);
    expect(RedisService.deleteRoom).toHaveBeenCalledWith(roomCode);

    expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
      roomCode,
      "room_state",
      {
        status: "lobby",
        round: 0,
        scores: {},
        room: mockUpdatedRoom,
      }
    );
  });

  it("authorizes host via body.sessionToken", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
    (RoomService.updateRoomRound as any).mockResolvedValue(mockUpdatedRoom);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: hostId }),
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("authorizes host via Authorization Bearer header", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
    (RoomService.updateRoomRound as any).mockResolvedValue(mockUpdatedRoom);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hostId}`,
      },
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("allows reset without any token for backward compatibility (e.g. server reset)", async () => {
    (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
    (RoomService.updateRoomRound as any).mockResolvedValue(mockUpdatedRoom);

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 500 when an unexpected exception occurs", async () => {
    (RoomService.getRoomByCode as any).mockRejectedValue(new Error("Database connection lost"));

    const req = new NextRequest(`http://localhost/api/room/${roomCode}/reset-lobby`, {
      method: "POST",
    });

    const res = await resetLobbyHandler(req, {
      params: Promise.resolve({ code: roomCode }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Database connection lost");
  });
});
