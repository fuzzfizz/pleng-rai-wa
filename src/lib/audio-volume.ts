/**
 * ==========================================
 * เพลงไรวะ (Pleng-Rai-Wa) - Master & SFX Volume Control
 * Global audio volume state management with localStorage persistence,
 * reactive window event pub/sub, composite gain calculation (Master * SFX),
 * procedural SFX synthesizer & HTMLAudioElement sync.
 * ==========================================
 */

import { soundEffects } from "./sound-effects";

// Storage keys & events for Master Volume
export const STORAGE_KEY_MASTER_VOLUME = "pleng_master_volume";
export const STORAGE_KEY_PREV_VOLUME = "pleng_master_volume_prev";
export const EVENT_MASTER_VOLUME_CHANGE = "pleng-master-volume-change";
export const DEFAULT_MASTER_VOLUME = 0.7;

// Storage keys & events for SFX Volume
export const STORAGE_KEY_SFX_VOLUME = "pleng_sfx_volume";
export const STORAGE_KEY_SFX_MUTED = "pleng_sfx_muted";
export const STORAGE_KEY_PREV_SFX_VOLUME = "pleng_sfx_volume_prev";
export const EVENT_SFX_VOLUME_CHANGE = "pleng-sfx-volume-change";
export const DEFAULT_SFX_VOLUME = 0.7;

// Master volume state caches
let cachedVolume: number | null = null;
let cachedPrevVolume: number = DEFAULT_MASTER_VOLUME;

// SFX volume state caches
let cachedSfxVolume: number | null = null;
let cachedSfxMuted: boolean | null = null;
let cachedPrevSfxVolume: number = DEFAULT_SFX_VOLUME;

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
 * Computes composite effective sound effects gain (Master * SFX)
 * and syncs it with the procedural sound synthesizer engine.
 */
export function applyEffectiveSoundEffectsVolume(): void {
  const master = getMasterVolume();
  const sfx = getSfxVolume();
  const isEffectiveMuted = isMasterMuted() || isSfxMuted();
  const effectiveGain = isEffectiveMuted ? 0 : Math.max(0, Math.min(1, master * sfx));
  try {
    soundEffects.setVolume(effectiveGain);
    soundEffects.setMuted(effectiveGain === 0);
  } catch {}
}

/**
 * Sets the master volume level clamped between 0.0 and 1.0.
 * Persists to localStorage, notifies subscribers via window event,
 * and updates procedural sound effect synthesizer volume with composite gain.
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

  applyEffectiveSoundEffectsVolume();
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
    applyEffectiveSoundEffectsVolume();
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
    applyEffectiveSoundEffectsVolume();
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

/**
 * Returns current SFX volume level clamped between 0.0 and 1.0.
 * Defaults to 0.7. Safe for SSR.
 */
export function getSfxVolume(): number {
  if (typeof window === "undefined") {
    return cachedSfxVolume ?? DEFAULT_SFX_VOLUME;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_SFX_VOLUME);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) {
        const clamped = Math.max(0, Math.min(1, parsed));
        cachedSfxVolume = clamped;
        return clamped;
      }
    } else {
      cachedSfxVolume = null;
      return DEFAULT_SFX_VOLUME;
    }
  } catch {}

  if (cachedSfxVolume !== null) return cachedSfxVolume;
  return DEFAULT_SFX_VOLUME;
}

/**
 * Returns whether SFX is currently muted (default false, or if volume === 0).
 */
export function isSfxMuted(): boolean {
  if (getSfxVolume() === 0) return true;
  if (typeof window === "undefined") {
    return cachedSfxMuted ?? false;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_SFX_MUTED);
    if (stored !== null) {
      cachedSfxMuted = stored === "true";
      return cachedSfxMuted;
    } else {
      cachedSfxMuted = null;
      return false;
    }
  } catch {
    return cachedSfxMuted ?? false;
  }
}

/**
 * Updates SFX mute state, persists to localStorage,
 * dispatches EVENT_SFX_VOLUME_CHANGE and applies composite gain.
 */
export function setSfxMuted(muted: boolean): void {
  cachedSfxMuted = muted;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_SFX_MUTED, String(muted));
      window.dispatchEvent(
        new CustomEvent(EVENT_SFX_VOLUME_CHANGE, {
          detail: { volume: getSfxVolume(), muted },
        })
      );
    } catch {}
  }
  applyEffectiveSoundEffectsVolume();
}

/**
 * Sets the SFX volume level clamped between 0.0 and 1.0.
 * Persists to localStorage, notifies subscribers, and updates composite gain.
 */
export function setSfxVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  cachedSfxVolume = clamped;
  if (clamped > 0) {
    cachedPrevSfxVolume = clamped;
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_SFX_VOLUME, String(clamped));
      if (clamped > 0) {
        localStorage.setItem(STORAGE_KEY_PREV_SFX_VOLUME, String(clamped));
      }
      window.dispatchEvent(
        new CustomEvent(EVENT_SFX_VOLUME_CHANGE, {
          detail: { volume: clamped, muted: isSfxMuted() },
        })
      );
    } catch {}
  }

  applyEffectiveSoundEffectsVolume();
}

/**
 * Toggles SFX mute state.
 * If muted, un-mutes (restoring previous volume or default 0.7 if volume was 0) and returns false.
 * If unmuted, mutes (saving previous volume) and returns true.
 */
export function toggleSfxMute(): boolean {
  const currentlyMuted = isSfxMuted();
  if (currentlyMuted) {
    // Un-mute
    setSfxMuted(false);
    if (getSfxVolume() === 0) {
      let restore = cachedPrevSfxVolume;
      if (typeof window !== "undefined") {
        try {
          const savedPrev = localStorage.getItem(STORAGE_KEY_PREV_SFX_VOLUME);
          if (savedPrev !== null) {
            const parsed = parseFloat(savedPrev);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
              restore = parsed;
            }
          }
        } catch {}
      }
      if (restore <= 0) {
        restore = DEFAULT_SFX_VOLUME;
      }
      setSfxVolume(restore);
    }
    return false;
  } else {
    // Mute
    const current = getSfxVolume();
    if (current > 0) {
      cachedPrevSfxVolume = current;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY_PREV_SFX_VOLUME, String(current));
        } catch {}
      }
    }
    setSfxMuted(true);
    return true;
  }
}

/**
 * Subscribes to SFX volume and mute state changes across the application.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeSfxVolume(
  callback: (vol: number, muted: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ volume?: number; muted?: boolean }>;
    const vol =
      typeof custom.detail?.volume === "number"
        ? custom.detail.volume
        : getSfxVolume();
    const muted =
      typeof custom.detail?.muted === "boolean"
        ? custom.detail.muted
        : isSfxMuted();
    callback(vol, muted);
  };

  window.addEventListener(EVENT_SFX_VOLUME_CHANGE, handler);
  return () => {
    window.removeEventListener(EVENT_SFX_VOLUME_CHANGE, handler);
  };
}
