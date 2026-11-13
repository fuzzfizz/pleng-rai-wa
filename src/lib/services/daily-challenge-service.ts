// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Daily Challenge Service
// Deterministic Daily Song Selector, Streak Engine & Storage
// ==========================================

import { supabase, getServiceSupabase } from "@/lib/supabase";
import { SongService } from "@/lib/services/song-service";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";
import { calculateSliceStart, type SongHookMetadata } from "@/lib/audio-slice-utils";
import { isRedisAvailable, getRedisClient } from "@/lib/services/redis-service";
import { createServerClient } from "@supabase/ssr";
import type { Song, DailyAttempt, DailyUserStats } from "@/types";

export type { DailyAttempt, DailyUserStats };

// ==========================================
// In-Memory Storage & Test Overrides
// ==========================================

const inMemoryAttempts = new Map<string, Map<string, DailyAttempt>>();
let songPoolOverride: Song[] | null = null;
let customDbClient: any = null;
let authUserOverride: { id: string; email?: string } | null | undefined = undefined;

export function clearInMemoryDailyStore(): void {
  inMemoryAttempts.clear();
}

export function setDailySongPoolOverride(songs: Song[] | null): void {
  songPoolOverride = songs;
}

export function resetDailySongPoolOverride(): void {
  songPoolOverride = null;
}

export function setDbClient(client: any): void {
  customDbClient = client;
}

export function resetDbClient(): void {
  customDbClient = null;
}

export function setAuthUserOverride(user: { id: string; email?: string } | null | undefined): void {
  authUserOverride = user;
}

/**
 * Checks whether Supabase is configured with real credentials (not placeholder URL).
 */
export function isSupabaseConfigured(): boolean {
  if (customDbClient) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("placeholder-project") || key.includes("placeholder-anon-key")) {
    return false;
  }
  return true;
}

function getDbClient(): typeof supabase {
  if (customDbClient) {
    return customDbClient;
  }
  if (typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return getServiceSupabase();
    } catch {
      return supabase;
    }
  }
  return supabase;
}

// ==========================================
// Date Helpers (Asia/Bangkok UTC+7)
// ==========================================

/**
 * Returns current date in Thai timezone (Asia/Bangkok, UTC+7) as "YYYY-MM-DD".
 * Optionally accepts a Date object for testing.
 */
export function getTodayDateString(refDate?: Date): string {
  const d = refDate || new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Validates "YYYY-MM-DD" format and ensures date is not in the future.
 */
export function isValidDateString(date: string, todayReference?: string): boolean {
  if (!date || typeof date !== "string") return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;

  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }

  const todayStr = todayReference || getTodayDateString();
  if (date > todayStr) {
    return false; // Future dates not permitted
  }

  return true;
}

/**
 * Returns array of past date strings starting from today going back `days` days.
 */
export function getPastDatesList(days: number = 30, fromDateStr?: string): string[] {
  const result: string[] = [];
  if (typeof days !== "number" || isNaN(days) || days <= 0) {
    return result;
  }
  const baseDateStr = fromDateStr || getTodayDateString();
  const [y, m, d] = baseDateStr.split("-").map(Number);

  for (let i = 0; i < days; i++) {
    const cur = new Date(Date.UTC(y, m - 1, d - i));
    const year = cur.getUTCFullYear();
    const month = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cur.getUTCDate()).padStart(2, "0");
    result.push(`${year}-${month}-${day}`);
  }
  return result;
}

/**
 * Calculates number of calendar days between two "YYYY-MM-DD" strings in UTC.
 * E.g. daysBetween("2026-11-10", "2026-11-11") === 1
 */
export function daysBetween(dateStrA: string, dateStrB: string): number {
  const [y1, m1, d1] = dateStrA.split("-").map(Number);
  const [y2, m2, d2] = dateStrB.split("-").map(Number);
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24));
}

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/**
 * Formats "YYYY-MM-DD" to Thai date e.g. "13 พ.ย. 2026".
 */
export function formatThaiDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const month = THAI_MONTHS_SHORT[monthIdx] || parts[1];
  return `${day} ${month} ${year}`;
}

// ==========================================
// Deterministic Hash & Song Selector
// ==========================================

/**
 * FNV-1a 32-bit hash implementation to derive deterministic integer seed from string.
 */
export function hashStringToSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Creates a deterministic pseudo-random number generator [0, 1) from an integer seed.
 */
