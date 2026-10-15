// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Leave / Host Migration API Route
// Handles real-time player departures, host migration, active room retention,
// and empty room cleanup
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

    const {
      playerId,
      isHost,
      remainingPlayers: bodyRemainingPlayers,
      candidateHost: bodyCandidateHost,
    } = (body || {}) as {
      playerId?: string;
      isHost?: boolean;
      remainingPlayers?: any[];
      candidateHost?: { id: string; displayName?: string; avatarUrl?: string };
    };

    const isActualHost =
      Boolean(isHost) ||
      (Boolean(playerId) && playerId === room.host_player_id);

    const currentSettings = (room.settings as any) || {};
    const dbPlayers: any[] = Array.isArray(currentSettings.players)
      ? currentSettings.players
      : [];

    // Filter remaining players excluding the leaving player
    let remainingPlayersList: any[] = [];
    if (Array.isArray(bodyRemainingPlayers)) {
      remainingPlayersList = bodyRemainingPlayers.filter(
        (p: any) => p && p.id && p.id !== playerId
      );
    } else if (dbPlayers.length > 0) {
      remainingPlayersList = dbPlayers.filter(
        (p: any) => p && p.id && p.id !== playerId
      );
    }

    // Determine current player count
    const currentCount =
      typeof currentSettings.playerCount === "number"
        ? currentSettings.playerCount
        : dbPlayers.length > 0
        ? dbPlayers.length
        : 1;

    let remainingCount: number;
    if (Array.isArray(bodyRemainingPlayers)) {
      remainingCount = remainingPlayersList.length;
    } else if (remainingPlayersList.length > 0) {
      remainingCount = remainingPlayersList.length;
    } else {
      remainingCount = Math.max(0, currentCount - 1);
    }

    // 1. If NO players remain at all (remainingCount <= 0 and empty players list):
    // Delete the empty room immediately (Requirement 9)
    if (remainingCount <= 0 && remainingPlayersList.length === 0) {
      await RoomService.deleteRoomByCode(cleanCode);
      RoomStateStore.deleteRoom(cleanCode);
      RedisService.deleteRoom(cleanCode).catch(() => {});

      await RealtimeBroadcastService.broadcast(cleanCode, "room_dissolved", {
        reason: "ไม่มีผู้เล่นเหลืออยู่ในห้อง ห้องถูกลบเรียบร้อย",
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        deleted: true,
        dissolved: true,
        message: "ไม่มีผู้เล่นเหลืออยู่ในห้อง ห้องถูกลบทันที",
      });
    }

    // 2. If the leaving player is HOST and other players remain:
    // Execute Host Migration & keep active room alive (Requirements 1-5)
    if (isActualHost) {
      // Elect next host:
      // Priority 1: candidateHost passed in body (if valid and not leaving player)
      // Priority 2: first active human player (avatar != "📺" and not TV view)
      // Priority 3: first remaining player
      const validCandidate =
        bodyCandidateHost &&
        bodyCandidateHost.id &&
        bodyCandidateHost.id !== playerId
          ? bodyCandidateHost
          : null;

      const electedPlayer =
        validCandidate ||
        remainingPlayersList.find(
          (p: any) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
        ) ||
        remainingPlayersList[0];

      if (!electedPlayer) {
        // Fallback: If no candidate could be resolved, delete room
        await RoomService.deleteRoomByCode(cleanCode);
        RoomStateStore.deleteRoom(cleanCode);
        RedisService.deleteRoom(cleanCode).catch(() => {});

        await RealtimeBroadcastService.broadcast(cleanCode, "room_dissolved", {
          reason: "หัวหน้าห้องออกจากห้องแล้ว ห้องถูกยุบเรียบร้อย",
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          dissolved: true,
          message: "ห้องถูกลบออกจากระบบเรียบร้อยแล้ว",
        });
      }

      const nextHostId = String(electedPlayer.id);
      const nextHostDisplayName = electedPlayer.displayName || "หัวหน้าห้อง";
      const nextHostAvatar = electedPlayer.avatarUrl || "🎧";
      const nextPlayerCount = Math.max(1, remainingPlayersList.length > 0 ? remainingPlayersList.length : remainingCount);

      // Ensure nextHost is flagged with isHost: true in remaining players list
      const updatedPlayersList = (
        remainingPlayersList.length > 0
          ? remainingPlayersList
          : [{ id: nextHostId, displayName: nextHostDisplayName, avatarUrl: nextHostAvatar, isHost: true }]
      ).map((p: any) => ({
        ...p,
        isHost: p.id === nextHostId,
      }));

      // Update rooms.host_player_id in Supabase DB (Requirement 3)
      await RoomService.transferHost(cleanCode, nextHostId);

      // Update rooms.settings in Supabase DB (Requirement 4)
      const settingsUpdate = {
        hostDisplayName: nextHostDisplayName,
        hostAvatar: nextHostAvatar,
        playerCount: nextPlayerCount,
        players: updatedPlayersList,
      };
      await RoomService.updateRoomSettings(cleanCode, settingsUpdate);

      const mergedSettings = {
        ...currentSettings,
        ...settingsUpdate,
      };

      // Broadcast host_changed and room_settings to Realtime (Requirement 5)
      await RealtimeBroadcastService.broadcast(cleanCode, "host_changed", {
        newHostPlayerId: nextHostId,
        hostDisplayName: nextHostDisplayName,
        hostAvatar: nextHostAvatar,
        formerHostPlayerId: playerId,
        remainingPlayers: updatedPlayersList,
        remainingCount: nextPlayerCount,
        settings: mergedSettings,
      }).catch(() => {});

      await RealtimeBroadcastService.broadcast(cleanCode, "room_settings", {
        settings: mergedSettings,
        room: {
          ...room,
          host_player_id: nextHostId,
          settings: mergedSettings,
        },
      }).catch(() => {});

      if (playerId) {
        await RealtimeBroadcastService.broadcast(cleanCode, "player_left", {
          playerId,
          remainingCount: nextPlayerCount,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        migrated: true,
        newHostPlayerId: nextHostId,
        remainingCount: nextPlayerCount,
        message: `หัวหน้าห้องเดิมออกจากห้องแล้ว โอนสิทธิ์หัวหน้าห้องให้ ${nextHostDisplayName} เรียบร้อย`,
      });
    }

    // 3. Normal guest player leaves: Decrement count and update players list
    const nextPlayerCount = Math.max(0, remainingCount);

    if (nextPlayerCount <= 0) {
      await RoomService.deleteRoomByCode(cleanCode);
      RoomStateStore.deleteRoom(cleanCode);
      RedisService.deleteRoom(cleanCode).catch(() => {});

      await RealtimeBroadcastService.broadcast(cleanCode, "room_dissolved", {
        reason: "ไม่มีผู้เล่นเหลืออยู่ในห้อง ห้องถูกลบเรียบร้อย",
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        deleted: true,
        dissolved: true,
        message: "ไม่มีผู้เล่นเหลืออยู่ในห้อง ห้องถูกลบทันที",
      });
    }

    const updatedPlayersList = remainingPlayersList.filter(
      (p: any) => p && p.id && p.id !== playerId
    );

    const updatePayload: any = { playerCount: nextPlayerCount };
    if (updatedPlayersList.length > 0 || dbPlayers.length > 0) {
      updatePayload.players = updatedPlayersList;
    }

    await RoomService.updateRoomSettings(cleanCode, updatePayload);

    if (playerId) {
      await RealtimeBroadcastService.broadcast(cleanCode, "player_left", {
        playerId,
        remainingCount: nextPlayerCount,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      remainingCount: nextPlayerCount,
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
