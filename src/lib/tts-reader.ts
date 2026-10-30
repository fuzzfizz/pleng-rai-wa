/**
 * Client-side Web Speech API (window.speechSynthesis) integration for "โหมด AI อ่านเนื้อเพลง"
 *
 * 100% Free, Unlimited, Native on iOS Safari, Android Chrome, Windows Edge/Chrome.
 * Reads Thai lyrics in deadpan robotic style for guessing games with male/female voice switching.
 */

import {
  isMasterMuted,
  getMasterVolume,
  subscribeMasterVolume,
} from "./audio-volume";

export type AIVoiceGender = "male" | "female" | "random";

export interface SpeakLyricsOptions {
  gender?: AIVoiceGender;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

// Global active utterance reference to prevent Chromium garbage collection bug
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Keywords identifying genuine female Thai voice names across platforms (Windows, macOS, iOS, Android)
export const FEMALE_THAI_KEYWORDS = [
  "google",
  "siri",
  "premwadee",
  "achara",
  "kanya",
  "narisa",
  "female",
  "woman",
];

// Initialize voices listener and master volume subscriber if in browser environment
if (typeof window !== "undefined") {
  if ("speechSynthesis" in window) {
    cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
    };
  }
  subscribeMasterVolume((vol) => {
    if (vol === 0 || isMasterMuted()) {
      stopSpeaking();
    } else if (activeAudio) {
      activeAudio.volume = Math.max(0, Math.min(1, vol));
    }
  });
}

/**
 * Checks if the Web Speech Synthesis API is supported by the current browser.
 */
export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Checks whether the current system has a genuine female Thai voice available in Web Speech API.
 * Windows/Chrome typically only ships with Microsoft Pattara / Niwat (male voices),
 * which requires falling back to the server TTS proxy for female voice mode.
 */
export function hasGenuineFemaleThaiVoice(): boolean {
  if (!isSpeechSupported()) return false;

  const rawVoices = window.speechSynthesis.getVoices();
  const allVoices = rawVoices.length > 0 ? rawVoices : cachedVoices;

  const thaiVoices = allVoices.filter((v) => {
    const lang = (v.lang || "").toLowerCase().replace(/_/g, "-");
    const name = (v.name || "").toLowerCase();
    return lang.startsWith("th") || lang.includes("th-th") || name.includes("thai");
  });

  return thaiVoices.some((v) => {
    const name = (v.name || "").toLowerCase();
    return FEMALE_THAI_KEYWORDS.some((kw) => name.includes(kw));
  });
}

/**
 * Returns available voices filtered for Thai (th-TH).
 * Optionally prioritizes male or female voice if available on the system.
 */
export function getThaiVoices(gender?: "male" | "female"): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];

  const rawVoices = window.speechSynthesis.getVoices();
  const allVoices = rawVoices.length > 0 ? rawVoices : cachedVoices;

  // Filter for Thai voices
  const thaiVoices = allVoices.filter((v) => {
    const lang = (v.lang || "").toLowerCase().replace(/_/g, "-");
    const name = (v.name || "").toLowerCase();
    return lang.startsWith("th") || lang.includes("th-th") || name.includes("thai");
  });

  if (thaiVoices.length > 0) {
    if (gender === "male") {
      const maleVoice = thaiVoices.find((v) => {
        const name = (v.name || "").toLowerCase();
        return (
          name.includes("niwat") ||
          name.includes("pattara") ||
          name.includes("male") ||
          name.includes("man")
        );
      });
      if (maleVoice) {
        return [maleVoice, ...thaiVoices.filter((v) => v !== maleVoice)];
      }
    } else if (gender === "female") {
      const femaleVoice = thaiVoices.find((v) => {
        const name = (v.name || "").toLowerCase();
        return FEMALE_THAI_KEYWORDS.some((kw) => name.includes(kw));
      });
      if (femaleVoice) {
        return [femaleVoice, ...thaiVoices.filter((v) => v !== femaleVoice)];
      }
    }
    return thaiVoices;
  }

  // Fallback default voice if no specific Thai voice package is installed
  const defaultVoice = allVoices.find((v) => v.default) || allVoices[0];
  return defaultVoice ? [defaultVoice] : [];
}

/**
 * Returns available voices filtered for English (en, en-US, en-GB, etc.).
 * Optionally prioritizes male or female voice if available on the system based on name keywords.
 */
