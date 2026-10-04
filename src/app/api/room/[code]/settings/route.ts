// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Settings Route
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { isValidRoomCode } from "@/lib/room-code";
import type { RoomSettings } from "@/types";

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

    const { settings, newHostPlayerId } = body as {
      sessionToken?: string;
      settings?: Partial<RoomSettings>;
      newHostPlayerId?: string;
    };

    const cleanCode = code.trim().toUpperCase();
    const currentRoom = await RoomService.getRoomByCode(cleanCode);

    if (!currentRoom) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    let updatedRoom = currentRoom;

    if (
      newHostPlayerId &&
      typeof newHostPlayerId === "string" &&
      newHostPlayerId.trim().length > 0
    ) {
      updatedRoom = await RoomService.transferHost(
        cleanCode,
        newHostPlayerId.trim()
      );
    }

    if (settings && typeof settings === "object" && !Array.isArray(settings)) {
      updatedRoom = await RoomService.updateRoomSettings(cleanCode, settings);
    }

    return NextResponse.json({
      success: true,
      room: updatedRoom,
    });
  } catch (error) {
    console.error("Update room settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการอัปเดตการตั้งค่าห้อง",
      },
      { status: 500 }
    );
  }
}
