// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Leave / Dissolve API Route
// Handles real-time player departures, host room dissolution, and immediate database cleanup
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

    if (!room) {
      return NextResponse.json(
        { success: true, message: "ห้องถูกลบไปแล้ว" },
        { status: 200 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty or beacon request
    }

    const { playerId, isHost } = body as { playerId?: string; isHost?: boolean };

    const isActualHost =
      Boolean(isHost) ||
      (playerId && playerId === room.host_player_id);

    // If Host leaves or dissolves room: Delete room immediately (0s Real-time Cleanup)
    if (isActualHost) {
      await RoomService.deleteRoomByCode(cleanCode);
      RoomStateStore.deleteRoom(cleanCode);
      RedisService.deleteRoom(cleanCode).catch(() => {});

      // Broadcast room dissolution to any remaining players
      await RealtimeBroadcastService.broadcast(cleanCode, "room_dissolved", {
        reason: "หัวหน้าห้องออกจากห้องแล้ว ห้องถูกยุบเรียบร้อย",
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        dissolved: true,
        message: "ห้องถูกลบออกจากระบบเรียบร้อยแล้ว",
      });
    }

    // Normal guest player leaves: Decrement playerCount
    const currentSettings = (room.settings as any) || {};
    const currentCount = typeof currentSettings.playerCount === "number" ? currentSettings.playerCount : 1;
    const nextCount = Math.max(0, currentCount - 1);

    if (nextCount <= 0) {
      // No players left at all: Delete empty room immediately
      await RoomService.deleteRoomByCode(cleanCode);
      RoomStateStore.deleteRoom(cleanCode);
      return NextResponse.json({
        success: true,
        deleted: true,
        message: "ไม่มีผู้เล่นเหลืออยู่ในห้อง ห้องถูกลบทันที",
      });
    }

    // Update remaining playerCount in room settings
    await RoomService.updateRoomSettings(cleanCode, { playerCount: nextCount });

    // Broadcast player_left event
    if (playerId) {
      await RealtimeBroadcastService.broadcast(cleanCode, "player_left", {
        playerId,
        remainingCount: nextCount,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      remainingCount: nextCount,
    });
  } catch (error) {
    console.error("[RoomLeave] Error during room leave:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการออกจากห้อง",
      },
      { status: 500 }
    );
  }
}
