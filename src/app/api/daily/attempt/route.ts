// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - POST /api/daily/attempt
// Evaluate Daily Guess, Handle Surrender & Persist Completion
// ==========================================

import { NextResponse } from "next/server";
import { DailyChallengeService } from "@/lib/services/daily-challenge-service";
import { checkAnswer } from "@/lib/answer-checker";
import { calculatePointsForSliceStep } from "@/lib/audio-slice-utils";
import type { DailyAttempt } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authentication check (requires logged in user)
    const user = await DailyChallengeService.getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required to submit daily attempts." },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const { date, guessTitle, step = 1, isSurrender = false, previousGuesses } = body;

    // 3. Validate date parameter
    if (!date || typeof date !== "string" || !DailyChallengeService.isValidDateString(date)) {
      return NextResponse.json(
        { error: "Invalid or future date provided." },
        { status: 400 }
      );
    }

    // 4. Fetch daily song for date
    const dailySong = await DailyChallengeService.getDailySongForDate(date);
    if (!dailySong) {
      return NextResponse.json(
        { error: "Daily challenge song not found for this date." },
        { status: 404 }
      );
    }

    // 5. Check if user already completed this date
    const existingAttempt = await DailyChallengeService.getUserDailyAttempt(user.id, date);
    if (existingAttempt) {
      const userStats = await DailyChallengeService.getUserDailyStats(user.id);
      const allAttempts = await DailyChallengeService.getAllUserAttempts(user.id);
      return NextResponse.json({
        success: true,
        isCorrect: existingAttempt.isCorrect,
        matchedAs: existingAttempt.isCorrect ? dailySong.title : "",
        scoreDelta: existingAttempt.score,
        isCompleted: true,
        revealedSong: {
          id: dailySong.id,
          title: dailySong.title,
          artist: dailySong.artist,
          album: dailySong.album || null,
          audioUrl: dailySong.audioUrl,
          releaseYear: dailySong.releaseYear || null,
          hookStartSec: dailySong.hookStartSec || 0,
        },
        userAttempt: existingAttempt,
        userStats,
        allAttempts,
      });
    }

    const currentStep = typeof step === "number" && !isNaN(step) ? Math.max(1, Math.min(5, Math.round(step))) : 1;
    const trimmedGuess = typeof guessTitle === "string" ? guessTitle.trim() : "";

    // Accumulate guesses
    const prior = Array.isArray(previousGuesses) ? previousGuesses.filter((g: any) => typeof g === "string") : [];
    const updatedGuesses = trimmedGuess && !prior.includes(trimmedGuess) ? [...prior, trimmedGuess] : prior;

    // 6. Handle Surrender
    if (isSurrender) {
      const attempt: DailyAttempt = {
        userId: user.id,
        date,
        isCorrect: false,
        step: currentStep,
        score: 0,
        guesses: updatedGuesses,
        completedAt: new Date().toISOString(),
      };

      await DailyChallengeService.saveUserDailyAttempt(user.id, attempt);
      const userStats = await DailyChallengeService.getUserDailyStats(user.id);
      const allAttempts = await DailyChallengeService.getAllUserAttempts(user.id);

      return NextResponse.json({
        success: true,
        isCorrect: false,
        matchedAs: "",
        scoreDelta: 0,
        isCompleted: true,
        revealedSong: {
          id: dailySong.id,
          title: dailySong.title,
          artist: dailySong.artist,
          album: dailySong.album || null,
          audioUrl: dailySong.audioUrl,
          releaseYear: dailySong.releaseYear || null,
          hookStartSec: dailySong.hookStartSec || 0,
        },
        userAttempt: attempt,
        userStats,
        allAttempts,
      });
    }

    // 7. Evaluate guess against song title and aliases
    const checkResult = checkAnswer(trimmedGuess, {
      title: dailySong.title,
      aliases: dailySong.aliases || [],
    });

    if (checkResult.isCorrect) {
      const scoreDelta = calculatePointsForSliceStep(currentStep);
      const attempt: DailyAttempt = {
        userId: user.id,
        date,
        isCorrect: true,
        step: currentStep,
        score: scoreDelta,
        guesses: updatedGuesses,
        completedAt: new Date().toISOString(),
      };

      await DailyChallengeService.saveUserDailyAttempt(user.id, attempt);
      const userStats = await DailyChallengeService.getUserDailyStats(user.id);
      const allAttempts = await DailyChallengeService.getAllUserAttempts(user.id);

      return NextResponse.json({
        success: true,
        isCorrect: true,
        matchedAs: checkResult.matchedAs,
        scoreDelta,
        isCompleted: true,
        revealedSong: {
          id: dailySong.id,
          title: dailySong.title,
          artist: dailySong.artist,
          album: dailySong.album || null,
          audioUrl: dailySong.audioUrl,
          releaseYear: dailySong.releaseYear || null,
          hookStartSec: dailySong.hookStartSec || 0,
        },
        userAttempt: attempt,
        userStats,
        allAttempts,
      });
    }

    // Guess is wrong: check if max step (5) is reached
    if (currentStep >= 5) {
      const attempt: DailyAttempt = {
        userId: user.id,
        date,
        isCorrect: false,
        step: 5,
        score: 0,
        guesses: updatedGuesses,
        completedAt: new Date().toISOString(),
      };

      await DailyChallengeService.saveUserDailyAttempt(user.id, attempt);
      const userStats = await DailyChallengeService.getUserDailyStats(user.id);
      const allAttempts = await DailyChallengeService.getAllUserAttempts(user.id);

      return NextResponse.json({
        success: true,
        isCorrect: false,
        matchedAs: "",
        scoreDelta: 0,
        isCompleted: true,
        revealedSong: {
          id: dailySong.id,
          title: dailySong.title,
          artist: dailySong.artist,
          album: dailySong.album || null,
          audioUrl: dailySong.audioUrl,
          releaseYear: dailySong.releaseYear || null,
          hookStartSec: dailySong.hookStartSec || 0,
        },
        userAttempt: attempt,
        userStats,
        allAttempts,
      });
    }

    // Guess is wrong and step < 5: Do NOT complete, do NOT reveal song
    const userStats = await DailyChallengeService.getUserDailyStats(user.id);
    const allAttempts = await DailyChallengeService.getAllUserAttempts(user.id);
    return NextResponse.json({
      success: true,
      isCorrect: false,
      matchedAs: "",
      scoreDelta: 0,
      isCompleted: false,
      revealedSong: undefined,
      userAttempt: null,
      userStats,
      allAttempts,
    });
  } catch (err: any) {
    console.error("[DailyAPI] Unexpected error in POST /api/daily/attempt:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err?.message },
      { status: 500 }
    );
  }
}
