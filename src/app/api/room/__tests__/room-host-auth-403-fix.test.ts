import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomService } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { RoomStateStore } from "@/lib/room-state-store";
import { POST as nextRoundHandler } from "../[code]/next-round/route";
import { POST as settingsHandler } from "../[code]/settings/route";
import { POST as skipHandler } from "../[code]/skip/route";
import { NextRequest } from "next/server";
import type { Song, RoomSettings } from "@/types";

vi.mock("@/lib/services/room-service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    RoomService: {
      ...actual.RoomService,
      isCallerHost: actual.RoomService.isCallerHost,
      getRoomByCode: vi.fn(),
      updateRoomSettings: vi.fn(),
      updateRoomStatus: vi.fn(),
      updateRoomRound: vi.fn().mockResolvedValue({}),
      updateRoomRoundState: vi.fn().mockResolvedValue({}),
    },
    DEFAULT_ROOM_SETTINGS: actual.DEFAULT_ROOM_SETTINGS,
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

describe("Issue 5 & Issue 4: Room Host Auth & 403 Prevention Fix", () => {
  const roomCode = "AUTH43";
  const hostPlayerId = "host-player-uuid-1111";
  const hostSessionToken = "host-session-uuid-2222";
  const nonHostPlayerId = "guest-player-uuid-3333";
  const nonHostSessionToken = "guest-session-uuid-4444";

  const dummySong: Song = {
    id: "song-auth-1",
    title: "รักแรกพบ",
    artist: "Tattoo Colour",
    audioUrl: "https://example.com/song1.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
    aliases: [],
  };

  const mockRoom = {
    room_code: roomCode,
    host_player_id: hostPlayerId,
    status: "lobby",
    played_song_ids: [],
    settings: {
      gameMode: "audio-slice",
      answerInputMode: "autocomplete",
      totalRounds: 10,
      players: [
        {
          id: hostPlayerId,
          displayName: "Host Player",
          isHost: true,
          sessionToken: hostSessionToken,
          score: 0,
        },
        {
          id: nonHostPlayerId,
          displayName: "Guest Player",
          isHost: false,
          sessionToken: nonHostSessionToken,
          score: 0,
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  describe("1. RoomService.isCallerHost Unit Verification", () => {
    it("returns true when token matches room.host_player_id directly", () => {
      const isHost = RoomService.isCallerHost(mockRoom, [hostPlayerId]);
      expect(isHost).toBe(true);
    });

    it("returns true when token matches room.hostPlayerId directly", () => {
      const camelCaseRoom = { hostPlayerId: "camel-host-id" };
      const isHost = RoomService.isCallerHost(camelCaseRoom, ["camel-host-id"]);
      expect(isHost).toBe(true);
    });

    it("returns true when token matches host's sessionToken (different from host_player_id)", () => {
      // Root cause scenario: sessionToken !== host_player_id
      expect(hostSessionToken).not.toBe(hostPlayerId);
      const isHost = RoomService.isCallerHost(mockRoom, [hostSessionToken]);
      expect(isHost).toBe(true);
    });

    it("returns true when candidateTokens has multiple values including hostSessionToken or hostPlayerId", () => {
      const isHost = RoomService.isCallerHost(mockRoom, [
        undefined,
        null,
        "",
        hostSessionToken,
        hostPlayerId,
      ]);
      expect(isHost).toBe(true);
    });

    it("returns false for non-host player id and non-host sessionToken", () => {
      const isHost = RoomService.isCallerHost(mockRoom, [nonHostPlayerId, nonHostSessionToken]);
      expect(isHost).toBe(false);
    });

    it("returns false for unknown random tokens", () => {
      const isHost = RoomService.isCallerHost(mockRoom, ["random-token-xyz"]);
      expect(isHost).toBe(false);
    });

    it("returns false when candidate tokens are empty or undefined", () => {
      expect(RoomService.isCallerHost(mockRoom, [])).toBe(false);
      expect(RoomService.isCallerHost(mockRoom, [undefined, null, "   "])).toBe(false);
      expect(RoomService.isCallerHost(null, [hostPlayerId])).toBe(false);
      expect(RoomService.isCallerHost(undefined, [hostPlayerId])).toBe(false);
    });
  });

  describe("2. POST /api/room/[code]/next-round Host Auth & 403 Fix", () => {
    it("succeeds (200) when host starts game using sessionToken (sessionToken !== host_player_id)", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
      (SongService.getRandomSongs as any).mockResolvedValueOnce([dummySong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: hostSessionToken,
          playerId: hostPlayerId,
          isNewGame: true,
        }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.round).toBe(1);
    });

    it("succeeds (200) when host starts game using sessionToken alone without playerId in body", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
      (SongService.getRandomSongs as any).mockResolvedValueOnce([dummySong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: hostSessionToken,
          isNewGame: true,
        }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("succeeds (200) when host sends Authorization Bearer header", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
      (SongService.getRandomSongs as any).mockResolvedValueOnce([dummySong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hostSessionToken}`,
        },
        body: JSON.stringify({
          isNewGame: true,
        }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("rejects (403) with error when non-host player attempts to start game", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: nonHostSessionToken,
          playerId: nonHostPlayerId,
        }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("เฉพาะ Host เท่านั้น");
    });
  });

  describe("3. POST /api/room/[code]/settings Host Auth & 403 Fix", () => {
    it("succeeds (200) when host updates settings using sessionToken (sessionToken !== host_player_id)", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
      const updatedMock = {
        ...mockRoom,
        settings: {
          ...mockRoom.settings,
          totalRounds: 15,
        },
      };
      (RoomService.updateRoomSettings as any).mockResolvedValue(updatedMock);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/settings`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: hostSessionToken,
          playerId: hostPlayerId,
          settings: { totalRounds: 15 },
        }),
      });

      const res = await settingsHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(RoomService.updateRoomSettings).toHaveBeenCalledWith(roomCode, { totalRounds: 15 });
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "room_settings",
        expect.any(Object)
      );
    });

    it("succeeds (200) when host updates settings via Authorization Bearer token", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);
      (RoomService.updateRoomSettings as any).mockResolvedValue({
        ...mockRoom,
        settings: { ...mockRoom.settings, sliceDurationSec: 5.0 },
      });

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/settings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hostSessionToken}`,
        },
        body: JSON.stringify({
          settings: { sliceDurationSec: 5.0 },
        }),
      });

      const res = await settingsHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("rejects (403) with error when non-host attempts to update settings", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(mockRoom);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/settings`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: nonHostSessionToken,
          playerId: nonHostPlayerId,
          settings: { totalRounds: 20 },
        }),
      });

      const res = await settingsHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("เฉพาะ Host เท่านั้น");
      expect(RoomService.updateRoomSettings).not.toHaveBeenCalled();
    });
  });

  describe("4. POST /api/room/[code]/skip Host Auth", () => {
    it("succeeds (200) when host calls skip with hostSessionToken", async () => {
      const activeRoom = {
        ...mockRoom,
        status: "question_active",
        current_song_id: dummySong.id,
      };
      (RoomService.getRoomByCode as any).mockResolvedValue(activeRoom);
      (SongService.getSongById as any).mockResolvedValue(dummySong);
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        answerInputMode: "multiple-choice",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 5,
        targetScore: 0,
      };
      RoomStateStore.initRound(roomCode, 1, dummySong, settings);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/skip`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: hostSessionToken,
          playerId: hostPlayerId,
        }),
      });

      const res = await skipHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("rejects (403) when non-host calls skip", async () => {
      const activeRoom = {
        ...mockRoom,
        status: "question_active",
        current_song_id: dummySong.id,
      };
      (RoomService.getRoomByCode as any).mockResolvedValue(activeRoom);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/skip`, {
        method: "POST",
        body: JSON.stringify({
          sessionToken: nonHostSessionToken,
          playerId: nonHostPlayerId,
        }),
      });

      const res = await skipHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });
});