export function seedToRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Calculates a deterministic hook/slice start offset for a song and date.
 */
export function getDailySliceStart(song: SongHookMetadata, dateStr: string): number {
  const songId = (song as any).id || (song as any).title || "song";
  const seed = hashStringToSeed(`pleng-rai-wa-daily-slice-${dateStr}-${songId}`);
  const randFn = seedToRandom(seed);
  return calculateSliceStart(song, 0.1, randFn);
}

/**
 * Deterministically selects the daily song for a given date string (YYYY-MM-DD).
 * For a given dateStr, the same song is ALWAYS returned.
 */
export async function getDailySongForDate(dateStr: string): Promise<Song | null> {
  let pool: Song[] = [];

  if (songPoolOverride && songPoolOverride.length > 0) {
    pool = songPoolOverride;
  } else if (!isSupabaseConfigured()) {
    pool = DEMO_SONGS;
  } else {
    try {
      if (customDbClient) {
        SongService.setDbClient(customDbClient);
      }
      const fetched = await SongService.getSongs({ limit: 1000 });
      if (Array.isArray(fetched) && fetched.length > 0) {
        pool = fetched;
      }
    } catch {
      // Fallback to DEMO_SONGS if database query fails
    } finally {
      if (customDbClient) {
        SongService.resetDbClient();
      }
    }

    if (pool.length === 0) {
      pool = DEMO_SONGS;
    }
  }

  if (pool.length === 0) {
    return null;
  }

  // Sort pool deterministically by ID to ensure stable indexing across environments
  const sortedPool = [...pool].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  const seed = hashStringToSeed(`pleng-rai-wa-daily-${dateStr}`);
  const index = seed % sortedPool.length;
  const picked = { ...sortedPool[index] };

  // Calculate and attach deterministic sliceStartSec
  const sliceStartSec = getDailySliceStart(picked, dateStr);
  (picked as any).dailySliceStartSec = sliceStartSec;

  return picked;
}

// ==========================================
// User Daily Attempt & Streak Storage
// ==========================================

function mapAttemptFromRow(row: any): DailyAttempt {
  let guesses: string[] = [];
  if (Array.isArray(row.guesses)) {
    guesses = row.guesses;
  } else if (typeof row.guesses === "string") {
    try {
      const parsed = JSON.parse(row.guesses);
      if (Array.isArray(parsed)) guesses = parsed;
    } catch {}
  }

  return {
    userId: row.user_id,
    date: row.date,
    isCorrect: Boolean(row.is_correct),
    step: Number(row.step) || 1,
    score: Number(row.score) || 0,
    guesses,
    completedAt: row.completed_at || row.created_at || new Date().toISOString(),
  };
}

function mapAttemptToRow(attempt: DailyAttempt) {
  return {
    user_id: attempt.userId,
    date: attempt.date,
    is_correct: attempt.isCorrect,
    step: attempt.step,
    score: attempt.score,
    guesses: attempt.guesses || [],
    completed_at: attempt.completedAt,
  };
}

function saveToInMemory(userId: string, attempt: DailyAttempt): void {
  if (!inMemoryAttempts.has(userId)) {
    inMemoryAttempts.set(userId, new Map());
  }
  inMemoryAttempts.get(userId)!.set(attempt.date, attempt);
}

/**
 * Retrieves a user's completed daily attempt for a given date.
 * Queries Supabase `user_daily_attempts` first, falling back to Redis and in-memory store.
 */
