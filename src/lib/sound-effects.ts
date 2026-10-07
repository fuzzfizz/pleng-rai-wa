/**
 * Zero-Asset Web Audio API Procedural Sound Synthesizer for เพลงไรวะ (Pleng-Rai-Wa)
 *
 * Uses native AudioContext oscillators, gain envelopes, and filters for instant 0ms latency
 * sound effects that never fail to load without external audio assets.
 */

const STORAGE_KEY_MUTED = "pleng_sfx_muted";
const STORAGE_KEY_VOLUME = "pleng_sfx_volume";

let audioCtx: AudioContext | null = null;
let cachedMuted: boolean | null = null;
let cachedVolume: number | null = null;

/**
 * Returns the shared AudioContext instance, resuming it if suspended.
 * Safe for SSR (returns null on server).
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Checks whether sound effects are currently muted.
 * Persisted in localStorage.
 */
export function isMuted(): boolean {
  if (cachedMuted !== null) return cachedMuted;
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY_MUTED);
    cachedMuted = stored === "true";
  } catch {
    cachedMuted = false;
  }
  return cachedMuted;
}

/**
 * Toggles or sets the global sound effects mute state.
 * Persisted in localStorage.
 */
export function setMuted(muted: boolean): void {
  cachedMuted = muted;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
    } catch {}
  }
}

/**
 * Gets the current SFX volume (0.0 to 1.0).
 * Defaults to 0.7. Persisted in localStorage.
 */
export function getVolume(): number {
  if (cachedVolume !== null) return cachedVolume;
  if (typeof window === "undefined") return 0.7;

  try {
    const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        cachedVolume = parsed;
        return cachedVolume;
      }
    }
  } catch {}

  cachedVolume = 0.7;
  return cachedVolume;
}

/**
 * Sets the global SFX volume (clamped between 0.0 and 1.0).
 * Persisted in localStorage.
 */
export function setVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  cachedVolume = clamped;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    } catch {}
  }
}

/**
 * Helper to get master gain node connected to destination.
 * Returns null if muted or volume is zero.
 */
function createMasterOutput(ctx: AudioContext): GainNode | null {
  if (isMuted()) return null;
  const vol = getVolume();
  if (vol <= 0.001) return null;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(vol, ctx.currentTime);
  masterGain.connect(ctx.destination);
  return masterGain;
}

/**
 * Punchy game show buzzer sound (two dissonant square/sawtooth tones with rapid decay).
 */
export function playBuzzerSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = createMasterOutput(ctx);
  if (!master) return;

  const t = ctx.currentTime;
  const duration = 0.35;

  // Bandpass / Lowpass filter to shape the raw harshness into a punchy arcade buzzer
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, t);
  filter.connect(master);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
  gain.gain.setValueAtTime(0.35, t + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(filter);

  // Two dissonant frequencies creating the classic game show buzz clash (Minor 2nd / tritone beating)
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(130.81, t); // C3

  const osc2 = ctx.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(138.59, t); // C#3 (dissonant clash)

  osc1.connect(gain);
  osc2.connect(gain);

  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + duration);
  osc2.stop(t + duration);

  osc1.onended = () => {
    osc1.disconnect();
    osc2.disconnect();
    gain.disconnect();
    filter.disconnect();
    master.disconnect();
  };
}

/**
 * Cheerful ascending major arpeggio chime (C5 -> E5 -> G5 -> C6).
 */
export function playCorrectSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = createMasterOutput(ctx);
  if (!master) return;

  const t0 = ctx.currentTime;
  // Notes: C5, E5, G5, C6
  const notes = [
    { freq: 523.25, time: 0.0, dur: 0.35 },
    { freq: 659.25, time: 0.08, dur: 0.35 },
    { freq: 783.99, time: 0.16, dur: 0.35 },
    { freq: 1046.5, time: 0.24, dur: 0.55 },
  ];

  notes.forEach((note, index) => {
    const noteStart = t0 + note.time;
    const noteEnd = noteStart + note.dur;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.28, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    gain.connect(master);

    // Warm sine chime with slight triangle harmonic for sparkle
    const osc = ctx.createOscillator();
    osc.type = index === notes.length - 1 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(note.freq, noteStart);
    osc.connect(gain);

    osc.start(noteStart);
    osc.stop(noteEnd);

    if (index === notes.length - 1) {
      osc.onended = () => {
        gain.disconnect();
        master.disconnect();
      };
    }
  });
}

