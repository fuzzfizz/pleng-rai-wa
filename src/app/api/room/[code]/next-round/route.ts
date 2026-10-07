// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Next Round API Route
// Host-only round progression, song picker, slice URL generator & anti-cheat
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { isValidRoomCode } from "@/lib/room-code";
import type { RoomSettings, Song } from "@/types";

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

    // Parse body for sessionToken
    let body: any = {};
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty or non-JSON body
    }

    // Host authorization check
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : undefined;
    const callerToken =
      typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0
        ? body.sessionToken.trim()
        : bearerToken;

    if (!callerToken || callerToken !== room.host_player_id) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์เริ่มรอบใหม่ (เฉพาะ Host เท่านั้น)",
        },
        { status: 403 }
      );
    }

    // Room settings
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...(room.settings && typeof room.settings === "object" ? room.settings : {}),
    };

    const existingRoundState = RoomStateStore.getRoomRoundState(cleanCode);
    const playedSongIds: string[] = Array.isArray(room.played_song_ids)
      ? [...room.played_song_ids]
      : [];
    const completedRounds = existingRoundState
      ? existingRoundState.currentRound
      : playedSongIds.length;

    // Check if game has reached maximum rounds
    if (settings.totalRounds > 0 && completedRounds >= settings.totalRounds) {
      await RoomService.updateRoomStatus(cleanCode, "game_over");
      RoomStateStore.setGameOver(cleanCode);

      await RealtimeBroadcastService.broadcast(cleanCode, "game_over", {
        gameOver: true,
        round: completedRounds,
        totalRounds: settings.totalRounds,
        finalScores: existingRoundState?.scores || {},
      });

      return NextResponse.json({
        success: true,
        gameOver: true,
        message: "เกมจบแล้ว (ครบจำนวนรอบ)",
        finalScores: existingRoundState?.scores || {},
      });
    }

    const nextRound = completedRounds + 1;

    // Extract filter options from settings.songFilter (or fallback to legacy genreId / playlistId)
    const songFilter = settings.songFilter;
    let filterGenreId: string | undefined = undefined;
    let filterEra: string | undefined = undefined;
    let filterArtist: string | undefined = undefined;
    let filterYearStart: number | undefined = undefined;
    let filterYearEnd: number | undefined = undefined;
    let filterPlaylistId: string | null | undefined = undefined;

    if (songFilter) {
      if (songFilter.type === "genre") {
        filterGenreId = songFilter.genreId;
      } else if (songFilter.type === "era") {
        filterEra = songFilter.era;
      } else if (songFilter.type === "artist") {
        filterArtist = songFilter.artist;
      } else if (songFilter.type === "playlist") {
        filterPlaylistId = songFilter.playlistId;
      }
      filterYearStart = songFilter.yearStart;
      filterYearEnd = songFilter.yearEnd;
    } else {
      filterGenreId = settings.genreId;
      filterPlaylistId = settings.playlistId;
    }

    // Fetch random unplayed song
    const songs = await SongService.getRandomSongs(1, {
      genreId: filterGenreId,
      era: filterEra,
      artist: filterArtist,
      yearStart: filterYearStart,
      yearEnd: filterYearEnd,
      playlistId: filterPlaylistId,
      excludeIds: playedSongIds,
    });

    if (!songs || songs.length === 0) {
      await RoomService.updateRoomStatus(cleanCode, "game_over");
      RoomStateStore.setGameOver(cleanCode);

      await RealtimeBroadcastService.broadcast(cleanCode, "game_over", {
        gameOver: true,
        round: completedRounds,
        totalRounds: settings.totalRounds,
        finalScores: existingRoundState?.scores || {},
        reason: "no_more_songs",
      });

      return NextResponse.json({
        success: true,
        gameOver: true,
        message: "เพลงหมดคลังแล้ว",
        finalScores: existingRoundState?.scores || {},
      });
    }

    const song: Song = songs[0];

    // Build audio slice URL & lyrics
    const durationSec = settings.sliceDurationSec || 2.0;
    const startSec =
      song.hookStartSec && song.hookStartSec > 0 ? song.hookStartSec : 0;
    const sliceUrl = `/api/audio/slice?id=${encodeURIComponent(song.id)}&start=${startSec}&duration=${durationSec}`;

    let lyrics: string | undefined = undefined;
    if (settings.gameMode === "ai-lyrics") {
      lyrics =
        settings.lyricsType === "intro"
          ? song.lyricsIntro || song.lyricsChorus || ""
          : song.lyricsChorus || song.lyricsIntro || "";
    }

    // Initialize round in authoritative memory store
    const roundState = RoomStateStore.initRound(
      cleanCode,
      nextRound,
      song,
      settings,
      {
        totalRounds: settings.totalRounds,
        sliceUrl,
        sliceStartSec: startSec,
        sliceDurationSec: durationSec,
        lyrics,
      }
    );

    // Update database room row
    const updatedPlayedSongs = [...playedSongIds, song.id];
    await RoomService.updateRoomRound(cleanCode, {
      currentSongId: song.id,
      playedSongIds: updatedPlayedSongs,
      status: "question_active",
    });

    // Broadcast round_start event to all room participants
    // ANTI-CHEAT: NEVER leak song title or artist in broadcast or response
    const roundStartPayload = {
      round: nextRound,
      totalRounds: settings.totalRounds || 0,
      gameMode: settings.gameMode,
      sliceUrl,
      durationSec,
      lyrics,
      startedAt: roundState.startedAt,
    };

    await RealtimeBroadcastService.broadcast(
      cleanCode,
      "round_start",
      roundStartPayload
    );

    return NextResponse.json({
      success: true,
      gameOver: false,
      round: nextRound,
      totalRounds: settings.totalRounds || 0,
      gameMode: settings.gameMode,
      sliceUrl,
      durationSec,
      lyrics,
      startedAt: roundState.startedAt,
    });
  } catch (error) {
    console.error("Next round route error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการเริ่มรอบใหม่",
      },
      { status: 500 }
    );
  }
}