export function getEnglishVoices(gender?: "male" | "female"): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];

  const rawVoices = window.speechSynthesis.getVoices();
  const allVoices = rawVoices.length > 0 ? rawVoices : cachedVoices;

  // Filter available voices for English
  const englishVoices = allVoices.filter((v) => {
    const lang = (v.lang || "").toLowerCase().replace(/_/g, "-");
    const name = (v.name || "").toLowerCase();
    return lang.startsWith("en") || lang.includes("en-") || name.includes("english");
  });

  if (englishVoices.length > 0) {
    if (gender === "male") {
      const maleKeywords = [
        "david",
        "mark",
        "george",
        "guy",
        "james",
        "male",
        "man",
        "daniel",
        "richard",
        "oliver",
        "alex",
      ];
      const matched: SpeechSynthesisVoice[] = [];
      const others: SpeechSynthesisVoice[] = [];
      for (const v of englishVoices) {
        const name = (v.name || "").toLowerCase();
        if (maleKeywords.some((kw) => name.includes(kw))) {
          matched.push(v);
        } else {
          others.push(v);
        }
      }
      if (matched.length > 0) {
        return [...matched, ...others];
      }
    } else if (gender === "female") {
      const femaleKeywords = [
        "zira",
        "jenny",
        "aria",
        "samantha",
        "female",
        "woman",
        "susan",
        "karen",
        "victoria",
        "catherine",
      ];
      const matched: SpeechSynthesisVoice[] = [];
      const others: SpeechSynthesisVoice[] = [];
      for (const v of englishVoices) {
        const name = (v.name || "").toLowerCase();
        if (femaleKeywords.some((kw) => name.includes(kw))) {
          matched.push(v);
        } else {
          others.push(v);
        }
      }
      if (matched.length > 0) {
        return [...matched, ...others];
      }
    }
    return englishVoices;
  }

  // Fallback default voice if no specific English voice is found
  const defaultVoice = allVoices.find((v) => v.default) || allVoices[0];
  return defaultVoice ? [defaultVoice] : [];
}

/**
 * Splits long text (e.g. full lyrics) into smaller readable chunks (<= maxLength chars)
 * along lines, sentences, or punctuation to prevent Chromium Web Speech API from stalling.
 */
export function splitTextIntoChunks(text: string, maxLength: number = 200): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];

  const chunks: string[] = [];

  // Break text into paragraphs or lines first
  const lines = clean.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);

  let currentChunk = "";

  const pushCurrent = () => {
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
  };

  const processLongSegment = (segment: string) => {
    // Split by punctuation or spaces while preserving words
    const tokens = segment.split(/([,.;!?\s]+)/).filter(Boolean);
    let sub = "";

    for (const token of tokens) {
      if (token.length > maxLength) {
        // Unusually long token (no spaces/punctuation), hard slice
        if (sub.trim()) {
          chunks.push(sub.trim());
          sub = "";
        }
        for (let i = 0; i < token.length; i += maxLength) {
          const slice = token.slice(i, i + maxLength).trim();
          if (slice) chunks.push(slice);
        }
      } else if ((sub + token).length <= maxLength) {
        sub += token;
      } else {
        if (sub.trim()) chunks.push(sub.trim());
        sub = token.trimStart();
      }
    }
    if (sub.trim()) {
      chunks.push(sub.trim());
    }
  };

  for (const line of lines) {
    if (line.length > maxLength) {
      pushCurrent();
      processLongSegment(line);
    } else {
      const candidate = currentChunk ? `${currentChunk}\n${line}` : line;
      if (candidate.length <= maxLength) {
        currentChunk = candidate;
      } else {
        pushCurrent();
        currentChunk = line;
      }
    }
  }

  pushCurrent();
  return chunks;
}

// Global session tracking and keepalive timer to prevent Chromium speech synthesis stalling
let currentSpeechSessionId = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
  stopKeepAlive();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  keepAliveTimer = setInterval(() => {
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } catch {}
    } else {
      stopKeepAlive();
    }
  }, 10000);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * Checks whether speech synthesis or HTML5 fallback audio is currently actively speaking.
 */
export function isSpeaking(): boolean {
  const isAudioSpeaking = Boolean(
    activeAudio !== null && !activeAudio.paused && !activeAudio.ended
  );
  const isSynthSpeaking = Boolean(
    isSpeechSupported() && window.speechSynthesis?.speaking
  );
  return isAudioSpeaking || isSynthSpeaking;
}

/**
 * Immediately halts any ongoing speech and cleans up active references
 * (both Web Speech Synthesis and HTML5 Audio fallback).
 */