export async function getUserDailyAttempt(
  userId: string,
  dateStr: string
): Promise<DailyAttempt | null> {
  if (!userId || !dateStr) return null;

  // 1. Check in-memory store
  const inMem = inMemoryAttempts.get(userId)?.get(dateStr);

  // 2. Try Supabase if configured or customDbClient provided
  if (isSupabaseConfigured()) {
    try {
      const client = getDbClient();
      const { data, error } = await client
        .from("user_daily_attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("date", dateStr)
        .maybeSingle();

      if (!error && data) {
        const attempt = mapAttemptFromRow(data);
        saveToInMemory(userId, attempt);
        return attempt;
      }
      if (!error && !data) {
        // Supabase table checked and row definitely does not exist
        return inMem || null;
      }
    } catch {
      // Graceful fallback if table does not exist or client errors
    }
  }

  // 3. Try Redis
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      if (redis) {
        const raw = await redis.hget<string | DailyAttempt>(
          `pleng:daily:user:${userId}:attempts`,
          dateStr
        );
        if (raw) {
          const attempt: DailyAttempt = typeof raw === "string" ? JSON.parse(raw) : raw;
          saveToInMemory(userId, attempt);
          return attempt;
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  return inMem || null;
}

/**
 * Saves a user's completed daily attempt.
 * Persists to In-Memory, Redis, and Supabase `user_daily_attempts`.
 */
export async function saveUserDailyAttempt(
  userId: string,
  attempt: DailyAttempt
): Promise<DailyAttempt> {
  const normalizedAttempt: DailyAttempt = {
    ...attempt,
    userId,
    completedAt: attempt.completedAt || new Date().toISOString(),
  };

  // 1. Always save in-memory
  saveToInMemory(userId, normalizedAttempt);

  // 2. Save in Redis
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.hset(`pleng:daily:user:${userId}:attempts`, {
          [normalizedAttempt.date]: JSON.stringify(normalizedAttempt),
        });
      }
    } catch (err) {
      console.warn("[DailyChallengeService] Failed to save to Redis:", err);
    }
  }

  // 3. Save to Supabase user_daily_attempts if configured
  if (isSupabaseConfigured()) {
    try {
      const client = getDbClient();
      const row = mapAttemptToRow(normalizedAttempt);
      await client
        .from("user_daily_attempts")
        .upsert(row, { onConflict: "user_id,date" });
    } catch (err) {
      console.warn(
        "[DailyChallengeService] Failed to upsert to Supabase, stored in memory/Redis:",
        err
      );
    }
  }

  return normalizedAttempt;
}

/**
 * Retrieves all attempts for a given user across available storage layers.
 */
export async function getAllUserAttempts(userId: string): Promise<DailyAttempt[]> {
  const attemptsMap = new Map<string, DailyAttempt>();

  // 1. Load from in-memory
  const inMem = inMemoryAttempts.get(userId);
  if (inMem) {
    for (const [date, att] of inMem.entries()) {
      attemptsMap.set(date, att);
    }
  }

  // 2. Load from Redis
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      if (redis) {
        const all = await redis.hgetall<Record<string, string | DailyAttempt>>(
          `pleng:daily:user:${userId}:attempts`
        );
        if (all) {
          for (const [date, raw] of Object.entries(all)) {
            const att: DailyAttempt = typeof raw === "string" ? JSON.parse(raw) : raw;
            attemptsMap.set(date, att);
          }
        }
      }
    } catch {}
  }

  // 3. Load from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const client = getDbClient();
      const { data, error } = await client
        .from("user_daily_attempts")
        .select("*")
        .eq("user_id", userId);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const att = mapAttemptFromRow(row);
          attemptsMap.set(att.date, att);
        }
      }
    } catch {}
  }

  return Array.from(attemptsMap.values());
}

/**
 * Calculates streak and performance statistics for a collection of daily attempts.
 */
