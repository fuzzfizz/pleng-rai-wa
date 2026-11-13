import { describe, it, expect, beforeEach } from "vitest";
import {
  DailyChallengeService,
  getTodayDateString,
  isValidDateString,
  getPastDatesList,
  daysBetween,
  hashStringToSeed,
  seedToRandom,
  getDailySliceStart,
  getDailySongForDate,
  getUserDailyAttempt,
  saveUserDailyAttempt,
  calculateDailyStats,
  clearInMemoryDailyStore,
  setDailySongPoolOverride,
  resetDailySongPoolOverride,
  setDbClient,
  resetDbClient,
} from "../services/daily-challenge-service";
import type { Song, DailyAttempt } from "@/types";

describe("DailyChallengeService", () => {
  beforeEach(() => {
    clearInMemoryDailyStore();
    resetDailySongPoolOverride();
    resetDbClient();
  });

  describe("Date Helpers", () => {
    it("getTodayDateString returns YYYY-MM-DD in Asia/Bangkok time (UTC+7)", () => {
      // 2026-11-12 at 20:00:00 UTC is 2026-11-13 03:00:00 in Bangkok (UTC+7)
      const lateUtc = new Date("2026-11-12T20:00:00Z");
      expect(getTodayDateString(lateUtc)).toBe("2026-11-13");

      // 2026-11-13 at 01:00:00 UTC is 2026-11-13 08:00:00 in Bangkok
      const morningUtc = new Date("2026-11-13T01:00:00Z");
      expect(getTodayDateString(morningUtc)).toBe("2026-11-13");
    });

    it("isValidDateString validates correct dates and rejects invalid or future dates", () => {
      const today = getTodayDateString();
      expect(isValidDateString(today)).toBe(true);
      expect(isValidDateString("2026-01-01")).toBe(true);

      // Future date
      expect(isValidDateString("2099-12-31")).toBe(false);

      // Malformed strings
      expect(isValidDateString("")).toBe(false);
      expect(isValidDateString("not-a-date")).toBe(false);
      expect(isValidDateString("2026/11/13")).toBe(false);
      expect(isValidDateString("13-11-2026")).toBe(false);

      // Impossible calendar dates
      expect(isValidDateString("2026-02-30")).toBe(false);
      expect(isValidDateString("2026-13-01")).toBe(false);
      expect(isValidDateString("2026-00-10")).toBe(false);
    });

    it("getPastDatesList returns descending dates starting from today", () => {
      const past3 = getPastDatesList(3, "2026-11-13");
      expect(past3).toEqual(["2026-11-13", "2026-11-12", "2026-11-11"]);

      const past1 = getPastDatesList(1, "2026-11-13");
      expect(past1).toEqual(["2026-11-13"]);

      const past0 = getPastDatesList(0, "2026-11-13");
      expect(past0).toEqual([]);

      // Across month boundary: 2026-11-02 going back 3 days
      const monthBoundary = getPastDatesList(3, "2026-11-02");
      expect(monthBoundary).toEqual(["2026-11-02", "2026-11-01", "2026-10-31"]);
    });

    it("daysBetween calculates exact calendar days in UTC", () => {
      expect(daysBetween("2026-11-10", "2026-11-11")).toBe(1);
      expect(daysBetween("2026-11-10", "2026-11-10")).toBe(0);
      expect(daysBetween("2026-11-11", "2026-11-10")).toBe(-1);
      expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
      expect(daysBetween("2026-11-01", "2026-11-05")).toBe(4);
    });
  });

  describe("Deterministic Song Selector & Slice Start", () => {
    const mockSongs: Song[] = [
      {
        id: "song-alpha",
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: ["wat jai"],
        audioUrl: "https://example.com/watjai.mp3",
        hookStartSec: 68,
        hookEndSec: 94,
        durationSec: 260,
      },
      {
        id: "song-beta",
        title: "ซ่อนกลิ่น",
        artist: "Palmy",
        aliases: ["son klin"],
        audioUrl: "https://example.com/sonklin.mp3",
        hookStartSec: 65,
        hookEndSec: 90,
        durationSec: 250,
      },
      {
        id: "song-gamma",
        title: "ขอบคุณที่รักกัน",
        artist: "Potato",
        aliases: ["kob koon"],
        audioUrl: "https://example.com/potato.mp3",
        hookStartSec: 72,
        hookEndSec: 98,
        durationSec: 245,
      },
    ];

    it("hashStringToSeed produces consistent non-negative integers", () => {
      const seed1 = hashStringToSeed("pleng-rai-wa-daily-2026-11-13");
      const seed2 = hashStringToSeed("pleng-rai-wa-daily-2026-11-13");
      const seedDiff = hashStringToSeed("pleng-rai-wa-daily-2026-11-14");

      expect(seed1).toBe(seed2);
      expect(seed1).toBeGreaterThanOrEqual(0);
      expect(seed1).not.toBe(seedDiff);
    });

    it("seedToRandom generates deterministic numbers between 0 and 1", () => {
      const randA = seedToRandom(12345);
      const randB = seedToRandom(12345);

      const valA1 = randA();
      const valA2 = randA();

      const valB1 = randB();
      const valB2 = randB();

      expect(valA1).toBe(valB1);
      expect(valA2).toBe(valB2);
      expect(valA1).toBeGreaterThanOrEqual(0);
      expect(valA1).toBeLessThan(1);
    });

    it("getDailySongForDate selects deterministically for the same date", async () => {
      setDailySongPoolOverride(mockSongs);

      const pick1 = await getDailySongForDate("2026-11-13");
      const pick2 = await getDailySongForDate("2026-11-13");
      const pick3 = await getDailySongForDate("2026-11-13");

      expect(pick1).not.toBeNull();
      expect(pick2).not.toBeNull();
      expect(pick1?.id).toBe(pick2?.id);
      expect(pick1?.id).toBe(pick3?.id);
      expect((pick1 as any).dailySliceStartSec).toBe((pick2 as any).dailySliceStartSec);
    });

    it("getDailySliceStart produces consistent hook start offset", () => {
      const song = mockSongs[0];
      const start1 = getDailySliceStart(song, "2026-11-13");
      const start2 = getDailySliceStart(song, "2026-11-13");

      expect(start1).toBe(start2);
      expect(start1).toBeGreaterThanOrEqual(song.hookStartSec || 0);
      expect(start1).toBeLessThanOrEqual(song.hookEndSec || 100);
    });

    it("gracefully falls back to DEMO_SONGS if DB returns empty", async () => {
      resetDailySongPoolOverride();
      const chain: any = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      setDbClient({
        from: () => chain,
      });

      const dailySong = await getDailySongForDate("2026-11-13");
      expect(dailySong).not.toBeNull();
      expect(dailySong?.title).toBeDefined();
    });
  });

  describe("User Daily Attempt & Streak Storage", () => {
    it("saves and retrieves user daily attempt correctly", async () => {
      const attempt: DailyAttempt = {
        userId: "user-1",
        date: "2026-11-13",
        isCorrect: true,
        step: 2,
        score: 80,
        guesses: ["วัดใจ"],
        completedAt: "2026-11-13T10:00:00Z",
      };

      await saveUserDailyAttempt("user-1", attempt);
      const retrieved = await getUserDailyAttempt("user-1", "2026-11-13");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.userId).toBe("user-1");
      expect(retrieved?.date).toBe("2026-11-13");
      expect(retrieved?.isCorrect).toBe(true);
      expect(retrieved?.score).toBe(80);
      expect(retrieved?.step).toBe(2);
      expect(retrieved?.guesses).toEqual(["วัดใจ"]);

      // Unplayed date returns null
      const unplayed = await getUserDailyAttempt("user-1", "2026-11-12");
      expect(unplayed).toBeNull();
    });

    it("handles Supabase query error gracefully by falling back to in-memory store", async () => {
      // Simulate broken Supabase table
      setDbClient({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.reject(new Error("Relation user_daily_attempts does not exist")),
              }),
            }),
          }),
          upsert: () => Promise.reject(new Error("Relation user_daily_attempts does not exist")),
        }),
      });

      const attempt: DailyAttempt = {
        userId: "user-fallback",
        date: "2026-11-13",
        isCorrect: true,
        step: 1,
        score: 100,
        guesses: ["ซ่อนกลิ่น"],
        completedAt: "2026-11-13T10:00:00Z",
      };

      // Should not throw!
      await saveUserDailyAttempt("user-fallback", attempt);
      const retrieved = await getUserDailyAttempt("user-fallback", "2026-11-13");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.score).toBe(100);
    });
  });

  describe("Daily Stats & Streak Calculations", () => {
    it("returns zero stats when user has no attempts", () => {
      const stats = calculateDailyStats([], "2026-11-13");
      expect(stats).toEqual({
        currentStreak: 0,
        maxStreak: 0,
        totalPlayed: 0,
        totalWon: 0,
        winRate: 0,
      });
    });

    it("calculates streak 1 when user won today", () => {
      const attempts: DailyAttempt[] = [
        {
          userId: "u1",
          date: "2026-11-13",
          isCorrect: true,
          step: 1,
          score: 100,
          guesses: ["วัดใจ"],
          completedAt: "2026-11-13T10:00:00Z",
        },
      ];

      const stats = calculateDailyStats(attempts, "2026-11-13");
      expect(stats.currentStreak).toBe(1);
      expect(stats.maxStreak).toBe(1);
      expect(stats.totalPlayed).toBe(1);
      expect(stats.totalWon).toBe(1);
      expect(stats.winRate).toBe(100);
    });

    it("calculates streak 0 when user played and lost today", () => {
      const attempts: DailyAttempt[] = [
        {
          userId: "u1",
          date: "2026-11-13",
          isCorrect: false,
          step: 5,
          score: 0,
          guesses: ["ผิด 1", "ผิด 2"],
          completedAt: "2026-11-13T10:00:00Z",
        },
      ];

      const stats = calculateDailyStats(attempts, "2026-11-13");
      expect(stats.currentStreak).toBe(0);
      expect(stats.maxStreak).toBe(0);
      expect(stats.totalPlayed).toBe(1);
      expect(stats.totalWon).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    it("preserves active streak from yesterday when today has not been played yet", () => {
      const attempts: DailyAttempt[] = [
        {
          userId: "u1",
          date: "2026-11-12",
          isCorrect: true,
          step: 1,
          score: 100,
          guesses: ["ซ่อนกลิ่น"],
          completedAt: "2026-11-12T10:00:00Z",
        },
      ];

      // Today is 2026-11-13, user has not played yet
      const stats = calculateDailyStats(attempts, "2026-11-13");
      expect(stats.currentStreak).toBe(1);
      expect(stats.maxStreak).toBe(1);
    });

    it("calculates consecutive winning streak across multiple days", () => {
      const attempts: DailyAttempt[] = [
        {
          userId: "u1",
          date: "2026-11-10",
          isCorrect: true,
          step: 1,
          score: 100,
          guesses: ["A"],
          completedAt: "2026-11-10T10:00:00Z",
        },
        {
          userId: "u1",
          date: "2026-11-11",
          isCorrect: true,
          step: 2,
          score: 80,
          guesses: ["B"],
          completedAt: "2026-11-11T10:00:00Z",
        },
        {
          userId: "u1",
          date: "2026-11-12",
          isCorrect: true,
          step: 3,
          score: 60,
          guesses: ["C"],
          completedAt: "2026-11-12T10:00:00Z",
        },
        {
          userId: "u1",
          date: "2026-11-13",
          isCorrect: true,
          step: 1,
          score: 100,
          guesses: ["D"],
          completedAt: "2026-11-13T10:00:00Z",
        },
      ];

      const stats = calculateDailyStats(attempts, "2026-11-13");
      expect(stats.currentStreak).toBe(4);
      expect(stats.maxStreak).toBe(4);
      expect(stats.totalPlayed).toBe(4);
      expect(stats.totalWon).toBe(4);
      expect(stats.winRate).toBe(100);
    });

    it("handles broken streak with historical maxStreak correctly", () => {
      const attempts: DailyAttempt[] = [
        // 3 consecutive wins
        { userId: "u1", date: "2026-11-01", isCorrect: true, step: 1, score: 100, guesses: ["1"], completedAt: "" },
        { userId: "u1", date: "2026-11-02", isCorrect: true, step: 1, score: 100, guesses: ["2"], completedAt: "" },
        { userId: "u1", date: "2026-11-03", isCorrect: true, step: 1, score: 100, guesses: ["3"], completedAt: "" },
        // Missed 2026-11-04
        // Loss on 2026-11-05
        { userId: "u1", date: "2026-11-05", isCorrect: false, step: 5, score: 0, guesses: ["4"], completedAt: "" },
        // New win today (2026-11-06)
        { userId: "u1", date: "2026-11-06", isCorrect: true, step: 1, score: 100, guesses: ["5"], completedAt: "" },
      ];

      const stats = calculateDailyStats(attempts, "2026-11-06");
      expect(stats.currentStreak).toBe(1);
      expect(stats.maxStreak).toBe(3);
      expect(stats.totalPlayed).toBe(5);
      expect(stats.totalWon).toBe(4);
      expect(stats.winRate).toBe(80);
    });

    it("correctly tracks streaks across month boundaries", () => {
      const attempts: DailyAttempt[] = [
        { userId: "u1", date: "2026-10-31", isCorrect: true, step: 1, score: 100, guesses: ["1"], completedAt: "" },
        { userId: "u1", date: "2026-11-01", isCorrect: true, step: 2, score: 80, guesses: ["2"], completedAt: "" },
        { userId: "u1", date: "2026-11-02", isCorrect: true, step: 3, score: 60, guesses: ["3"], completedAt: "" },
      ];

      const stats = calculateDailyStats(attempts, "2026-11-02");
      expect(stats.currentStreak).toBe(3);
      expect(stats.maxStreak).toBe(3);
    });
  });
});
