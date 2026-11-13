// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Progressive Audio Slice Step API
// Advances player's slice ladder step (0.1s -> 0.5s -> 1.0s -> 2.0s -> 4.0s)
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { isValidRoomCode } from "@/lib/room-code";
import { RedisService } from "@/lib/services/redis-service";
import { getProgressiveStep } from "@/lib/audio-slice-utils";

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

    const { playerId } = body as { playerId?: string };
    const cleanPlayerId =
      typeof playerId === "string" && playerId.trim().length > 0
        ? playerId.trim()
        : undefined;

    if (!cleanPlayerId) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ playerId" },
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

    // Ensure round state is rehydrated if running on a fresh serverless instance
    await RoomStateStore.ensureRoundState(cleanCode, room);

    const state = RoomStateStore.getRoomRoundState(cleanCode);

    // Validate room status is "question_active"
    const isQuestionActive =
      room.status === "question_active" || state?.roundStatus === "question_active";

    if (!isQuestionActive) {
      return NextResponse.json(
        { success: false, error: "รอบปัจจุบันไม่ได้อยู่ในสถานะเล่นคำถาม" },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { success: false, error: "ไม่พบข้อมูลรอบปัจจุบัน" },
        { status: 400 }
      );
    }

    // Call RoomStateStore.advancePlayerSliceStep
    const result = RoomStateStore.advancePlayerSliceStep(cleanCode, cleanPlayerId);

    // If player is already at max step (step 5), return success: true with step 5 info as required
    const stepConfig = getProgressiveStep(result.step);

    const songId = state.currentSong?.id || "";
    const startSec = state.sliceStartSec ?? 0;
    const sliceUrl = `/api/audio/slice?id=${encodeURIComponent(songId)}&start=${startSec}&duration=${stepConfig.durationSec}`;

    // Sync to Redis & DB for serverless environments
    RedisService.saveRoundState(cleanCode, RoomStateStore.serializeRoundState(state)).catch(() => {});
    RoomService.updateRoomRoundState(
      cleanCode,
      RoomStateStore.serializeRoundState(state)
    ).catch((err) => console.warn("[RoomSliceStep] Failed to persist slice step state to DB:", err));

    return NextResponse.json({
      success: true,
      step: stepConfig.step,
      durationSec: stepConfig.durationSec,
      points: stepConfig.points,
      sliceUrl,
    });
  } catch (error) {
    console.error("Slice step route error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการเลื่อนสเต็ปเสียง",
      },
      { status: 500 }
    );
  }
}