export function calculateDailyStats(
  attempts: DailyAttempt[],
  todayStr: string = getTodayDateString()
): DailyUserStats {
  if (!attempts || attempts.length === 0) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      totalPlayed: 0,
      totalWon: 0,
      winRate: 0,
    };
  }

  const totalPlayed = attempts.length;
  const totalWon = attempts.filter((a) => a.isCorrect).length;
  const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;

  const attemptsByDate = new Map<string, DailyAttempt>();
  for (const att of attempts) {
    attemptsByDate.set(att.date, att);
  }

  const getPrevDateStr = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - 1));
    const yStr = dt.getUTCFullYear();
    const mStr = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(dt.getUTCDate()).padStart(2, "0");
    return `${yStr}-${mStr}-${dStr}`;
  };

  // 1. Current streak calculation
  let currentStreak = 0;
  const todayAtt = attemptsByDate.get(todayStr);

  if (todayAtt) {
    if (todayAtt.isCorrect) {
      currentStreak = 1;
      let checkDate = getPrevDateStr(todayStr);
      while (true) {
        const prevAtt = attemptsByDate.get(checkDate);
        if (prevAtt && prevAtt.isCorrect) {
          currentStreak++;
          checkDate = getPrevDateStr(checkDate);
        } else {
          break;
        }
      }
    } else {
      // User played today and failed -> streak is 0
      currentStreak = 0;
    }
  } else {
    // Today not played yet: check if yesterday was won
    const yesterdayStr = getPrevDateStr(todayStr);
    const yesterdayAtt = attemptsByDate.get(yesterdayStr);
    if (yesterdayAtt && yesterdayAtt.isCorrect) {
      currentStreak = 1;
      let checkDate = getPrevDateStr(yesterdayStr);
      while (true) {
        const prevAtt = attemptsByDate.get(checkDate);
        if (prevAtt && prevAtt.isCorrect) {
          currentStreak++;
          checkDate = getPrevDateStr(checkDate);
        } else {
          break;
        }
      }
    } else {
      currentStreak = 0;
    }
  }

  // 2. Max streak calculation
  const wonDates = Array.from(
    new Set(attempts.filter((a) => a.isCorrect).map((a) => a.date))
  ).sort();

  let maxStreak = 0;
  if (wonDates.length > 0) {
    maxStreak = 1;
    let temp = 1;
    for (let i = 1; i < wonDates.length; i++) {
      if (daysBetween(wonDates[i - 1], wonDates[i]) === 1) {
        temp++;
        if (temp > maxStreak) {
          maxStreak = temp;
        }
      } else if (daysBetween(wonDates[i - 1], wonDates[i]) > 1) {
        temp = 1;
      }
    }
  }

  maxStreak = Math.max(maxStreak, currentStreak);

  return {
    currentStreak,
    maxStreak,
    totalPlayed,
    totalWon,
    winRate,
  };
}

/**
 * Returns a user's daily statistics (streak, maxStreak, totalPlayed, totalWon, winRate).
 */
export async function getUserDailyStats(
  userId: string,
  todayStr?: string
): Promise<DailyUserStats> {
  if (!userId) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      totalPlayed: 0,
      totalWon: 0,
      winRate: 0,
    };
  }
  const attempts = await getAllUserAttempts(userId);
  return calculateDailyStats(attempts, todayStr);
}

// ==========================================
// Request Authentication Helper
// ==========================================

export async function getAuthUserFromRequest(
  request: Request
): Promise<{ id: string; email?: string } | null> {
  if (authUserOverride !== undefined) {
    return authUserOverride;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
          return { id: data.user.id, email: data.user.email };
        }
      } catch (err) {
        console.warn("[DailyChallenge] Error checking bearer token:", err);
      }
    }
  }

  // 2. Check cookies
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    try {
      const serverClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
        {
          cookies: {
            getAll() {
              return cookieHeader
                .split(";")
                .map((c) => {
                  const [name, ...val] = c.trim().split("=");
                  return { name, value: val.join("=") };
                })
                .filter((c) => c.name && c.value);
            },
            setAll() {},
          },
        }
      );
      const { data, error } = await serverClient.auth.getUser();
      if (!error && data?.user) {
        return { id: data.user.id, email: data.user.email };
      }
    } catch {}
  }

  return null;
}

// ==========================================
// Service Class Facade
// ==========================================

export class DailyChallengeService {
  static getTodayDateString = getTodayDateString;
  static isValidDateString = isValidDateString;
  static getPastDatesList = getPastDatesList;
  static daysBetween = daysBetween;
  static formatThaiDate = formatThaiDate;
  static THAI_MONTHS_SHORT = THAI_MONTHS_SHORT;
  static hashStringToSeed = hashStringToSeed;
  static seedToRandom = seedToRandom;
  static getDailySliceStart = getDailySliceStart;
  static getDailySongForDate = getDailySongForDate;
  static getUserDailyAttempt = getUserDailyAttempt;
  static saveUserDailyAttempt = saveUserDailyAttempt;
  static getAllUserAttempts = getAllUserAttempts;
  static calculateDailyStats = calculateDailyStats;
  static getUserDailyStats = getUserDailyStats;
  static getAuthUserFromRequest = getAuthUserFromRequest;
  static isSupabaseConfigured = isSupabaseConfigured;
  static clearInMemoryDailyStore = clearInMemoryDailyStore;
  static setDailySongPoolOverride = setDailySongPoolOverride;
  static resetDailySongPoolOverride = resetDailySongPoolOverride;
  static setDbClient = setDbClient;
  static resetDbClient = resetDbClient;
  static setAuthUserOverride = setAuthUserOverride;
}
