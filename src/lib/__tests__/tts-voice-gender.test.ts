import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ttsReader,
  getEnglishVoices,
  getThaiVoices,
  splitTextIntoChunks,
  speakLyrics,
  stopSpeaking,
  isSpeechSupported,
} from "../tts-reader";

// Helper mock voice factory
function createMockVoice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: isDefault,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

describe("TTS Voice & Gender Reader", () => {
  let mockVoices: SpeechSynthesisVoice[] = [];
  let speakCalls: any[] = [];
  let mockCancel: any;
  let mockSpeak: any;
  let mockResume: any;
  let mockPause: any;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    speakCalls = [];
    mockVoices = [
      createMockVoice("Microsoft David - English (United States)", "en-US"),
      createMockVoice("Microsoft Zira - English (United States)", "en-US"),
      createMockVoice("Microsoft Mark - English (United States)", "en-US"),
      createMockVoice("Google UK English Female", "en-GB"),
      createMockVoice("Google UK English Male", "en-GB"),
      createMockVoice("Microsoft Niwat Online (Natural) - Thai (Thailand)", "th-TH"),
      createMockVoice("Microsoft Premwadee Online (Natural) - Thai (Thailand)", "th-TH"),
      createMockVoice("Microsoft Achara - Thai (Thailand)", "th-TH"),
      createMockVoice("Default Voice", "fr-FR", true),
    ];

    mockCancel = vi.fn();
    mockSpeak = vi.fn((utterance: any) => {
      speakCalls.push(utterance);
    });
    mockResume = vi.fn();
    mockPause = vi.fn();

    class MockSpeechSynthesisUtterance {
      text: string;
      lang = "";
      pitch = 1;
      rate = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    const mockSpeechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      resume: mockResume,
      pause: mockPause,
      getVoices: vi.fn(() => mockVoices),
      speaking: false,
      paused: false,
      onvoiceschanged: null,
    };

    (globalThis as any).window = {
      speechSynthesis: mockSpeechSynthesis,
    };
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    stopSpeaking();
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  describe("splitTextIntoChunks", () => {
    it("returns empty array for empty or whitespace text", () => {
      expect(splitTextIntoChunks("")).toEqual([]);
      expect(splitTextIntoChunks("   \n\t  ")).toEqual([]);
    });

    it("returns single chunk for short text (<= 200 chars)", () => {
      const short = "วัดใจ - Silly Fools";
      expect(splitTextIntoChunks(short, 200)).toEqual([short]);
    });

    it("groups multiple lines into chunks without exceeding maxLength", () => {
      const lines = [
        "Line 1: แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย",
        "Line 2: มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด",
        "Line 3: จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า",
        "Line 4: ขอบคุณที่รักกัน ขอบคุณทุกรอยยิ้มที่มีให้กัน",
      ];
      const longText = lines.join("\n");
      const chunks = splitTextIntoChunks(longText, 100);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(100);
      }
      // Every line's core content is preserved across chunks
      expect(chunks.join("\n")).toContain("แม้ทั้งชีวิตพังทลาย");
      expect(chunks.join("\n")).toContain("ขอบคุณทุกรอยยิ้ม");
    });

    it("hard splits unbroken text exceeding maxLength", () => {
      const continuous = "A".repeat(450);
      const chunks = splitTextIntoChunks(continuous, 200);

      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(200);
      expect(chunks[1].length).toBe(200);
      expect(chunks[2].length).toBe(50);
    });

    it("handles sentence delimiters cleanly", () => {
      const text =
        "First sentence here. Second sentence follows. Third sentence comes next. Fourth sentence arrives! Fifth sentence is right here? And finally the sixth sentence.";
      const chunks = splitTextIntoChunks(text, 60);

      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(60);
      }
    });
  });

  describe("getEnglishVoices", () => {
    it("filters and returns English voices", () => {
      const voices = getEnglishVoices();
      expect(voices.length).toBe(5);
      expect(voices.every((v) => v.lang.startsWith("en"))).toBe(true);
    });

    it("prioritizes male voices when gender is 'male'", () => {
      const voices = getEnglishVoices("male");
      expect(voices.length).toBe(5);
      // Microsoft David, Microsoft Mark, or Google UK English Male should be first
      const topVoiceName = voices[0].name.toLowerCase();
      const isMale =
        topVoiceName.includes("david") ||
        topVoiceName.includes("mark") ||
        topVoiceName.includes("male");
      expect(isMale).toBe(true);

      // Verify male keyword matches come before female-only voices
      const ziraIndex = voices.findIndex((v) => v.name.includes("Zira"));
      const davidIndex = voices.findIndex((v) => v.name.includes("David"));
      expect(davidIndex).toBeLessThan(ziraIndex);
    });

    it("prioritizes female voices when gender is 'female'", () => {
      const voices = getEnglishVoices("female");
      expect(voices.length).toBe(5);
      const topVoiceName = voices[0].name.toLowerCase();
      const isFemale =
        topVoiceName.includes("zira") ||
        topVoiceName.includes("female") ||
        topVoiceName.includes("jenny");
      expect(isFemale).toBe(true);

      // Verify female voice comes before male voice
      const ziraIndex = voices.findIndex((v) => v.name.includes("Zira"));
      const davidIndex = voices.findIndex((v) => v.name.includes("David"));
      expect(ziraIndex).toBeLessThan(davidIndex);
    });

    it("falls back to default voice if no English voice matches", () => {
      mockVoices = [createMockVoice("Fallback Default Voice", "fr-FR", true)];
      const voices = getEnglishVoices("male");
      expect(voices.length).toBe(1);
      expect(voices[0].name).toBe("Fallback Default Voice");
    });
  });

  describe("getThaiVoices", () => {
    it("prioritizes male Thai voice when gender is 'male'", () => {
      const voices = getThaiVoices("male");
      expect(voices.length).toBe(3);
      expect(voices[0].name).toContain("Niwat");
    });

    it("prioritizes female Thai voice when gender is 'female'", () => {
      const voices = getThaiVoices("female");
      expect(voices.length).toBe(3);
      const isFemale =
        voices[0].name.includes("Premwadee") ||
        voices[0].name.includes("Achara") ||
        voices[0].name.includes("female");
      expect(isFemale).toBe(true);
    });
  });

  describe("speakLyrics with English TTS and Gender Acoustics", () => {
    it("sets male acoustic defaults (pitch: 0.8, rate: 0.9) and assigns male English voice", () => {
      speakLyrics("Never gonna give you up, never gonna let you down", {
        lang: "en-US",
        gender: "male",
      });

      expect(speakCalls.length).toBe(1);
      const utterance = speakCalls[0];
      expect(utterance.pitch).toBeCloseTo(0.8, 2);
      expect(utterance.rate).toBeCloseTo(0.9, 2);
      expect(utterance.lang).toBe("en-US");
      expect(utterance.voice).toBeDefined();
      expect(
        utterance.voice.name.toLowerCase().includes("david") ||
          utterance.voice.name.toLowerCase().includes("mark") ||
          utterance.voice.name.toLowerCase().includes("male")
      ).toBe(true);
    });

    it("sets female acoustic defaults (pitch: 1.2, rate: 0.95) and assigns female English voice", () => {
      speakLyrics("I will always love you", {
        lang: "en-US",
        gender: "female",
      });

      expect(speakCalls.length).toBe(1);
      const utterance = speakCalls[0];
      expect(utterance.pitch).toBeCloseTo(1.2, 2);
      expect(utterance.rate).toBeCloseTo(0.95, 2);
      expect(utterance.lang).toBe("en-US");
      expect(utterance.voice).toBeDefined();
      expect(
        utterance.voice.name.toLowerCase().includes("zira") ||
          utterance.voice.name.toLowerCase().includes("female")
      ).toBe(true);
    });

    it("allows custom pitch and rate overrides in English mode", () => {
      speakLyrics("Custom pitch and rate test", {
        lang: "en-US",
        gender: "male",
        pitch: 1.45,
        rate: 1.1,
      });

      expect(speakCalls.length).toBe(1);
      const utterance = speakCalls[0];
      expect(utterance.pitch).toBe(1.45);
      expect(utterance.rate).toBe(1.1);
    });

    it("uses Thai acoustic defaults when lang is not English", () => {
      speakLyrics("แม้ทั้งชีวิตพังทลาย", {
        gender: "male",
      });

      expect(speakCalls.length).toBe(1);
      const utterance = speakCalls[0];
      expect(utterance.pitch).toBeCloseTo(0.75, 2);
      expect(utterance.rate).toBeCloseTo(0.88, 2);
      expect(utterance.voice?.name).toContain("Niwat");
      expect(utterance.lang).toBe("th-TH");
    });
  });

  describe("speakLyrics Chunked Speech for Long Texts (> 200 chars)", () => {
    it("chunks long lyrics and sequentially speaks them through onend events", () => {
      const stanza1 = "ท่อนที่หนึ่ง: มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า แม้หนทางจะยาวไกลเพียงใด";
      const stanza2 = "ท่อนที่สอง: แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย จะก้าวเดินต่อไปข้างหน้า ไม่ยอมแพ้ต่อโชคชะตาใดๆ ทั้งสิ้น";
      const fullLyrics = `${stanza1}\n${stanza2}`;

      expect(fullLyrics.length).toBeGreaterThan(200);

      const onStart = vi.fn();
      const onEnd = vi.fn();

      speakLyrics(fullLyrics, {
        onStart,
        onEnd,
      });

      // First chunk is immediately spoken
      expect(speakCalls.length).toBe(1);
      const firstUtterance = speakCalls[0];
      expect(firstUtterance.text).toBe(stanza1);

      // Trigger start on first chunk
      firstUtterance.onstart?.();
      expect(onStart).toHaveBeenCalledTimes(1);

      // Trigger end on first chunk -> should invoke next chunk
      firstUtterance.onend?.();
      expect(speakCalls.length).toBe(2);
      const secondUtterance = speakCalls[1];
      expect(secondUtterance.text).toBe(stanza2);

      // Triggering start on second chunk should NOT call onStart again
      secondUtterance.onstart?.();
      expect(onStart).toHaveBeenCalledTimes(1);

      // Trigger end on final chunk -> should complete and call onEnd
      secondUtterance.onend?.();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("halts chunk sequence immediately when stopSpeaking is called", () => {
      const longText = `${"A".repeat(150)}\n${"B".repeat(150)}\n${"C".repeat(150)}`;
      const onEnd = vi.fn();

      speakLyrics(longText, { onEnd });

      expect(speakCalls.length).toBe(1);
      const firstUtterance = speakCalls[0];

      // Stop speech while first chunk is playing
      stopSpeaking();
      expect(mockCancel).toHaveBeenCalled();

      // Simulate first utterance onend after cancel
      firstUtterance.onend?.();

      // No second chunk should be triggered
      expect(speakCalls.length).toBe(1);
      expect(onEnd).not.toHaveBeenCalled();
    });
  });

  describe("ttsReader module export", () => {
    it("exports getEnglishVoices and splitTextIntoChunks on ttsReader object", () => {
      expect(typeof ttsReader.getEnglishVoices).toBe("function");
      expect(typeof ttsReader.getThaiVoices).toBe("function");
      expect(typeof ttsReader.splitTextIntoChunks).toBe("function");
      expect(typeof ttsReader.speakLyrics).toBe("function");
      expect(typeof ttsReader.stopSpeaking).toBe("function");
      expect(typeof getEnglishVoices).toBe("function");
    });
  });
});