/**
 * Sad descending "wah-wah" buzz (low frequency saw drop).
 */
export function playWrongSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = createMasterOutput(ctx);
  if (!master) return;

  const t0 = ctx.currentTime;

  // Two sad descending slides: Note 1 (Eb3 down to D3), Note 2 (Db3 down to G2)
  const segments = [
    { startFreq: 155, endFreq: 135, start: 0.0, dur: 0.22 },
    { startFreq: 138, endFreq: 82, start: 0.26, dur: 0.45 },
  ];

  segments.forEach((seg, i) => {
    const start = t0 + seg.start;
    const end = start + seg.dur;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, start);
    filter.frequency.exponentialRampToValueAtTime(300, end);
    filter.connect(master);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.32, start + 0.03);
    gain.gain.setValueAtTime(0.25, end - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(filter);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(seg.startFreq, start);
    osc.frequency.exponentialRampToValueAtTime(seg.endFreq, end);
    osc.connect(gain);

    osc.start(start);
    osc.stop(end);

    if (i === segments.length - 1) {
      osc.onended = () => {
        gain.disconnect();
        filter.disconnect();
        master.disconnect();
      };
    }
  });
}

/**
 * Crisp wooden tick / heart-beat click with increasing pitch for last 5 seconds.
 * @param urgency Optional scale (1 to 5, where 5 is highest urgency / last second).
 */
export function playCountdownTickSound(urgency: number = 1): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = createMasterOutput(ctx);
  if (!master) return;

  const t = ctx.currentTime;
  const level = Math.max(1, Math.min(5, urgency));

  // Base frequency increases as countdown gets closer to zero (700Hz up to 1300Hz)
  const baseFreq = 700 + (level - 1) * 150;
  const dur = 0.04;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(baseFreq, t);
  filter.Q.setValueAtTime(4 + level * 0.8, t);
  filter.connect(master);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  gain.connect(filter);

  // Rapid micro pitch drop creates the crisp acoustic wood click transient
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + dur);
  osc.connect(gain);

  osc.start(t);
  osc.stop(t + dur);

  // If critical urgency (4 or 5), add a subtle higher-pitched double click echo
  if (level >= 4) {
    const t2 = t + 0.06;
    const dur2 = 0.03;

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.2, t2 + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + dur2);
    gain2.connect(filter);

    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 1.8, t2);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq, t2 + dur2);
    osc2.connect(gain2);

    osc2.start(t2);
    osc2.stop(t2 + dur2);
  }

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    filter.disconnect();
    master.disconnect();
  };
}

/**
 * Subtle high-tech UI button click.
 */
export function playClickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = createMasterOutput(ctx);
  if (!master) return;

  const t = ctx.currentTime;
  const dur = 0.025;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  gain.connect(master);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, t);
  osc.frequency.exponentialRampToValueAtTime(650, t + dur);
  osc.connect(gain);

  osc.start(t);
  osc.stop(t + dur);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    master.disconnect();
  };
}

/**
 * Celebratory game over fanfare with triumphant brass/synth harmony.
 */
