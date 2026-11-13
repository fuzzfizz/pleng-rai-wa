// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - GET /api/daily
// Deterministic Daily Challenge Info with Anti-Cheat Protection
// ==========================================

import { NextResponse } from "next/server";
import { DailyChallengeService } from "@/lib/services/daily-challenge-service";
import { PROGRESSIVE_SLICE_STEPS } from "@/lib/audio-slice-utils";
import type { DailyAttempt, DailyUserStats } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date = dateParam && dateParam.trim().length > 0
      ? dateParam.trim()
      : DailyChallengeService.getTodayDateString();

    // 1. Validate date parameter (must be valid YYYY-MM-DD and not in the future)
    if (!DailyChallengeService.isValidDateString(date)) {
      return NextResponse.json(
        { error: "Invalid date parameter. Date must be YYYY-MM-DD and cannot be in the future." },
        { status: 400 }
      );
    }

    // 2. Fetch daily song deterministically
    const dailySong = await DailyChallengeService.getDailySongForDate(date);
    if (!dailySong) {
      return NextResponse.json(
        { error: "Daily challenge song not found for this date." },
        { status: 404 }
      );
    }

    const sliceStartSec =
      (dailySong as any).dailySliceStartSec ??
      DailyChallengeService.getDailySliceStart(dailySong, date);

    const sliceUrl = `/api/audio/slice?id=${dailySong.id}&start=${sliceStartSec}&duration=0.1`;

    // 3. Check user authentication
    const user = await DailyChallengeService.getAuthUserFromRequest(request);

    let userAttempt: DailyAttempt | null = null;
    let userStats: DailyUserStats | null = null;
    let allAttempts: DailyAttempt[] = [];

    if (user) {
      userAttempt = await DailyChallengeService.getUserDailyAttempt(user.id, date);
      userStats = await DailyChallengeService.getUserDailyStats(user.id);
      allAttempts = await DailyChallengeService.getAllUserAttempts(user.id);
    }

    const isCompleted = Boolean(userAttempt);

    // 4. Anti-cheat protection:
    // If user has not completed this challenge yet, do NOT reveal title, artist, or full audioUrl!
    if (!isCompleted) {
      return NextResponse.json(
        {
          date,
          durationSteps: PROGRESSIVE_SLICE_STEPS,
          sliceUrl,
          sliceStartSec,
          songId: dailySong.id,
          isCompleted: false,
          userAttempt: null,
          userStats,
          allAttempts,
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    // If user has completed (or failed/surrendered), reveal the song metadata
    return NextResponse.json(
      {
        date,
        durationSteps: PROGRESSIVE_SLICE_STEPS,
        sliceUrl,
        sliceStartSec,
        songId: dailySong.id,
        isCompleted: true,
        userAttempt,
        userStats,
        allAttempts,
        revealedSong: {
          id: dailySong.id,
          title: dailySong.title,
          artist: dailySong.artist,
          album: dailySong.album || null,
          audioUrl: dailySong.audioUrl,
          releaseYear: dailySong.releaseYear || null,
          hookStartSec: dailySong.hookStartSec || 0,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err: any) {
    console.error("[DailyAPI] Unexpected error in GET /api/daily:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err?.message },
      { status: 500 }
    );
  }
}
