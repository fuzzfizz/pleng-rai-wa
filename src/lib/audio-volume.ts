/**
 * ==========================================
 * เพลงไรวะ (Pleng-Rai-Wa) - Master Volume Control
 * Global audio volume state management with localStorage persistence,
 * reactive window event pub/sub, procedural SFX & HTMLAudioElement sync.
 * ==========================================
 */

import { soundEffects } from "./sound-effects";

export const STORAGE_KEY_MASTER_VOLUME = "pleng_master_volume";
export const STORAGE_KEY_PREV_VOLUME = "pleng_master_volume_prev";
export const EVENT_MASTER_VOLUME_CHANGE = "pleng-master-volume-change";
export const DEFAULT_MASTER_VOLUME = 0.7;

let cachedVolume: number | null = null;
let cachedPrevVolume: number = DEFAULT_MASTER_VOLUME;

/**
 * Returns current master volume level as a number between 0.0 and 1.0.
 * Defaults to 0.7. Safe for SSR.
 */
export function getMasterVolume(): number {
  if (typeof window === "undefined") return DEFAULT_MASTER_VOLUME;

  try {
    const saved = localStorage.getItem(STORAGE_KEY_MASTER_VOLUME);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        cachedVolume = parsed;
        return parsed;
      }
    }
  } catch {}

  if (cachedVolume !== null) return cachedVolume;
  return DEFAULT_MASTER_VOLUME;
}

/**
 * Sets the master volume level clamped between 0.0 and 1.0.
 * Persists to localStorage, notifies subscribers via window event,
 * and updates procedural sound effect synthesizer volume.
 */
export function setMasterVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  cachedVolume = clamped;
  if (clamped > 0) {
    cachedPrevVolume = clamped;
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_MASTER_VOLUME, String(clamped));
      if (clamped > 0) {
        localStorage.setItem(STORAGE_KEY_PREV_VOLUME, String(clamped));
      }
      window.dispatchEvent(
        new CustomEvent(EVENT_MASTER_VOLUME_CHANGE, { detail: clamped })
      );
    } catch {}
  }

  try {
    soundEffects.setVolume(clamped);
    soundEffects.setMuted(clamped === 0);
  } catch {}
}

/**
 * Returns whether master volume is currently muted (volume === 0).
 */
export function isMasterMuted(): boolean {
  return getMasterVolume() === 0;
}

/**
 * Toggles master mute state.
 * If unmuted (> 0), stores previous volume and mutes to 0 (returns true).
 * If muted (=== 0), restores previous non-zero volume (returns false).
 */
export function toggleMasterMute(): boolean {
  const current = getMasterVolume();
  if (current > 0) {
    cachedPrevVolume = current;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_PREV_VOLUME, String(current));
      } catch {}
    }
    setMasterVolume(0);
    return true;
  } else {
    let restore = cachedPrevVolume;
    if (typeof window !== "undefined") {
      try {
        const savedPrev = localStorage.getItem(STORAGE_KEY_PREV_VOLUME);
        if (savedPrev !== null) {
          const parsed = parseFloat(savedPrev);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
            restore = parsed;
          }
        }
      } catch {}
    }
    if (restore <= 0) {
      restore = DEFAULT_MASTER_VOLUME;
    }
    setMasterVolume(restore);
    return false;
  }
}

/**
 * Subscribes to master volume changes across the application.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeMasterVolume(callback: (vol: number) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<number>;
    callback(typeof custom.detail === "number" ? custom.detail : getMasterVolume());
  };

  window.addEventListener(EVENT_MASTER_VOLUME_CHANGE, handler);
  return () => {
    window.removeEventListener(EVENT_MASTER_VOLUME_CHANGE, handler);
  };
}
