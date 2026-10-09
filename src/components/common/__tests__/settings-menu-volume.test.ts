import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getInitialSettingsVolumeState,
  handleMasterSliderChange,
  handleSfxSliderChange,
  handleToggleMasterMuteAction,
  handleToggleSfxMuteAction,
  handleTestSfxAudio,
} from "../settings-menu";
import * as audioVolumeModule from "@/lib/audio-volume";
import { soundEffects } from "@/lib/sound-effects";

describe("SettingsMenu volume helpers and state", () => {
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

    vi.spyOn(soundEffects, "click").mockImplementation(() => {});
    vi.spyOn(soundEffects, "correct").mockImplementation(() => {});
    vi.spyOn(soundEffects, "setVolume").mockImplementation(() => {});
    vi.spyOn(soundEffects, "setMuted").mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  describe("Initial State Loading", () => {
    it("loads initial master and sfx volume correctly from audio-volume module", () => {
      audioVolumeModule.setMasterVolume(0.8);
      audioVolumeModule.setSfxVolume(0.5);
      audioVolumeModule.setSfxMuted(false);

      const state = getInitialSettingsVolumeState();

      expect(state.masterVolume).toBe(80);
      expect(state.sfxVolume).toBe(50);
      expect(state.isMasterMuted).toBe(false);
      expect(state.isSfxMuted).toBe(false);
    });

    it("detects muted states when volumes are zero or muted flag is true", () => {
      audioVolumeModule.setMasterVolume(0);
      audioVolumeModule.setSfxVolume(0.7);
      audioVolumeModule.setSfxMuted(true);

      const state = getInitialSettingsVolumeState();

      expect(state.masterVolume).toBe(0);
      expect(state.isMasterMuted).toBe(true);
      expect(state.isSfxMuted).toBe(true);
    });
  });

  describe("Master Volume Slider Change", () => {
    it("dispatches setMasterVolume with normalized float value (0.0 to 1.0)", () => {
      const setMasterSpy = vi.spyOn(audioVolumeModule, "setMasterVolume");

      const result = handleMasterSliderChange(45);

      expect(result).toBe(45);
      expect(setMasterSpy).toHaveBeenCalledWith(0.45);
      expect(audioVolumeModule.getMasterVolume()).toBe(0.45);
    });

    it("clamps master volume between 0 and 100", () => {
      const setMasterSpy = vi.spyOn(audioVolumeModule, "setMasterVolume");

      handleMasterSliderChange(-15);
      expect(setMasterSpy).toHaveBeenCalledWith(0);

      handleMasterSliderChange(125);
      expect(setMasterSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("SFX Volume Slider Change", () => {
    it("dispatches setSfxVolume with normalized float value (0.0 to 1.0)", () => {
      const setSfxSpy = vi.spyOn(audioVolumeModule, "setSfxVolume");

      const result = handleSfxSliderChange(60);

      expect(result).toBe(60);
      expect(setSfxSpy).toHaveBeenCalledWith(0.6);
      expect(audioVolumeModule.getSfxVolume()).toBe(0.6);
    });

    it("clamps sfx volume between 0 and 100", () => {
      const setSfxSpy = vi.spyOn(audioVolumeModule, "setSfxVolume");

      handleSfxSliderChange(-20);
      expect(setSfxSpy).toHaveBeenCalledWith(0);

      handleSfxSliderChange(150);
      expect(setSfxSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("Mute Toggles", () => {
    it("sfx mute toggle calls toggleSfxMute and plays UI click feedback", () => {
      audioVolumeModule.setSfxVolume(0.7);
      audioVolumeModule.setSfxMuted(false);

      const toggleSfxSpy = vi.spyOn(audioVolumeModule, "toggleSfxMute");

      const res = handleToggleSfxMuteAction();

      expect(soundEffects.click).toHaveBeenCalled();
      expect(toggleSfxSpy).toHaveBeenCalledTimes(1);
      expect(res.isMuted).toBe(true);
    });

    it("master mute toggle calls toggleMasterMute and plays UI click feedback", () => {
      audioVolumeModule.setMasterVolume(0.7);

      const toggleMasterSpy = vi.spyOn(audioVolumeModule, "toggleMasterMute");

      const res = handleToggleMasterMuteAction();

      expect(soundEffects.click).toHaveBeenCalled();
      expect(toggleMasterSpy).toHaveBeenCalledTimes(1);
      expect(res.isMuted).toBe(true);
      expect(res.volume).toBe(0);
    });
  });

  describe("Test Audio Button", () => {
    it("triggers procedural chime soundEffect.correct()", () => {
      handleTestSfxAudio();

      expect(soundEffects.correct).toHaveBeenCalledTimes(1);
    });
  });
});
