// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Skip Round API Route
// Host-only round skip handler, transitions to revealing
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

    const cleanCode = code.trim().toUpperCase();
    const room = await RoomService.getRoomByCode(cleanCode);

    if (!room) {
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

    const { playerId } = body || {};
    const isHost = playerId
      ? room.host_player_id === playerId || room.hostPlayerId === playerId
      : true;

    if (!isHost) {
      return NextResponse.json(
        { success: false, error: "เฉพาะ Host เท่านั้นที่ข้ามข้อได้" },
        { status: 403 }
      );
    }

    // Ensure round state is rehydrated if running on a fresh serverless instance
    await RoomStateStore.ensureRoundState(cleanCode, room);

    const state = RoomStateStore.getRoomRoundState(cleanCode);
    if (
      !state ||
      (state.roundStatus !== "question_active" && state.roundStatus !== "buzzed")
    ) {
      return NextResponse.json(
        { success: false, error: "ไม่อยู่ในช่วงเวลาที่ข้ามได้" },
        { status: 400 }
      );
    }

    const skipResult = RoomStateStore.skipRound(cleanCode);
    if (!skipResult.success || !skipResult.fullSong) {
      return NextResponse.json(
        { success: false, error: "ไม่สามารถข้ามข้อนี้ได้" },
        { status: 500 }
      );
    }

    await RoomService.updateRoomStatus(cleanCode, "revealing");

    if (skipResult.roundState && typeof RoomService.updateRoomRoundState === "function") {
      RoomService.updateRoomRoundState(
        cleanCode,
        RoomStateStore.serializeRoundState(skipResult.roundState),
        "revealing"
      ).catch((err) => console.warn("[SkipRoute] Failed to sync round state:", err));
    }

    // Broadcast round_reveal event indicating skipped question
    await RealtimeBroadcastService.broadcast(cleanCode, "round_reveal", {
      song: skipResult.fullSong,
      winnerPlayerId: null,
      winnerDisplayName: null,
      answerText: null,
      scoreDelta: 0,
      scores: skipResult.roundState?.scores || {},
      skipped: true,
    });

    return NextResponse.json({
      success: true,
      message: "ข้ามข้อนี้เรียบร้อยแล้ว",
      roundStatus: "revealing",
    });
  } catch (error) {
    console.error("Skip route error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการข้ามข้อ",
      },
      { status: 500 }
    );
  }
}
