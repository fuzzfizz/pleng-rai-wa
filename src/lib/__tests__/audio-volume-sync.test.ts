import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getMasterVolume,
  setMasterVolume,
  isMasterMuted,
  toggleMasterMute,
  subscribeMasterVolume,
  DEFAULT_MASTER_VOLUME,
  STORAGE_KEY_MASTER_VOLUME,
  STORAGE_KEY_PREV_VOLUME,
} from "../audio-volume";
import { soundEffects } from "../sound-effects";
import { ttsReader } from "../tts-reader";

describe("audio-volume synchronization", () => {
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

    (globalThis as any).window = mockWindow;
    (globalThis as any).localStorage = mockLocalStorage;
    vi.spyOn(soundEffects, "setVolume").mockImplementation(() => {});
    vi.spyOn(soundEffects, "setMuted").mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  it("triggers subscribeMasterVolume callbacks when setMasterVolume is called", () => {
    const volumeHistory: number[] = [];
    const unsubscribe = subscribeMasterVolume((vol) => {
      volumeHistory.push(vol);
    });

    setMasterVolume(0.4);
    setMasterVolume(0.85);
    setMasterVolume(1.2); // clamped to 1.0
    setMasterVolume(-0.3); // clamped to 0.0

    expect(volumeHistory).toEqual([0.4, 0.85, 1.0, 0.0]);

    unsubscribe();
    setMasterVolume(0.6);
    // No new callbacks after unsubscribe
    expect(volumeHistory).toEqual([0.4, 0.85, 1.0, 0.0]);
  });

  it("updates mock HTMLAudioElement volume and muted state in real-time", () => {
    // Mock HTMLAudioElement
    const mockAudio = {
      volume: 1,
      muted: false,
    };

    const syncToAudio = (newVol: number) => {
      mockAudio.volume = Math.max(0, Math.min(1, newVol));
      mockAudio.muted = newVol === 0;
    };

    const unsubscribe = subscribeMasterVolume(syncToAudio);

    // Initial sync
    setMasterVolume(0.6);
    expect(mockAudio.volume).toBe(0.6);
    expect(mockAudio.muted).toBe(false);

    // Turn down to 0 (mute)
    setMasterVolume(0);
    expect(mockAudio.volume).toBe(0);
    expect(mockAudio.muted).toBe(true);

    // Turn up to 0.95
    setMasterVolume(0.95);
    expect(mockAudio.volume).toBe(0.95);
    expect(mockAudio.muted).toBe(false);

    unsubscribe();
  });

  it("syncs initial playback state using getMasterVolume and isMasterMuted", () => {
    setMasterVolume(0.45);

    const mockAudio = {
      volume: 0,
      muted: false,
    };

    // Mimic component starting playback
    mockAudio.volume = getMasterVolume();
    mockAudio.muted = isMasterMuted();

    expect(mockAudio.volume).toBe(0.45);
    expect(mockAudio.muted).toBe(false);

    // Now test when master is muted
    setMasterVolume(0);
    const mockMutedAudio = {
      volume: 1,
      muted: false,
    };
    mockMutedAudio.volume = getMasterVolume();
    mockMutedAudio.muted = isMasterMuted();

    expect(mockMutedAudio.volume).toBe(0);
    expect(mockMutedAudio.muted).toBe(true);
  });

  it("handles toggleMasterMute and restoration for attached audio elements", () => {
    const mockAudio = {
      volume: 1,
      muted: false,
    };

    const unsubscribe = subscribeMasterVolume((newVol) => {
      mockAudio.volume = Math.max(0, Math.min(1, newVol));
      mockAudio.muted = newVol === 0;
    });

    // Start with volume 0.75
    setMasterVolume(0.75);
    expect(mockAudio.volume).toBe(0.75);
    expect(mockAudio.muted).toBe(false);
    expect(isMasterMuted()).toBe(false);

    // Toggle mute -> should mute
    const muted = toggleMasterMute();
    expect(muted).toBe(true);
    expect(isMasterMuted()).toBe(true);
    expect(getMasterVolume()).toBe(0);
    expect(mockAudio.volume).toBe(0);
    expect(mockAudio.muted).toBe(true);

    // Toggle mute again -> should restore previous volume (0.75)
    const unmuted = toggleMasterMute();
    expect(unmuted).toBe(false);
    expect(isMasterMuted()).toBe(false);
    expect(getMasterVolume()).toBe(0.75);
    expect(mockAudio.volume).toBe(0.75);
    expect(mockAudio.muted).toBe(false);

    unsubscribe();
  });

  it("supports multiple simultaneous listeners (e.g. vinyl + reveal card + solo player)", () => {
    const vinylAudio = { volume: 1, muted: false };
    const revealAudio = { volume: 1, muted: false };
    const soloAudio = { volume: 1, muted: false };

    const unsubs = [
      subscribeMasterVolume((vol) => {
        vinylAudio.volume = Math.max(0, Math.min(1, vol));
        vinylAudio.muted = vol === 0;
      }),
      subscribeMasterVolume((vol) => {
        revealAudio.volume = Math.max(0, Math.min(1, vol));
        revealAudio.muted = vol === 0;
      }),
      subscribeMasterVolume((vol) => {
        soloAudio.volume = Math.max(0, Math.min(1, vol));
        soloAudio.muted = vol === 0;
      }),
    ];

    setMasterVolume(0.3);

    expect(vinylAudio.volume).toBe(0.3);
    expect(revealAudio.volume).toBe(0.3);
    expect(soloAudio.volume).toBe(0.3);

    setMasterVolume(0);
    expect(vinylAudio.muted).toBe(true);
    expect(revealAudio.muted).toBe(true);
    expect(soloAudio.muted).toBe(true);

    unsubs.forEach((unsub) => unsub());
  });

  it("halts and prevents TTS playback when master volume is muted or 0", () => {
    const mockCancel = vi.fn();
    const mockSpeak = vi.fn();

    (globalThis as any).window.speechSynthesis = {
      cancel: mockCancel,
      speak: mockSpeak,
      speaking: false,
      paused: false,
      getVoices: vi.fn(() => []),
      onvoiceschanged: null,
    };
    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    // Case 1: Master volume is 0
    setMasterVolume(0);
    expect(isMasterMuted()).toBe(true);

    ttsReader.speakLyrics("ใจสั่งมา - เสก โลโซ");
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();

    mockCancel.mockClear();
    mockSpeak.mockClear();

    // Case 2: Master volume is active (> 0)
    setMasterVolume(0.8);
    expect(isMasterMuted()).toBe(false);

    ttsReader.speakLyrics("ใจสั่งมา - เสก โลโซ");
    expect(mockSpeak).toHaveBeenCalled();

    // Case 3: Master volume is turned to 0 while speaking
    setMasterVolume(0);
    expect(mockCancel).toHaveBeenCalled();
  });

  it("ensures procedural ambient synth respects mute state and dynamic volume adjustments", async () => {
    const gainNodes: any[] = [];
    const mockCtx = {
      currentTime: 10,
      destination: {},
      createGain: vi.fn(() => {
        const node = {
          gain: {
            value: 1,
            setValueAtTime: vi.fn((val) => {
              node.gain.value = val;
            }),
            linearRampToValueAtTime: vi.fn((val) => {
              node.gain.value = val;
            }),
            exponentialRampToValueAtTime: vi.fn((val) => {
              node.gain.value = val;
            }),
            cancelScheduledValues: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        gainNodes.push(node);
        return node;
      }),
      createBiquadFilter: vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createOscillator: vi.fn(() => ({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
    };

    const soundEffectsModule = await import("../sound-effects");
    vi.spyOn(soundEffectsModule, "getAudioContext").mockReturnValue(mockCtx as any);

    const { createProceduralAmbientSynth } = await import(
      "../../components/common/three-vinyl-canvas"
    );

    // Case 1: Start muted -> target gain should stay at silence (0.0001)
    const mutedSynth = createProceduralAmbientSynth(0, true);
    expect(mutedSynth).not.toBeNull();
    const masterGain1 = gainNodes[0];
    expect(masterGain1.gain.value).toBe(0.0001);
    mutedSynth?.stop();

    // Case 2: Start with volume 0.8 -> target gain ramps to 0.8 * 0.18 = 0.144
    gainNodes.length = 0;
    const activeSynth = createProceduralAmbientSynth(0.8, false);
    expect(activeSynth).not.toBeNull();
    const masterGain2 = gainNodes[0];
    expect(masterGain2.gain.value).toBeCloseTo(0.144, 3);

    // Dynamic mute via setVolume
    activeSynth?.setVolume(0, true);
    expect(masterGain2.gain.value).toBe(0.0001);

    // Dynamic unmute and scale
    activeSynth?.setVolume(0.5, false);
    expect(masterGain2.gain.value).toBeCloseTo(0.09, 3);

    activeSynth?.stop();
  });
});


