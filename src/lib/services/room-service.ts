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

    const mergedSettings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...initialSettings,
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
}

