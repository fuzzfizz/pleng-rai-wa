// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Playlist Utilities
// Pure helper functions for duration, validation, and reordering
// ==========================================

import type { Song } from "@/types";

/**
 * Formats a duration in seconds into a Thai readable string.
 * Examples:
 * - 0 -> "0 วินาที"
 * - 45 -> "45 วินาที"
 * - 60 -> "1 นาที"
 * - 225 -> "3 นาที 45 วินาที"
 * - 3600 -> "1 ชม."
 * - 4500 -> "1 ชม. 15 นาที"
 */
export function formatPlaylistDuration(seconds: number): string {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds <= 0) {
    return "0 วินาที";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours} ชม. ${minutes} นาที`;
    }
    if (secs > 0) {
      return `${hours} ชม. ${secs} วินาที`;
    }
    return `${hours} ชม.`;
  }

  if (minutes > 0) {
    if (secs > 0) {
      return `${minutes} นาที ${secs} วินาที`;
    }
    return `${minutes} นาที`;
  }

  return `${secs} วินาที`;
}

/**
 * Checks whether a playlist satisfies the minimum threshold (at least 5 songs)
 * required to be used in game modes.
 */
export function isPlaylistPlayable(songCount: number): boolean {
  if (typeof songCount !== "number" || isNaN(songCount)) {
    return false;
  }
  return songCount >= 5;
}

/**
 * Pure array reordering function that returns a new array with the item
 * moved from fromIndex to toIndex without mutating the original list.
 */
export function reorderSongs<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  if (
    fromIndex < 0 ||
    fromIndex >= list.length ||
    toIndex < 0 ||
    toIndex >= list.length
  ) {
    return [...list];
  }

  if (fromIndex === toIndex) {
    return [...list];
  }

  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

/**
 * Calculates the total duration in seconds from an array of songs.
 */
export function calculateTotalDuration(songs: Array<{ durationSec?: number }>): number {
  if (!Array.isArray(songs)) return 0;
  return songs.reduce((acc, song) => acc + (song.durationSec || 0), 0);
}
