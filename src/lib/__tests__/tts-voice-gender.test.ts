import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ttsReader,
  getEnglishVoices,
  getThaiVoices,
  hasGenuineFemaleThaiVoice,
  splitTextIntoChunks,
  speakLyrics,
  stopSpeaking,
  isSpeaking,
  isSpeechSupported,
} from "../tts-reader";
import * as audioVolumeModule from "../audio-volume";

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
  let mockAudioInstances: any[] = [];
  let mockCancel: any;
  let mockSpeak: any;
  let mockResume: any;
  let mockPause: any;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    speakCalls = [];
    mockAudioInstances = [];
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

    class MockAudio {
      src: string;
      volume = 1;
      paused = true;
      ended = false;
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;

      constructor(src?: string) {
        this.src = src || "";
        mockAudioInstances.push(this);
      }

      play = vi.fn().mockImplementation(() => {
        this.paused = false;
        this.ended = false;
        if (this.onplay) {
          this.onplay();
        }
        return Promise.resolve();
      });

      pause = vi.fn().mockImplementation(() => {
        this.paused = true;
      });

      load = vi.fn();
      removeAttribute = vi.fn();
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

    (globalThis as any).Audio = MockAudio;
    (globalThis as any).window = {
      speechSynthesis: mockSpeechSynthesis,
      Audio: MockAudio,
    };
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    stopSpeaking();
    (globalThis as any).window = originalWindow;
    delete (globalThis as any).Audio;
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

  describe("hasGenuineFemaleThaiVoice", () => {
    it("returns true when native female Thai voices (Premwadee, Achara) exist", () => {
      expect(hasGenuineFemaleThaiVoice()).toBe(true);
    });

    it("returns true when Google Thai voice is available", () => {
      mockVoices = [createMockVoice("Google ภาษาไทย", "th-TH")];
      expect(hasGenuineFemaleThaiVoice()).toBe(true);
    });

    it("returns true when Siri Thai voice is available", () => {
      mockVoices = [createMockVoice("Siri Voice 1 (Thai)", "th-TH")];
      expect(hasGenuineFemaleThaiVoice()).toBe(true);
    });

    it("returns true when Kanya or Narisa Thai voice is available", () => {
      mockVoices = [createMockVoice("Kanya", "th-TH")];
      expect(hasGenuineFemaleThaiVoice()).toBe(true);
    });

    it("returns false when only male Thai voice exists (e.g. Microsoft Pattara / Niwat on Windows/Chrome)", () => {
      mockVoices = [
        createMockVoice("Microsoft Pattara Online (Natural) - Thai (Thailand)", "th-TH"),
        createMockVoice("Microsoft Niwat Online (Natural) - Thai (Thailand)", "th-TH"),
      ];
      expect(hasGenuineFemaleThaiVoice()).toBe(false);
    });

    it("returns false when no Thai voice is installed on the system", () => {
      mockVoices = [
        createMockVoice("Microsoft David - English (United States)", "en-US"),
        createMockVoice("Microsoft Zira - English (United States)", "en-US"),
      ];
      expect(hasGenuineFemaleThaiVoice()).toBe(false);
    });

    it("returns false when speech synthesis is not supported", () => {
      const savedSynth = (globalThis as any).window.speechSynthesis;
      delete (globalThis as any).window.speechSynthesis;
      expect(hasGenuineFemaleThaiVoice()).toBe(false);
      (globalThis as any).window.speechSynthesis = savedSynth;
    });
  });

  describe("Dual-Engine Audio Fallback in speakLyrics (Windows/Chrome Female Voice Fix)", () => {
    beforeEach(() => {
      // Simulate Windows Chrome environment where ONLY male voice (Pattara) is available
      mockVoices = [
        createMockVoice("Microsoft Pattara Online (Natural) - Thai (Thailand)", "th-TH"),
      ];
    });

    it("uses HTML5 Audio fallback calling /api/tts when female voice is requested and no native female voice exists", () => {
      const onStart = vi.fn();
      const onEnd = vi.fn();

      speakLyrics("แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย", {
        gender: "female",
        onStart,
        onEnd,
      });

      // Web Speech API should NOT be invoked
      expect(speakCalls.length).toBe(0);

      // HTML5 Audio instance should be created and played
      expect(mockAudioInstances.length).toBe(1);
      const audio = mockAudioInstances[0];
      expect(audio.src).toContain("/api/tts?text=");
      expect(audio.src).toContain("&lang=th&gender=female");
      expect(audio.play).toHaveBeenCalled();
      expect(onStart).toHaveBeenCalledTimes(1);

      // When audio finishes, onEnd should be triggered
      audio.onended?.();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("respects volume and master volume when using HTML5 Audio fallback", () => {
      vi.spyOn(audioVolumeModule, "getMasterVolume").mockReturnValue(0.6);

      speakLyrics("ใจดวงนี้ไม่เคยสลาย", {
        gender: "female",
        volume: 0.5,
      });

      expect(mockAudioInstances.length).toBe(1);
      const audio = mockAudioInstances[0];
      // effective volume = 0.5 * 0.6 = 0.3
      expect(audio.volume).toBeCloseTo(0.3, 2);
    });

    it("halts speaking and triggers onEnd immediately if master volume is muted", () => {
      vi.spyOn(audioVolumeModule, "isMasterMuted").mockReturnValue(true);
      const onEnd = vi.fn();

      speakLyrics("ใจดวงนี้ไม่เคยสลาย", {
        gender: "female",
        onEnd,
      });

      expect(mockAudioInstances.length).toBe(0);
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("chunks long lyrics (> 200 chars) sequentially using HTML5 Audio fallback", () => {
      const stanza1 = "ท่อนที่หนึ่ง: มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า แม้หนทางจะยาวไกลเพียงใด";
      const stanza2 = "ท่อนที่สอง: แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย จะก้าวเดินต่อไปข้างหน้า ไม่ยอมแพ้ต่อโชคชะตาใดๆ ทั้งสิ้น";
      const fullText = `${stanza1}\n${stanza2}`;
      expect(fullText.length).toBeGreaterThan(200);

      const onStart = vi.fn();
      const onEnd = vi.fn();

      speakLyrics(fullText, {
        gender: "female",
        onStart,
        onEnd,
      });

      // First chunk is created and started
      expect(mockAudioInstances.length).toBe(1);
      expect(decodeURIComponent(mockAudioInstances[0].src)).toContain(stanza1);
      expect(onStart).toHaveBeenCalledTimes(1);

      // Simulate chunk 1 ended -> triggers chunk 2
      mockAudioInstances[0].onended?.();
      expect(mockAudioInstances.length).toBe(2);
      expect(decodeURIComponent(mockAudioInstances[1].src)).toContain(stanza2);
      // onStart should NOT be called again on chunk 2
      expect(onStart).toHaveBeenCalledTimes(1);

      // Simulate chunk 2 ended -> completes sequence
      mockAudioInstances[1].onended?.();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("continues using Web Speech API when male voice is requested, even on Windows with only Pattara", () => {
      speakLyrics("แม้ทั้งชีวิตพังทลาย", {
        gender: "male",
      });

      // Uses Web Speech API, NOT Audio fallback
      expect(mockAudioInstances.length).toBe(0);
      expect(speakCalls.length).toBe(1);
      expect(speakCalls[0].voice.name).toContain("Pattara");
      expect(speakCalls[0].pitch).toBeCloseTo(0.75, 2);
    });

    it("continues using Web Speech API when native female voice exists on the system (e.g. Premwadee on Edge/macOS)", () => {
      mockVoices = [
        createMockVoice("Microsoft Premwadee Online (Natural) - Thai (Thailand)", "th-TH"),
      ];

      speakLyrics("แม้ทั้งชีวิตพังทลาย", {
        gender: "female",
      });

      // Uses Web Speech API, NOT Audio fallback
      expect(mockAudioInstances.length).toBe(0);
      expect(speakCalls.length).toBe(1);
      expect(speakCalls[0].voice.name).toContain("Premwadee");
    });

    it("continues using Web Speech API for English speech even if gender is female and no Thai female voice exists", () => {
      mockVoices = [
        createMockVoice("Microsoft Pattara Online (Natural) - Thai (Thailand)", "th-TH"),
        createMockVoice("Microsoft Zira - English (United States)", "en-US"),
      ];

      speakLyrics("Never gonna give you up", {
        lang: "en-US",
        gender: "female",
      });

      expect(mockAudioInstances.length).toBe(0);
      expect(speakCalls.length).toBe(1);
      expect(speakCalls[0].voice.name).toContain("Zira");
    });
  });

  describe("Dual-Engine isSpeaking and stopSpeaking Lifecycle", () => {
    beforeEach(() => {
      mockVoices = [
        createMockVoice("Microsoft Pattara Online (Natural) - Thai (Thailand)", "th-TH"),
      ];
    });

    it("isSpeaking() returns true while HTML5 Audio is active, and false after ended", () => {
      expect(isSpeaking()).toBe(false);

      speakLyrics("ทดสอบเสียง", { gender: "female" });
      expect(mockAudioInstances.length).toBe(1);
      expect(isSpeaking()).toBe(true);

      mockAudioInstances[0].onended?.();
      expect(isSpeaking()).toBe(false);
    });

    it("stopSpeaking() immediately pauses and clears active HTML5 Audio element", () => {
      speakLyrics("ทดสอบการหยุดเสียง", { gender: "female" });
      expect(mockAudioInstances.length).toBe(1);
      const audio = mockAudioInstances[0];

      expect(isSpeaking()).toBe(true);
      stopSpeaking();

      expect(audio.pause).toHaveBeenCalled();
      expect(mockCancel).toHaveBeenCalled();
      expect(isSpeaking()).toBe(false);
    });

    it("cancels pending chunk transitions if stopSpeaking() is called before chunk ends", () => {
      const stanza1 = "ท่อนที่หนึ่ง: มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า แม้หนทางจะยาวไกลเพียงใด";
      const stanza2 = "ท่อนที่สอง: แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย จะก้าวเดินต่อไปข้างหน้า ไม่ยอมแพ้ต่อโชคชะตาใดๆ ทั้งสิ้น";
      const fullText = `${stanza1}\n${stanza2}`;

      const onEnd = vi.fn();
      speakLyrics(fullText, { gender: "female", onEnd });
      expect(mockAudioInstances.length).toBe(1);

      stopSpeaking();

      // Even if old audio triggers onended after stopSpeaking
      mockAudioInstances[0].onended?.();

      // No second chunk should be triggered
      expect(mockAudioInstances.length).toBe(1);
      expect(onEnd).not.toHaveBeenCalled();
    });
  });

  describe("ttsReader module export", () => {
    it("exports getEnglishVoices, hasGenuineFemaleThaiVoice and splitTextIntoChunks on ttsReader object", () => {
      expect(typeof ttsReader.getEnglishVoices).toBe("function");
      expect(typeof ttsReader.getThaiVoices).toBe("function");
      expect(typeof ttsReader.hasGenuineFemaleThaiVoice).toBe("function");
      expect(typeof ttsReader.splitTextIntoChunks).toBe("function");
      expect(typeof ttsReader.speakLyrics).toBe("function");
      expect(typeof ttsReader.stopSpeaking).toBe("function");
      expect(typeof getEnglishVoices).toBe("function");
      expect(typeof hasGenuineFemaleThaiVoice).toBe("function");
    });
  });
});
