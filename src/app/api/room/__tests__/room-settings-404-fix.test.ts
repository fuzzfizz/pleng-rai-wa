import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as settingsHandler } from "../[code]/settings/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

describe("Room Settings 404 Prevention & Self-Healing Fix", () => {
  const roomCode = "STG404";
  const hostPlayerId = "host-player-uuid-9999";
  const hostSessionToken = "host-session-token-9999";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. RoomService.cleanupStaleRooms Extended Thresholds", () => {
    it("uses 120 minutes default threshold for lobby rooms (not 5 minutes)", async () => {
      const deleteCalls: { table: string; filters: any[] }[] = [];

      // Mock Supabase client to record delete calls and thresholds
      const mockClient = {
        from: (table: string) => {
          let isDelete = false;
          const callRecord = { table, filters: [] as any[] };
          const queryBuilder: any = {
            delete: () => {
              isDelete = true;
              return queryBuilder;
            },
            eq: (col: string, val: any) => {
              callRecord.filters.push({ type: "eq", col, val });
              return queryBuilder;
            },
            lt: (col: string, val: any) => {
              callRecord.filters.push({ type: "lt", col, val });
              return queryBuilder;
            },
            in: (col: string, val: any) => {
              callRecord.filters.push({ type: "in", col, val });
              return queryBuilder;
            },
            select: () => {
              if (isDelete) {
                deleteCalls.push(callRecord);
              }
              return Promise.resolve({ data: [] });
            },
          };
          return queryBuilder;
        },
      };

      vi.spyOn(RoomService as any, "getClient").mockReturnValue(mockClient);

      const beforeCall = Date.now();
      await RoomService.cleanupStaleRooms();
      const afterCall = Date.now();

      // We expect 3 delete queries: game_over, lobby, and inactive
      expect(deleteCalls.length).toBe(3);

      // Query 1: ended rooms (status == game_over, updated_at < endedThreshold)
      const endedQuery = deleteCalls.find(
        (c) => c.filters.some((f) => f.col === "status" && f.val === "game_over")
      );
      expect(endedQuery).toBeDefined();
      const endedLt = endedQuery!.filters.find((f) => f.type === "lt" && f.col === "updated_at");
      const endedTime = new Date(endedLt.val).getTime();
      // Should be ~60 mins ago
      expect(endedTime).toBeLessThanOrEqual(beforeCall - 59 * 60 * 1000);
      expect(endedTime).toBeGreaterThanOrEqual(afterCall - 61 * 60 * 1000);

      // Query 2: lobby rooms (status == lobby, updated_at < lobbyThreshold)
      const lobbyQuery = deleteCalls.find(
        (c) => c.filters.some((f) => f.col === "status" && f.val === "lobby")
      );
      expect(lobbyQuery).toBeDefined();
      const lobbyLt = lobbyQuery!.filters.find((f) => f.type === "lt" && f.col === "updated_at");
      const lobbyTime = new Date(lobbyLt.val).getTime();
      // Must be ~120 mins ago (2 hours), NOT 5 mins ago!
      expect(lobbyTime).toBeLessThanOrEqual(beforeCall - 119 * 60 * 1000);
      expect(lobbyTime).toBeGreaterThanOrEqual(afterCall - 121 * 60 * 1000);

      // Query 3: stale rooms (updated_at < inactiveThreshold)
      const inactiveQuery = deleteCalls.find(
        (c) => !c.filters.some((f) => f.col === "status")
      );
      expect(inactiveQuery).toBeDefined();
      const inactiveLt = inactiveQuery!.filters.find((f) => f.type === "lt" && f.col === "updated_at");
      const inactiveTime = new Date(inactiveLt.val).getTime();
      // Should be ~30 mins ago (reduced from 180 mins / 3 hours)
      expect(inactiveTime).toBeLessThanOrEqual(beforeCall - 29 * 60 * 1000);
      expect(inactiveTime).toBeGreaterThanOrEqual(afterCall - 31 * 60 * 1000);
    });

    it("does NOT delete a lobby room that is 10 or 30 minutes old", async () => {
      // Simulate that a room was updated 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      let lobbyThresholdUsed: string | null = null;
      const mockClient = {
        from: (table: string) => {
          let isLobbyQuery = false;
          const queryBuilder: any = {
            delete: () => queryBuilder,
            eq: (col: string, val: any) => {
              if (col === "status" && val === "lobby") isLobbyQuery = true;
              return queryBuilder;
            },
            lt: (col: string, val: any) => {
              if (isLobbyQuery && col === "updated_at") lobbyThresholdUsed = val;
              return queryBuilder;
            },
            select: () => Promise.resolve({ data: [] }),
          };
          return queryBuilder;
        },
      };

      vi.spyOn(RoomService as any, "getClient").mockReturnValue(mockClient);

      await RoomService.cleanupStaleRooms();

      // The room updated 30 minutes ago is NEWER than the threshold (~120 minutes ago)
      expect(lobbyThresholdUsed).not.toBeNull();
      expect(new Date(thirtyMinutesAgo).getTime()).toBeGreaterThan(new Date(lobbyThresholdUsed!).getTime());
    });
  });

  describe("2. POST /api/room/[code]/settings Self-Healing & 404 Prevention", () => {
    it("returns 200 with self-healing when getRoomByCode returns null and caller is host with sessionToken", async () => {
      // Room was cleaned up or evicted from DB
      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue(null);

      let upsertPayload: any = null;
      const mockClient = {
        from: (table: string) => ({
          upsert: (payload: any) => {
            upsertPayload = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { ...payload, id: "rehydrated-room-uuid" }, error: null }),
              }),
            };
          },
        }),
      };
      vi.spyOn(RoomService, "getClient").mockReturnValue(mockClient as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/settings`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: hostSessionToken,
          playerId: hostPlayerId,
          settings: {
            totalRounds: 15,
            gameMode: "audio-slice",
            sliceDurationSec: 3.0,
          },
        }),
      });

      const res = await settingsHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      // MUST NOT return 404!
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.room).toBeDefined();
      expect(data.room.room_code).toBe(roomCode);
      expect(data.room.host_player_id).toBe(hostPlayerId);
      expect(data.room.status).toBe("lobby");
      expect(data.room.settings.totalRounds).toBe(15);
      expect(data.room.settings.sliceDurationSec).toBe(3.0);

      // Verify realtime broadcast was triggered
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "room_settings",
        expect.objectContaining({
          room: expect.any(Object),
        })
      );
    });

    it("returns 200 with self-healing when caller passes Authorization Bearer header", async () => {
      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue(null);

      const mockClient = {
        from: (table: string) => ({
          upsert: (payload: any) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...payload, id: "rehydrated-bearer" }, error: null }),
            }),
          }),
        }),
      };
      vi.spyOn(RoomService, "getClient").mockReturnValue(mockClient as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/settings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hostSessionToken}`,
        },
        body: JSON.stringify({
          settings: {
            roundTimeoutSec: 30,
          },
        }),
      });

      const res = await settingsHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.room.room_code).toBe(roomCode);
      expect(data.room.settings.roundTimeoutSec).toBe(30);
    });

    it("returns 404 when getRoomByCode returns null and NO host candidate token is provided", async () => {
      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/settings`, {
        method: "POST",
        body: JSON.stringify({
          settings: { totalRounds: 10 },
          // No sessionToken, playerId, or Authorization header
        }),
      });

      const res = await settingsHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("ไม่พบห้องนี้ในระบบ");
    });
  });

  describe("3. RoomService.updateRoomSettings Self-Healing", () => {
    it("self-heals and upserts room if not found in DB and fallback host is provided", async () => {
      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue(null);

      let upsertData: any = null;
      const mockClient = {
        from: () => ({
          upsert: (data: any) => {
            upsertData = data;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { ...data, id: "healed-room" }, error: null }),
              }),
            };
          },
        }),
      };
      vi.spyOn(RoomService, "getClient").mockReturnValue(mockClient as any);

      const result = await RoomService.updateRoomSettings(
        roomCode,
        { totalRounds: 20 },
        { hostPlayerId, hostDisplayName: "Host Test" }
      );

      expect(result).toBeDefined();
      expect(result.room_code).toBe(roomCode);
      expect(result.host_player_id).toBe(hostPlayerId);
      expect(result.settings.totalRounds).toBe(20);
      expect(result.settings.hostDisplayName).toBe("Host Test");
    });

    it("throws Error('Room not found') when not found and no fallback host is provided", async () => {
      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue(null);

      await expect(
        RoomService.updateRoomSettings(roomCode, { totalRounds: 20 })
      ).rejects.toThrow("Room not found");
    });
  });
});
