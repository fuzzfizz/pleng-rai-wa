import { describe, it, expect } from "vitest";
import { parseCliArgs } from "../../../scripts/import-song.mjs";
import { extractIntroLyrics } from "@/lib/lyrics-cleaner";

describe("CLI import-song argument parser and logic", () => {
  describe("parseCliArgs", () => {
    it("parses simple query positional argument", () => {
      const { query, flags } = parseCliArgs(["วัดใจ Silly Fools"]);
      expect(query).toBe("วัดใจ Silly Fools");
      expect(flags.youtubeUrl).toBeUndefined();
      expect(flags.lyrics).toBeUndefined();
      expect(flags.hookStart).toBeUndefined();
      expect(flags.hookEnd).toBeUndefined();
      expect(flags.help).toBe(false);
    });

    it("parses unquoted multi-word positional arguments", () => {
      const { query, flags } = parseCliArgs(["วัดใจ", "Silly", "Fools"]);
      expect(query).toBe("วัดใจ Silly Fools");
      expect(flags.help).toBe(false);
    });

    it("parses direct YouTube URL as query", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const { query, flags } = parseCliArgs([url]);
      expect(query).toBe(url);
      expect(flags.youtubeUrl).toBeUndefined();
    });

    it("parses --youtube-url flag with space and with equal sign", () => {
      const res1 = parseCliArgs(["วัดใจ", "--youtube-url", "https://youtu.be/custom1"]);
      expect(res1.query).toBe("วัดใจ");
      expect(res1.flags.youtubeUrl).toBe("https://youtu.be/custom1");

      const res2 = parseCliArgs(["--youtube-url=https://youtu.be/custom2", "วัดใจ Silly Fools"]);
      expect(res2.query).toBe("วัดใจ Silly Fools");
      expect(res2.flags.youtubeUrl).toBe("https://youtu.be/custom2");
    });

    it("parses --lyrics flag with space and with equal sign", () => {
      const res1 = parseCliArgs(["วัดใจ", "--lyrics", "เนื้อเพลงบรรทัดหนึ่ง\nบรรทัดสอง"]);
      expect(res1.query).toBe("วัดใจ");
      expect(res1.flags.lyrics).toBe("เนื้อเพลงบรรทัดหนึ่ง\nบรรทัดสอง");

      const res2 = parseCliArgs(["--lyrics=ท่อนฮุกตรงนี้", "วัดใจ"]);
      expect(res2.query).toBe("วัดใจ");
      expect(res2.flags.lyrics).toBe("ท่อนฮุกตรงนี้");
    });

    it("parses --lyrics-intro and --intro flags with space and with equal sign", () => {
      const res1 = parseCliArgs(["วัดใจ", "--lyrics-intro", "ท่อนเปิดบรรทัดหนึ่ง\nบรรทัดสอง"]);
      expect(res1.query).toBe("วัดใจ");
      expect(res1.flags.lyricsIntro).toBe("ท่อนเปิดบรรทัดหนึ่ง\nบรรทัดสอง");

      const res2 = parseCliArgs(["--lyrics-intro=ท่อนเปิดตรงนี้", "วัดใจ"]);
      expect(res2.query).toBe("วัดใจ");
      expect(res2.flags.lyricsIntro).toBe("ท่อนเปิดตรงนี้");

      const res3 = parseCliArgs(["วัดใจ", "--intro", "ท่อนเปิดสั้นๆ"]);
      expect(res3.flags.lyricsIntro).toBe("ท่อนเปิดสั้นๆ");

      const res4 = parseCliArgs(["--intro=ท่อนเปิดแบบสั้น", "วัดใจ"]);
      expect(res4.flags.lyricsIntro).toBe("ท่อนเปิดแบบสั้น");
    });

    it("parses --album flag with space and with equal sign", () => {
      const res1 = parseCliArgs(["ยาพิษ", "--album", "Save My Life"]);
      expect(res1.query).toBe("ยาพิษ");
      expect(res1.flags.album).toBe("Save My Life");

      const res2 = parseCliArgs(["--album=คราม", "แสงสุดท้าย"]);
      expect(res2.query).toBe("แสงสุดท้าย");
      expect(res2.flags.album).toBe("คราม");
    });

    it("parses --hook-start and --hook-end flags", () => {
      const res1 = parseCliArgs(["วัดใจ", "--hook-start", "45", "--hook-end", "75"]);
      expect(res1.query).toBe("วัดใจ");
      expect(res1.flags.hookStart).toBe("45");
      expect(res1.flags.hookEnd).toBe("75");

      const res2 = parseCliArgs(["วัดใจ", "--hook-start=60.5", "--hook-end=90"]);
      expect(res2.flags.hookStart).toBe("60.5");
      expect(res2.flags.hookEnd).toBe("90");
    });

    it("parses help flags -h and --help", () => {
      const res1 = parseCliArgs(["--help"]);
      expect(res1.flags.help).toBe(true);

      const res2 = parseCliArgs(["-h"]);
      expect(res2.flags.help).toBe(true);
    });

    it("handles all override flags together", () => {
      const { query, flags } = parseCliArgs([
        "วัดใจ Silly Fools",
        "--youtube-url", "https://www.youtube.com/watch?v=abc12345",
        "--lyrics", "มีแค่ใจดวงเดียวดวงนี้...",
        "--hook-start", "68",
        "--hook-end", "94",
      ]);

      expect(query).toBe("วัดใจ Silly Fools");
      expect(flags.youtubeUrl).toBe("https://www.youtube.com/watch?v=abc12345");
      expect(flags.lyrics).toBe("มีแค่ใจดวงเดียวดวงนี้...");
      expect(flags.hookStart).toBe("68");
      expect(flags.hookEnd).toBe("94");
    });
  });

  describe("Override and Database Payload Logic", () => {
    it("determines correct ytTarget for direct URL query", () => {
      const targetQuery = "https://www.youtube.com/watch?v=xyz987";
      const flags = { youtubeUrl: undefined };
      const metadata = { youtubeSearchQuery: "วัดใจ Silly Fools", title: "วัดใจ", artist: "Silly Fools" };

      const isDirectUrl = /^https?:\/\//i.test(targetQuery);
      const ytTarget =
        flags.youtubeUrl ||
        (isDirectUrl
          ? targetQuery
          : (metadata.youtubeSearchQuery || `${metadata.title} ${metadata.artist} official audio`));

      expect(isDirectUrl).toBe(true);
      expect(ytTarget).toBe("https://www.youtube.com/watch?v=xyz987");
    });

    it("prefers --youtube-url flag over direct URL or metadata search query", () => {
      const targetQuery = "https://www.youtube.com/watch?v=original";
      const flags = { youtubeUrl: "https://www.youtube.com/watch?v=override" };
      const metadata = { youtubeSearchQuery: "ค้นหา", title: "เพลง", artist: "นักร้อง" };

      const isDirectUrl = /^https?:\/\//i.test(targetQuery);
      const ytTarget =
        flags.youtubeUrl ||
        (isDirectUrl
          ? targetQuery
          : (metadata.youtubeSearchQuery || `${metadata.title} ${metadata.artist} official audio`));

      expect(ytTarget).toBe("https://www.youtube.com/watch?v=override");
    });

    it("uses metadata.youtubeSearchQuery when query is text and no flag is given", () => {
      const targetQuery = "วัดใจ";
      const flags = { youtubeUrl: undefined };
      const metadata = { youtubeSearchQuery: "วัดใจ Silly Fools official", title: "วัดใจ", artist: "Silly Fools" };

      const isDirectUrl = /^https?:\/\//i.test(targetQuery);
      const ytTarget =
        flags.youtubeUrl ||
        (isDirectUrl
          ? targetQuery
          : (metadata.youtubeSearchQuery || `${metadata.title} ${metadata.artist} official audio`));

      expect(isDirectUrl).toBe(false);
      expect(ytTarget).toBe("วัดใจ Silly Fools official");
    });

    it("constructs songRow with top-level lyrics_full and overrides", () => {
      const flags = {
        youtubeUrl: "https://youtu.be/custom",
        lyrics: "เนื้อเพลงที่ผู้ใช้ระบุเอง...",
        hookStart: "50",
        hookEnd: "80",
      };

      const metadata = {
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: ["wat jai"],
        releaseYear: 2004,
        genreSlug: "rock",
        era: "2000s",
        hookStartSec: 68,
        hookEndSec: 94,
        lyricsIntro: "แม้ทั้งชีวิต...",
        lyricsChorus: "มีแค่ใจดวงเดียว...",
        lyricsFull: "เนื้อเพลงออริจินัลจาก AI...",
        lyricsConfidence: "verified",
      };

      const hookStart =
        flags.hookStart !== undefined && !isNaN(Number(flags.hookStart))
          ? Number(flags.hookStart)
          : (metadata.hookStartSec || 0);

      const hookEnd =
        flags.hookEnd !== undefined && !isNaN(Number(flags.hookEnd))
          ? Number(flags.hookEnd)
          : (metadata.hookEndSec || 0);

      const customLyrics = flags.lyrics;
      const lyricsFull = customLyrics ?? metadata.lyricsFull ?? null;
      const lyricsConfidence = customLyrics ? "verified" : (metadata.lyricsConfidence || "not_found");

      const songRow = {
        id: "mock-id-123",
        title: metadata.title,
        artist: metadata.artist,
        aliases: metadata.aliases || [metadata.title],
        release_year: metadata.releaseYear ? Number(metadata.releaseYear) : null,
        genre_id: "genre-rock-123",
        era: metadata.era || null,
        audio_url: "https://r2.example.com/songs/mock-id-123/full.mp3",
        hook_start_sec: hookStart,
        hook_end_sec: hookEnd,
        duration_sec: 240,
        lyrics_intro: metadata.lyricsIntro || null,
        lyrics_chorus: metadata.lyricsChorus || null,
        lyrics_full: lyricsFull,
        metadata: {
          youtubeSource: flags.youtubeUrl,
          storageType: "r2",
          r2Key: "songs/mock-id-123/full.mp3",
          lyricsFull: lyricsFull,
          lyricsConfidence: lyricsConfidence,
          importedAt: "2026-11-12T00:00:00.000Z",
        },
      };

      // Top-level lyrics_full
      expect(songRow.lyrics_full).toBe("เนื้อเพลงที่ผู้ใช้ระบุเอง...");
      // metadata.lyricsFull
      expect(songRow.metadata.lyricsFull).toBe("เนื้อเพลงที่ผู้ใช้ระบุเอง...");
      // metadata.lyricsConfidence
      expect(songRow.metadata.lyricsConfidence).toBe("verified");
      // hook overrides
      expect(songRow.hook_start_sec).toBe(50);
      expect(songRow.hook_end_sec).toBe(80);
    });

    it("falls back to metadata.lyricsFull and metadata.lyricsConfidence when no custom lyrics flag is provided", () => {
      const flags = {
        youtubeUrl: undefined,
        lyrics: undefined,
        hookStart: undefined,
        hookEnd: undefined,
      };

      const metadata = {
        lyricsFull: "เนื้อเพลงจาก Gemini",
        lyricsConfidence: "not_found",
        hookStartSec: 68,
        hookEndSec: 94,
      };

      const customLyrics = flags.lyrics;
      const lyricsFull = customLyrics ?? metadata.lyricsFull ?? null;
      const lyricsConfidence = customLyrics ? "verified" : (metadata.lyricsConfidence || "not_found");

      expect(lyricsFull).toBe("เนื้อเพลงจาก Gemini");
      expect(lyricsConfidence).toBe("not_found");
    });

    it("falls back to null when neither custom lyrics nor metadata.lyricsFull exist", () => {
      const flags = {
        youtubeUrl: undefined,
        lyrics: undefined,
      };

      const metadata = {
        lyricsFull: null,
      };

      const customLyrics = flags.lyrics;
      const lyricsFull = customLyrics ?? metadata.lyricsFull ?? null;
      expect(lyricsFull).toBeNull();
    });

    it("resolves lyrics_intro using priority: custom flag > metadata.lyricsIntro > extractIntroLyrics(lyricsFull)", () => {
      // Case 1: Custom flag takes highest precedence
      const flags1 = { lyricsIntro: "ท่อนเปิดกำหนดเอง" };
      const metadata1 = { lyricsIntro: "ท่อนเปิดจาก AI", lyricsFull: "บรรทัด 1\nบรรทัด 2" };
      const rawIntro1 = flags1.lyricsIntro || metadata1.lyricsIntro || extractIntroLyrics(metadata1.lyricsFull);
      expect(rawIntro1).toBe("ท่อนเปิดกำหนดเอง");

      // Case 2: Uses metadata.lyricsIntro when no custom flag is passed
      const flags2 = { lyricsIntro: undefined };
      const metadata2 = { lyricsIntro: "ท่อนเปิดจาก AI", lyricsFull: "บรรทัด 1\nบรรทัด 2" };
      const rawIntro2 = flags2.lyricsIntro || metadata2.lyricsIntro || extractIntroLyrics(metadata2.lyricsFull);
      expect(rawIntro2).toBe("ท่อนเปิดจาก AI");

      // Case 3: Auto-extracts from lyricsFull when lyricsIntro is missing
      const flags3 = { lyricsIntro: undefined };
      const metadata3 = {
        lyricsIntro: undefined,
        lyricsFull: "คำง่ายง่ายแต่ความหมายสุดลึกล้ำ\nคำง่ายง่ายที่เธอใช้ประจำ\nซ้ำไปซ้ำมา\nคิดจะพูดแต่ก็พูดอย่างไม่คิด\nรู้ไหมว่าหนึ่งชีวิตของใคร\nต้องเกิดปัญหา"
      };
      const rawIntro3 = flags3.lyricsIntro || metadata3.lyricsIntro || extractIntroLyrics(metadata3.lyricsFull);
      expect(rawIntro3).toBe("คำง่ายง่ายแต่ความหมายสุดลึกล้ำ\nคำง่ายง่ายที่เธอใช้ประจำ\nซ้ำไปซ้ำมา\nคิดจะพูดแต่ก็พูดอย่างไม่คิด");
    });
  });
});
