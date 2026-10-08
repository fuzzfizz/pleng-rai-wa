// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Join Route
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { isValidRoomCode } from "@/lib/room-code";

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

    const { roomCode, displayName, existingSessionToken, existingPlayerId, password } = body as {
      roomCode?: unknown;
      displayName?: unknown;
      existingSessionToken?: string;
      existingPlayerId?: string;
      password?: string;
    };

    if (
      typeof roomCode !== "string" ||
      !isValidRoomCode(roomCode)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "รหัสห้องไม่ถูกต้อง (ต้องเป็นตัวอักษรหรือตัวเลข 6 หลัก)",
        },
        { status: 400 }
      );
    }

    if (
      typeof displayName !== "string" ||
      displayName.trim().length === 0 ||
      displayName.trim().length > 30
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ชื่อผู้เล่นต้องมีความยาวระหว่าง 1 ถึง 30 ตัวอักษร",
        },
        { status: 400 }
      );
    }

    const cleanCode = roomCode.trim().toUpperCase();
    const room = await RoomService.getRoomByCode(cleanCode);

    if (!room) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องนี้ในระบบ" },
        { status: 404 }
      );
    }

    if (room.status === "game_over") {
      return NextResponse.json(
        { success: false, error: "เกมในห้องนี้จบลงแล้ว" },
        { status: 400 }
      );
    }

    // Verify room password if room is locked and user is not existing host
    const roomSettings = (room.settings as any) || {};
    const expectedPassword = roomSettings.password ? String(roomSettings.password).trim() : "";
    const isExistingHost =
      typeof existingSessionToken === "string" &&
      existingSessionToken.trim() === room.host_player_id;

    if (expectedPassword && !isExistingHost) {
      const providedPassword = typeof password === "string" ? password.trim() : "";
      if (providedPassword !== expectedPassword) {
        return NextResponse.json(
          {
            success: false,
            isLocked: true,
            error: "รหัสผ่านห้องไม่ถูกต้อง (กรุณากรอกรหัสผ่านของห้องนี้)",
          },
          { status: 403 }
        );
      }
    }

    const sessionToken =
      typeof existingSessionToken === "string" &&
      existingSessionToken.trim().length > 0
        ? existingSessionToken.trim()
        : crypto.randomUUID();

    let playerId =
      typeof existingPlayerId === "string" &&
      existingPlayerId.trim().length > 0
        ? existingPlayerId.trim()
        : crypto.randomUUID();

    if (
      typeof existingSessionToken === "string" &&
      existingSessionToken.trim() === room.host_player_id
    ) {
      playerId = room.host_player_id;
    }

    const isHost =
      (typeof existingSessionToken === "string" &&
        existingSessionToken.trim() === room.host_player_id) ||
      playerId === room.host_player_id;

    // Update live playerCount in room settings if a new player joins
    const currentSettings = (room.settings as any) || {};
    const isReconnecting =
      (typeof existingPlayerId === "string" && existingPlayerId.trim().length > 0) ||
      (typeof existingSessionToken === "string" && existingSessionToken.trim().length > 0);

    let updatedCount = typeof currentSettings.playerCount === "number" ? currentSettings.playerCount : 1;
    if (!isHost && !isReconnecting) {
      updatedCount = Math.max(1, updatedCount + 1);
      await RoomService.updateRoomSettings(cleanCode, { playerCount: updatedCount }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        roomCode: room.room_code,
        sessionToken,
        playerId,
        isHost,
        room: {
          id: room.id,
          roomCode: room.room_code,
          status: room.status,
          settings: {
            ...currentSettings,
            playerCount: updatedCount,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการเข้าร่วมห้อง",
      },
      { status: 500 }
    );
  }
}
