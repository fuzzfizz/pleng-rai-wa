import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mapSongFromRow,
  mapSongToRow,
  updateSong,
  setDbClient,
  resetDbClient,
} from "@/lib/services/song-service";
import {
  toSongDomain,
  normalizeSongForClient,
  sanitizeRoundState,
} from "@/lib/room-state-store";
import { sanitizeRoomState } from "@/app/api/room/[code]/state/route";
import type { SongRow } from "@/types/database";
import type { Song, RoomSettings } from "@/types";

describe("Task 2: Lyrics Full & Next-Round Fallback Logic", () => {
  beforeEach(() => {
    resetDbClient();
  });

  afterEach(() => {
    resetDbClient();
    vi.restoreAllMocks();
  });

  describe("SongService lyricsFull mapping", () => {
    it("maps lyrics_full column from database row into lyricsFull domain property", () => {
      const mockRow: SongRow = {
        id: "song-1",
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: ["wat jai"],
        release_year: 2004,
        genre_id: null,
        era: "2000s",
        audio_url: "https://example.com/audio.mp3",
        hook_start_sec: 68,
        hook_end_sec: 94,
        duration_sec: 260,
        lyrics_intro: "แม้ทั้งชีวิตพังทลาย",
        lyrics_chorus: "มีแค่ใจดวงเดียวดวงนี้",
        lyrics_full: "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด",
        metadata: {},
        created_at: "2026-10-17T00:00:00Z",
      };

      const mapped = mapSongFromRow(mockRow);
      expect(mapped.lyricsFull).toBe(
        "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด"
      );
    });

    it("falls back to metadata.lyricsFull if row.lyrics_full is null", () => {
      const mockRow: SongRow = {
        id: "song-2",
        title: "ซ่อนกลิ่น",
        artist: "Palmy",
        aliases: [],
        release_year: 2018,
        genre_id: null,
        era: "2010s",
        audio_url: "https://example.com/audio.mp3",
        hook_start_sec: 65,
        hook_end_sec: 90,
        duration_sec: 250,
        lyrics_intro: "ลืมตาตื่นมา",
        lyrics_chorus: "คงไว้ได้แค่กลิ่น",
        lyrics_full: null,
        metadata: {
          lyricsFull: "ลืมตาตื่นมาพร้อมหยาดน้ำตา คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา",
        },
        created_at: "2026-10-17T00:00:00Z",
      };

      const mapped = mapSongFromRow(mockRow);
      expect(mapped.lyricsFull).toBe(
        "ลืมตาตื่นมาพร้อมหยาดน้ำตา คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา"
      );
    });

    it("maps lyricsFull to lyrics_full in mapSongToRow", () => {
      const songData: Partial<Song> & { lyricsFull?: string } = {
        title: "ขอบคุณที่รักกัน",
        artist: "Potato",
        audioUrl: "https://example.com/potato.mp3",
        lyricsFull: "เคยเกือบหมดหวัง และเคยเกือบถอดใจ ขอบคุณที่รักกัน",
      };

      const row = mapSongToRow(songData);
      expect(row.lyrics_full).toBe("เคยเกือบหมดหวัง และเคยเกือบถอดใจ ขอบคุณที่รักกัน");
    });

    it("supports snake_case lyrics_full in mapSongToRow", () => {
      const songData = {
        title: "ขอบคุณที่รักกัน",
        artist: "Potato",
        audio_url: "https://example.com/potato.mp3",
        lyrics_full: "เคยเกือบหมดหวัง ขอบคุณที่รักกัน",
      };

      const row = mapSongToRow(songData);
      expect(row.lyrics_full).toBe("เคยเกือบหมดหวัง ขอบคุณที่รักกัน");
    });

    it("updates lyrics_full in updateSong", async () => {
      let updatedPayload: any = null;
      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn((data: any) => {
            updatedPayload = data;
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "song-1",
                      title: "วัดใจ",
                      artist: "Silly Fools",
                      aliases: [],
                      release_year: 2004,
                      genre_id: null,
                      era: "2000s",
                      audio_url: "https://example.com/audio.mp3",
                      hook_start_sec: 68,
                      hook_end_sec: 94,
                      duration_sec: 260,
                      lyrics_intro: null,
                      lyrics_chorus: null,
                      lyrics_full: data.lyrics_full,
                      metadata: {},
                      created_at: "2026-10-17T00:00:00Z",
                      genres: null,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }),
        }),
      };

      setDbClient(mockClient);

      await updateSong("song-1", {
        lyricsFull: "เนื้อเพลงเต็มฉบับสมบูรณ์",
      });

      expect(updatedPayload).toBeDefined();
      expect(updatedPayload.lyrics_full).toBe("เนื้อเพลงเต็มฉบับสมบูรณ์");
    });
  });

  describe("RoomStateStore & Anti-Cheat Sanitization", () => {
    it("maps lyricsFull and lyrics_full in toSongDomain", () => {
      const rawWithCamel = {
        id: "song-a",
        title: "เพลง A",
        artist: "ศิลปิน A",
        audioUrl: "https://example.com/a.mp3",
        lyricsFull: "เนื้อเพลงเต็ม A",
      };
      const domain1 = toSongDomain(rawWithCamel);
      expect(domain1.lyricsFull).toBe("เนื้อเพลงเต็ม A");

      const rawWithSnake = {
        id: "song-b",
        title: "เพลง B",
        artist: "ศิลปิน B",
        audio_url: "https://example.com/b.mp3",
        lyrics_full: "เนื้อเพลงเต็ม B",
      };
      const domain2 = toSongDomain(rawWithSnake);
      expect(domain2.lyricsFull).toBe("เนื้อเพลงเต็ม B");
    });

    it("normalizeSongForClient deletes lyricsFull and lyrics_full", () => {
      const song: any = {
        id: "song-1",
        title: "วัดใจ",
        artist: "Silly Fools",
        lyricsFull: "มีแค่ใจดวงเดียวดวงนี้...",
        lyrics_full: "มีแค่ใจดวงเดียวดวงนี้...",
      };

      normalizeSongForClient(song);
      expect(song.lyricsFull).toBeUndefined();
      expect(song.lyrics_full).toBeUndefined();
    });

    it("sanitizeRoundState strips lyricsFull when round status is revealing", () => {
      const state: any = {
        roomCode: "TEST01",
        roundStatus: "revealing",
        currentSong: {
          id: "song-1",
          title: "วัดใจ",
          artist: "Silly Fools",
          lyricsChorus: "มีแค่ใจดวงเดียว",
          lyricsFull: "เนื้อเพลงเต็มทั้งหมด...",
          lyrics_full: "เนื้อเพลงเต็มทั้งหมด...",
        },
      };

      const sanitized = sanitizeRoundState(state);
      expect(sanitized.currentSong).toBeDefined();
      expect(sanitized.currentSong.title).toBe("วัดใจ");
      expect(sanitized.currentSong.lyricsFull).toBeUndefined();
      expect(sanitized.currentSong.lyrics_full).toBeUndefined();
    });

    it("sanitizeRoomState strips lyricsFull and lyrics_full during active rounds", () => {
      const room: any = {
        code: "TEST01",
        status: "question_active",
        current_song_id: "song-1",
        song: {
          id: "song-1",
          title: "วัดใจ",
          artist: "Silly Fools",
          lyricsChorus: "มีแค่ใจดวงเดียว",
          lyricsFull: "เนื้อเพลงเต็มทั้งหมด...",
          lyrics_full: "เนื้อเพลงเต็มทั้งหมด...",
        },
      };

      const sanitized = sanitizeRoomState(room);
      expect(sanitized.current_song_id).toBeNull();
      expect(sanitized.song.title).toBeUndefined();
      expect(sanitized.song.artist).toBeUndefined();
      expect(sanitized.song.lyricsChorus).toBeUndefined();
      expect(sanitized.song.lyricsFull).toBeUndefined();
      expect(sanitized.song.lyrics_full).toBeUndefined();
    });
  });

  describe("Next-Round Fallback Logic for ai-lyrics and translated-lyrics", () => {
    function prepareRawLyrics(song: Song, settings: RoomSettings): string {
      let rawThai = "";
      if (settings.lyricsType === "full") {
        rawThai = song.lyricsFull || song.lyricsChorus || song.lyricsIntro || "";
      } else if (settings.lyricsType === "intro") {
        rawThai = song.lyricsIntro || song.lyricsChorus || song.lyricsFull || "";
      } else {
        // Default to chorus; if song doesn't have chorus, fallback to lyricsFull!
        rawThai = song.lyricsChorus || song.lyricsFull || song.lyricsIntro || "";
      }
      return rawThai;
    }

    it("uses lyricsFull when lyricsType === 'full'", () => {
      const song: Song = {
        id: "song-1",
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: [],
        audioUrl: "https://example.com/audio.mp3",
        lyricsIntro: "แม้ทั้งชีวิตพังทลาย",
        lyricsChorus: "มีแค่ใจดวงเดียวดวงนี้",
        lyricsFull: "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด",
      };

      const settings: RoomSettings = {
        gameMode: "ai-lyrics",
        lyricsType: "full",
        answerInputMode: "autocomplete",
        answerResolutionMode: "race",
        maxPlayers: 8,
        totalRounds: 10,
        roundTimeoutSec: 30,
        sliceDurationSec: 2.0,
        targetScore: 0,
      };

      const lyrics = prepareRawLyrics(song, settings);
      expect(lyrics).toBe(
        "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด"
      );
    });

    it("falls back to lyricsFull when lyricsType === 'chorus' and song has NO lyricsChorus", () => {
      const songWithoutChorus: Song = {
        id: "song-2",
        title: "เพลงที่ไม่มีท่อนฮุก",
        artist: "ศิลปินอินดี้",
        aliases: [],
        audioUrl: "https://example.com/indie.mp3",
        lyricsIntro: "",
        lyricsChorus: "", // Empty chorus
        lyricsFull: "กาลครั้งหนึ่งนานมาแล้ว มีบทเพลงที่ร้องยาวไปเรื่อยๆ จนจบเพลง",
      };

      const settings: RoomSettings = {
        gameMode: "ai-lyrics",
        lyricsType: "chorus",
        answerInputMode: "autocomplete",
        answerResolutionMode: "race",
        maxPlayers: 8,
        totalRounds: 10,
        roundTimeoutSec: 30,
        sliceDurationSec: 2.0,
        targetScore: 0,
      };

      const lyrics = prepareRawLyrics(songWithoutChorus, settings);
      expect(lyrics).toBe(
        "กาลครั้งหนึ่งนานมาแล้ว มีบทเพลงที่ร้องยาวไปเรื่อยๆ จนจบเพลง"
      );
    });

    it("uses lyricsChorus when lyricsType === 'chorus' and lyricsChorus is present", () => {
      const songWithChorus: Song = {
        id: "song-3",
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: [],
        audioUrl: "https://example.com/audio.mp3",
        lyricsChorus: "มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด",
        lyricsFull: "เนื้อเพลงเต็มทั้งหมด",
      };

      const settings: RoomSettings = {
        gameMode: "ai-lyrics",
        lyricsType: "chorus",
        answerInputMode: "autocomplete",
        answerResolutionMode: "race",
        maxPlayers: 8,
        totalRounds: 10,
        roundTimeoutSec: 30,
        sliceDurationSec: 2.0,
        targetScore: 0,
      };

      const lyrics = prepareRawLyrics(songWithChorus, settings);
      expect(lyrics).toBe("มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด");
    });

    it("falls back to lyricsChorus or lyricsIntro if lyricsType === 'full' but lyricsFull is missing", () => {
      const songMissingFull: Song = {
        id: "song-4",
        title: "เพลงเก่า",
        artist: "ศิลปินเก่า",
        aliases: [],
        audioUrl: "https://example.com/audio.mp3",
        lyricsIntro: "เปิดเพลงมาแบบนี้",
        lyricsChorus: "ท่อนฮุกกระแทกใจ",
      };

      const settings: RoomSettings = {
        gameMode: "ai-lyrics",
        lyricsType: "full",
        answerInputMode: "autocomplete",
        answerResolutionMode: "race",
        maxPlayers: 8,
        totalRounds: 10,
        roundTimeoutSec: 30,
        sliceDurationSec: 2.0,
        targetScore: 0,
      };

      const lyrics = prepareRawLyrics(songMissingFull, settings);
      expect(lyrics).toBe("ท่อนฮุกกระแทกใจ");
    });
  });
});