export function stopSpeaking(): void {
  currentSpeechSessionId++;
  stopKeepAlive();

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.removeAttribute("src");
      activeAudio.load();
    } catch {}
    activeAudio = null;
  }

  if (!isSpeechSupported()) return;

  try {
    window.speechSynthesis.cancel();
  } catch {}

  activeUtterance = null;
}

/**
 * Speaks lyrics in a deadpan, robotic cadence.
 * Supports Thai and English, with male, female, or random voice gender switching (100% free via Web Speech API).
 *
 * For English:
 * - Male: pitch = 0.8, rate = 0.9
 * - Female: pitch = 1.2, rate = 0.95
 *
 * For Thai:
 * - Male: pitch = 0.75, rate = 0.88
 * - Female: pitch = 1.25, rate = 0.95
 *
 * Dual-Engine Architecture:
 * - When female Thai voice is requested on systems without genuine native female voices (e.g. Windows Chrome
 *   which only includes Pattara/Niwat), automatically streams audio from the /api/tts proxy endpoint.
 *
 * Automatically chunks longer texts (> 200 characters) and maintains Chromium keepalive
 * to avoid speech engine cutoffs.
 *
 * @param text The song lyrics to be spoken.
 * @param options Optional configuration (gender, rate, pitch, callbacks).
 */
