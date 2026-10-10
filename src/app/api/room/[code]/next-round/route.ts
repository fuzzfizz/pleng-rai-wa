// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Next Round API Route
// Host-only round progression, song picker, slice URL generator & anti-cheat
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { RedisService } from "@/lib/services/redis-service";
import { isValidRoomCode } from "@/lib/room-code";
import { translateThaiToEnglishLiteral } from "@/lib/translate";
import { calculateSliceStart } from "@/lib/audio-slice-utils";
import type { RoomSettings, Song, ChoiceOption } from "@/types";

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

    // Ensure round state is rehydrated if running on a fresh serverless instance
    await RoomStateStore.ensureRoundState(cleanCode, room);

    // Check if this is a request to play again after game_over
    const isPlayAgain = Boolean(body.playAgain) || room.status === "game_over";

    const existingRoundState = RoomStateStore.getRoomRoundState(cleanCode);
    const playedSongIds: string[] = isPlayAgain
      ? []
      : Array.isArray(room.played_song_ids)
      ? [...room.played_song_ids]
      : [];
    const dbRoundState =
      (typeof room.settings?.round_state === "object" && room.settings.round_state !== null
        ? room.settings.round_state
        : undefined) ||
      (typeof room.round_state === "object" && room.round_state !== null
        ? room.round_state
        : undefined);

    const completedRounds = isPlayAgain
      ? 0
      : Math.max(
          playedSongIds.length,
          typeof dbRoundState?.currentRound === "number" ? dbRoundState.currentRound : 0,
          existingRoundState?.currentRound ?? 0
        );

    if (isPlayAgain) {
      RoomStateStore.resetRoom(cleanCode);
      await RoomService.updateRoomRound(cleanCode, {
        currentSongId: null,
        playedSongIds: [],
        status: "question_active",
        roundState: null,
      }).catch((err) => console.warn("[NextRound] Failed to reset room round for playAgain:", err));
    } else {
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
    const startSec = calculateSliceStart(song, durationSec);
    const sliceUrl = `/api/audio/slice?id=${encodeURIComponent(song.id)}&start=${startSec}&duration=${durationSec}`;

    let lyrics: string | undefined = undefined;
    if (settings.gameMode === "ai-lyrics") {
      lyrics =
        settings.lyricsType === "intro"
          ? song.lyricsIntro || song.lyricsChorus || ""
          : song.lyricsChorus || song.lyricsIntro || "";
    } else if (settings.gameMode === "translated-lyrics") {
      const rawThai =
        settings.lyricsType === "intro"
          ? song.lyricsIntro || song.lyricsChorus || ""
          : song.lyricsChorus || song.lyricsIntro || "";
      lyrics = await translateThaiToEnglishLiteral(rawThai);
    }

    // Decoy choices generation for multiple-choice mode
    let choices: ChoiceOption[] | undefined = undefined;
    if (settings.answerInputMode === "multiple-choice") {
      let decoys: Song[] = [];
      try {
        decoys = await SongService.getRandomSongs(3, {
          genreId: filterGenreId,
          era: filterEra,
          artist: filterArtist,
          yearStart: filterYearStart,
          yearEnd: filterYearEnd,
          playlistId: filterPlaylistId,
          excludeIds: [song.id, ...playedSongIds],
        });
      } catch (err) {
        console.warn("Failed to fetch filtered decoys, falling back to general pool", err);
      }

      if (decoys.length < 3) {
        const needed = 3 - decoys.length;
        const existingIds = [song.id, ...playedSongIds, ...decoys.map((d) => d.id)];
        try {
          const fallbackDecoys = await SongService.getRandomSongs(needed, {
            excludeIds: existingIds,
          });
          decoys = [...decoys, ...fallbackDecoys];
        } catch (fallbackErr) {
          console.warn("Failed to fetch fallback decoys", fallbackErr);
        }
      }

      const rawChoices = [
        { realId: song.id, title: song.title, artist: song.artist },
        ...decoys.map((d) => ({ realId: d.id, title: d.title, artist: d.artist })),
      ];

      // Fisher-Yates shuffle
      for (let i = rawChoices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rawChoices[i], rawChoices[j]] = [rawChoices[j], rawChoices[i]];
      }

      choices = rawChoices.map((c, idx) => ({
        id: `choice_${idx}`,
        title: c.title,
        artist: c.artist,
      }));
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
        choices,
      }
    );

    // Update database room row with serialized round state for serverless rehydration
    const updatedPlayedSongs = [...playedSongIds, song.id];
    const serializedRound = RoomStateStore.serializeRoundState(roundState);
    await RoomService.updateRoomRound(cleanCode, {
      currentSongId: song.id,
      playedSongIds: updatedPlayedSongs,
      status: "question_active",
      roundState: serializedRound,
    });

    // Reset buzzer lock and cache round state in Redis if available
    RedisService.releaseBuzzerLock(cleanCode).catch(() => {});
    RedisService.saveRoundState(cleanCode, serializedRound).catch(() => {});

    // Broadcast round_start event to all room participants
    // ANTI-CHEAT: NEVER leak song title or artist in broadcast or response
    const roundStartPayload = {
      round: nextRound,
      totalRounds: settings.totalRounds || 0,
      gameMode: settings.gameMode,
      sliceUrl,
      durationSec,
      lyrics,
      choices,
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
      choices,
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
