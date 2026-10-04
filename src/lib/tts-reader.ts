/**
 * Client-side Web Speech API (window.speechSynthesis) integration for "โหมด AI อ่านเนื้อเพลง"
 *
 * 100% Free, Unlimited, Native on iOS Safari, Android Chrome, Windows Edge/Chrome.
 * Reads Thai lyrics in deadpan robotic style for guessing games.
 */

export interface SpeakLyricsOptions {
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
 * If no specific Thai voice is installed on the operating system, returns fallback default voices.
 */
export function getThaiVoices(): SpeechSynthesisVoice[] {
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
 * Speaks Thai lyrics in a deadpan, robotic, comical cadence.
 * Handles canceling ongoing speech cleanly before starting new speech.
 *
 * @param text The song lyrics to be spoken.
 * @param options Optional configuration (rate, pitch, callbacks).
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

  // Robotic deadpan defaults: slightly slower pace (0.9), neutral monotone pitch (1.0)
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = options?.volume ?? 1.0;

  // Select voice: user-provided voice -> first Thai voice -> fallback
  const thaiVoices = getThaiVoices();
  const selectedVoice = options?.voice || (thaiVoices.length > 0 ? thaiVoices[0] : null);

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || "th-TH";
  } else {
    utterance.lang = "th-TH";
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
