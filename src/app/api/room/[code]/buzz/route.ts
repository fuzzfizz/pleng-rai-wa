// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Buzzer Arbitration Route
// Atomic FCFS buzzer locking with exclusion check for previous wrong guessers
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

    const { playerId, displayName } = body as {
      playerId?: string;
      displayName?: string;
    };

    if (
      !playerId ||
      typeof playerId !== "string" ||
      playerId.trim().length === 0 ||
      !displayName ||
      typeof displayName !== "string" ||
      displayName.trim().length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ข้อมูลผู้เล่นไม่ถูกต้อง (ต้องระบุ playerId และ displayName)",
        },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const room = await RoomService.getRoomByCode(cleanCode);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    const cleanPlayerId = playerId.trim();
    const cleanDisplayName = displayName.trim();

    // 1. Optional fast atomic lock via Upstash Redis (if configured)
    const redisLock = await RedisService.acquireBuzzerLock(
      cleanCode,
      cleanPlayerId,
      cleanDisplayName
    );
    if (redisLock.isRedisActive && !redisLock.acquired) {
      return NextResponse.json(
        {
          success: false,
          reason: "already_buzzed",
          error: "มีผู้เล่นคนอื่นกดกริ่งไปก่อนแล้ว",
        },
        { status: 409 }
      );
    }

    // 2. Ensure round state is rehydrated if running on a fresh serverless instance
    await RoomStateStore.ensureRoundState(cleanCode, room);

    // 3. Attempt authoritative in-memory buzzer arbitration
    const buzzResult = RoomStateStore.buzz(
      cleanCode,
      cleanPlayerId,
      cleanDisplayName
    );

    if (!buzzResult.success) {
      // If in-memory check failed (e.g. already guessed wrong), release Redis lock
      if (redisLock.isRedisActive && redisLock.acquired) {
        RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
      }

      const errorMap: Record<string, string> = {
        already_buzzed: "มีผู้เล่นคนอื่นกดกริ่งไปก่อนแล้ว",
        already_guessed_wrong:
          "คุณตอบผิดไปแล้วในรอบนี้ ไม่สามารถกดกริ่งซ้ำได้จนกว่าจะขึ้นเพลงถัดไป",
        round_not_active: "รอบการเล่นยังไม่เริ่มต้นหรือหมดเวลาแล้ว",
      };

      return NextResponse.json(
        {
          success: false,
          reason: buzzResult.reason,
          error:
            errorMap[buzzResult.reason || ""] ||
            "ไม่สามารถกดกริ่งได้ในขณะนี้",
        },
        { status: 409 }
      );
    }

    const roundState = buzzResult.roundState!;
    const serialized = RoomStateStore.serializeRoundState(roundState);

    // Persist buzzer lock to Supabase so subsequent /answer requests on any lambda know who buzzed
    await RoomService.updateRoomRoundState(
      cleanCode,
      serialized,
      "buzzed"
    ).catch((err) => {
      console.warn("[BuzzerRoute] Failed to persist buzzer state to DB:", err);
    });

    // Cache updated state in Redis if available
    RedisService.saveRoundState(cleanCode, serialized).catch(() => {});

    const broadcastPayload = {
      playerId: roundState.buzzedPlayerId,
      displayName: roundState.buzzedPlayerName,
      buzzedAt: roundState.buzzedAt,
      deadline: roundState.buzzDeadline,
    };

    // Broadcast buzzer hit to all players in realtime
    await RealtimeBroadcastService.broadcast(
      cleanCode,
      "buzzer_hit",
      broadcastPayload
    );

    return NextResponse.json({
      success: true,
      buzzedPlayerId: roundState.buzzedPlayerId,
      displayName: roundState.buzzedPlayerName,
      buzzedAt: roundState.buzzedAt,
      deadline: roundState.buzzDeadline,
    });
  } catch (error) {
    console.error("Buzzer route error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการกดกริ่ง",
      },
      { status: 500 }
    );
  }
}
