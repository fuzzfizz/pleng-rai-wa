// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room State Route
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { isValidRoomCode } from "@/lib/room-code";

/**
 * Strips secret song metadata (title, artist, lyrics, aliases)
 * from room object when game is active and answer is not yet revealed.
 */
export function sanitizeRoomState(room: any): any {
  if (!room) return room;
  const sanitized = JSON.parse(JSON.stringify(room));

  if (sanitized.status !== "revealing" && sanitized.status !== "game_over") {
    const stripSongSecrets = (song: any) => {
      if (!song || typeof song !== "object") return song;
      delete song.title;
      delete song.artist;
      delete song.aliases;
      delete song.lyrics_intro;
      delete song.lyrics_chorus;
      delete song.lyricsIntro;
      delete song.lyricsChorus;
      delete song.metadata;
      return song;
    };

    if (sanitized.songs) {
      if (Array.isArray(sanitized.songs)) {
        sanitized.songs = sanitized.songs.map(stripSongSecrets);
      } else {
        sanitized.songs = stripSongSecrets(sanitized.songs);
      }
    }

    if (sanitized.song) {
      sanitized.song = stripSongSecrets(sanitized.song);
    }

    if (sanitized.currentSong) {
      sanitized.currentSong = stripSongSecrets(sanitized.currentSong);
    }

    if (sanitized.current_song) {
      sanitized.current_song = stripSongSecrets(sanitized.current_song);
    }
  }

  return sanitized;
}

export async function GET(
  _request: NextRequest,
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

    const sanitizedRoom = sanitizeRoomState(room);

    return NextResponse.json({
      success: true,
      room: sanitizedRoom,
    });
  } catch (error) {
    console.error("Get room state error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง",
      },
      { status: 500 }
    );
  }
}
