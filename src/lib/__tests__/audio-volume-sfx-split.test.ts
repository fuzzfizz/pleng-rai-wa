import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getMasterVolume,
  setMasterVolume,
  isMasterMuted,
  toggleMasterMute,
  getSfxVolume,
  setSfxVolume,
  isSfxMuted,
  setSfxMuted,
  toggleSfxMute,
  subscribeSfxVolume,
  applyEffectiveSoundEffectsVolume,
  STORAGE_KEY_SFX_VOLUME,
  STORAGE_KEY_SFX_MUTED,
  STORAGE_KEY_PREV_SFX_VOLUME,
  EVENT_SFX_VOLUME_CHANGE,
  DEFAULT_SFX_VOLUME,
} from "../audio-volume";
import { soundEffects } from "../sound-effects";

describe("audio-volume SFX split & composite gain engine", () => {
  let mockStorage: Record<string, string>;
  let listeners: Record<string, Function[]>;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    mockStorage = {};
    listeners = {};

    const mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    const mockWindow = {
      localStorage: mockLocalStorage,
      addEventListener: vi.fn((event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      }),
      removeEventListener: vi.fn((event: string, callback: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((cb) => cb !== callback);
        }
      }),
      dispatchEvent: vi.fn((event: CustomEvent) => {
        const cbs = listeners[event.type] || [];
        for (const cb of cbs) {
          cb(event);
        }
        return true;
      }),
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).localStorage = mockLocalStorage;

    vi.spyOn(soundEffects, "setVolume").mockImplementation(() => {});
    vi.spyOn(soundEffects, "setMuted").mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  describe("getSfxVolume and clamping", () => {
    it("returns default volume 0.7 when localStorage is empty", () => {
      delete mockStorage[STORAGE_KEY_SFX_VOLUME];
      setSfxVolume(DEFAULT_SFX_VOLUME);
      expect(getSfxVolume()).toBe(0.7);
    });

    it("clamps volume between 0.0 and 1.0", () => {
      setSfxVolume(-0.5);
      expect(getSfxVolume()).toBe(0);

      setSfxVolume(1.8);
      expect(getSfxVolume()).toBe(1);

      setSfxVolume(0.42);
      expect(getSfxVolume()).toBe(0.42);
    });

    it("clamps invalid or out-of-range values retrieved from localStorage", () => {
      mockStorage[STORAGE_KEY_SFX_VOLUME] = "2.5";
      expect(getSfxVolume()).toBe(1.0);

      mockStorage[STORAGE_KEY_SFX_VOLUME] = "-0.8";
      expect(getSfxVolume()).toBe(0.0);
    });
  });

  describe("setSfxVolume persistence and updates", () => {
    it("persists volume to localStorage and updates prev volume when positive", () => {
      setSfxVolume(0.65);
      expect(mockStorage[STORAGE_KEY_SFX_VOLUME]).toBe("0.65");
      expect(mockStorage[STORAGE_KEY_PREV_SFX_VOLUME]).toBe("0.65");
      expect(getSfxVolume()).toBe(0.65);
    });

    it("does not overwrite prev volume when setting to 0", () => {
      setSfxVolume(0.75);
      expect(mockStorage[STORAGE_KEY_PREV_SFX_VOLUME]).toBe("0.75");

      setSfxVolume(0);
      expect(mockStorage[STORAGE_KEY_SFX_VOLUME]).toBe("0");
      expect(mockStorage[STORAGE_KEY_PREV_SFX_VOLUME]).toBe("0.75");
    });
  });

  describe("isSfxMuted and toggleSfxMute", () => {
    it("reports muted if volume is 0 or if muted flag is set", () => {
      setSfxVolume(0.5);
      setSfxMuted(false);
      expect(isSfxMuted()).toBe(false);

      setSfxMuted(true);
      expect(isSfxMuted()).toBe(true);

      setSfxMuted(false);
      setSfxVolume(0);
      expect(isSfxMuted()).toBe(true);
    });

    it("toggleSfxMute toggles mute state and remembers previous volume", () => {
      setSfxVolume(0.85);
      setSfxMuted(false);
      expect(isSfxMuted()).toBe(false);

      // Toggle mute ON
      const muted = toggleSfxMute();
      expect(muted).toBe(true);
      expect(isSfxMuted()).toBe(true);
      expect(mockStorage[STORAGE_KEY_SFX_MUTED]).toBe("true");
      expect(mockStorage[STORAGE_KEY_PREV_SFX_VOLUME]).toBe("0.85");

      // Toggle mute OFF -> restores previous state
      const unmuted = toggleSfxMute();
      expect(unmuted).toBe(false);
      expect(isSfxMuted()).toBe(false);
      expect(mockStorage[STORAGE_KEY_SFX_MUTED]).toBe("false");
      expect(getSfxVolume()).toBe(0.85);
    });

    it("toggleSfxMute restores previous volume when volume was set to 0", () => {
      setSfxVolume(0.9);
      setSfxVolume(0);
      expect(isSfxMuted()).toBe(true);

      const unmuted = toggleSfxMute();
      expect(unmuted).toBe(false);
      expect(isSfxMuted()).toBe(false);
      expect(getSfxVolume()).toBe(0.9);
    });
  });

  describe("subscribeSfxVolume event bus", () => {
    it("receives updates when setSfxVolume or toggleSfxMute is called", () => {
      const history: Array<{ vol: number; muted: boolean }> = [];
      const unsubscribe = subscribeSfxVolume((vol, muted) => {
        history.push({ vol, muted });
      });

      setSfxVolume(0.5);
      toggleSfxMute();
      toggleSfxMute();

      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history[0]).toEqual({ vol: 0.5, muted: false });
      expect(history[1]).toEqual({ vol: 0.5, muted: true });
      expect(history[2]).toEqual({ vol: 0.5, muted: false });

      unsubscribe();
      setSfxVolume(0.9);
      expect(history.length).toBe(3);
    });
  });

  describe("composite effective volume calculation", () => {
    it("calculates composite gain: Master 0.8 * SFX 0.5 = 0.4 gain on soundEffects", () => {
      setMasterVolume(0.8);
      setSfxVolume(0.5);
      setSfxMuted(false);

      applyEffectiveSoundEffectsVolume();

      expect(soundEffects.setVolume).toHaveBeenLastCalledWith(0.4);
      expect(soundEffects.setMuted).toHaveBeenLastCalledWith(false);
    });

    it("scales soundEffects to 0.0 when Master is muted (0.0) even if SFX is 1.0", () => {
      setSfxVolume(1.0);
      setSfxMuted(false);
      setMasterVolume(0);

      applyEffectiveSoundEffectsVolume();

      expect(soundEffects.setVolume).toHaveBeenLastCalledWith(0);
      expect(soundEffects.setMuted).toHaveBeenLastCalledWith(true);
    });

    it("scales soundEffects to 0.0 when SFX is muted even if Master is 1.0", () => {
      setMasterVolume(1.0);
      setSfxVolume(0.8);
      setSfxMuted(true);

      applyEffectiveSoundEffectsVolume();

      expect(soundEffects.setVolume).toHaveBeenLastCalledWith(0);
      expect(soundEffects.setMuted).toHaveBeenLastCalledWith(true);
    });

    it("automatically updates composite SFX volume when setMasterVolume is called", () => {
      setSfxVolume(0.5);
      setSfxMuted(false);
      vi.clearAllMocks();

      setMasterVolume(0.6);

      // 0.6 * 0.5 = 0.30
      expect(soundEffects.setVolume).toHaveBeenCalledWith(0.3);
      expect(soundEffects.setMuted).toHaveBeenCalledWith(false);
    });
  });
});
