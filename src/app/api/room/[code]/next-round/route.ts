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
import { cleanLyricsForGame } from "@/lib/lyrics-cleaner";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";
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

    const candidateTokens = [
      typeof body.sessionToken === "string" ? body.sessionToken : undefined,
      typeof body.playerId === "string" ? body.playerId : undefined,
      bearerToken,
    ];

    const isHost = typeof RoomService.isCallerHost === "function"
      ? RoomService.isCallerHost(room, candidateTokens)
      : candidateTokens.some(
          (t) => Boolean(t && (t === room.host_player_id || t === room.hostPlayerId))
        );

    if (!isHost) {
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

    // Check if this is a request to start a new game (from lobby or play again)
    const isNewGame =
      Boolean(body.playAgain) ||
      Boolean(body.isNewGame) ||
      room.status === "game_over" ||
      room.status === "lobby";

    const existingRoundState = isNewGame ? undefined : RoomStateStore.getRoomRoundState(cleanCode);
    const playedSongIds: string[] = isNewGame
      ? []
      : Array.isArray(room.played_song_ids)
      ? [...room.played_song_ids]
      : [];
    const dbRoundState = isNewGame
      ? undefined
      : (typeof room.settings?.round_state === "object" && room.settings.round_state !== null
          ? room.settings.round_state
          : undefined) ||
        (typeof room.round_state === "object" && room.round_state !== null
          ? room.round_state
          : undefined);

    const completedRounds = isNewGame
      ? 0
      : Math.max(
          playedSongIds.length,
          typeof dbRoundState?.currentRound === "number" ? dbRoundState.currentRound : 0,
          existingRoundState?.currentRound ?? 0
        );

    if (isNewGame) {
      RoomStateStore.resetRoom(cleanCode);
      RedisService.deleteRoom(cleanCode).catch(() => {});
      await Promise.resolve(
        RoomService.updateRoomRound(cleanCode, {
          currentSongId: null,
          playedSongIds: [],
          status: "question_active",
          roundState: null,
        })
      ).catch((err) => console.warn("[NextRound] Failed to reset room round for new game:", err));
    } else {
      // Check if game has reached maximum rounds
      if (settings.totalRounds > 0 && completedRounds >= settings.totalRounds) {
        const finalScores =
          (existingRoundState?.scores && Object.keys(existingRoundState.scores).length > 0)
            ? existingRoundState.scores
            : (dbRoundState?.scores && Object.keys(dbRoundState.scores).length > 0)
            ? dbRoundState.scores
            : (room.settings?.round_state?.scores || {});

        await RoomService.updateRoomStatus(cleanCode, "game_over");
        RoomStateStore.setGameOver(cleanCode);

        await RealtimeBroadcastService.broadcast(cleanCode, "game_over", {
          gameOver: true,
          round: completedRounds,
          totalRounds: settings.totalRounds,
          finalScores,
        });

        return NextResponse.json({
          success: true,
          gameOver: true,
          message: "เกมจบแล้ว (ครบจำนวนรอบ)",
          finalScores,
        });
      }
    }

    const nextRound = completedRounds + 1;

    // Extract filter options from settings.songFilter (or fallback to legacy genreId / playlistId)
    const songFilter = settings.songFilter;
    let filterGenreId: string | undefined = undefined;
    let filterGenreIds: string[] | undefined = undefined;
    let filterEra: string | undefined = undefined;
    let filterEraIds: string[] | undefined = undefined;
    let filterArtist: string | undefined = undefined;
    let filterArtists: string[] | undefined = undefined;
    let filterYearStart: number | undefined = undefined;
    let filterYearEnd: number | undefined = undefined;
    let filterPlaylistId: string | null | undefined = undefined;

    if (songFilter) {
      if (songFilter.type === "genre") {
        filterGenreId = songFilter.genreId;
        filterGenreIds =
          songFilter.genreIds && songFilter.genreIds.length > 0
            ? songFilter.genreIds
            : songFilter.genreId
            ? [songFilter.genreId]
            : undefined;
      } else if (songFilter.type === "era") {
        filterEra = songFilter.era;
        filterEraIds =
          songFilter.eraIds && songFilter.eraIds.length > 0
            ? songFilter.eraIds
            : songFilter.era
            ? [songFilter.era]
            : undefined;
      } else if (songFilter.type === "artist") {
        filterArtist = songFilter.artist;
        filterArtists =
          songFilter.artists && songFilter.artists.length > 0
            ? songFilter.artists
            : songFilter.artist
            ? [songFilter.artist]
            : undefined;
      } else if (songFilter.type === "playlist") {
        filterPlaylistId = songFilter.playlistId;
      }
      filterYearStart = songFilter.yearStart;
      filterYearEnd = songFilter.yearEnd;
    } else {
      filterGenreId = settings.genreId;
      filterGenreIds =
        settings.genreIds && settings.genreIds.length > 0
          ? settings.genreIds
          : settings.genreId
          ? [settings.genreId]
          : undefined;
      filterEraIds = settings.eraIds;
      filterPlaylistId = settings.playlistId;
    }

    const isLyricsMode =
      settings.gameMode === "ai-lyrics" || settings.gameMode === "translated-lyrics";

    // Fetch random unplayed song
    const songs = await SongService.getRandomSongs(1, {
      genreId: filterGenreId,
      genreIds: filterGenreIds,
      era: filterEra,
      eraIds: filterEraIds,
      artist: filterArtist,
      artists: filterArtists,
      yearStart: filterYearStart,
      yearEnd: filterYearEnd,
      playlistId: filterPlaylistId,
      excludeIds: playedSongIds,
      hasLyrics: isLyricsMode ? true : undefined,
    });

    let song: Song | null = songs && songs.length > 0 ? songs[0] : null;

    // If total database is empty (or returned 0 songs) and we haven't played songs yet,
    // check if system can fall back to DEMO_SONGS
    if (!song && playedSongIds.length === 0) {
      const demoCandidate = DEMO_SONGS.find(
        (s) =>
          !playedSongIds.includes(s.id) &&
          (!isLyricsMode || Boolean(s.lyricsFull?.trim() || s.lyricsChorus?.trim() || s.lyricsIntro?.trim()))
      );

      if (demoCandidate) {
        song = demoCandidate;
      }
    }

    if (!song) {
      const finalScores =
        (existingRoundState?.scores && Object.keys(existingRoundState.scores).length > 0)
          ? existingRoundState.scores
          : (dbRoundState?.scores && Object.keys(dbRoundState.scores).length > 0)
          ? dbRoundState.scores
          : (room.settings?.round_state?.scores || {});

      await RoomService.updateRoomStatus(cleanCode, "game_over");
      RoomStateStore.setGameOver(cleanCode);

      const noMoreSongsMessage = isLyricsMode
        ? `เล่นครบทุกเพลงที่มีเนื้อเพลงในคลังแล้ว (รวม ${completedRounds} ข้อ)`
        : `เล่นครบทุกเพลงในคลัง/เพลย์ลิสต์แล้ว (รวม ${completedRounds} ข้อ) สรุปคะแนนผู้ชนะ!`;

      await RealtimeBroadcastService.broadcast(cleanCode, "game_over", {
        gameOver: true,
        round: completedRounds,
        totalRounds: settings.totalRounds,
        finalScores,
        reason: "no_more_songs",
        message: noMoreSongsMessage,
      });

      return NextResponse.json({
        success: true,
        gameOver: true,
        reason: "no_more_songs",
        message: noMoreSongsMessage,
        finalScores,
      });
    }

    // If in lyrics mode and song has no lyrics in any field, check fallback to DEMO_SONGS with lyrics
    if (
      isLyricsMode &&
      !song.lyricsFull?.trim() &&
      !song.lyricsChorus?.trim() &&
      !song.lyricsIntro?.trim()
    ) {
      const demoWithLyrics = DEMO_SONGS.find(
        (s) =>
          !playedSongIds.includes(s.id) &&
          Boolean(s.lyricsFull?.trim() || s.lyricsChorus?.trim() || s.lyricsIntro?.trim())
      );

      if (demoWithLyrics) {
        song = demoWithLyrics;
      } else {
        // No demo songs with lyrics available either - end game cleanly rather than mismatching lyrics
        const finalScores =
          (existingRoundState?.scores && Object.keys(existingRoundState.scores).length > 0)
            ? existingRoundState.scores
            : (dbRoundState?.scores && Object.keys(dbRoundState.scores).length > 0)
            ? dbRoundState.scores
            : (room.settings?.round_state?.scores || {});

        await RoomService.updateRoomStatus(cleanCode, "game_over");
        RoomStateStore.setGameOver(cleanCode);

        const noMoreSongsMessage = `เล่นครบทุกเพลงที่มีเนื้อเพลงในคลังแล้ว (รวม ${completedRounds} ข้อ)`;

        await RealtimeBroadcastService.broadcast(cleanCode, "game_over", {
          gameOver: true,
          round: completedRounds,
          totalRounds: settings.totalRounds,
          finalScores,
          reason: "no_more_songs",
          message: noMoreSongsMessage,
        });

        return NextResponse.json({
          success: true,
          gameOver: true,
          reason: "no_more_songs",
          message: noMoreSongsMessage,
          finalScores,
        });
      }
    }

    // Build audio slice URL & lyrics
    let durationSec = settings.sliceDurationSec || 2.0;
    let startSec = 0;

    if (settings.gameMode === "buzzer") {
      if (settings.buzzerPlayRegion === "entire_song") {
        startSec = 0;
      } else {
        startSec = song.hookStartSec && song.hookStartSec > 0 ? song.hookStartSec : 0;
      }
      durationSec = typeof song.durationSec === "number" && song.durationSec > 0 ? song.durationSec : 300;
    } else {
      durationSec = settings.sliceDurationSec || 2.0;
      startSec = calculateSliceStart(
        song,
        durationSec,
        Math.random,
        settings.sliceRandomRegion || "hook"
      );
    }
    const sliceUrl = `/api/audio/slice?id=${encodeURIComponent(song.id)}&start=${startSec}&duration=${durationSec}`;

    let rawThai = "";
    if (settings.gameMode === "translated-lyrics") {
      // Translated lyrics mode: always use full song lyrics so players read and find the hook themselves!
      rawThai = song.lyricsFull || song.lyricsChorus || song.lyricsIntro || "";
    } else if (settings.lyricsType === "full") {
      rawThai = song.lyricsFull || song.lyricsChorus || song.lyricsIntro || "";
    } else if (settings.lyricsType === "intro") {
      rawThai = song.lyricsIntro || song.lyricsChorus || song.lyricsFull || "";
    } else {
      // Default to chorus; if song doesn't have chorus, fallback to lyricsFull!
      rawThai = song.lyricsChorus || song.lyricsFull || song.lyricsIntro || "";
    }

    // Strip song title and artist header lines
    let cleanedThai = cleanLyricsForGame(rawThai);
    if (!cleanedThai.trim() && rawThai.trim()) {
      cleanedThai = rawThai.trim();
    }

    // If lyrics is empty for lyrics mode after all checks, end game cleanly instead of mismatching
    if (isLyricsMode && !cleanedThai.trim()) {
      const finalScores =
        (existingRoundState?.scores && Object.keys(existingRoundState.scores).length > 0)
          ? existingRoundState.scores
          : (dbRoundState?.scores && Object.keys(dbRoundState.scores).length > 0)
          ? dbRoundState.scores
          : (room.settings?.round_state?.scores || {});

      await RoomService.updateRoomStatus(cleanCode, "game_over");
      RoomStateStore.setGameOver(cleanCode);

      const noMoreSongsMessage = `เล่นครบทุกเพลงที่มีเนื้อเพลงในคลังแล้ว (รวม ${completedRounds} ข้อ)`;

      await RealtimeBroadcastService.broadcast(cleanCode, "game_over", {
        gameOver: true,
        round: completedRounds,
        totalRounds: settings.totalRounds,
        finalScores,
        reason: "no_more_songs",
        message: noMoreSongsMessage,
      });

      return NextResponse.json({
        success: true,
        gameOver: true,
        reason: "no_more_songs",
        message: noMoreSongsMessage,
        finalScores,
      });
    }

    let lyrics: string | undefined = undefined;
    if (settings.gameMode === "ai-lyrics") {
      lyrics = cleanedThai;
    } else if (settings.gameMode === "translated-lyrics") {
      lyrics = await translateThaiToEnglishLiteral(cleanedThai);
    }

    // Decoy choices generation for multiple-choice mode
    let choices: ChoiceOption[] | undefined = undefined;
    if (settings.answerInputMode === "multiple-choice") {
      let sameArtistDecoys: Song[] = [];
      try {
        sameArtistDecoys = await SongService.getRandomSongs(3, {
          artist: song.artist,
          excludeIds: [song.id, ...playedSongIds],
        });
      } catch (err) {
        console.warn("Failed to fetch same-artist decoys", err);
      }

      let decoys = [...sameArtistDecoys];

      if (decoys.length < 3) {
        let additionalDecoys: Song[] = [];
        const needed = 3 - decoys.length;
        const excludeIds = [song.id, ...playedSongIds, ...decoys.map((d) => d.id)];
        try {
          additionalDecoys = await SongService.getRandomSongs(needed, {
            genreId: filterGenreId,
            genreIds: filterGenreIds,
            era: filterEra,
            playlistId: filterPlaylistId,
            excludeIds,
          });
        } catch (err) {
          console.warn("Failed to fetch additional decoys", err);
        }
        decoys = [...decoys, ...additionalDecoys];
      }

      if (decoys.length < 3) {
        const neededGeneral = 3 - decoys.length;
        const existingIds = [song.id, ...playedSongIds, ...decoys.map((d) => d.id)];
        try {
          const fallbackDecoys = await SongService.getRandomSongs(neededGeneral, {
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
