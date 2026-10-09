# Design Specification: Split Master Volume & Sound Effects Volume

**Date:** 2026-10-09  
**Status:** Approved by User  
**Scope:** Decouple audio volume controls in Pleng-Rai-Wa into independent Master Volume and Sound Effects (SFX) Volume controls.

---

## 1. Motivation & User Intent
In `idea.md`, the user requested:
> "แบ่งการปรับระดับเสียงเป็นเสียงรวมทั้งหมดกับเสียงเอฟเฟค"

Currently, the application has a single master volume control in `src/lib/audio-volume.ts` and `src/components/common/settings-menu.tsx`. Adjusting master volume directly updates both HTMLAudioElement (music / streams) and procedural Web Audio synthesizers (SFX). Users want separate sliders to adjust background music/master loudness and sound effects (buzzer, correct chime, ticks, clicks) independently.

---

## 2. Audio Engine Architecture

### 2.1 Volume Hierarchy
The final effective sound effect gain is governed by both Master Volume and SFX Volume:
$$\text{Effective SFX Gain} = \text{MasterVolume} \times \text{SfxVolume}$$

* **Master Volume ($0.0 - 1.0$, default $0.7$):**
  * Controls all music streams and slices:
    * Home Lo-Fi vinyl stream (`ThreeVinylCanvas`)
    * Question audio slice (`audioRef` in `GameView` / `SoloPlay`)
    * Reveal full song playback (`RoundRevealCard` / `SoloPlay`)
  * Acts as global master scale: If Master Volume is muted ($0.0$), all sounds (music + SFX) are silent.
* **SFX Volume ($0.0 - 1.0$, default $0.7$):**
  * Controls procedural Web Audio SFX:
    * Buzzer (`soundEffects.buzzer()`)
    * Correct answer chime (`soundEffects.correct()`)
    * Wrong answer tone (`soundEffects.wrong()`)
    * Countdown tick (`soundEffects.countdownTick()`)
    * UI click (`soundEffects.click()`)
  * If SFX is muted or set to $0.0$, SFX sounds are silent while music continues playing.

### 2.2 Audio State Management (`src/lib/audio-volume.ts`)
Add dedicated SFX state functions and event bus alongside existing master volume utilities:
* `getSfxVolume(): number`: returns stored SFX volume ($0.0 - 1.0$), default $0.7$.
* `setSfxVolume(volume: number): void`: updates SFX volume, persists to `pleng_sfx_volume`, fires `EVENT_SFX_VOLUME_CHANGE`, updates `soundEffects.setVolume`.
* `isSfxMuted(): boolean`: returns whether SFX is muted, persisted to `pleng_sfx_muted`.
* `setSfxMuted(muted: boolean): void`: sets SFX mute state, fires event, updates `soundEffects.setMuted`.
* `toggleSfxMute(): boolean`: toggles mute, restoring previous volume if unmuting.
* `subscribeSfxVolume(callback: (vol: number, muted: boolean) => void): () => void`: event listener for live UI updates.
* Update `setMasterVolume`: updates `soundEffects` with composite gain $\text{Master} \times \text{SFX}$.

---

## 3. UI Specifications (`src/components/common/settings-menu.tsx`)

The popover settings menu will display two distinct volume control rows under Section 2:

1. **🔊 เสียงรวม / เพลง (Master Volume)**:
   * Label: `🔊 เสียงรวม / เพลง (Master Volume)`
   * Percentage badge: `${masterVolume}%`
   * Mute toggle button: `Volume2` / `Volume1` / `VolumeX`
   * Range slider: `0 - 100%`, styled with amber track gradient
2. **🔔 เสียงเอฟเฟกต์ (Sound Effects)**:
   * Label: `🔔 เสียงเอฟเฟกต์ (Sound Effects)`
   * Percentage badge: `${sfxVolume}%`
   * Mute toggle button: `Bell` / `BellOff` (or `Volume2` with badge)
   * Range slider: `0 - 100%`, styled with amber track gradient
   * Test Button: `🎵 ทดสอบเสียงเอฟเฟกต์ (Test SFX)`: plays `soundEffects.correct()` or `soundEffects.buzzer()` for immediate feedback.

---

## 4. Verification & Testing Plan
* **Unit Tests (`src/lib/__tests__/audio-volume-sfx-split.test.ts`):**
  * `getSfxVolume` and `setSfxVolume` clamping ($0.0 - 1.0$) and persistence.
  * `toggleSfxMute` and restoration of previous volume.
  * Composite effective volume calculation (`master * sfx`).
  * `subscribeSfxVolume` listener notification and cleanup.
* **Component Test:**
  * Render `SettingsMenu` and verify both Master and SFX sliders and badges work.
* **Regression Testing:**
  * Run full vitest suite (all existing suites pass).
  * Run `npm run build` with 0 TypeScript/build errors.
