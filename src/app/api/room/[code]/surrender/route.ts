// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Surrender Round API Route
// Player surrenders the active round without score penalty.
// When all active players surrender or guess wrong, round transitions to revealing.
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { RoomStateStore } from "@/lib/room-state-store";
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

    const cleanCode = code.trim().toUpperCase();
    const room = await RoomService.getRoomByCode(cleanCode);
    const inMemoryState = RoomStateStore.getRoomRoundState(cleanCode);

    if (!room && !inMemoryState) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    let body: any = {};
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty or non-JSON body
    }

    const { playerId, displayName, totalPlayers } = body || {};

    if (!playerId || typeof playerId !== "string" || playerId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "ไม่พบรหัสผู้เล่น (playerId required)" },
        { status: 400 }
      );
    }

    const cleanPlayerId = playerId.trim();

    // Ensure round state is rehydrated if running on a fresh serverless instance
    if (room) {
      await RoomStateStore.ensureRoundState(cleanCode, room);
    }

    const roomSettings = room?.settings || inMemoryState?.settings;
    const result = RoomStateStore.surrenderPlayer(cleanCode, cleanPlayerId, displayName, {
      roomSettings,
      totalPlayers: typeof totalPlayers === "number" && totalPlayers > 0 ? totalPlayers : undefined,
    });

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
      ).catch((err) => console.warn("[SurrenderRoute] Failed to sync round state:", err));

      const effectiveGameMode = inMemoryState?.gameMode || roomSettings?.gameMode || "buzzer";
      if (effectiveGameMode === "buzzer") {
        RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
      }
      RedisService.saveRoundState(cleanCode, serialized).catch(() => {});
    }

    if (result.allExcluded) {
      await RoomService.updateRoomStatus(cleanCode, "revealing").catch((err) =>
        console.warn("[SurrenderRoute] Failed to update room status to revealing:", err)
      );
    }

    // 1. Broadcast neutral player_surrendered event to all players
    await RealtimeBroadcastService.broadcast(cleanCode, "player_surrendered", {
      playerId: cleanPlayerId,
      displayName: displayName || "ผู้เล่น",
      allExcluded: result.allExcluded,
    });

    // 2. If all players have surrendered or guessed wrong, broadcast round_reveal
    if (result.allExcluded) {
      await RealtimeBroadcastService.broadcast(cleanCode, "round_reveal", {
        song: result.fullSong || result.roundState?.currentSong,
        winnerPlayerId: null,
        winnerDisplayName: null,
        answerText: null,
        scoreDelta: 0,
        scores: result.roundState?.scores || {},
        skipped: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "ยอมแพ้ข้อนี้เรียบร้อยแล้ว",
      allExcluded: result.allExcluded,
      roundStatus: result.roundState?.roundStatus,
    });
  } catch (error) {
    console.error("[SurrenderRoute] Error processing surrender:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการยอมแพ้",
      },
      { status: 500 }
    );
  }
}
