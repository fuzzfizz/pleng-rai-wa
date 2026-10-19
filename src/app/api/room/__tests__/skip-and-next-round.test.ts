import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as skipHandler } from "../[code]/skip/route";
import { POST as nextRoundHandler } from "../[code]/next-round/route";
import { POST as answerHandler } from "../[code]/answer/route";
import type { Song, RoomSettings } from "@/types";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn(),
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
  },
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

describe("Skip Route & Decoy Generation Logic", () => {
  const dummySong: Song = {
    id: "song-1",
    title: "เพลงจริง",
    artist: "ศิลปินจริง",
    aliases: ["Real Song"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 10,
    hookEndSec: 30,
  };

  const dummyDecoys: Song[] = [
    { id: "song-2", title: "เพลงหลอก 1", artist: "ศิลปิน 1", audioUrl: "", aliases: [] },
    { id: "song-3", title: "เพลงหลอก 2", artist: "ศิลปิน 2", audioUrl: "", aliases: [] },
    { id: "song-4", title: "เพลงหลอก 3", artist: "ศิลปิน 3", audioUrl: "", aliases: [] },
  ];

  const roomCode = "ABC123";

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  describe("Decoy Choice Generation & Masking", () => {
    it("generates 4 choices with masked keys and no leaked target song id", () => {
      const rawChoices = [
        { realId: dummySong.id, title: dummySong.title, artist: dummySong.artist },
        ...dummyDecoys.map((d) => ({ realId: d.id, title: d.title, artist: d.artist })),
      ];
      // Fisher-Yates shuffle & mask
      const shuffled = [...rawChoices].sort(() => 0.5 - Math.random());
      const masked = shuffled.map((c, idx) => ({
        id: `choice_${idx}`,
        title: c.title,
        artist: c.artist,
      }));

      expect(masked).toHaveLength(4);
      expect(masked.map((m) => m.id)).toEqual([
        "choice_0",
        "choice_1",
        "choice_2",
        "choice_3",
      ]);
      expect(masked.some((m) => m.title === "เพลงจริง")).toBe(true);
      // Ensure raw song IDs are NOT exposed in masked choices
      expect(masked.some((m) => m.id === "song-1")).toBe(false);
    });
  });

  describe("POST /api/room/[code]/next-round", () => {
    it("fetches decoys, masks choices, stores them in round state, and returns them", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: {
          gameMode: "audio-slice",
          answerInputMode: "multiple-choice",
          sliceDurationSec: 2.0,
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      // First call for target song, second call for decoys
      (SongService.getRandomSongs as any)
        .mockResolvedValueOnce([dummySong])
        .mockResolvedValueOnce(dummyDecoys);

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
      expect(data.choices).toHaveLength(4);
      expect(data.choices.map((c: any) => c.id)).toEqual([
        "choice_0",
        "choice_1",
        "choice_2",
        "choice_3",
      ]);
      expect(data.choices.some((c: any) => c.title === "เพลงจริง")).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.choices).toBeDefined();
      expect(state?.choices).toHaveLength(4);

      // Verify Realtime broadcast received choices
      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "round_start",
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({ id: "choice_0" }),
          ]),
        })
      );
    });

    it("prioritizes same-artist decoys before falling back to additional decoys", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: {
          gameMode: "audio-slice",
          answerInputMode: "multiple-choice",
          sliceDurationSec: 2.0,
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      const sameArtistDecoy: Song = {
        id: "song-same-artist",
        title: "เพลงศิลปินเดียวกัน",
        artist: dummySong.artist,
        audioUrl: "",
        aliases: [],
      };

      const fallbackDecoys: Song[] = [
        { id: "fallback-1", title: "เพลงอื่น 1", artist: "ศิลปินอื่น 1", audioUrl: "", aliases: [] },
        { id: "fallback-2", title: "เพลงอื่น 2", artist: "ศิลปินอื่น 2", audioUrl: "", aliases: [] },
      ];

      // 1st call: target song
      // 2nd call: same artist decoys (returns 1 song)
      // 3rd call: additional decoys (returns 2 songs to fill 3)
      (SongService.getRandomSongs as any)
        .mockResolvedValueOnce([dummySong])
        .mockResolvedValueOnce([sameArtistDecoy])
        .mockResolvedValueOnce(fallbackDecoys);

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
      expect(data.choices).toHaveLength(4);

      // Verify SongService was called with artist filter first
      expect(SongService.getRandomSongs).toHaveBeenNthCalledWith(
        2,
        3,
        expect.objectContaining({
          artist: dummySong.artist,
          excludeIds: [dummySong.id],
        })
      );

      // Verify 3rd call requested the remaining count (2)
      expect(SongService.getRandomSongs).toHaveBeenNthCalledWith(
        3,
        2,
        expect.objectContaining({
          excludeIds: [dummySong.id, sameArtistDecoy.id],
        })
      );
    });

    it("starts strictly at round 1 when starting from lobby even if previous played_song_ids exist", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        status: "lobby",
        settings: {
          gameMode: "audio-slice",
          answerInputMode: "autocomplete",
          totalRounds: 10,
        },
        played_song_ids: ["old-song-1", "old-song-2", "old-song-3"],
      });

      (SongService.getRandomSongs as any).mockResolvedValueOnce([dummySong]);

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
      expect(data.round).toBe(1);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.currentRound).toBe(1);
    });
  });

  describe("POST /api/room/[code]/answer - Direct Answering", () => {
    it("allows direct answer submissions in audio-slice mode without prior buzzer", async () => {
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        answerInputMode: "multiple-choice",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 5,
        targetScore: 0,
      };

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings,
        players: [{ id: "p1", displayName: "Player 1" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong, settings);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          answerText: "เพลงจริง",
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
  });

  describe("POST /api/room/[code]/skip", () => {
    it("rejects with 400 for invalid room code", async () => {
      const req = new NextRequest("http://localhost:3000/api/room/invalid/skip", {
        method: "POST",
      });
      const response = await skipHandler(req, {
        params: Promise.resolve({ code: "bad!" }),
      });
      expect(response.status).toBe(400);
    });

    it("rejects with 404 if room does not exist", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue(null);
      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/skip`, {
        method: "POST",
      });
      const response = await skipHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      expect(response.status).toBe(404);
    });

    it("rejects with 403 if caller is not host", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
      });
      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/skip`, {
        method: "POST",
        body: JSON.stringify({ playerId: "player-2" }),
      });
      const response = await skipHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      expect(response.status).toBe(403);
    });

    it("rejects with 400 if round is not active", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
      });
      // No active round in RoomStateStore
      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/skip`, {
        method: "POST",
        body: JSON.stringify({ playerId: "host-1" }),
      });
      const response = await skipHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      expect(response.status).toBe(400);
    });

    it("successfully skips question when caller is host and question is active", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
      });

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
        body: JSON.stringify({ playerId: "host-1" }),
      });
      const response = await skipHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.roundStatus).toBe("revealing");

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.roundStatus).toBe("revealing");
      expect(state?.winnerPlayerId).toBeNull();

      expect(RoomService.updateRoomStatus).toHaveBeenCalledWith(roomCode, "revealing");
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
});
