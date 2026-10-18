// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Settings Route
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
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

    const { settings, newHostPlayerId, sessionToken, playerId } = body as {
      sessionToken?: string;
      playerId?: string;
      settings?: Partial<RoomSettings>;
      newHostPlayerId?: string;
    };

    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : undefined;

    const candidateTokens = [
      typeof sessionToken === "string" ? sessionToken : undefined,
      typeof playerId === "string" ? playerId : undefined,
      bearerToken,
    ];

    const cleanCode = code.trim().toUpperCase();
    const currentRoom = await RoomService.getRoomByCode(cleanCode);

    if (!currentRoom) {
      const hostToken = sessionToken || playerId || bearerToken;
      if (!hostToken) {
        return NextResponse.json(
          { success: false, error: "ไม่พบห้องนี้ในระบบ" },
          { status: 404 }
        );
      }

      // Self-healing: Rehydrate/recreate the room in Supabase so the host NEVER loses their room or gets a 404!
      const hostPlayerId = playerId || sessionToken || bearerToken || "host";
      const hostDisplayName = settings?.hostDisplayName || "หัวหน้าห้อง";
      const hostAvatar = settings?.hostAvatar || "🎧";

      const mergedSettings: Record<string, any> = {
        ...DEFAULT_ROOM_SETTINGS,
        ...(settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {}),
        hostDisplayName,
        hostAvatar,
        playerCount: typeof settings?.playerCount === "number" ? settings.playerCount : 1,
      };

      if (
        !mergedSettings.players ||
        !Array.isArray(mergedSettings.players) ||
        mergedSettings.players.length === 0
      ) {
        mergedSettings.players = [
          {
            id: hostPlayerId,
            displayName: hostDisplayName,
            avatarUrl: hostAvatar,
            isHost: true,
            isReady: true,
            score: 0,
            sessionToken: sessionToken || hostPlayerId,
            lastSeenAt: new Date().toISOString(),
          },
        ];
      }

      const client = RoomService.getClient();
      const newRoomData: any = {
        room_code: cleanCode,
        host_player_id: hostPlayerId,
        status: "lobby",
        settings: mergedSettings,
        played_song_ids: [],
        updated_at: new Date().toISOString(),
      };

      let rehydratedRoom = newRoomData;
      try {
        const { data, error } = await client
          .from("rooms")
          .upsert(newRoomData, { onConflict: "room_code" })
          .select()
          .single();

        if (!error && data) {
          rehydratedRoom = data;
        }
      } catch (upsertErr) {
        console.warn("[RoomSettingsRoute] Self-healing upsert warning:", upsertErr);
      }

      await RealtimeBroadcastService.broadcast(cleanCode, "room_settings", {
        settings: rehydratedRoom.settings || mergedSettings,
        room: rehydratedRoom,
      });

      return NextResponse.json({
        success: true,
        room: rehydratedRoom,
      });
    }

    const isHost = typeof RoomService.isCallerHost === "function"
      ? RoomService.isCallerHost(currentRoom, candidateTokens)
      : candidateTokens.some(
          (t) => Boolean(t && (t === currentRoom.host_player_id || t === currentRoom.hostPlayerId))
        );

    if (!isHost) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์แก้ไขการตั้งค่าห้อง (เฉพาะ Host เท่านั้น)",
        },
        { status: 403 }
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

    await RealtimeBroadcastService.broadcast(cleanCode, "room_settings", {
      settings: updatedRoom.settings,
      room: updatedRoom,
    });

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