export function playVictoryFanfare(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = createMasterOutput(ctx);
  if (!master) return;

  const t0 = ctx.currentTime;

  // Fanfare melody notes: G4 -> C5 -> E5 -> G5 -> E5 -> final G5 sustained chord
  const melody = [
    { freq: 392.0, time: 0.0, dur: 0.12 },
    { freq: 523.25, time: 0.14, dur: 0.12 },
    { freq: 659.25, time: 0.28, dur: 0.12 },
    { freq: 783.99, time: 0.42, dur: 0.24 },
    { freq: 659.25, time: 0.7, dur: 0.12 },
    { freq: 783.99, time: 0.84, dur: 0.75 },
  ];

  // Warm brass low-pass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2800, t0);
  filter.connect(master);

  melody.forEach((step) => {
    const start = t0 + step.time;
    const end = start + step.dur;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.24, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(filter);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(step.freq, start);
    osc.connect(gain);

    osc.start(start);
    osc.stop(end);
  });

  // Final triumphant major triad harmony hit at 0.84s (C5 + E5 + C6)
  const chordNotes = [523.25, 659.25, 1046.5];
  const chordStart = t0 + 0.84;
  const chordEnd = chordStart + 0.85;

  chordNotes.forEach((freq, idx) => {
    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0.001, chordStart);
    chordGain.gain.exponentialRampToValueAtTime(0.18, chordStart + 0.03);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, chordEnd);
    chordGain.connect(filter);

    const chordOsc = ctx.createOscillator();
    chordOsc.type = idx === 2 ? "sine" : "triangle";
    chordOsc.frequency.setValueAtTime(freq, chordStart);
    chordOsc.connect(chordGain);

    chordOsc.start(chordStart);
    chordOsc.stop(chordEnd);

    if (idx === chordNotes.length - 1) {
      chordOsc.onended = () => {
        filter.disconnect();
        master.disconnect();
      };
    }
  });
}

/**
 * Authentic vintage turntable start sound:
 * 1. Physical push switch click transient
 * 2. Gentle tactile needle drop "thump"
 * 3. Soft lo-fi warm vinyl crackle/noise burst
 * 4. Nostalgic warm 7th chord chime (Cmaj9 / lo-fi Rhodes harmonic)
 */
export function playTurntableStartSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const master = createMasterOutput(ctx);
  if (!master) return;

  const t0 = ctx.currentTime;

  // 1. Mechanical switch click
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.001, t0);
  clickGain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.003);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
  clickGain.connect(master);

  const clickOsc = ctx.createOscillator();
  clickOsc.type = "triangle";
  clickOsc.frequency.setValueAtTime(1400, t0);
  clickOsc.frequency.exponentialRampToValueAtTime(180, t0 + 0.035);
  clickOsc.connect(clickGain);
  clickOsc.start(t0);
  clickOsc.stop(t0 + 0.035);

  // 2. Needle drop contact "thump" (around 0.16s when needle lands on vinyl groove)
  const thumpTime = t0 + 0.16;
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.001, thumpTime);
  thumpGain.gain.exponentialRampToValueAtTime(0.28, thumpTime + 0.015);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, thumpTime + 0.13);
  thumpGain.connect(master);

  const thumpFilter = ctx.createBiquadFilter();
  thumpFilter.type = "lowpass";
  thumpFilter.frequency.setValueAtTime(260, thumpTime);
  thumpFilter.frequency.exponentialRampToValueAtTime(70, thumpTime + 0.13);
  thumpFilter.connect(thumpGain);

  const thumpOsc = ctx.createOscillator();
  thumpOsc.type = "sine";
  thumpOsc.frequency.setValueAtTime(120, thumpTime);
  thumpOsc.frequency.exponentialRampToValueAtTime(45, thumpTime + 0.13);
  thumpOsc.connect(thumpFilter);
  thumpOsc.start(thumpTime);
  thumpOsc.stop(thumpTime + 0.14);

  // 3. Subtle procedural vinyl groove crackle noise (0.16s to 1.6s)
  try {
    const crackleDuration = 1.4;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * crackleDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const isPop = Math.random() < 0.0016;
      const popVal = isPop ? (Math.random() - 0.5) * 0.6 : 0;
      const hiss = (Math.random() * 2 - 1) * 0.018;
      output[i] = popVal + hiss;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1200, thumpTime);
    noiseFilter.Q.setValueAtTime(0.8, thumpTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, thumpTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.12, thumpTime + 0.04);
    noiseGain.gain.setValueAtTime(0.08, thumpTime + 0.6);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, thumpTime + crackleDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    noiseSource.start(thumpTime);
    noiseSource.stop(thumpTime + crackleDuration);
  } catch {}

  // 4. Lo-Fi warm nostalgic chord chime (Cmaj9: C4, G4, B4, D5, E5)
  const chordNotes = [
    { freq: 261.63, time: 0.25, dur: 1.8 }, // C4
    { freq: 392.0, time: 0.33, dur: 1.7 },  // G4
    { freq: 493.88, time: 0.41, dur: 1.6 }, // B4
    { freq: 587.33, time: 0.49, dur: 1.5 }, // D5
    { freq: 659.25, time: 0.57, dur: 1.4 }, // E5
  ];

  const chordFilter = ctx.createBiquadFilter();
  chordFilter.type = "lowpass";
  chordFilter.frequency.setValueAtTime(2200, t0);
  chordFilter.connect(master);

  chordNotes.forEach((n, idx) => {
    const noteStart = t0 + n.time;
    const noteEnd = noteStart + n.dur;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, noteStart);
    g.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    g.connect(chordFilter);

    const o = ctx.createOscillator();
    o.type = idx % 2 === 0 ? "sine" : "triangle";
    o.frequency.setValueAtTime(n.freq, noteStart);
    o.connect(g);

    o.start(noteStart);
    o.stop(noteEnd);

    if (idx === chordNotes.length - 1) {
      o.onended = () => {
        chordFilter.disconnect();
        master.disconnect();
      };
    }
  });
}

