// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Audio Slice Utilities
// Dynamic Chorus Slice Randomization
// ==========================================

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
  randomFn: () => number = Math.random
): number {
  if (!song) return 0;

  const safeDuration = typeof durationSec === "number" && durationSec > 0 ? durationSec : 2.0;

  // Base hook start: ensure non-negative
  const rawHookStart = song.hookStartSec;
  const minStart = Math.max(
    0,
    typeof rawHookStart === "number" && !isNaN(rawHookStart) && rawHookStart > 0
      ? rawHookStart
      : 0
  );

  // Target chorus span: if hookEndSec is valid and larger than minStart + durationSec, use it.
  // Otherwise, default to estimating a 20-second chorus span.
  const rawHookEnd = song.hookEndSec;
  const chorusEnd =
    typeof rawHookEnd === "number" && !isNaN(rawHookEnd) && rawHookEnd > minStart + safeDuration
      ? rawHookEnd
      : minStart + 20;

  // Max start offset within the chorus
  let maxStart = Math.max(minStart, chorusEnd - safeDuration);

  // If total song duration is known, constrain maxStart so slice does not exceed song length
  const totalDuration =
    typeof song.duration === "number" && !isNaN(song.duration)
      ? song.duration
      : typeof song.durationSec === "number" && !isNaN(song.durationSec)
      ? song.durationSec
      : null;

  if (totalDuration !== null) {
    if (totalDuration <= safeDuration) {
      return Math.round(Math.min(minStart, Math.max(0, totalDuration)) * 10) / 10;
    }
    maxStart = Math.min(maxStart, Math.max(minStart, totalDuration - safeDuration));
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
