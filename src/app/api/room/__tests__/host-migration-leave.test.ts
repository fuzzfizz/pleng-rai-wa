import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as leaveHandler } from "../[code]/leave/route";
import { POST as joinHandler } from "../join/route";
import { RoomService } from "@/lib/services/room-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { RedisService } from "@/lib/services/redis-service";
import {
  reduceRoomRealtimeEvent,
  createInitialRoomRealtimeState,
} from "@/hooks/use-room-realtime";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    deleteRoomByCode: vi.fn().mockResolvedValue(true),
    transferHost: vi.fn().mockResolvedValue({}),
    updateRoomSettings: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/room-state-store", () => ({
  RoomStateStore: {
    deleteRoom: vi.fn(),
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

describe("Host Migration & Active Room Retention on Leave (/api/room/[code]/leave)", () => {
  const roomCode = "HOSTMG";
  const initialHostId = "host-player-1";
  const guestPlayer1Id = "guest-player-2";
  const guestPlayer2Id = "guest-player-3";

  const createMockRoom = (overrides?: any) => ({
    id: "room-uuid-1",
    room_code: roomCode,
    host_player_id: initialHostId,
    status: "lobby",
    settings: {
      gameMode: "audio-slice",
      hostDisplayName: "ดีเจเจ้าของห้อง",
      hostAvatar: "👑",
      playerCount: 3,
      players: [
        {
          id: initialHostId,
          displayName: "ดีเจเจ้าของห้อง",
          avatarUrl: "👑",
          isHost: true,
        },
        {
          id: guestPlayer1Id,
          displayName: "เซียนเพลงหนึ่ง",
          avatarUrl: "🦊",
          isHost: false,
        },
        {
          id: guestPlayer2Id,
          displayName: "เซียนเพลงสอง",
          avatarUrl: "🐼",
          isHost: false,
        },
      ],
      ...overrides?.settings,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Host Leaves & Migrates Ownership (Room Stays Active)
  // =========================================================================
  describe("1. Host Migration & Room Retention", () => {
    it("does NOT delete room when host leaves if other players remain, elects new host and updates Supabase", async () => {
      const mockRoom = createMockRoom();
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const remainingPlayers = [
        {
          id: guestPlayer1Id,
          displayName: "เซียนเพลงหนึ่ง",
          avatarUrl: "🦊",
          isHost: false,
        },
        {
          id: guestPlayer2Id,
          displayName: "เซียนเพลงสอง",
          avatarUrl: "🐼",
          isHost: false,
        },
      ];

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: initialHostId,
          isHost: true,
          remainingPlayers,
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.migrated).toBe(true);
      expect(data.newHostPlayerId).toBe(guestPlayer1Id);
      expect(data.remainingCount).toBe(2);

      // Verify room was NOT deleted
      expect(RoomService.deleteRoomByCode).not.toHaveBeenCalled();
      expect(RoomStateStore.deleteRoom).not.toHaveBeenCalled();

      // Verify host transfer in Supabase
      expect(RoomService.transferHost).toHaveBeenCalledWith(roomCode, guestPlayer1Id);

      // Verify settings update in Supabase
      expect(RoomService.updateRoomSettings).toHaveBeenCalledWith(
        roomCode,
        expect.objectContaining({
          hostDisplayName: "เซียนเพลงหนึ่ง",
          hostAvatar: "🦊",
          playerCount: 2,
          players: expect.arrayContaining([
            expect.objectContaining({ id: guestPlayer1Id, isHost: true }),
            expect.objectContaining({ id: guestPlayer2Id, isHost: false }),
          ]),
        })
      );

      // Verify Realtime Broadcasts: host_changed, room_settings, player_left
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "host_changed",
        expect.objectContaining({
          newHostPlayerId: guestPlayer1Id,
          hostDisplayName: "เซียนเพลงหนึ่ง",
          hostAvatar: "🦊",
          formerHostPlayerId: initialHostId,
          remainingCount: 2,
        })
      );

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "room_settings",
        expect.objectContaining({
          settings: expect.objectContaining({
            hostDisplayName: "เซียนเพลงหนึ่ง",
            hostAvatar: "🦊",
            playerCount: 2,
          }),
        })
      );

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "player_left",
        expect.objectContaining({
          playerId: initialHostId,
          remainingCount: 2,
        })
      );
    });

    it("honors candidateHost passed explicitly in request body", async () => {
      const mockRoom = createMockRoom();
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const remainingPlayers = [
        {
          id: guestPlayer1Id,
          displayName: "เซียนเพลงหนึ่ง",
          avatarUrl: "🦊",
          isHost: false,
        },
        {
          id: guestPlayer2Id,
          displayName: "เซียนเพลงสอง",
          avatarUrl: "🐼",
          isHost: false,
        },
      ];

      const candidateHost = {
        id: guestPlayer2Id,
        displayName: "เซียนเพลงสอง",
        avatarUrl: "🐼",
      };

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: initialHostId,
          isHost: true,
          remainingPlayers,
          candidateHost,
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.migrated).toBe(true);
      expect(data.newHostPlayerId).toBe(guestPlayer2Id);

      expect(RoomService.transferHost).toHaveBeenCalledWith(roomCode, guestPlayer2Id);
      expect(RoomService.updateRoomSettings).toHaveBeenCalledWith(
        roomCode,
        expect.objectContaining({
          hostDisplayName: "เซียนเพลงสอง",
          hostAvatar: "🐼",
        })
      );
    });

    it("skips TV view spectators and elects active human player when auto-electing host", async () => {
      const mockRoom = createMockRoom();
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const remainingPlayers = [
        {
          id: "tv-spectator-id",
          displayName: "ทีวีจอปาร์ตี้ (TV)",
          avatarUrl: "📺",
          isHost: false,
        },
        {
          id: guestPlayer1Id,
          displayName: "ผู้เล่นมือถือ",
          avatarUrl: "🐯",
          isHost: false,
        },
      ];

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: initialHostId,
          isHost: true,
          remainingPlayers,
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(data.newHostPlayerId).toBe(guestPlayer1Id);
      expect(RoomService.transferHost).toHaveBeenCalledWith(roomCode, guestPlayer1Id);
    });

    it("falls back to database room.settings.players when remainingPlayers is omitted from body", async () => {
      const mockRoom = createMockRoom();
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: initialHostId,
          isHost: true,
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.migrated).toBe(true);
      expect(data.newHostPlayerId).toBe(guestPlayer1Id);
      expect(RoomService.deleteRoomByCode).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Empty Room Deletion (All Players Have Left)
  // =========================================================================
  describe("2. Empty Room Deletion", () => {
    it("deletes room immediately when host leaves and was the only player in the room", async () => {
      const singlePlayerRoom = createMockRoom({
        settings: {
          playerCount: 1,
          players: [
            {
              id: initialHostId,
              displayName: "ดีเจเจ้าของห้อง",
              avatarUrl: "👑",
              isHost: true,
            },
          ],
        },
      });
      (RoomService.getRoomByCode as any).mockResolvedValue(singlePlayerRoom);

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: initialHostId,
          isHost: true,
          remainingPlayers: [],
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deleted).toBe(true);
      expect(RoomService.deleteRoomByCode).toHaveBeenCalledWith(roomCode);
      expect(RoomStateStore.deleteRoom).toHaveBeenCalledWith(roomCode);
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "room_dissolved",
        expect.any(Object)
      );
    });

    it("deletes room immediately when the last guest leaves and remainingCount reaches 0", async () => {
      const singleGuestRoom = createMockRoom({
        host_player_id: "former-host-id",
        settings: {
          playerCount: 1,
          players: [
            {
              id: guestPlayer1Id,
              displayName: "เซียนเพลงหนึ่ง",
              avatarUrl: "🦊",
              isHost: false,
            },
          ],
        },
      });
      (RoomService.getRoomByCode as any).mockResolvedValue(singleGuestRoom);

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: guestPlayer1Id,
          isHost: false,
          remainingPlayers: [],
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deleted).toBe(true);
      expect(RoomService.deleteRoomByCode).toHaveBeenCalledWith(roomCode);
    });
  });

  // =========================================================================
  // 3. Normal Guest Leaves with Host & Others Remaining
  // =========================================================================
  describe("3. Non-host Guest Departure", () => {
    it("updates remaining playerCount and players list without transferring host", async () => {
      const mockRoom = createMockRoom();
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const remainingPlayers = [
        {
          id: initialHostId,
          displayName: "ดีเจเจ้าของห้อง",
          avatarUrl: "👑",
          isHost: true,
        },
        {
          id: guestPlayer2Id,
          displayName: "เซียนเพลงสอง",
          avatarUrl: "🐼",
          isHost: false,
        },
      ];

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: guestPlayer1Id,
          isHost: false,
          remainingPlayers,
        }),
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.remainingCount).toBe(2);

      expect(RoomService.transferHost).not.toHaveBeenCalled();
      expect(RoomService.deleteRoomByCode).not.toHaveBeenCalled();
      expect(RoomService.updateRoomSettings).toHaveBeenCalledWith(
        roomCode,
        expect.objectContaining({
          playerCount: 2,
        })
      );
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "player_left",
        expect.objectContaining({
          playerId: guestPlayer1Id,
          remainingCount: 2,
        })
      );
    });
  });

  // =========================================================================
  // 4. Edge Cases & Error Handling
  // =========================================================================
  describe("4. Edge Cases", () => {
    it("returns 400 for invalid room code", async () => {
      const req = new NextRequest("http://localhost/api/room/INVALID_LONG_CODE/leave", {
        method: "POST",
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: "BAD_CODE_123" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it("returns 200 message when room is already deleted", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(null);

      const req = new NextRequest(`http://localhost/api/room/${roomCode}/leave`, {
        method: "POST",
      });

      const res = await leaveHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("ห้องถูกลบไปแล้ว");
    });
  });

  // =========================================================================
  // 5. Join Route updates room.settings.players (Requirement 8)
  // =========================================================================
  describe("5. Join Route room.settings.players Tracking", () => {
    it("updates room.settings.players when a new guest joins", async () => {
      const mockRoom = createMockRoom();
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const req = new NextRequest("http://localhost/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          displayName: "ผู้เล่นใหม่เอี่ยม",
          avatar: "🦁",
        }),
      });

      const res = await joinHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(RoomService.updateRoomSettings).toHaveBeenCalledWith(
        roomCode,
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({
              displayName: "ผู้เล่นใหม่เอี่ยม",
              avatarUrl: "🦁",
            }),
          ]),
        })
      );
    });
  });

  // =========================================================================
  // 6. Client Realtime Reducer Host Promotion (Requirement 6)
  // =========================================================================
  describe("6. use-room-realtime State Reducer Promotion", () => {
    it("promotes player to host when receiving host_changed with their player ID", () => {
      const initialState = createInitialRoomRealtimeState(roomCode, {
        id: guestPlayer1Id,
        displayName: "เซียนเพลงหนึ่ง",
        isHost: false,
      });

      expect(initialState.isHost).toBe(false);
      expect(initialState.myPlayer?.isHost).toBe(false);

      const nextState = reduceRoomRealtimeEvent(initialState, {
        type: "broadcast",
        event: "host_changed",
        payload: {
          newHostPlayerId: guestPlayer1Id,
          hostDisplayName: "เซียนเพลงหนึ่ง",
          hostAvatar: "🦊",
          formerHostPlayerId: initialHostId,
          remainingPlayers: [
            {
              id: guestPlayer1Id,
              displayName: "เซียนเพลงหนึ่ง",
              avatarUrl: "🦊",
              isHost: true,
            },
            {
              id: guestPlayer2Id,
              displayName: "เซียนเพลงสอง",
              avatarUrl: "🐼",
              isHost: false,
            },
          ],
        },
      });

      expect(nextState.isHost).toBe(true);
      expect(nextState.myPlayer?.isHost).toBe(true);
      expect(nextState.players.find((p) => p.id === guestPlayer1Id)?.isHost).toBe(true);
      expect(nextState.players.find((p) => p.id === guestPlayer2Id)?.isHost).toBe(false);
    });

    it("updates room host without promoting self if host_changed targets another player", () => {
      const initialState = createInitialRoomRealtimeState(roomCode, {
        id: guestPlayer2Id,
        displayName: "เซียนเพลงสอง",
        isHost: false,
      });

      const nextState = reduceRoomRealtimeEvent(initialState, {
        type: "broadcast",
        event: "host_changed",
        payload: {
          newHostPlayerId: guestPlayer1Id,
          hostDisplayName: "เซียนเพลงหนึ่ง",
          hostAvatar: "🦊",
          formerHostPlayerId: initialHostId,
        },
      });

      expect(nextState.isHost).toBe(false);
      expect(nextState.myPlayer?.isHost).toBe(false);
      expect(nextState.room?.host_player_id).toBe(guestPlayer1Id);
    });
  });
});
