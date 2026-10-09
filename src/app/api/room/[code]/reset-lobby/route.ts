// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Reset Lobby API Route
// Resets room status to "lobby", clears played song IDs,
// resets active round state in RoomStateStore (round 0, scores 0,
// question null, buzzed player null), and broadcasts room_state to room.
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

    // 1. Update room status in DB / memory back to "lobby", clear roundState, and reset played_song_ids = []
    const updatedRoom = await RoomService.updateRoomRound(cleanCode, {
      status: "lobby",
      playedSongIds: [],
      currentSongId: null,
      roundState: null,
    });

    // 2. Reset round state in RoomStateStore (resets round to 0, scores to 0, current question to null, buzzed player to null)
    RoomStateStore.resetRoom(cleanCode);

    // 3. Broadcast room_state event with status "lobby" to all players in the room
    await RealtimeBroadcastService.broadcast(cleanCode, "room_state", {
      status: "lobby",
      round: 0,
      scores: {},
      room: updatedRoom,
    });

    return NextResponse.json({
      success: true,
      message: "รีเซ็ตห้องกลับสู่สถานะล็อบบี้สำเร็จ",
      room: updatedRoom,
    });
  } catch (error) {
    console.error("Reset room to lobby error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการรีเซ็ตห้องกลับสู่ล็อบบี้",
      },
      { status: 500 }
    );
  }
}