export function speakLyrics(
  text: string,
  options?: SpeakLyricsOptions
): void {
  const cleanText = text.trim();
  if (!cleanText) {
    options?.onEnd?.();
    return;
  }

  // If master volume is muted or explicitly 0, halt speaking and return
  if (
    options?.volume === 0 ||
    (typeof window !== "undefined" && (isMasterMuted() || getMasterVolume() === 0))
  ) {
    stopSpeaking();
    options?.onEnd?.();
    return;
  }

  // Halt any current playback cleanly
  stopSpeaking();

  // Resolve target voice gender: if "random", randomly pick "male" or "female"
  const rawGender = options?.gender;
  const resolvedGender: "male" | "female" =
    rawGender === "random"
      ? (Math.random() < 0.5 ? "male" : "female")
      : (rawGender ?? "female");

  const isEnglish = Boolean(
    options?.lang?.toLowerCase().startsWith("en") ||
    options?.voice?.lang?.toLowerCase().startsWith("en")
  );

  const hasAudioSupport =
    typeof Audio !== "undefined" ||
    (typeof window !== "undefined" && Boolean((window as any).Audio));

  // DUAL-ENGINE: If female voice is requested for Thai and no genuine native female voice is installed
  // (e.g. Windows Chrome which only has Pattara/Niwat), fallback to HTML5 Audio via /api/tts proxy.
  if (
    !isEnglish &&
    resolvedGender === "female" &&
    !hasGenuineFemaleThaiVoice() &&
    hasAudioSupport
  ) {
    const chunks = splitTextIntoChunks(cleanText, 200);
    if (chunks.length === 0) {
      options?.onEnd?.();
      return;
    }

    const sessionId = ++currentSpeechSessionId;
    let chunkIndex = 0;

    const playNextAudioChunk = () => {
      if (sessionId !== currentSpeechSessionId) return;

      if (chunkIndex >= chunks.length) {
        activeAudio = null;
        options?.onEnd?.();
        return;
      }

      const chunkText = chunks[chunkIndex];
      const audioUrl = `/api/tts?text=${encodeURIComponent(chunkText)}&lang=th&gender=female`;

      let audio: HTMLAudioElement;
      try {
        if (typeof Audio !== "undefined") {
          audio = new Audio(audioUrl);
        } else if (typeof window !== "undefined" && (window as any).Audio) {
          audio = new (window as any).Audio(audioUrl);
        } else {
          options?.onError?.(new Error("Audio playback is not supported in this environment"));
          return;
        }
      } catch (err) {
        options?.onError?.(err);
        return;
      }

      const masterVol = typeof window !== "undefined" ? getMasterVolume() : 1.0;
      const baseVol = options?.volume ?? 1.0;
      const effectiveVol =
        typeof window !== "undefined" && isMasterMuted()
          ? 0
          : Math.max(0, Math.min(1, baseVol * masterVol));

      audio.volume = effectiveVol;
      activeAudio = audio;

      let started = false;
      const handleStart = () => {
        if (sessionId !== currentSpeechSessionId) return;
        if (!started) {
          started = true;
          if (chunkIndex === 0) {
            options?.onStart?.();
          }
        }
      };

      audio.onplay = handleStart;

      audio.onended = () => {
        if (sessionId !== currentSpeechSessionId) return;
        chunkIndex++;
        if (chunkIndex < chunks.length) {
          playNextAudioChunk();
        } else {
          activeAudio = null;
          options?.onEnd?.();
        }
      };

      audio.onerror = (err) => {
        if (sessionId !== currentSpeechSessionId) return;
        activeAudio = null;
        options?.onError?.(err);
      };

      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((err) => {
            if (sessionId !== currentSpeechSessionId) return;
            if (err?.name === "AbortError") return;
            activeAudio = null;
            options?.onError?.(err);
          });
        }
      } catch (err) {
        if (sessionId !== currentSpeechSessionId) return;
        activeAudio = null;
        options?.onError?.(err);
      }
    };

    playNextAudioChunk();
    return;
  }

  // Otherwise, use native browser Web Speech API
  if (!isSpeechSupported()) {
    options?.onError?.(new Error("Web Speech API is not supported in this environment"));
    return;
  }

  // Resume synthesis in case browser put it in paused state
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  // Acoustic defaults:
  // English: Male (pitch: 0.8, rate: 0.9), Female (pitch: 1.2, rate: 0.95)
  // Thai: Male (pitch: 0.75, rate: 0.88), Female (pitch: 1.25, rate: 0.95)
  const defaultPitch = isEnglish
    ? (resolvedGender === "male" ? 0.8 : 1.2)
    : (resolvedGender === "male" ? 0.75 : 1.25);
  const defaultRate = isEnglish
    ? (resolvedGender === "male" ? 0.9 : 0.95)
    : (resolvedGender === "male" ? 0.88 : 0.95);

  const pitch = options?.pitch ?? defaultPitch;
  const rate = options?.rate ?? defaultRate;
  const volume = options?.volume ?? 1.0;

  let selectedVoice: SpeechSynthesisVoice | null = null;
  let targetLang = "th-TH";

  if (isEnglish) {
    const englishVoices = getEnglishVoices(resolvedGender);
    selectedVoice = options?.voice || (englishVoices.length > 0 ? englishVoices[0] : null);
    targetLang = selectedVoice?.lang || options?.lang || "en-US";
  } else {
    const thaiVoices = getThaiVoices(resolvedGender);
    selectedVoice = options?.voice || (thaiVoices.length > 0 ? thaiVoices[0] : null);
    targetLang = selectedVoice?.lang || options?.lang || "th-TH";
  }

  const chunks = splitTextIntoChunks(cleanText, 200);
  if (chunks.length === 0) {
    options?.onEnd?.();
    return;
  }

  const sessionId = ++currentSpeechSessionId;
  let chunkIndex = 0;

  const speakNextChunk = () => {
    if (sessionId !== currentSpeechSessionId) return;

    if (chunkIndex >= chunks.length) {
      activeUtterance = null;
      stopKeepAlive();
      options?.onEnd?.();
      return;
    }

    const chunkText = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunkText);

    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || (isEnglish ? "en-US" : "th-TH");
    } else {
      utterance.lang = isEnglish ? (options?.lang || "en-US") : (options?.lang || "th-TH");
    }

    activeUtterance = utterance;

    utterance.onstart = () => {
      if (sessionId !== currentSpeechSessionId) return;
      if (chunkIndex === 0) {
        options?.onStart?.();
        startKeepAlive();
      }
    };

    utterance.onend = () => {
      if (sessionId !== currentSpeechSessionId) return;
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        speakNextChunk();
      } else {
        activeUtterance = null;
        stopKeepAlive();
        options?.onEnd?.();
      }
    };

    utterance.onerror = (event) => {
      if (sessionId !== currentSpeechSessionId) return;
      activeUtterance = null;
      stopKeepAlive();
      // "canceled" or "interrupted" error codes occur normally when stopped or restarted
      if (event.error !== "canceled" && event.error !== "interrupted") {
        options?.onError?.(event);
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (sessionId !== currentSpeechSessionId) return;
      activeUtterance = null;
      stopKeepAlive();
      options?.onError?.(err);
    }
  };

  speakNextChunk();
}

/**
 * Convenient bundled TTS reader object.
 */
export const ttsReader = {
  getThaiVoices,
  getEnglishVoices,
  hasGenuineFemaleThaiVoice,
  splitTextIntoChunks,
  speakLyrics,
  stopSpeaking,
  isSpeaking,
  isSpeechSupported,
};

export default ttsReader;
