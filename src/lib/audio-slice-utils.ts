// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Audio Slice Utilities
// Dynamic Chorus Slice Randomization & Progressive Slice Step Progression
// ==========================================

import type { ProgressiveSliceStep } from "@/types";

export const PROGRESSIVE_SLICE_STEPS: readonly ProgressiveSliceStep[] = [
  { step: 1, durationSec: 0.1, points: 100, label: "0.1s" },
  { step: 2, durationSec: 0.5, points: 80, label: "0.5s" },
  { step: 3, durationSec: 1.0, points: 60, label: "1.0s" },
  { step: 4, durationSec: 2.0, points: 40, label: "2.0s" },
  { step: 5, durationSec: 4.0, points: 20, label: "4.0s" },
] as const;

/**
 * Returns the ProgressiveSliceStep configuration for a given step number (1..5).
 * Clamps step to valid range [1, 5]. Fallbacks safely if step is invalid or NaN.
 */
export function getProgressiveStep(step: number): ProgressiveSliceStep {
  const safeStep = typeof step === "number" && !isNaN(step) ? Math.round(step) : 1;
  const clampedStep = Math.max(1, Math.min(PROGRESSIVE_SLICE_STEPS.length, safeStep));
  return PROGRESSIVE_SLICE_STEPS[clampedStep - 1];
}

/**
 * Calculates points awarded for guessing correctly at a given progressive slice step,
 * factoring in any hint deductions. Minimum guaranteed points floor is 20.
 */
export function calculatePointsForSliceStep(step: number, hintDeduction?: number): number {
  const stepConfig = getProgressiveStep(step);
  const deduction =
    typeof hintDeduction === "number" && !isNaN(hintDeduction) && hintDeduction > 0
      ? hintDeduction
      : 0;
  return Math.max(20, stepConfig.points - deduction);
}

/**
 * Returns the next ProgressiveSliceStep or null if already at the max step (step 5).
 */
export function getNextSliceStep(currentStep: number): ProgressiveSliceStep | null {
  const safeStep = typeof currentStep === "number" && !isNaN(currentStep) ? Math.round(currentStep) : 1;
  const clampedStep = Math.max(1, safeStep);
  if (clampedStep >= PROGRESSIVE_SLICE_STEPS.length) {
    return null;
  }
  return PROGRESSIVE_SLICE_STEPS[clampedStep];
}

export interface SongHookMetadata {
  hookStartSec?: number | null;
  hookEndSec?: number | null;
  duration?: number | null;
  durationSec?: number | null;
}

/**
 * Calculates a randomized slice start offset within the song's chorus/hook section.
 *
 * Prevents repetitive gameplay where players always hear the exact same first 2 seconds
 * of the chorus. Slices are bounded within [hookStartSec, hookEndSec - durationSec]
 * (or estimated chorus span if hookEndSec is missing) and cannot exceed the song's duration.
 *
 * @param song Song metadata containing hook boundaries and duration
 * @param durationSec Duration of the slice in seconds (default 2.0)
 * @param randomFn Optional pseudo-random number generator [0, 1) for deterministic testing (default Math.random)
 * @returns Offset in seconds rounded to 1 decimal place
 */
export function calculateSliceStart(
  song: SongHookMetadata,
  durationSec: number = 2.0,
  randomFn: () => number = Math.random,
  sliceRegion: "hook" | "entire_song" = "hook"
): number {
  if (!song) return 0;

  const safeDuration = typeof durationSec === "number" && durationSec > 0 ? durationSec : 2.0;

  if (sliceRegion === "entire_song") {
    const totalDuration =
      typeof song.duration === "number" && !isNaN(song.duration) && song.duration > 0
        ? song.duration
        : typeof song.durationSec === "number" && !isNaN(song.durationSec) && song.durationSec > 0
        ? song.durationSec
        : 180;

    const minStart = Math.max(5.0, Math.round(totalDuration * 0.15 * 10) / 10);
    const maxStart = Math.min(
      Math.max(minStart, totalDuration - safeDuration - 5.0),
      Math.round(totalDuration * 0.90 * 10) / 10
    );

    if (maxStart <= minStart) {
      return Math.round(Math.min(minStart, Math.max(0, totalDuration - safeDuration)) * 10) / 10;
    }

    const rand = typeof randomFn === "function" ? randomFn() : Math.random();
    const clampedRand = Math.max(0, Math.min(1, rand));
    const picked = minStart + clampedRand * (maxStart - minStart);

    return Math.round(picked * 10) / 10;
  }

  const rawTotal =
    typeof song.duration === "number" && !isNaN(song.duration) && song.duration > 0
      ? song.duration
      : typeof song.durationSec === "number" && !isNaN(song.durationSec) && song.durationSec > 0
      ? song.durationSec
      : null;

  // Base hook start: ensure non-negative and avoid intro silence if missing
  const rawHookStart = song.hookStartSec;
  const hasValidHookStart =
    typeof rawHookStart === "number" && !isNaN(rawHookStart) && rawHookStart > 0;

  let minStart = hasValidHookStart
    ? rawHookStart
    : Math.max(5.0, Math.round(((rawTotal || 180) * 0.25) * 10) / 10);

  // Target chorus span: if hookEndSec is valid and larger than minStart + durationSec, use it.
  // Otherwise, default to estimating a 20-second chorus span.
  const rawHookEnd = song.hookEndSec;
  const chorusEnd =
    typeof rawHookEnd === "number" && !isNaN(rawHookEnd) && rawHookEnd > minStart + safeDuration
      ? rawHookEnd
      : minStart + 20;

  // Max start offset within the chorus
  let maxStart = Math.max(minStart, chorusEnd - safeDuration);

  // If total song duration is known, constrain maxStart and minStart so slice does not exceed song length
  if (rawTotal !== null) {
    if (rawTotal <= safeDuration) {
      return 0;
    }
    minStart = Math.min(minStart, Math.max(0, rawTotal - safeDuration));
    maxStart = Math.min(maxStart, Math.max(minStart, rawTotal - safeDuration));
  }

  // If chorus range is too tight for the slice duration, fallback to minStart
  if (maxStart <= minStart) {
    return Math.round(minStart * 10) / 10;
  }

  // Pick a pseudo-random point between [minStart, maxStart] rounded to 1 decimal place
  const rand = typeof randomFn === "function" ? randomFn() : Math.random();
  const clampedRand = Math.max(0, Math.min(1, rand));
  const picked = minStart + clampedRand * (maxStart - minStart);

  return Math.round(picked * 10) / 10;
}
