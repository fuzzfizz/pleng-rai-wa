// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Answer Submission Route
// Buzzer holder authorization, fuzzy answer checking & multi-chance scoring
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { RoomStateStore, type RoundStatus } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { RedisService } from "@/lib/services/redis-service";
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
    // Ensure active round state is rehydrated in case this is a fresh serverless instance
    const currentRoundState = room
      ? await RoomStateStore.ensureRoundState(cleanCode, room)
      : RoomStateStore.getRoomRoundState(cleanCode);

    if (!room && !currentRoundState) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    // Fallback check: If currentRoundState.roundStatus === "revealing" but room?.status === "question_active", update currentRoundState.roundStatus = "question_active"
    if (currentRoundState && currentRoundState.roundStatus === "revealing" && room?.status === "question_active") {
      currentRoundState.roundStatus = "question_active";
    }

    const isSurrender = cleanAnswerText === "(ยอมแพ้)" || Boolean(body.isSurrender);
    const roomSettings = room?.settings || currentRoundState?.settings;
    const effectiveGameMode =
      currentRoundState?.gameMode ||
      roomSettings?.gameMode ||
      "buzzer";
    const effectiveRoundStatus =
      room?.status === "question_active" && effectiveGameMode !== "buzzer"
        ? "question_active"
        : (currentRoundState?.roundStatus ||
           (room?.status as RoundStatus) ||
           "question_active");
    let effectiveBuzzedPlayerId =
      currentRoundState?.buzzedPlayerId ||
      roomSettings?.round_state?.buzzedPlayerId ||
      null;

    if (!effectiveBuzzedPlayerId && RedisService.isRedisAvailable()) {
      try {
        const redisLock = await RedisService.getBuzzerLock(cleanCode);
        if (redisLock?.playerId) {
          effectiveBuzzedPlayerId = redisLock.playerId;
        }
      } catch {}
    }

    // Handle Surrender cleanly with zero score penalty and no wrong guess banner
    if (isSurrender) {
      if (effectiveRoundStatus !== "question_active" && effectiveRoundStatus !== "buzzed") {
        return NextResponse.json(
          {
            success: false,
            error: "ไม่อยู่ในช่วงเวลาที่ยอมแพ้ได้",
          },
          { status: 400 }
        );
      }

      const totalPlayers =
        (typeof body.totalPlayers === "number" && body.totalPlayers > 0
          ? body.totalPlayers
          : undefined) ??
        (room?.players && room.players.length > 0
          ? room.players.length
          : undefined) ??
        (roomSettings?.playerCount && roomSettings.playerCount > 0
          ? roomSettings.playerCount
          : undefined) ??
        (currentRoundState && Object.keys(currentRoundState.scores).length > 0
          ? Object.keys(currentRoundState.scores).length
          : undefined) ??
        1;

      const result = RoomStateStore.surrenderPlayer(
        cleanCode,
        cleanPlayerId,
        cleanDisplayName,
        {
          roomSettings,
          totalPlayers,
          reason: body.reason === "timed_out" ? "timed_out" : "surrendered",
          isHost: Boolean(body.isHost || (room?.host_player_id && room.host_player_id === cleanPlayerId)),
        }
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              result.reason === "round_not_active"
                ? "ไม่อยู่ในช่วงเวลาที่ยอมแพ้ได้"
                : "ไม่สามารถยอมแพ้ในรอบนี้ได้",
          },
          { status: 400 }
        );
      }

      // Persist updated round state to database
      if (result.roundState && typeof RoomService.updateRoomRoundState === "function") {
        const serialized = RoomStateStore.serializeRoundState(result.roundState);
        RoomService.updateRoomRoundState(
          cleanCode,
          serialized,
          result.allExcluded ? "revealing" : undefined
        ).catch((err) => console.warn("[AnswerRoute] Failed to sync surrender state:", err));

        if (effectiveGameMode === "buzzer") {
          RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
        }
        RedisService.saveRoundState(cleanCode, serialized).catch(() => {});
      }

      if (result.allExcluded) {
        await RoomService.updateRoomStatus(cleanCode, "revealing").catch(() => {});
      }

      // 1. Broadcast player_surrendered event
      await RealtimeBroadcastService.broadcast(cleanCode, "player_surrendered", {
        playerId: cleanPlayerId,
        displayName: cleanDisplayName,
        allExcluded: result.allExcluded,
      });

      // 2. If all players have surrendered or guessed wrong, broadcast round_reveal
      if (result.allExcluded) {
        const winnerId = result.roundState?.winnerPlayerId || null;
        const winnerSub = winnerId ? result.roundState?.playerSubmissions?.[winnerId] : null;
        const winnerDisplayName = winnerSub?.displayName || (winnerId ? "ผู้ชนะ" : null);
        const scoreDelta = winnerSub?.scoreDelta || 0;

        const winners =
          result.roundState?.winners ||
          (winnerId
            ? [
                {
                  playerId: winnerId,
                  displayName: winnerDisplayName,
                  scoreDelta,
                },
              ]
            : []);

        await RealtimeBroadcastService.broadcast(cleanCode, "round_reveal", {
          song: result.fullSong || result.roundState?.currentSong,
          winnerPlayerId: winnerId,
          winnerDisplayName,
          answerText: winnerSub?.answerText || null,
          scoreDelta,
          scores: result.roundState?.scores || {},
          skipped: !winnerId,
          winners,
        });
      }

      return NextResponse.json({
        success: true,
        isSurrender: true,
        isCorrect: false,
        allExcluded: result.allExcluded,
        scoreDelta: 0,
        scores: result.roundState?.scores || {},
        roundStatus: result.roundState?.roundStatus,
      });
    }

    const isBuzzerHolder =
      effectiveRoundStatus === "buzzed" &&
      effectiveBuzzedPlayerId === cleanPlayerId;
    const isDirectAnswerAllowed =
      effectiveGameMode !== "buzzer" &&
      (effectiveRoundStatus === "question_active" || room?.status === "question_active");

    if (!currentRoundState || (!isBuzzerHolder && !isDirectAnswerAllowed)) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์ตอบคำถาม (ไม่ใช่ผู้กดกริ่งคนแรก หรือไม่อยู่ในช่วงเวลาที่ตอบได้)",
        },
        { status: 403 }
      );
    }

    if (currentRoundState.excludedPlayerIds.includes(cleanPlayerId)) {
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
        const canRetry = Boolean(result.canRetry);
        const remainingAttempts =
          typeof result.remainingAttempts === "number" ? result.remainingAttempts : 0;
        const isExcluded = !canRetry;

        const timeoutPayload = {
          playerId: cleanPlayerId,
          displayName: cleanDisplayName,
          answerText: "(หมดเวลา)",
          scoreDelta: 0,
          scores: result.scores,
          resumeAudio: effectiveGameMode === "buzzer",
          wrongGuesses: result.roundState?.wrongGuesses || [],
          reason: "buzzer_timeout",
          excluded: isExcluded,
          isExcluded,
          canRetry,
          remainingAttempts,
        };

        if (result.roundState && typeof RoomService.updateRoomRoundState === "function") {
          RoomService.updateRoomRoundState(
            cleanCode,
            RoomStateStore.serializeRoundState(result.roundState),
            result.roundState.roundStatus
          ).catch((err) => console.warn("[AnswerRoute] Failed to sync timeout state:", err));
        }

        // Release buzzer in Redis on timeout
        RedisService.releaseBuzzerLock(cleanCode).catch(() => {});

        if (result.roundState?.roundStatus === "revealing") {
          await RoomService.updateRoomStatus(cleanCode, "revealing").catch(() => {});
          await RealtimeBroadcastService.broadcast(cleanCode, "round_reveal", {
            winnerPlayerId: null,
            winnerDisplayName: null,
            answerText: "(หมดเวลา)",
            scoreDelta: 0,
            scores: result.scores,
            song: result.roundState.currentSong,
            skipped: true,
          });
        } else {
          RealtimeBroadcastService.broadcast(
            cleanCode,
            "wrong_guess",
            timeoutPayload
          ).catch((err: unknown) => {
            console.warn("Failed to broadcast buzzer timeout event:", err);
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: "หมดเวลาในการตอบคำถาม (เกิน 10 วินาที)",
            isCorrect: false,
            scoreDelta: 0,
            newScore: result.newScore,
            scores: result.scores,
            resumeAudio: effectiveGameMode === "buzzer",
            wrongGuesses: result.roundState?.wrongGuesses || [],
            reason: "buzzer_timeout",
            canRetry,
            remainingAttempts,
            isExcluded,
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

    // 1. Wait for all mode: Player answered, but waiting for others to finish
    if (result.waitingForOthers) {
      if (result.roundState && typeof RoomService.updateRoomRoundState === "function") {
        const serialized = RoomStateStore.serializeRoundState(result.roundState);
        RoomService.updateRoomRoundState(
          cleanCode,
          serialized,
          "question_active"
        ).catch((err) => console.warn("[AnswerRoute] Failed to sync waiting round state:", err));

        RedisService.saveRoundState(cleanCode, serialized).catch(() => {});
      }

      await RealtimeBroadcastService.broadcast(cleanCode, "player_submitted", {
        playerId: cleanPlayerId,
        displayName: cleanDisplayName,
        allExcluded: false,
      });

      return NextResponse.json({
        success: true,
        isCorrect: result.isCorrect,
        waitingForOthers: true,
        canRetry: result.canRetry,
        remainingAttempts: result.remainingAttempts,
        matchedAs: result.matchedAs,
        similarity: result.similarity,
        scoreDelta: result.scoreDelta,
        newScore: result.newScore,
        scores: result.scores,
        message: "บันทึกคำตอบเรียบร้อยแล้ว รอเพื่อนๆ ตอบครบทุกคน",
      });
    }

    // 2. Wait for all mode: Last active player answered, reveal round with winner (if any)
    if (result.shouldReveal) {
      await RoomService.updateRoomStatus(cleanCode, "revealing");

      if (result.roundState && typeof RoomService.updateRoomRoundState === "function") {
        const serialized = RoomStateStore.serializeRoundState(result.roundState);
        RoomService.updateRoomRoundState(
          cleanCode,
          serialized,
          "revealing"
        ).catch((err) => console.warn("[AnswerRoute] Failed to sync reveal state:", err));

        RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
        RedisService.saveRoundState(cleanCode, serialized).catch(() => {});
      }

      const winnerId = result.roundState?.winnerPlayerId || null;
      const winnerSub = winnerId ? result.roundState?.playerSubmissions?.[winnerId] : null;
      const winnerDisplayName = winnerSub?.displayName || (winnerId ? "ผู้ชนะ" : null);
      const scoreDelta = winnerSub?.scoreDelta || result.scoreDelta;

      const winners =
        result.roundState?.winners ||
        (winnerId
          ? [
              {
                playerId: winnerId,
                displayName: winnerDisplayName,
                scoreDelta: scoreDelta,
              },
            ]
          : []);

      const revealPayload = {
        winnerPlayerId: winnerId,
        winnerDisplayName,
        answerText: winnerSub?.answerText || cleanAnswerText,
        matchedAs: winnerSub?.matchedAs || result.matchedAs,
        similarity: winnerSub?.similarity || result.similarity,
        scoreDelta,
        scores: result.scores,
        song: result.fullSong || currentRoundState?.currentSong,
        skipped: !winnerId,
        winners,
      };

      await RealtimeBroadcastService.broadcast(
        cleanCode,
        "round_reveal",
        revealPayload
      );

      return NextResponse.json({
        success: true,
        isCorrect: result.isCorrect,
        waitingForOthers: false,
        matchedAs: result.matchedAs,
        similarity: result.similarity,
        scoreDelta: result.scoreDelta,
        newScore: result.newScore,
        scores: result.scores,
        song: result.fullSong,
        winners,
      });
    }

    if (result.isCorrect) {
      // 3. Race mode: Correct Answer: update DB status to 'revealing' and sync round state
      await RoomService.updateRoomStatus(cleanCode, "revealing");

      if (result.roundState && typeof RoomService.updateRoomRoundState === "function") {
        const serialized = RoomStateStore.serializeRoundState(result.roundState);
        RoomService.updateRoomRoundState(
          cleanCode,
          serialized,
          "revealing"
        ).catch((err) => console.warn("[AnswerRoute] Failed to sync reveal state:", err));

        // Cache reveal state & release buzzer in Redis
        RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
        RedisService.saveRoundState(cleanCode, serialized).catch(() => {});
      } else {
        RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
      }

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
      // 2. Wrong Answer: update DB with new round state and status
      const nextStatus = result.roundState?.roundStatus || "question_active";
      if (result.roundState && typeof RoomService.updateRoomRoundState === "function") {
        const serialized = RoomStateStore.serializeRoundState(result.roundState);
        RoomService.updateRoomRoundState(
          cleanCode,
          serialized,
          nextStatus
        ).catch(() => RoomService.updateRoomStatus(cleanCode, nextStatus));

        // In buzzer mode, release lock so others can buzz, and cache updated state
        if (effectiveGameMode === "buzzer") {
          RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
        }
        RedisService.saveRoundState(cleanCode, serialized).catch(() => {});
      } else {
        if (effectiveGameMode === "buzzer") {
          RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
        }
        RoomService.updateRoomStatus(cleanCode, nextStatus).catch(() => {});
      }

      // Check if all players answered wrong -> roundStatus transitioned to 'revealing' with no winner
      if (result.roundState?.roundStatus === "revealing") {

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
      const canRetry = Boolean(result.canRetry);
      const remainingAttempts =
        typeof result.remainingAttempts === "number" ? result.remainingAttempts : 0;
      const isExcluded = !canRetry;

      const wrongPayload = {
        playerId: cleanPlayerId,
        displayName:
          result.roundState?.buzzedPlayerName || cleanDisplayName,
        answerText: cleanAnswerText,
        similarity: result.similarity,
        scoreDelta: result.scoreDelta,
        newScore: result.newScore,
        scores: result.scores,
        resumeAudio: effectiveGameMode === "buzzer",
        wrongGuesses: result.roundState?.wrongGuesses || [],
        excluded: isExcluded,
        isExcluded,
        canRetry,
        remainingAttempts,
      };

      await RealtimeBroadcastService.broadcast(
        cleanCode,
        "wrong_guess",
        wrongPayload
      );

      return NextResponse.json({
        success: true,
        isCorrect: false,
        scoreDelta: result.scoreDelta,
        newScore: result.newScore,
        scores: result.scores,
        resumeAudio: effectiveGameMode === "buzzer",
        wrongGuesses: result.roundState?.wrongGuesses || [],
        canRetry,
        remainingAttempts,
        isExcluded,
        waitingForOthers: result.waitingForOthers,
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
