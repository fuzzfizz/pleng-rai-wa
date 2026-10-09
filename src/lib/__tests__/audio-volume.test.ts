import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getMasterVolume,
  setMasterVolume,
  isMasterMuted,
  toggleMasterMute,
  subscribeMasterVolume,
  STORAGE_KEY_MASTER_VOLUME,
  STORAGE_KEY_PREV_VOLUME,
  EVENT_MASTER_VOLUME_CHANGE,
} from "../audio-volume";
import { soundEffects } from "../sound-effects";

describe("audio-volume", () => {
  let mockStorage: Record<string, string>;
  let listeners: Record<string, Function[]>;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    mockStorage = {};
    listeners = {};

    // Mock localStorage
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

    // Mock Window Event Target
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

    // Assign to globalThis
    (globalThis as any).window = mockWindow;
    (globalThis as any).localStorage = mockLocalStorage;
    vi.spyOn(soundEffects, "setVolume").mockImplementation(() => {});
    vi.spyOn(soundEffects, "setMuted").mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  it("returns default volume 0.7 when localStorage is empty", () => {
    delete mockStorage[STORAGE_KEY_MASTER_VOLUME];
    setMasterVolume(0.7);
    expect(getMasterVolume()).toBe(0.7);
  });

  it("clamps volume between 0 and 1", () => {
    setMasterVolume(-0.25);
    expect(getMasterVolume()).toBe(0);

    setMasterVolume(1.8);
    expect(getMasterVolume()).toBe(1);

    setMasterVolume(0.42);
    expect(getMasterVolume()).toBe(0.42);
  });

  it("persists clamped volume to localStorage and updates soundEffects", () => {
    setMasterVolume(0.65);
    expect(mockStorage[STORAGE_KEY_MASTER_VOLUME]).toBe("0.65");
    expect(soundEffects.setVolume).toHaveBeenCalledWith(0.65 * 0.7);
    expect(soundEffects.setMuted).toHaveBeenCalledWith(false);
  });

  it("reports isMasterMuted correctly", () => {
    setMasterVolume(0.5);
    expect(isMasterMuted()).toBe(false);

    setMasterVolume(0);
    expect(isMasterMuted()).toBe(true);
    expect(soundEffects.setMuted).toHaveBeenCalledWith(true);
  });

  it("toggles master mute on and off, remembering previous non-zero volume", () => {
    setMasterVolume(0.85);
    expect(isMasterMuted()).toBe(false);

    // Mute
    const isNowMuted = toggleMasterMute();
    expect(isNowMuted).toBe(true);
    expect(getMasterVolume()).toBe(0);
    expect(mockStorage[STORAGE_KEY_PREV_VOLUME]).toBe("0.85");

    // Unmute -> restores 0.85
    const isUnmuted = toggleMasterMute();
    expect(isUnmuted).toBe(false);
    expect(getMasterVolume()).toBe(0.85);
  });

  it("dispatches window event and notifies subscribeMasterVolume listener", () => {
    const received: number[] = [];
    const unsubscribe = subscribeMasterVolume((vol) => {
      received.push(vol);
    });

    setMasterVolume(0.3);
    setMasterVolume(0.9);

    expect(received).toEqual([0.3, 0.9]);

    // Unsubscribe should cease updates
    unsubscribe();
    setMasterVolume(0.5);
    expect(received).toEqual([0.3, 0.9]);
  });
});
