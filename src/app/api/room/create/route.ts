// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Create Route
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import type { RoomSettings } from "@/types";

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
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

    const { hostDisplayName, settings } = body as {
      hostDisplayName?: unknown;
      settings?: Partial<RoomSettings>;
    };

    if (
      typeof hostDisplayName !== "string" ||
      hostDisplayName.trim().length === 0 ||
      hostDisplayName.trim().length > 30
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ชื่อผู้เล่นต้องมีความยาวระหว่าง 1 ถึง 30 ตัวอักษร",
        },
        { status: 400 }
      );
    }

    const result = await RoomService.createRoom(
      hostDisplayName.trim(),
      settings
    );

    return NextResponse.json(
      {
        success: true,
        roomCode: result.roomCode,
        sessionToken: result.sessionToken,
        playerId: result.playerId,
        isHost: true,
        room: result.room,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการสร้างห้อง",
      },
      { status: 500 }
    );
  }
}
