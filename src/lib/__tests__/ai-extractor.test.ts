import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cleanSongTitle,
  parseYouTubeVideoId,
  getEraFromYear,
  cleanJsonResponse,
  heuristicExtractSongMetadata,
  extractSongMetadata,
  KNOWN_THAI_SONGS,
} from "@/lib/ai-extractor";

// Mock @google/genai SDK
const mockGenerateContent = vi.fn();
vi.mock("@google/genai", () => {
  return {
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      INTEGER: "INTEGER",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
      ARRAY: "ARRAY",
    },
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

describe("ai-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("utility functions", () => {
    it("cleanSongTitle strips noise and special characters", () => {
      expect(cleanSongTitle("เคลิ้ม - Slot Machine [Official MV] 4K")).toBe("เคลิ้ม - Slot Machine");
      expect(cleanSongTitle("ซ่อนกลิ่น - Palmy (Official Audio) [Full Song]")).toBe("ซ่อนกลิ่น - Palmy");
      expect(cleanSongTitle("วัดใจ เนื้อเพลง คอร์ดเพลง")).toBe("วัดใจ");
    });

    it("parseYouTubeVideoId extracts video ID correctly", () => {
      expect(parseYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(parseYouTubeVideoId("not a url")).toBe(null);
    });

    it("getEraFromYear maps release years to eras", () => {
      expect(getEraFromYear(1985)).toBe("80s");
      expect(getEraFromYear(1995)).toBe("90s");
      expect(getEraFromYear(2005)).toBe("2000s");
      expect(getEraFromYear(2015)).toBe("2010s");
      expect(getEraFromYear(2025)).toBe("2020s");
    });

    it("cleanJsonResponse cleans markdown codeblocks", () => {
      expect(cleanJsonResponse('```json\n{"title": "เคลิ้ม"}\n```')).toBe('{"title": "เคลิ้ม"}');
      expect(cleanJsonResponse('```\n{"title": "เคลิ้ม"}\n```')).toBe('{"title": "เคลิ้ม"}');
      expect(cleanJsonResponse('{"title": "เคลิ้ม"}')).toBe('{"title": "เคลิ้ม"}');
    });
  });

  describe("heuristic extraction & curated songs", () => {
    it("has เคลิ้ม by Slot Machine with accurate verified lyrics", () => {
      const song = KNOWN_THAI_SONGS.find((s) => s.title === "เคลิ้ม" && s.artist === "Slot Machine");
      expect(song).toBeDefined();
      expect(song?.lyricsChorus).toContain("เหมือนโดนซ้ำซ้ำแล้วสะใจ");
      expect(song?.lyricsChorus).not.toContain("เหมือนเดิมซ้ำ ๆ แล้วสะใจ");
      expect(song?.lyricsFull).toContain("เหมือนโดนซ้ำซ้ำแล้วสะใจ");
    });

    it("heuristicExtractSongMetadata matches เคลิ้ม by Slot Machine accurately", async () => {
      const res = await heuristicExtractSongMetadata("เคลิ้ม Slot Machine");
      expect(res.songFound).toBe(true);
      expect(res.title).toBe("เคลิ้ม");
      expect(res.artist).toBe("Slot Machine");
      expect(res.lyricsConfidence).toBe("verified");
      expect(res.lyricsChorus).toContain("เหมือนโดนซ้ำซ้ำแล้วสะใจ");
    });

    it("identifies artist-only query like 'Slot Machine' as not a song", async () => {
      const res = await heuristicExtractSongMetadata("Slot Machine");
      expect(res.songFound).toBe(false);
      expect(res.notFoundReason).toContain("Slot Machine");
      expect(res.title).toBe("");
    });
  });

  describe("Gemini Google Search Grounding extraction", () => {
    it("passes tools: [{ googleSearch: {} }] to ai.models.generateContent", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          songFound: true,
          lyricsConfidence: "verified",
          title: "เคลิ้ม",
          artist: "Slot Machine",
          aliases: ["kloem", "เคลิ้ม"],
          releaseYear: 2013,
          genreSlug: "rock",
          era: "2010s",
          hookStartSec: 54,
          hookEndSec: 80,
          lyricsIntro: "รู้ดีเธอน่ะใจร้าย แต่ก็ไม่วายจะยอมรับ",
          lyricsChorus: "หัวใจดวงนี้ไม่หลาบจำ\nเหมือนโดนซ้ำซ้ำแล้วสะใจ\nหัวใจนี่มันงมงาย\nตักเตือนไม่ยอมฟังกัน",
          lyricsFull: "หัวใจดวงนี้ไม่หลาบจำ\nเหมือนโดนซ้ำซ้ำแล้วสะใจ",
          youtubeSearchQuery: "เคลิ้ม Slot Machine",
        }),
      });

      // Use a custom query not in KNOWN_THAI_SONGS to trigger Gemini SDK call
      const res = await extractSongMetadata("เคลิ้ม เพลงสด Slot Machine 2013 Live", "valid-gemini-api-key-test-12345");

      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config).toHaveProperty("tools");
      expect(callArgs.config.tools).toEqual([{ googleSearch: {} }]);
      expect(callArgs.contents).toContain("Siamzone");
      expect(callArgs.contents).toContain("Genius");
      expect(callArgs.contents).toContain("Phonetic hallucinations");

      expect(res.songFound).toBe(true);
      expect(res.title).toBe("เคลิ้ม");
      expect(res.artist).toBe("Slot Machine");
      expect(res.lyricsConfidence).toBe("verified");
      expect(res.lyricsChorus).toContain("เหมือนโดนซ้ำซ้ำแล้วสะใจ");
    });
  });
});
