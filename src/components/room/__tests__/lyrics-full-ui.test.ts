import { describe, it, expect } from "vitest";
import type { Song, LyricsType } from "@/types";

describe("Lyrics resolution logic for solo and multiplayer views", () => {
  const mockSong: Partial<Song> = {
    title: "ฤดูร้อน",
    artist: "Paradox",
    lyricsIntro: "ผ่านพ้นนาทีเลวร้าย",
    lyricsChorus: "ยิ่งโตยิ่งเข้าใจ ทุกอย่างเปลี่ยนไปตามเวลา",
    lyricsFull: "ผ่านพ้นนาทีเลวร้าย เมื่อรักเลือนหายไป...\nยิ่งโตยิ่งเข้าใจ ทุกอย่างเปลี่ยนไปตามเวลา...\nและสุดท้ายไม่มีใคร",
  };

  function resolveSongLyrics(song: Partial<Song>, type: LyricsType): string {
    if (type === "full") {
      return song.lyricsFull || song.lyricsChorus || song.lyricsIntro || "";
    }
    if (type === "chorus") {
      return song.lyricsChorus || song.lyricsFull || song.lyricsIntro || "";
    }
    return song.lyricsIntro || song.lyricsChorus || song.lyricsFull || "";
  }

  it("resolves full song lyrics when lyricsType is full", () => {
    const lyrics = resolveSongLyrics(mockSong, "full");
    expect(lyrics).toBe(mockSong.lyricsFull);
  });

  it("resolves chorus lyrics when lyricsType is chorus", () => {
    const lyrics = resolveSongLyrics(mockSong, "chorus");
    expect(lyrics).toBe(mockSong.lyricsChorus);
  });

  it("falls back to chorus if lyricsFull is missing when type is full", () => {
    const songWithoutFull: Partial<Song> = {
      lyricsChorus: "ท่อนฮุก",
    };
    const lyrics = resolveSongLyrics(songWithoutFull, "full");
    expect(lyrics).toBe("ท่อนฮุก");
  });

  it("falls back to lyricsFull if lyricsChorus is missing when type is chorus", () => {
    const songWithoutChorus: Partial<Song> = {
      lyricsFull: "เนื้อเพลงเต็มทั้งเพลง",
    };
    const lyrics = resolveSongLyrics(songWithoutChorus, "chorus");
    expect(lyrics).toBe("เนื้อเพลงเต็มทั้งเพลง");
  });
});
