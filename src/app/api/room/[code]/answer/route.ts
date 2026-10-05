// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Answer Submission Route
// Buzzer holder authorization, fuzzy answer checking & multi-chance scoring
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { isValidRoomCode } from "@/lib/room-code";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;

    if (!code || !isValidRoomCode(code)) {
      return NextResponse.json(
        { success: false, error: "รหัสห้องไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "ข้อมูล JSON ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "ข้อมูล JSON ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { playerId, displayName, answerText } = body as {
      playerId?: string;
      displayName?: string;
      answerText?: string;
    };

    if (
      !playerId ||
      typeof playerId !== "string" ||
      playerId.trim().length === 0 ||
      answerText === undefined ||
      typeof answerText !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ข้อมูลคำตอบไม่ถูกต้อง (ต้องระบุ playerId และ answerText)",
        },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanPlayerId = playerId.trim();
    const cleanDisplayName =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : "ผู้เล่น";
    const cleanAnswerText = answerText.trim();

    const room = await RoomService.getRoomByCode(cleanCode);
    if (!room) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    // Verify that the caller is the current active buzzer holder
    const currentRoundState = RoomStateStore.getRoomRoundState(cleanCode);
    if (
      !currentRoundState ||
      currentRoundState.roundStatus !== "buzzed" ||
      currentRoundState.buzzedPlayerId !== cleanPlayerId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์ตอบคำถาม (ไม่ใช่ผู้กดกริ่งคนแรก)",
        },
        { status: 403 }
      );
    }

    // Evaluate answer with fuzzy Thai engine and update score
    const result = RoomStateStore.submitAnswer(
      cleanCode,
      cleanPlayerId,
      cleanDisplayName,
      cleanAnswerText
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถประมวลผลคำตอบได้ในขณะนี้",
        },
        { status: 400 }
      );
    }

    if (result.isCorrect) {
      // 1. Correct Answer: update DB status to 'revealing'
      await RoomService.updateRoomStatus(cleanCode, "revealing");

      const revealPayload = {
        winnerPlayerId: cleanPlayerId,
        winnerDisplayName:
          result.roundState?.buzzedPlayerName || cleanDisplayName,
        answerText: cleanAnswerText,
        matchedAs: result.matchedAs,
        similarity: result.similarity,
        scoreDelta: 100,
        scores: result.scores,
        song: result.fullSong,
      };

      await RealtimeBroadcastService.broadcast(
        cleanCode,
        "round_reveal",
        revealPayload
      );

      return NextResponse.json({
        success: true,
        isCorrect: true,
        matchedAs: result.matchedAs,
        similarity: result.similarity,
        scoreDelta: 100,
        newScore: result.newScore,
        scores: result.scores,
        song: result.fullSong,
      });
    } else {
      // 2. Wrong Answer: party rules penalty (-20), unlock buzzer, resume audio
      const wrongPayload = {
        playerId: cleanPlayerId,
        displayName:
          result.roundState?.buzzedPlayerName || cleanDisplayName,
        answerText: cleanAnswerText,
        similarity: result.similarity,
        scoreDelta: -20,
        newScore: result.newScore,
        scores: result.scores,
        resumeAudio: true,
        wrongGuesses: result.roundState?.wrongGuesses || [],
      };

      await RealtimeBroadcastService.broadcast(
        cleanCode,
        "wrong_guess",
        wrongPayload
      );

      return NextResponse.json({
        success: true,
        isCorrect: false,
        scoreDelta: -20,
        newScore: result.newScore,
        scores: result.scores,
        resumeAudio: true,
        wrongGuesses: result.roundState?.wrongGuesses || [],
      });
    }
  } catch (error) {
    console.error("Answer route error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการตรวจสอบคำตอบ",
      },
      { status: 500 }
    );
  }
}
