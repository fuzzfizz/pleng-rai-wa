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
