import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as nextRoundHandler } from "../[code]/next-round/route";
import {
  reduceRoomRealtimeEvent,
  createInitialRoomRealtimeState,
} from "@/hooks/use-room-realtime";
import { RoomService } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { cleanLyricsForGame } from "@/lib/lyrics-cleaner";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";
import type { Song, RoomSettings } from "@/types";

describe("Lyrics Not Found & Active Question Rehydration Fix", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. useRoomRealtime init_room rehydration", () => {
    it("rehydrates activeQuestion when room status is question_active and roundState is present", () => {
      const state = createInitialRoomRealtimeState("TEST1");
      const action = {
        type: "init_room" as const,
        room: {
          code: "TEST1",
          status: "question_active",
          current_round: 2,
          settings: { totalRounds: 5, gameMode: "translated-lyrics" },
          roundState: {
            sliceUrl: "/api/audio/slice?id=song1&start=0&duration=2",
            sliceDurationSec: 2,
            lyrics: "Even though my whole life falls apart",
            choices: [],
            startedAt: "2026-10-28T12:00:00Z",
          },
        },
      };

      const next = reduceRoomRealtimeEvent(state, action, { playSounds: false });
      expect(next.status).toBe("question_active");
      expect(next.activeQuestion).toBeDefined();
      expect(next.activeQuestion?.lyrics).toBe("Even though my whole life falls apart");
      expect(next.activeQuestion?.sliceUrl).toBe("/api/audio/slice?id=song1&start=0&duration=2");
      expect(next.activeQuestion?.durationSec).toBe(2);
    });

    it("rehydrates activeQuestion when room status is buzzed or revealing", () => {
      const state = createInitialRoomRealtimeState("TEST2");
      const actionBuzzed = {
        type: "init_room" as const,
        room: {
          code: "TEST2",
          status: "buzzed",
          roundState: {
            sliceUrl: "/api/audio/slice?id=song2",
            sliceDurationSec: 3,
            lyrics: "ซ่อนกลิ่น",
          },
        },
      };

      const nextBuzzed = reduceRoomRealtimeEvent(state, actionBuzzed, { playSounds: false });
      expect(nextBuzzed.activeQuestion).toBeDefined();
      expect(nextBuzzed.activeQuestion?.lyrics).toBe("ซ่อนกลิ่น");

      const actionRevealing = {
        type: "init_room" as const,
        room: {
          code: "TEST2",
          status: "revealing",
          roundState: {
            sliceUrl: "/api/audio/slice?id=song2",
            sliceDurationSec: 3,
            lyrics: "ซ่อนกลิ่น",
          },
        },
      };

      const nextRevealing = reduceRoomRealtimeEvent(state, actionRevealing, { playSounds: false });
      expect(nextRevealing.activeQuestion).toBeDefined();
      expect(nextRevealing.activeQuestion?.lyrics).toBe("ซ่อนกลิ่น");
    });

    it("does not populate activeQuestion when room is in lobby", () => {
      const state = createInitialRoomRealtimeState("TEST3");
      const actionLobby = {
        type: "init_room" as const,
        room: {
          code: "TEST3",
          status: "lobby",
          roundState: null,
        },
      };

      const nextLobby = reduceRoomRealtimeEvent(state, actionLobby, { playSounds: false });
      expect(nextLobby.activeQuestion).toBeNull();
    });
  });

  describe("2. Next-Round Route Lyrics Cleaning & Fallback", () => {
    it("strips song title and artist header lines from lyrics before sending", async () => {
      const roomCode = "CLNLRC";
      const hostToken = "host-token-123";

      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue({
        id: "room-1",
        code: roomCode,
        host_player_id: hostToken,
        hostPlayerId: hostToken,
        status: "question_active",
        current_round: 1,
        played_song_ids: [],
        settings: {
          gameMode: "ai-lyrics",
          lyricsType: "full",
          totalRounds: 5,
        },
      } as any);

      const songWithHeaders: Song = {
        id: "song-with-header",
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: [],
        audioUrl: "https://example.com/watjai.mp3",
        lyricsFull: `เพลง: วัดใจ
ศิลปิน: Silly Fools
คำร้อง/ทำนอง: Silly Fools

แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย`,
      };

      vi.spyOn(SongService, "getRandomSongs").mockResolvedValue([songWithHeaders]);
      vi.spyOn(RoomService, "updateRoomRound").mockResolvedValue({} as any);
      vi.spyOn(RealtimeBroadcastService, "broadcast").mockResolvedValue(undefined as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: hostToken }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.lyrics).toBeDefined();
      expect(data.lyrics).not.toContain("เพลง:");
      expect(data.lyrics).not.toContain("ศิลปิน:");
      expect(data.lyrics).not.toContain("Silly Fools");
      expect(data.lyrics).toContain("แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย");
    });

    it("falls back to DEMO_SONGS if picked song has no lyrics in any field for ai-lyrics mode and keeps song and lyrics 100% synchronized", async () => {
      const roomCode = "FBKLRC";
      const hostToken = "host-token-456";

      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue({
        id: "room-2",
        code: roomCode,
        host_player_id: hostToken,
        hostPlayerId: hostToken,
        status: "question_active",
        current_round: 1,
        played_song_ids: [],
        settings: {
          gameMode: "ai-lyrics",
          lyricsType: "chorus",
          totalRounds: 5,
        },
      } as any);

      const songWithoutLyrics: Song = {
        id: "song-no-lyrics",
        title: "ไม่มีเนื้อเพลง",
        artist: "นักดนตรี",
        aliases: [],
        audioUrl: "https://example.com/no-lyrics.mp3",
        lyricsIntro: "",
        lyricsChorus: "",
        lyricsFull: "",
      };

      const getRandomSongsSpy = vi.spyOn(SongService, "getRandomSongs").mockResolvedValue([songWithoutLyrics]);
      const updateRoomRoundSpy = vi.spyOn(RoomService, "updateRoomRound").mockResolvedValue({} as any);
      vi.spyOn(RealtimeBroadcastService, "broadcast").mockResolvedValue(undefined as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: hostToken }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(getRandomSongsSpy).toHaveBeenCalledWith(1, expect.objectContaining({ hasLyrics: true }));

      // Strict Song-Lyrics Integrity verification:
      // Both song and lyrics MUST belong to the exact same fallback song (DEMO_SONGS[0])
      const roundState = RoomStateStore.getRoomRoundState(roomCode);
      expect(roundState).toBeDefined();
      expect(roundState?.currentSong?.id).toBe(DEMO_SONGS[0].id);
      expect(roundState?.currentSong?.title).toBe(DEMO_SONGS[0].title);
      expect(roundState?.currentSong?.artist).toBe(DEMO_SONGS[0].artist);
      expect(roundState?.lyrics).toBe(data.lyrics);
      expect(data.lyrics).toContain("มีแค่ใจดวงเดียวดวงนี้");

      // Verify updateRoomRound received the synchronized demo song ID, not the no-lyrics song
      expect(updateRoomRoundSpy).toHaveBeenCalledWith(
        roomCode,
        expect.objectContaining({ currentSongId: DEMO_SONGS[0].id })
      );
    });

    it("ensures lyrics is never empty and matches song entity when gameMode is translated-lyrics", async () => {
      const roomCode = "TRNLRC";
      const hostToken = "host-token-789";

      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue({
        id: "room-3",
        code: roomCode,
        host_player_id: hostToken,
        hostPlayerId: hostToken,
        status: "question_active",
        current_round: 1,
        played_song_ids: [],
        settings: {
          gameMode: "translated-lyrics",
          lyricsType: "full",
          totalRounds: 5,
        },
      } as any);

      const songEmptyLyrics: Song = {
        id: "song-empty",
        title: "เพลงเปล่า",
        artist: "ศิลปินเปล่า",
        aliases: [],
        audioUrl: "https://example.com/empty.mp3",
      };

      const getRandomSongsSpy = vi.spyOn(SongService, "getRandomSongs").mockResolvedValue([songEmptyLyrics]);
      vi.spyOn(RoomService, "updateRoomRound").mockResolvedValue({} as any);
      vi.spyOn(RealtimeBroadcastService, "broadcast").mockResolvedValue(undefined as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: hostToken }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(getRandomSongsSpy).toHaveBeenCalledWith(1, expect.objectContaining({ hasLyrics: true }));
      expect(data.lyrics).toBeDefined();
      expect(typeof data.lyrics).toBe("string");
      expect(data.lyrics.trim().length).toBeGreaterThan(0);

      const roundState = RoomStateStore.getRoomRoundState(roomCode);
      expect(roundState?.currentSong?.id).toBe(DEMO_SONGS[0].id);
      expect(roundState?.lyrics).toBe(data.lyrics);
    });

    it("ends game cleanly with reason 'no_more_songs' when SongService returns 0 songs with lyrics in lyrics mode", async () => {
      const roomCode = "NOLYRC";
      const hostToken = "host-token-no-lyrics";

      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue({
        id: "room-nolyrics",
        code: roomCode,
        host_player_id: hostToken,
        hostPlayerId: hostToken,
        status: "question_active",
        current_round: 2,
        played_song_ids: ["song-1", "song-2"],
        settings: {
          gameMode: "ai-lyrics",
          lyricsType: "full",
          totalRounds: 5,
        },
      } as any);

      vi.spyOn(SongService, "getRandomSongs").mockResolvedValue([]);
      const updateRoomStatusSpy = vi.spyOn(RoomService, "updateRoomStatus").mockResolvedValue({} as any);
      const broadcastSpy = vi.spyOn(RealtimeBroadcastService, "broadcast").mockResolvedValue(undefined as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: hostToken }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.gameOver).toBe(true);
      expect(data.reason).toBe("no_more_songs");
      expect(data.message).toBe("เล่นครบทุกเพลงที่มีเนื้อเพลงในคลังแล้ว (รวม 2 ข้อ)");

      expect(updateRoomStatusSpy).toHaveBeenCalledWith(roomCode, "game_over");
      expect(broadcastSpy).toHaveBeenCalledWith(
        roomCode,
        "game_over",
        expect.objectContaining({
          gameOver: true,
          reason: "no_more_songs",
          message: "เล่นครบทุกเพลงที่มีเนื้อเพลงในคลังแล้ว (รวม 2 ข้อ)",
        })
      );
    });

    it("ends game cleanly when song has no lyrics and all demo songs are already exhausted", async () => {
      const roomCode = "EXHDEM";
      const hostToken = "host-token-exh";

      const allDemoIds = DEMO_SONGS.map((d) => d.id);

      vi.spyOn(RoomService, "getRoomByCode").mockResolvedValue({
        id: "room-exh",
        code: roomCode,
        host_player_id: hostToken,
        hostPlayerId: hostToken,
        status: "question_active",
        current_round: 3,
        played_song_ids: [...allDemoIds],
        settings: {
          gameMode: "ai-lyrics",
          lyricsType: "chorus",
          totalRounds: 5,
        },
      } as any);

      const emptySong: Song = {
        id: "empty-song-id",
        title: "ไม่มีเนื้อ",
        artist: "ไม่มีศิลปิน",
        aliases: [],
        audioUrl: "https://example.com/audio.mp3",
      };

      vi.spyOn(SongService, "getRandomSongs").mockResolvedValue([emptySong]);
      const updateRoomStatusSpy = vi.spyOn(RoomService, "updateRoomStatus").mockResolvedValue({} as any);
      vi.spyOn(RealtimeBroadcastService, "broadcast").mockResolvedValue(undefined as any);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: hostToken }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.gameOver).toBe(true);
      expect(data.reason).toBe("no_more_songs");
      expect(data.message).toBe("เล่นครบทุกเพลงที่มีเนื้อเพลงในคลังแล้ว (รวม 3 ข้อ)");
      expect(updateRoomStatusSpy).toHaveBeenCalledWith(roomCode, "game_over");
    });
  });
});
