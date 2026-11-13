import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getDailyHandler } from "../route";
import { POST as postDailyAttemptHandler } from "../attempt/route";
import {
  DailyChallengeService,
  clearInMemoryDailyStore,
  setDailySongPoolOverride,
  resetDailySongPoolOverride,
  setAuthUserOverride,
} from "@/lib/services/daily-challenge-service";
import type { Song } from "@/types";

describe("Daily Challenge API Endpoints", () => {
  const dummySong: Song = {
    id: "song-daily-1",
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai", "watjai"],
    audioUrl: "https://example.com/watjai.mp3",
    hookStartSec: 68,
    hookEndSec: 94,
    durationSec: 260,
  };

  const todayStr = DailyChallengeService.getTodayDateString();

  beforeEach(() => {
    vi.clearAllMocks();
    clearInMemoryDailyStore();
    setDailySongPoolOverride([dummySong]);
    setAuthUserOverride(undefined);
  });

  describe("1. GET /api/daily", () => {
    it("defaults to today's date when date parameter is omitted", async () => {
      const req = new Request("http://localhost:3000/api/daily");
      const res = await getDailyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.date).toBe(todayStr);
      expect(data.songId).toBe(dummySong.id);
      expect(data.isCompleted).toBe(false);
      expect(data.sliceUrl).toContain(`/api/audio/slice?id=${dummySong.id}`);
      expect(Array.isArray(data.durationSteps)).toBe(true);
      expect(data.durationSteps.length).toBe(5);
    });

    it("rejects invalid date format with 400", async () => {
      const req = new Request("http://localhost:3000/api/daily?date=invalid-date");
      const res = await getDailyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("rejects future date with 400", async () => {
      const req = new Request("http://localhost:3000/api/daily?date=2099-12-31");
      const res = await getDailyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("cannot be in the future");
    });

    it("anti-cheat: masks song title, artist, audioUrl and revealedSong when challenge is incomplete", async () => {
      // Unauthenticated user
      setAuthUserOverride(null);

      const req = new Request(`http://localhost:3000/api/daily?date=${todayStr}`);
      const res = await getDailyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCompleted).toBe(false);
      expect(data.title).toBeUndefined();
      expect(data.artist).toBeUndefined();
      expect(data.audioUrl).toBeUndefined();
      expect(data.revealedSong).toBeUndefined();
      expect(data.userAttempt).toBeNull();
    });

    it("reveals song metadata when user has already completed the daily challenge", async () => {
      const userId = "auth-user-1";
      setAuthUserOverride({ id: userId });

      // Save a completed attempt
      await DailyChallengeService.saveUserDailyAttempt(userId, {
        userId,
        date: todayStr,
        isCorrect: true,
        step: 1,
        score: 100,
        guesses: ["วัดใจ"],
        completedAt: new Date().toISOString(),
      });

      const req = new Request(`http://localhost:3000/api/daily?date=${todayStr}`);
      const res = await getDailyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCompleted).toBe(true);
      expect(data.userAttempt).not.toBeNull();
      expect(data.userAttempt.score).toBe(100);
      expect(data.userStats).toBeDefined();
      expect(data.revealedSong).toEqual({
        id: dummySong.id,
        title: dummySong.title,
        artist: dummySong.artist,
        album: null,
        audioUrl: dummySong.audioUrl,
        releaseYear: null,
        hookStartSec: dummySong.hookStartSec,
      });
    });
  });

  describe("2. POST /api/daily/attempt", () => {
    it("returns 401 when caller is not authenticated", async () => {
      setAuthUserOverride(null);

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "วัดใจ",
          step: 1,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("returns 400 for invalid or future date", async () => {
      setAuthUserOverride({ id: "user-123" });

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2099-01-01",
          guessTitle: "วัดใจ",
          step: 1,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      expect(res.status).toBe(400);
    });

    it("evaluates correct guess on step 1: awards 100 points and completes challenge", async () => {
      setAuthUserOverride({ id: "user-correct-1" });

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "วัดใจ",
          step: 1,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isCorrect).toBe(true);
      expect(data.isCompleted).toBe(true);
      expect(data.scoreDelta).toBe(100);
      expect(data.revealedSong.title).toBe("วัดใจ");
      expect(data.userAttempt.score).toBe(100);
      expect(data.userStats.currentStreak).toBe(1);
    });

    it("evaluates correct guess via alias on step 3: awards 60 points", async () => {
      setAuthUserOverride({ id: "user-correct-3" });

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "wat jai",
          step: 3,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCorrect).toBe(true);
      expect(data.isCompleted).toBe(true);
      expect(data.scoreDelta).toBe(60);
    });

    it("handles incorrect guess when step < 5: does NOT complete and does NOT reveal song", async () => {
      setAuthUserOverride({ id: "user-wrong-step1" });

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "เพลงอื่นที่ไม่ถูก",
          step: 2,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCorrect).toBe(false);
      expect(data.isCompleted).toBe(false);
      expect(data.revealedSong).toBeUndefined();
      expect(data.userAttempt).toBeNull();
    });

    it("handles incorrect guess on final step (step 5): marks challenge as failed and reveals song", async () => {
      setAuthUserOverride({ id: "user-failed" });

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "ผิดครั้งสุดท้าย",
          step: 5,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCorrect).toBe(false);
      expect(data.isCompleted).toBe(true);
      expect(data.scoreDelta).toBe(0);
      expect(data.revealedSong.title).toBe("วัดใจ");
      expect(data.userAttempt.isCorrect).toBe(false);
      expect(data.userStats.currentStreak).toBe(0);
    });

    it("handles surrender: immediately finishes challenge with 0 points and reveals song", async () => {
      setAuthUserOverride({ id: "user-surrender" });

      const req = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          isSurrender: true,
          step: 2,
        }),
      });

      const res = await postDailyAttemptHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCorrect).toBe(false);
      expect(data.isCompleted).toBe(true);
      expect(data.scoreDelta).toBe(0);
      expect(data.revealedSong.title).toBe("วัดใจ");
      expect(data.userAttempt.isCorrect).toBe(false);
    });

    it("is idempotent: returns existing completed attempt if user already completed the date", async () => {
      const userId = "user-idempotent";
      setAuthUserOverride({ id: userId });

      // First submission (correct on step 1)
      const firstReq = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "วัดใจ",
          step: 1,
        }),
      });
      await postDailyAttemptHandler(firstReq);

      // Second submission on same date with different answer
      const secondReq = new Request("http://localhost:3000/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          guessTitle: "ชื่อเพลงมั่ว",
          step: 3,
        }),
      });
      const res = await postDailyAttemptHandler(secondReq);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCompleted).toBe(true);
      expect(data.isCorrect).toBe(true);
      expect(data.scoreDelta).toBe(100);
      expect(data.userAttempt.score).toBe(100);
    });
  });
});