/**
 * Vintage needle lift & turntable stop sound:
 * Gentle needle brush / scratch release + mechanical toggle click.
 */
export function playTurntableStopSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const master = createMasterOutput(ctx);
  if (!master) return;

  const t0 = ctx.currentTime;

  // 1. Needle friction scrape release (0.12s)
  const scrapeGain = ctx.createGain();
  scrapeGain.gain.setValueAtTime(0.001, t0);
  scrapeGain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  scrapeGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  scrapeGain.connect(master);

  const scrapeFilter = ctx.createBiquadFilter();
  scrapeFilter.type = "bandpass";
  scrapeFilter.frequency.setValueAtTime(800, t0);
  scrapeFilter.frequency.exponentialRampToValueAtTime(1600, t0 + 0.12);
  scrapeFilter.Q.setValueAtTime(2.0, t0);
  scrapeFilter.connect(scrapeGain);

  const scrapeOsc = ctx.createOscillator();
  scrapeOsc.type = "sawtooth";
  scrapeOsc.frequency.setValueAtTime(220, t0);
  scrapeOsc.frequency.exponentialRampToValueAtTime(540, t0 + 0.12);
  scrapeOsc.connect(scrapeFilter);
  scrapeOsc.start(t0);
  scrapeOsc.stop(t0 + 0.12);

  // 2. Mechanical latch click at t0 + 0.08s
  const clickStart = t0 + 0.08;
  const clickDur = 0.03;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.001, clickStart);
  clickGain.gain.exponentialRampToValueAtTime(0.2, clickStart + 0.003);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, clickStart + clickDur);
  clickGain.connect(master);

  const clickOsc = ctx.createOscillator();
  clickOsc.type = "sine";
  clickOsc.frequency.setValueAtTime(900, clickStart);
  clickOsc.frequency.exponentialRampToValueAtTime(240, clickStart + clickDur);
  clickOsc.connect(clickGain);
  clickOsc.start(clickStart);
  clickOsc.stop(clickStart + clickDur);

  clickOsc.onended = () => {
    scrapeGain.disconnect();
    scrapeFilter.disconnect();
    clickGain.disconnect();
    master.disconnect();
  };
}

/**
 * Convenient bundled sound effects object.
 */
export const soundEffects = {
  buzzer: playBuzzerSound,
  correct: playCorrectSound,
  wrong: playWrongSound,
  countdownTick: playCountdownTickSound,
  click: playClickSound,
  victoryFanfare: playVictoryFanfare,
  turntableStart: playTurntableStartSound,
  turntableStop: playTurntableStopSound,
  isMuted,
  setMuted,
  getVolume,
  setVolume,
};

export default soundEffects;
