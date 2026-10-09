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

    // Verify that the caller is the current active buzzer holder OR direct answering in non-buzzer modes
    const currentRoundState = RoomStateStore.getRoomRoundState(cleanCode);
    const isBuzzerHolder =
      currentRoundState?.roundStatus === "buzzed" &&
      currentRoundState?.buzzedPlayerId === cleanPlayerId;
    const isDirectAnswerAllowed =
      room.settings.gameMode !== "buzzer" &&
      currentRoundState?.roundStatus === "question_active";

    if (!currentRoundState || (!isBuzzerHolder && !isDirectAnswerAllowed)) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์ตอบคำถาม (ไม่ใช่ผู้กดกริ่งคนแรก หรือไม่อยู่ในช่วงเวลาที่ตอบได้)",
        },
        { status: 403 }
      );
    }

    if (isDirectAnswerAllowed && currentRoundState.excludedPlayerIds.includes(cleanPlayerId)) {
      return NextResponse.json(
        {
          success: false,
          error: "คุณตอบผิดในข้อนี้แล้ว ไม่สามารถตอบซ้ำได้",
          reason: "already_guessed_wrong",
        },
        { status: 400 }
      );
    }

    const totalPlayers =
      (typeof body.totalPlayers === "number" && body.totalPlayers > 0
        ? body.totalPlayers
        : undefined) ??
      (room.players && room.players.length > 0
        ? room.players.length
        : undefined) ??
      (room.settings?.playerCount && room.settings.playerCount > 0
        ? room.settings.playerCount
        : undefined) ??
      (currentRoundState && Object.keys(currentRoundState.scores).length > 0
        ? Object.keys(currentRoundState.scores).length
        : undefined) ??
      1;

    // Evaluate answer with fuzzy Thai engine and update score
    const result = RoomStateStore.submitAnswer(
      cleanCode,
      cleanPlayerId,
      cleanDisplayName,
      cleanAnswerText,
      {
        roomSettings: room.settings,
        gameMode: room.settings.gameMode,
        totalPlayers,
      }
    );

    if (!result.success) {
      if (result.reason === "already_guessed_wrong") {
        return NextResponse.json(
          {
            success: false,
            error: "คุณตอบผิดในข้อนี้แล้ว ไม่สามารถตอบซ้ำได้",
            reason: "already_guessed_wrong",
          },
          { status: 400 }
        );
      }

      if (result.reason === "buzzer_timeout") {
        const timeoutPayload = {
          playerId: cleanPlayerId,
          displayName: cleanDisplayName,
          answerText: "(หมดเวลา)",
          scoreDelta: -20,
          scores: result.scores,
          resumeAudio: true,
          wrongGuesses: result.roundState?.wrongGuesses || [],
          reason: "buzzer_timeout",
        };

        RealtimeBroadcastService.broadcast(
          cleanCode,
          "wrong_guess",
          timeoutPayload
        ).catch((err: unknown) => {
          console.warn("Failed to broadcast buzzer timeout event:", err);
        });

        return NextResponse.json(
          {
            success: false,
            error: "หมดเวลาในการตอบคำถาม (เกิน 10 วินาที)",
            isCorrect: false,
            scoreDelta: -20,
            newScore: result.newScore,
            scores: result.scores,
            resumeAudio: true,
            wrongGuesses: result.roundState?.wrongGuesses || [],
            reason: "buzzer_timeout",
          },
          { status: 200 }
        );
      }

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
        scoreDelta: result.scoreDelta,
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
        scoreDelta: result.scoreDelta,
        newScore: result.newScore,
        scores: result.scores,
        song: result.fullSong,
      });
    } else {
      // 2. Wrong Answer
      // Check if all players answered wrong -> roundStatus transitioned to 'revealing' with no winner
      if (result.roundState?.roundStatus === "revealing") {
        await RoomService.updateRoomStatus(cleanCode, "revealing");

        const revealPayload = {
          winnerPlayerId: null,
          winnerDisplayName: null,
          answerText: cleanAnswerText,
          matchedAs: result.matchedAs,
          similarity: result.similarity,
          scoreDelta: result.scoreDelta,
          scores: result.scores,
          song: result.fullSong || currentRoundState.currentSong,
        };

        await RealtimeBroadcastService.broadcast(
          cleanCode,
          "round_reveal",
          revealPayload
        );

        return NextResponse.json({
          success: true,
          isCorrect: false,
          scoreDelta: result.scoreDelta,
          newScore: result.newScore,
          scores: result.scores,
          wrongGuesses: result.roundState?.wrongGuesses || [],
          song: result.fullSong || currentRoundState.currentSong,
        });
      }

      // Still in active question -> broadcast wrong_guess
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
