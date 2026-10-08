// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Service
// ==========================================

import { supabase, getServiceSupabase } from "@/lib/supabase";
import { generateRoomCode } from "@/lib/room-code";
import type { RoomSettings, RoomRow, RoomUpdate, Json } from "@/types";

export interface CreateRoomResult {
  roomCode: string;
  sessionToken: string;
  playerId: string;
  room: RoomRow | null;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  gameMode: "buzzer",
  answerInputMode: "autocomplete",
  lyricsType: "intro",
  voiceGender: "female",
  sliceDurationSec: 2.0,
  roundTimeoutSec: 15,
  totalRounds: 10,
  targetScore: 0,
};

export class RoomService {
  /**
   * Resolves the appropriate Supabase client.
   * Uses service role client in server environment when SUPABASE_SERVICE_ROLE_KEY is present,
   * otherwise falls back to public anon client.
   */
  private static getClient() {
    if (typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        return getServiceSupabase();
      } catch {
        return supabase;
      }
    }
    return supabase;
  }

  /**
   * Creates a new multiplayer room in the database.
   * Generates a unique 6-character room code, host player ID, and session token.
   */
  static async createRoom(
    hostDisplayName: string,
    initialSettings?: Partial<RoomSettings>
  ): Promise<CreateRoomResult> {
    const client = this.getClient();
    const playerId = crypto.randomUUID();
    const sessionToken = playerId;
    const roomCode = generateRoomCode();

    // Auto-cleanup stale/abandoned rooms in the background (fire-and-forget, non-blocking)
    this.cleanupStaleRooms().catch(() => {});

    const mergedSettings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...initialSettings,
      hostDisplayName: hostDisplayName.trim(),
      playerCount: 1,
    };

    const { data, error } = await client
      .from("rooms")
      .insert({
        room_code: roomCode.trim().toUpperCase(),
        host_player_id: playerId,
        status: "lobby",
        settings: mergedSettings as unknown as Json,
        played_song_ids: [],
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create room: ${error.message}`);
    }

    return {
      roomCode: roomCode.trim().toUpperCase(),
      sessionToken,
      playerId,
      room: data,
    };
  }

  /**
   * Retrieves room information by 6-character room code.
   */
  static async getRoomByCode(code: string): Promise<any> {
    if (!code || typeof code !== "string") return null;
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();
    const { data, error } = await client
      .from("rooms")
      .select("*, songs(*)")
      .eq("room_code", cleanCode)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Updates settings for a room identified by code.
   */
  static async updateRoomSettings(
    code: string,
    settings: Partial<RoomSettings>
  ): Promise<any> {
    if (!code || typeof code !== "string") throw new Error("Invalid room code");
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();
    const current = await this.getRoomByCode(cleanCode);
    if (!current) throw new Error("Room not found");

    const currentSettings =
      typeof current.settings === "object" && current.settings !== null
        ? current.settings
        : {};

    const updatedSettings: Record<string, any> = {
      ...currentSettings,
      ...settings,
    };

    if ("playlistId" in settings) {
      if (
        settings.playlistId === null ||
        settings.playlistId === undefined ||
        (typeof settings.playlistId === "string" && !settings.playlistId.trim())
      ) {
        delete updatedSettings.playlistId;
      } else {
        updatedSettings.playlistId = String(settings.playlistId).trim();
      }
    }

    if ("genreId" in settings) {
      if (
        settings.genreId === null ||
        settings.genreId === undefined ||
        (typeof settings.genreId === "string" && !settings.genreId.trim())
      ) {
        delete updatedSettings.genreId;
      } else {
        updatedSettings.genreId = String(settings.genreId).trim();
      }
    }

    const { data, error } = await client
      .from("rooms")
      .update({ settings: updatedSettings as unknown as Json })
      .eq("room_code", cleanCode)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Updates status for a room identified by code.
   */
  static async updateRoomStatus(code: string, status: string): Promise<any> {
    if (!code || typeof code !== "string") throw new Error("Invalid room code");
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();
    const { data, error } = await client
      .from("rooms")
      .update({ status })
      .eq("room_code", cleanCode)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Transfers room ownership to a new host player ID.
   */
  static async transferHost(code: string, newHostPlayerId: string): Promise<any> {
    if (!code || typeof code !== "string") throw new Error("Invalid room code");
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();
    const { data, error } = await client
      .from("rooms")
      .update({ host_player_id: newHostPlayerId })
      .eq("room_code", cleanCode)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Updates round-related room properties (current_song_id, played_song_ids, status).
   */
  static async updateRoomRound(
    code: string,
    updates: {
      currentSongId?: string | null;
      playedSongIds?: string[];
      status?: string;
    }
  ): Promise<any> {
    if (!code || typeof code !== "string") throw new Error("Invalid room code");
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();
    const payload: RoomUpdate = {};
    if (updates.currentSongId !== undefined) payload.current_song_id = updates.currentSongId;
    if (updates.playedSongIds !== undefined) payload.played_song_ids = updates.playedSongIds;
    if (updates.status !== undefined) payload.status = updates.status;

    const { data, error } = await client
      .from("rooms")
      .update(payload)
      .eq("room_code", cleanCode)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a room immediately by room code (e.g., when host leaves or dissolves room).
   */
  static async deleteRoomByCode(code: string): Promise<boolean> {
    if (!code || typeof code !== "string") return false;
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();
    const { error } = await client.from("rooms").delete().eq("room_code", cleanCode);
    if (error) {
      console.warn("[RoomService] Failed to delete room:", cleanCode, error.message);
      return false;
    }
    return true;
  }

  /**
   * Automatically cleans up inactive / abandoned rooms from database in near real-time.
   * - Ended rooms ('game_over') older than 10 minutes.
   * - Abandoned lobby rooms ('lobby') with no activity older than 20 minutes.
   * - Inactive in-game rooms with no updates older than 40 minutes.
   */
  static async cleanupStaleRooms(optionsOrHours?: number | {
    endedMinutes?: number;
    lobbyMinutes?: number;
    inactiveMinutes?: number;
  }): Promise<{ deletedCount: number }> {
    try {
      const client = this.getClient();
      let endedMins = 10;
      let lobbyMins = 5;
      let inactiveMins = 40;

      if (typeof optionsOrHours === "number") {
        inactiveMins = optionsOrHours * 60;
        lobbyMins = optionsOrHours * 60;
        endedMins = Math.min(120, optionsOrHours * 60);
      } else if (optionsOrHours && typeof optionsOrHours === "object") {
        if (optionsOrHours.endedMinutes !== undefined) endedMins = optionsOrHours.endedMinutes;
        if (optionsOrHours.lobbyMinutes !== undefined) lobbyMins = optionsOrHours.lobbyMinutes;
        if (optionsOrHours.inactiveMinutes !== undefined) inactiveMins = optionsOrHours.inactiveMinutes;
      }

      const endedThreshold = new Date(Date.now() - endedMins * 60 * 1000).toISOString();
      const lobbyThreshold = new Date(Date.now() - lobbyMins * 60 * 1000).toISOString();
      const inactiveThreshold = new Date(Date.now() - inactiveMins * 60 * 1000).toISOString();

      // 1. Delete ended rooms older than 10 minutes
      const { data: endedRooms } = await client
        .from("rooms")
        .delete()
        .eq("status", "game_over")
        .lt("updated_at", endedThreshold)
        .select("id");

      // 2. Delete abandoned lobby rooms with no updates for 5 minutes
      const { data: lobbyRooms } = await client
        .from("rooms")
        .delete()
        .eq("status", "lobby")
        .lt("updated_at", lobbyThreshold)
        .select("id");

      // 3. Delete any stale rooms with no activity older than 40 minutes
      const { data: staleRooms, error } = await client
        .from("rooms")
        .delete()
        .lt("updated_at", inactiveThreshold)
        .select("id");

      if (error) {
        console.warn("[RoomService] Warning during cleanupStaleRooms:", error.message);
      }

      const totalDeleted =
        (endedRooms?.length || 0) +
        (lobbyRooms?.length || 0) +
        (staleRooms?.length || 0);

      return { deletedCount: totalDeleted };
    } catch (err) {
      console.warn("[RoomService] Error during cleanupStaleRooms:", err);
      return { deletedCount: 0 };
    }
  }

  /**
   * Retrieves active public rooms for directory table on home page.
   * Cleans up stale/ended rooms synchronously before query so table is always 100% fresh.
   * Excludes ended, stale, and private rooms.
   */
  static async listActiveRooms(): Promise<any[]> {
    const client = this.getClient();

    // Opportunistic cleanup: Purge dead rooms immediately before listing
    await this.cleanupStaleRooms().catch(() => {});

    // Rooms active in the last 40 minutes
    const recentThreshold = new Date(Date.now() - 40 * 60 * 1000).toISOString();

    const { data, error } = await client
      .from("rooms")
      .select("room_code, status, settings, created_at, updated_at")
      .neq("status", "game_over")
      .gt("updated_at", recentThreshold)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error || !data) {
      console.warn("[RoomService] listActiveRooms error:", error?.message);
      return [];
    }

    const activeRooms: any[] = [];
    for (const r of data) {
      const s = (r.settings as any) || {};
      const count = typeof s.playerCount === "number" ? Math.max(0, s.playerCount) : 1;

      // Filter out empty rooms and purge them immediately from DB
      if (count <= 0) {
        this.deleteRoomByCode(r.room_code).catch(() => {});
        continue;
      }

      // Filter out private rooms
      if (s.isPrivate) {
        continue;
      }

      activeRooms.push({
        roomCode: r.room_code,
        status: r.status,
        hostDisplayName: s.hostDisplayName || "หัวหน้าห้อง",
        hostAvatar: s.hostAvatar || "🎧",
        gameMode: s.gameMode || "buzzer",
        playerCount: count,
        totalRounds: s.totalRounds || 10,
        currentRound: s.currentRound || 1,
        isLocked: Boolean(s.password && String(s.password).trim().length > 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    return activeRooms;
  }
}

