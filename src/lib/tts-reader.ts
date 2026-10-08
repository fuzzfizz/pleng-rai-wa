/**
 * Client-side Web Speech API (window.speechSynthesis) integration for "โหมด AI อ่านเนื้อเพลง"
 *
 * 100% Free, Unlimited, Native on iOS Safari, Android Chrome, Windows Edge/Chrome.
 * Reads Thai lyrics in deadpan robotic style for guessing games with male/female voice switching.
 */

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
let cachedVoices: SpeechSynthesisVoice[] = [];

// Initialize voices listener if in browser environment
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
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
        return (
          name.includes("premwadee") ||
          name.includes("kanya") ||
          name.includes("achara") ||
          name.includes("narisa") ||
          name.includes("female") ||
          name.includes("woman")
        );
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
 * Checks whether speech synthesis is currently actively speaking.
 */
export function isSpeaking(): boolean {
  if (!isSpeechSupported()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Immediately halts any ongoing speech and cleans up active references.
 */
export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;

  try {
    window.speechSynthesis.cancel();
  } catch {}

  activeUtterance = null;
}

/**
 * Speaks Thai lyrics in a deadpan, robotic cadence.
 * Supports male, female, or random voice gender switching (100% free via Web Speech API).
 *
 * - For "male": pitch = 0.75, rate = 0.88.
 * - For "female": pitch = 1.25, rate = 0.95.
 *
 * @param text The song lyrics to be spoken.
 * @param options Optional configuration (gender, rate, pitch, callbacks).
 */
export function speakLyrics(
  text: string,
  options?: SpeakLyricsOptions
): void {
  if (!isSpeechSupported()) {
    options?.onError?.(new Error("Web Speech API is not supported in this environment"));
    return;
  }

  const cleanText = text.trim();
  if (!cleanText) {
    options?.onEnd?.();
    return;
  }

  // Halt any current playback cleanly
  stopSpeaking();

  // Resume synthesis in case browser put it in paused state
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Resolve target voice gender: if "random", randomly pick "male" or "female"
  const rawGender = options?.gender;
  const resolvedGender: "male" | "female" =
    rawGender === "random"
      ? (Math.random() < 0.5 ? "male" : "female")
      : (rawGender ?? "female");

  // Voice acoustic defaults:
  // Male: lower pitch (0.75), slightly slower robotic rate (0.88)
  // Female: higher pitch (1.25), slightly faster comedic rate (0.95)
  const defaultPitch = resolvedGender === "male" ? 0.75 : 1.25;
  const defaultRate = resolvedGender === "male" ? 0.88 : 0.95;

  utterance.pitch = options?.pitch ?? defaultPitch;
  utterance.rate = options?.rate ?? defaultRate;
  utterance.volume = options?.volume ?? 1.0;

  const isEnglish = options?.lang?.toLowerCase().startsWith("en");

  if (isEnglish) {
    const rawVoices = window.speechSynthesis.getVoices();
    const allVoices = rawVoices.length > 0 ? rawVoices : cachedVoices;
    const enVoice = allVoices.find((v) => (v.lang || "").toLowerCase().startsWith("en"));
    if (enVoice) {
      utterance.voice = enVoice;
      utterance.lang = enVoice.lang || "en-US";
    } else {
      utterance.lang = "en-US";
    }
  } else {
    // Look up available Thai voices from Web Speech API
    const thaiVoices = getThaiVoices(resolvedGender);
    const selectedVoice = options?.voice || (thaiVoices.length > 0 ? thaiVoices[0] : null);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || "th-TH";
    } else {
      utterance.lang = "th-TH";
    }
  }

  // Retain active reference to prevent GC from terminating speech early
  activeUtterance = utterance;

  utterance.onstart = () => {
    options?.onStart?.();
  };

  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
    }
    options?.onEnd?.();
  };

  utterance.onerror = (event) => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
    }
    // "canceled" or "interrupted" error codes occur normally when stopped or restarted
    if (event.error !== "canceled" && event.error !== "interrupted") {
      options?.onError?.(event);
    }
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    activeUtterance = null;
    options?.onError?.(err);
  }
}

/**
 * Convenient bundled TTS reader object.
 */
export const ttsReader = {
  getThaiVoices,
  speakLyrics,
  stopSpeaking,
  isSpeaking,
  isSpeechSupported,
};

export default ttsReader;
