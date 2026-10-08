// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Progressive Hint API
// Host triggers progressive hint (1. Genre -> 2. Year -> 3. Artist)
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

    const { playerId } = body as { playerId?: string };
    const cleanCode = code.trim().toUpperCase();

    const room = await RoomService.getRoomByCode(cleanCode);
    if (!room) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    // Host-only authorization
    if (playerId && playerId !== room.host_player_id) {
      return NextResponse.json(
        { success: false, error: "เฉพาะหัวหน้าห้องเท่านั้นที่สามารถเปิดคำใบ้ได้" },
        { status: 403 }
      );
    }

    const result = RoomStateStore.revealNextHint(cleanCode);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.level >= 3 ? "เปิดคำใบ้ครบทั้ง 3 ระดับแล้ว" : "ไม่สามารถเปิดคำใบ้ได้ในขณะนี้",
        },
        { status: 400 }
      );
    }

    // Broadcast hint_revealed event to all players in the room
    await RealtimeBroadcastService.broadcast(cleanCode, "hint_revealed", {
      level: result.level,
      hintType: result.hintType,
      hintText: result.hintText,
      pointsAvailable: result.pointsAvailable,
    });

    return NextResponse.json({
      success: true,
      level: result.level,
      hintType: result.hintType,
      hintText: result.hintText,
      pointsAvailable: result.pointsAvailable,
    });
  } catch (error) {
    console.error("[RoomHint] Error revealing hint:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการเปิดคำใบ้" },
      { status: 500 }
    );
  }
}
