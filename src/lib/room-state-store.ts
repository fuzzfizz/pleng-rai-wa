// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room State Store
// Authoritative active round manager, FCFS buzzer arbitration & scoring
// ==========================================

import type { Song, RoomSettings, GameMode, ChoiceOption } from "@/types";
import { checkAnswer } from "@/lib/answer-checker";
import { SongService, mapGenreFromRow } from "@/lib/services/song-service";

export type RoundStatus =
  | "idle"
  | "question_active"
  | "buzzed"
  | "revealing"
  | "game_over";

export interface WrongGuess {
  playerId: string;
  displayName: string;
  answerText: string;
  timestamp: string;
}

export interface RoomRoundState {
  roomCode: string;
  currentRound: number;
  totalRounds?: number;
  roundStatus: RoundStatus;
  gameMode?: GameMode;
  settings?: RoomSettings;
  currentSong?: Song; // Secret full metadata kept ONLY on server
  sliceUrl?: string;
  sliceStartSec?: number;
  sliceDurationSec?: number;
  lyrics?: string;
  choices?: ChoiceOption[];
  playerWrongCounts: Record<string, number>;
  buzzedPlayerId?: string | null;
  buzzedPlayerName?: string | null;
  buzzedAt?: string | null;
  buzzDeadline?: string | null; // 10 seconds timeout for answering
  excludedPlayerIds: string[]; // Players who answered wrong this round and are barred from re-buzzing until next song
  wrongGuesses: WrongGuess[];
  scores: Record<string, number>; // Running scores by playerId, minimum score clamped to 0
  winnerPlayerId?: string | null;
  roundWinnerPlayerId?: string | null;
  revealedHintLevel?: number; // 0 = none, 1 = genre, 2 = year, 3 = artist
  revealedHints?: { genre?: string; year?: string; artist?: string };
  playerHintLevels?: Record<string, number>;
  startedAt?: string;
}

export interface BuzzResult {
  success: boolean;
  reason?: "round_not_active" | "already_buzzed" | "already_guessed_wrong";
  roundState?: RoomRoundState;
}

export interface SubmitAnswerResult {
  success: boolean;
  isCorrect: boolean;
  matchedAs: string;
  similarity: number;
  scoreDelta: number;
  newScore: number;
  scores: Record<string, number>;
  reason?: string;
  roundState?: RoomRoundState;
  fullSong?: Song;
}

export interface TimeoutBuzzerResult {
  success: boolean;
  reason?: string;
  roundState?: RoomRoundState;
  wrongGuess?: WrongGuess;
  scoreDelta?: number;
  newScore?: number;
}

// In-memory store persistent across hot-reloads in development
const globalForRoomState = globalThis as unknown as {
  __roomRoundStates?: Map<string, RoomRoundState>;
};
const roomRoundStates =
  globalForRoomState.__roomRoundStates ?? new Map<string, RoomRoundState>();
globalForRoomState.__roomRoundStates = roomRoundStates;

/**
 * Safely converts a raw DB song row or partial object to domain Song.
 */
export function toSongDomain(raw: any): Song {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid song raw object");
  }
  return {
    id: raw.id,
    title: raw.title,
    artist: raw.artist,
    aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
    releaseYear: raw.releaseYear ?? raw.release_year ?? undefined,
    genreId: raw.genreId ?? raw.genre_id ?? undefined,
    genre: raw.genre ?? (raw.genres ? mapGenreFromRow(raw.genres) : undefined),
    era: raw.era ?? undefined,
    audioUrl: raw.audioUrl ?? raw.audio_url,
    hookStartSec: raw.hookStartSec ?? raw.hook_start_sec ?? 0,
    hookEndSec: raw.hookEndSec ?? raw.hook_end_sec ?? 0,
    durationSec: raw.durationSec ?? raw.duration_sec ?? 0,
    lyricsIntro: raw.lyricsIntro ?? raw.lyrics_intro ?? undefined,
    lyricsChorus: raw.lyricsChorus ?? raw.lyrics_chorus ?? undefined,
    metadata: raw.metadata ?? {},
    createdAt: raw.createdAt ?? raw.created_at,
  };
}

export class RoomStateStore {
  /**
   * Retrieves active round state for room code from in-memory cache.
   */
  static getRoomRoundState(code: string): RoomRoundState | undefined {
    if (!code || typeof code !== "string") return undefined;
    const cleanCode = code.trim().toUpperCase();
    return roomRoundStates.get(cleanCode);
  }

  /**
   * Serializes active round state for persistence in rooms.settings.round_state.
   * Strips secret song data so DB row doesn't leak secrets in settings JSON.
   */
  static serializeRoundState(state: RoomRoundState): any {
    return {
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      roundStatus: state.roundStatus,
      gameMode: state.gameMode,
      buzzedPlayerId: state.buzzedPlayerId ?? null,
      buzzedPlayerName: state.buzzedPlayerName ?? null,
      buzzedAt: state.buzzedAt ?? null,
      buzzDeadline: state.buzzDeadline ?? null,
      excludedPlayerIds: [...state.excludedPlayerIds],
      wrongGuesses: [...state.wrongGuesses],
      scores: { ...state.scores },
      winnerPlayerId: state.winnerPlayerId ?? null,
      roundWinnerPlayerId: state.roundWinnerPlayerId ?? null,
      revealedHintLevel: state.revealedHintLevel ?? 0,
      revealedHints: { ...(state.revealedHints || {}) },
      playerHintLevels: { ...(state.playerHintLevels || {}) },
      sliceUrl: state.sliceUrl,
      sliceStartSec: state.sliceStartSec,
      sliceDurationSec: state.sliceDurationSec,
      lyrics: state.lyrics,
      choices: state.choices,
      startedAt: state.startedAt,
    };
  }

  /**
   * Rehydrates or synchronizes round state from Supabase room record when
   * executing across different serverless function instances or cold starts.
   */
  static async ensureRoundState(
    code: string,
    room: any,
    song?: Song
  ): Promise<RoomRoundState | undefined> {
    if (!code || typeof code !== "string" || !room) return undefined;
    const cleanCode = code.trim().toUpperCase();
    const existing = roomRoundStates.get(cleanCode);

    const dbRoundState =
      typeof room.settings?.round_state === "object" && room.settings.round_state !== null
        ? room.settings.round_state
        : undefined;

    // If existing in-memory state has currentSong, sync any newer buzzer / status from DB if applicable
    if (existing && existing.currentSong) {
      if (dbRoundState) {
        if (dbRoundState.buzzedPlayerId && !existing.buzzedPlayerId) {
          existing.buzzedPlayerId = dbRoundState.buzzedPlayerId;
          existing.buzzedPlayerName = dbRoundState.buzzedPlayerName;
          existing.buzzedAt = dbRoundState.buzzedAt;
          existing.buzzDeadline = dbRoundState.buzzDeadline;
          existing.roundStatus =
            (room.status as RoundStatus) || dbRoundState.roundStatus || "buzzed";
        }
        if (dbRoundState.scores && Object.keys(dbRoundState.scores).length > 0) {
          existing.scores = { ...dbRoundState.scores, ...existing.scores };
        }
        if (Array.isArray(dbRoundState.excludedPlayerIds)) {
          for (const id of dbRoundState.excludedPlayerIds) {
            if (!existing.excludedPlayerIds.includes(id)) {
              existing.excludedPlayerIds.push(id);
            }
          }
        }
      }
      return existing;
    }

    // Otherwise, rehydrate from room / DB
    let resolvedSong: Song | undefined = song;
    if (!resolvedSong && room.songs) {
      try {
        const rawSong = Array.isArray(room.songs) ? room.songs[0] : room.songs;
        if (rawSong && rawSong.title) {
          resolvedSong = toSongDomain(rawSong);
        }
      } catch (err) {
        console.warn("[RoomStateStore] Failed to map room.songs:", err);
      }
    }

    if (!resolvedSong && room.current_song_id) {
      try {
        const fetchedSong = await SongService.getSongById(room.current_song_id);
        if (fetchedSong) {
          resolvedSong = fetchedSong;
        }
      } catch (err) {
        console.warn("[RoomStateStore] Failed to fetch song by current_song_id:", err);
      }
    }

    if (!resolvedSong) {
      // Cannot rehydrate a round without a song (e.g. lobby mode)
      return undefined;
    }

    const roundStatus: RoundStatus =
      (room.status === "buzzed" ||
       room.status === "question_active" ||
       room.status === "revealing" ||
       room.status === "game_over")
        ? (room.status as RoundStatus)
        : (dbRoundState?.roundStatus || "question_active");

    const reconstructed: RoomRoundState = {
      roomCode: cleanCode,
      currentRound: typeof dbRoundState?.currentRound === "number"
        ? dbRoundState.currentRound
        : (Array.isArray(room.played_song_ids) ? room.played_song_ids.length : 1),
      totalRounds: typeof dbRoundState?.totalRounds === "number"
        ? dbRoundState.totalRounds
        : (room.settings?.totalRounds || 10),
      roundStatus,
      gameMode: room.settings?.gameMode || dbRoundState?.gameMode || "buzzer",
      settings: room.settings,
      currentSong: resolvedSong,
      sliceUrl:
        dbRoundState?.sliceUrl ||
        `/api/audio/slice?id=${encodeURIComponent(resolvedSong.id)}&start=${resolvedSong.hookStartSec || 0}&duration=${room.settings?.sliceDurationSec || 2.0}`,
      sliceStartSec: dbRoundState?.sliceStartSec ?? resolvedSong.hookStartSec ?? 0,
      sliceDurationSec: dbRoundState?.sliceDurationSec ?? room.settings?.sliceDurationSec ?? 2.0,
      lyrics: dbRoundState?.lyrics,
      choices: dbRoundState?.choices,
      playerWrongCounts: dbRoundState?.playerWrongCounts || {},
      buzzedPlayerId: dbRoundState?.buzzedPlayerId ?? null,
      buzzedPlayerName: dbRoundState?.buzzedPlayerName ?? null,
      buzzedAt: dbRoundState?.buzzedAt ?? null,
      buzzDeadline: dbRoundState?.buzzDeadline ?? null,
      excludedPlayerIds: Array.isArray(dbRoundState?.excludedPlayerIds)
        ? [...dbRoundState.excludedPlayerIds]
        : [],
      wrongGuesses: Array.isArray(dbRoundState?.wrongGuesses)
        ? [...dbRoundState.wrongGuesses]
        : [],
      scores:
        typeof dbRoundState?.scores === "object" && dbRoundState?.scores !== null
          ? { ...dbRoundState.scores }
          : {},
      winnerPlayerId: dbRoundState?.winnerPlayerId ?? null,
      roundWinnerPlayerId: dbRoundState?.roundWinnerPlayerId ?? null,
      revealedHintLevel:
        typeof dbRoundState?.revealedHintLevel === "number"
          ? dbRoundState.revealedHintLevel
          : 0,
      revealedHints: dbRoundState?.revealedHints || {},
      playerHintLevels: dbRoundState?.playerHintLevels || {},
      startedAt: dbRoundState?.startedAt || new Date().toISOString(),
    };

    roomRoundStates.set(cleanCode, reconstructed);
    return reconstructed;
  }

  /**
   * Initializes or updates active round state for a room.
   * Preserves accumulated scores from previous rounds.
   */
  static initRound(
    code: string,
    roundNumber: number,
    song: Song,
    settings: RoomSettings,
    extra?: {
      totalRounds?: number;
      sliceUrl?: string;
      sliceStartSec?: number;
      sliceDurationSec?: number;
      lyrics?: string;
      choices?: ChoiceOption[];
    }
  ): RoomRoundState {
    const cleanCode = code.trim().toUpperCase();
    const existing = roomRoundStates.get(cleanCode);

    const scores: Record<string, number> = existing?.scores
      ? { ...existing.scores }
      : {};

    const newState: RoomRoundState = {
      roomCode: cleanCode,
      currentRound: roundNumber,
      totalRounds: extra?.totalRounds ?? settings.totalRounds ?? 0,
      roundStatus: "question_active",
      gameMode: settings.gameMode,
      settings,
      currentSong: song,
      sliceUrl: extra?.sliceUrl,
      sliceStartSec: extra?.sliceStartSec ?? song.hookStartSec ?? 0,
      sliceDurationSec: extra?.sliceDurationSec ?? settings.sliceDurationSec ?? 2.0,
      lyrics: extra?.lyrics,
      choices: extra?.choices,
      playerWrongCounts: {},
      buzzedPlayerId: null,
      buzzedPlayerName: null,
      buzzedAt: null,
      buzzDeadline: null,
      excludedPlayerIds: [],
      wrongGuesses: [],
      scores,
      winnerPlayerId: null,
      roundWinnerPlayerId: null,
      revealedHintLevel: 0,
      revealedHints: {},
      playerHintLevels: {},
      startedAt: new Date().toISOString(),
    };

    roomRoundStates.set(cleanCode, newState);
    return newState;
  }

  /**
   * First-Come-First-Serve atomic buzzer locking.
   * Bars players who already guessed wrong this round.
   */
  static buzz(
    code: string,
    playerId: string,
    displayName: string
  ): BuzzResult {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);

    if (!state) {
      return { success: false, reason: "round_not_active" };
    }

    if (state.roundStatus === "buzzed") {
      // Auto-expire previous buzzer if deadline exceeded without submitting
      if (
        state.buzzedPlayerId &&
        state.buzzDeadline &&
        Date.now() > new Date(state.buzzDeadline).getTime()
      ) {
        this.timeoutBuzzer(cleanCode, state.buzzedPlayerId);
      } else {
        return { success: false, reason: "already_buzzed" };
      }
    }

    if (state.roundStatus !== "question_active") {
      return { success: false, reason: "round_not_active" };
    }

    if (state.excludedPlayerIds.includes(playerId)) {
      return { success: false, reason: "already_guessed_wrong" };
    }

    if (state.buzzedPlayerId) {
      return { success: false, reason: "already_buzzed" };
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 10000); // 10 seconds answer timeout

    state.buzzedPlayerId = playerId;
    state.buzzedPlayerName = displayName;
    state.buzzedAt = now.toISOString();
    state.buzzDeadline = deadline.toISOString();
    state.roundStatus = "buzzed";

    return {
      success: true,
      roundState: state,
    };
  }

  /**
   * Validates buzzer holder's or direct answering player's answer with Thai fuzzy checker.
   * Multi-chance rules:
   * - Correct: +100 points, roundStatus -> 'revealing', winner declared.
   * - Wrong: -20 points (clamped to 0), excluded from re-guessing this round.
   *   In buzzer mode: buzzer unlocked, roundStatus -> 'question_active'.
   *   In ai-lyrics direct mode: roundStatus remains 'question_active' unless ALL players are excluded, then roundStatus -> 'revealing'.
   */
  static submitAnswer(
    code: string,
    playerId: string,
    displayName: string,
    answerText: string,
    options?: {
      gameMode?: GameMode;
      roomSettings?: RoomSettings;
      totalPlayers?: number;
    }
  ): SubmitAnswerResult {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);

    const defaultScore = state?.scores[playerId] ?? 0;
    const scoresSnapshot = state?.scores ? { ...state.scores } : {};

    if (!state) {
      return {
        success: false,
        isCorrect: false,
        matchedAs: "",
        similarity: 0,
        scoreDelta: 0,
        newScore: defaultScore,
        scores: scoresSnapshot,
        reason: "round_not_active",
      };
    }

    const gameMode =
      options?.gameMode ||
      options?.roomSettings?.gameMode ||
      state.gameMode ||
      state.settings?.gameMode;

    const isStandardBuzzer =
      state.roundStatus === "buzzed" && state.buzzedPlayerId === playerId;
    const isDirectAnswer =
      gameMode !== "buzzer" && state.roundStatus === "question_active";

    if (!isStandardBuzzer && !isDirectAnswer) {
      return {
        success: false,
        isCorrect: false,
        matchedAs: "",
        similarity: 0,
        scoreDelta: 0,
        newScore: defaultScore,
        scores: scoresSnapshot,
        reason: "unauthorized_or_not_buzzed",
      };
    }

    // Direct answering mode: verify player is not in excludedPlayerIds
    if (isDirectAnswer && state.excludedPlayerIds.includes(playerId)) {
      return {
        success: false,
        isCorrect: false,
        matchedAs: "",
        similarity: 0,
        scoreDelta: 0,
        newScore: defaultScore,
        scores: scoresSnapshot,
        reason: "already_guessed_wrong",
      };
    }

    // Standard buzzer mode: check if buzzer deadline expired before answering
    if (isStandardBuzzer && state.buzzDeadline && Date.now() > new Date(state.buzzDeadline).getTime()) {
      this.timeoutBuzzer(cleanCode, playerId);
      return {
        success: false,
        isCorrect: false,
        matchedAs: "",
        similarity: 0,
        scoreDelta: -20,
        newScore: state.scores[playerId] ?? 0,
        scores: { ...state.scores },
        reason: "buzzer_timeout",
      };
    }

    if (!state.currentSong) {
      return {
        success: false,
        isCorrect: false,
        matchedAs: "",
        similarity: 0,
        scoreDelta: 0,
        newScore: defaultScore,
        scores: scoresSnapshot,
        reason: "no_active_song",
      };
    }

    const check = checkAnswer(answerText, {
      title: state.currentSong.title,
      aliases: state.currentSong.aliases,
    });

    if (check.isCorrect) {
      // Points scaled by hint level: 0 hints = 100, 1 hint = 75, 2 hints = 50, 3 hints = 25
      const playerHintLevel =
        playerId && state.playerHintLevels && playerId in state.playerHintLevels
          ? state.playerHintLevels[playerId]
          : playerId && state.playerHintLevels && Object.keys(state.playerHintLevels).length > 0
          ? 0
          : (playerId && state.playerHintLevels?.[playerId]) ?? state.revealedHintLevel ?? 0;
      const points =
        playerHintLevel === 1
          ? 75
          : playerHintLevel === 2
          ? 50
          : playerHintLevel === 3
          ? 25
          : 100;
      const currentScore = state.scores[playerId] || 0;
      const newScore = currentScore + points;
      state.scores[playerId] = newScore;
      state.roundStatus = "revealing";
      state.winnerPlayerId = playerId;
      state.roundWinnerPlayerId = playerId;

      if (isStandardBuzzer) {
        state.buzzedPlayerId = null;
        state.buzzedPlayerName = null;
        state.buzzedAt = null;
        state.buzzDeadline = null;
      }

      return {
        success: true,
        isCorrect: true,
        matchedAs: check.matchedAs,
        similarity: check.similarity,
        scoreDelta: points,
        newScore,
        scores: { ...state.scores },
        roundState: state,
        fullSong: state.currentSong,
      };
    } else {
      // Wrong guess: -20 points (clamped to 0)
      if (!state.playerWrongCounts) state.playerWrongCounts = {};
      state.playerWrongCounts[playerId] = (state.playerWrongCounts[playerId] || 0) + 1;
      const currentScore = state.scores[playerId] || 0;
      const newScore = Math.max(0, currentScore - 20);
      state.scores[playerId] = newScore;

      if (isStandardBuzzer) {
        if (!state.excludedPlayerIds.includes(playerId)) {
          state.excludedPlayerIds.push(playerId);
        }
      } else {
        const maxWrong = state.settings?.maxWrongGuesses ?? 1;
        if (
          answerText === "(ยอมแพ้)" ||
          (maxWrong > 0 && state.playerWrongCounts[playerId] >= maxWrong)
        ) {
          if (!state.excludedPlayerIds.includes(playerId)) {
            state.excludedPlayerIds.push(playerId);
          }
        }
      }

      // Record wrong guess history
      state.wrongGuesses.push({
        playerId,
        displayName: displayName || state.buzzedPlayerName || "ผู้เล่น",
        answerText,
        timestamp: new Date().toISOString(),
      });

      const effectiveTotalPlayers =
        options?.totalPlayers && options.totalPlayers > 0
          ? options.totalPlayers
          : options?.roomSettings?.playerCount && options.roomSettings.playerCount > 0
          ? options.roomSettings.playerCount
          : Object.keys(state.scores).length > 0
          ? Object.keys(state.scores).length
          : 1;

      if (isStandardBuzzer) {
        // Release buzzer lock and allow other players to buzz if this was the buzzed player
        if (state.buzzedPlayerId === playerId) {
          state.buzzedPlayerId = null;
          state.buzzedPlayerName = null;
          state.buzzedAt = null;
          state.buzzDeadline = null;
        }

        if (state.excludedPlayerIds.length >= effectiveTotalPlayers) {
          state.roundStatus = "revealing";
          state.winnerPlayerId = null;
          state.roundWinnerPlayerId = null;
        } else {
          state.roundStatus = "question_active";
        }
      } else {
        // Direct answering mode:
        // Do NOT change roundStatus (remains "question_active" so other players can still guess!)
        // If ALL players in the room are in excludedPlayerIds: change state.roundStatus = "revealing" with no winner.
        if (state.excludedPlayerIds.length >= effectiveTotalPlayers) {
          state.roundStatus = "revealing";
          state.winnerPlayerId = null;
          state.roundWinnerPlayerId = null;
        } else {
          state.roundStatus = "question_active";
        }
      }

      return {
        success: true,
        isCorrect: false,
        matchedAs: check.matchedAs,
        similarity: check.similarity,
        scoreDelta: -20,
        newScore,
        scores: { ...state.scores },
        roundState: state,
        fullSong: state.roundStatus === "revealing" ? state.currentSong : undefined,
      };
    }
  }

  /**
   * Handles buzzer expiration when the buzzer holder fails to answer in time.
   * Penalizes player by -20 points and re-opens buzzer for others.
   */
  static timeoutBuzzer(code: string, playerId: string): TimeoutBuzzerResult {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);

    if (!state || state.roundStatus !== "buzzed" || state.buzzedPlayerId !== playerId) {
      return { success: false, reason: "not_active_buzzer_holder" };
    }

    const currentScore = state.scores[playerId] || 0;
    const newScore = Math.max(0, currentScore - 20);
    state.scores[playerId] = newScore;

    if (!state.playerWrongCounts) state.playerWrongCounts = {};
    state.playerWrongCounts[playerId] = (state.playerWrongCounts[playerId] || 0) + 1;

    if (!state.excludedPlayerIds.includes(playerId)) {
      state.excludedPlayerIds.push(playerId);
    }

    const wrongGuess: WrongGuess = {
      playerId,
      displayName: state.buzzedPlayerName || "ผู้เล่น",
      answerText: "(หมดเวลา)",
      timestamp: new Date().toISOString(),
    };
    state.wrongGuesses.push(wrongGuess);

    // Release buzzer
    state.buzzedPlayerId = null;
    state.buzzedPlayerName = null;
    state.buzzedAt = null;
    state.buzzDeadline = null;

    const effectiveTotalPlayers =
      state.settings?.playerCount && state.settings.playerCount > 0
        ? state.settings.playerCount
        : Object.keys(state.scores).length > 0
        ? Object.keys(state.scores).length
        : 1;

    if (state.excludedPlayerIds.length >= effectiveTotalPlayers) {
      state.roundStatus = "revealing";
      state.winnerPlayerId = null;
      state.roundWinnerPlayerId = null;
    } else {
      state.roundStatus = "question_active";
    }

    return {
      success: true,
      roundState: state,
      wrongGuess,
      scoreDelta: -20,
      newScore,
    };
  }

  /**
   * Sets game state to game_over.
   */
  static setGameOver(code: string): RoomRoundState | undefined {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);
    if (state) {
      state.roundStatus = "game_over";
    }
    return state;
  }

  /**
   * Reveals the next progressive hint for the active question:
   * Level 1: Genre (แนวเพลง)
   * Level 2: Release Year & Era (ปีที่ปล่อยเพลง / ยุค)
   * Level 3: Artist (ศิลปิน / วง)
   */
  static revealNextHint(code: string, playerId?: string): {
    success: boolean;
    level: number;
    hintType?: "genre" | "year" | "artist";
    hintText?: string;
    pointsAvailable: number;
    playerId?: string;
  } {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);
    if (!state || !state.currentSong) {
      return { success: false, level: 0, pointsAvailable: 100, playerId };
    }

    if (!state.playerHintLevels) {
      state.playerHintLevels = {};
    }

    const currentLevel = playerId
      ? state.playerHintLevels[playerId] || 0
      : state.revealedHintLevel || 0;

    if (currentLevel >= 3) {
      return { success: false, level: 3, pointsAvailable: 25, playerId };
    }

    const nextLevel = currentLevel + 1;

    if (playerId) {
      state.playerHintLevels[playerId] = nextLevel;
      state.revealedHintLevel = Math.max(state.revealedHintLevel || 0, nextLevel);
    } else {
      state.revealedHintLevel = nextLevel;
    }

    if (!state.revealedHints) {
      state.revealedHints = {};
    }

    let hintType: "genre" | "year" | "artist" = "genre";
    let hintText = "";

    if (nextLevel === 1) {
      hintType = "genre";
      hintText = state.currentSong.genre?.nameTh || "เพลงไทยยอดนิยม";
      state.revealedHints.genre = hintText;
    } else if (nextLevel === 2) {
      hintType = "year";
      const year = state.currentSong.releaseYear;
      const era = state.currentSong.era;
      hintText = year ? `ปี ${year}${era ? ` (ยุค ${era})` : ""}` : `ยุค ${era || "ไม่ระบุ"}`;
      state.revealedHints.year = hintText;
    } else if (nextLevel === 3) {
      hintType = "artist";
      hintText = state.currentSong.artist || "ศิลปินไม่ระบุ";
      state.revealedHints.artist = hintText;
    }

    const pointsAvailable = nextLevel === 1 ? 75 : nextLevel === 2 ? 50 : 25;

    return {
      success: true,
      level: nextLevel,
      hintType,
      hintText,
      pointsAvailable,
      playerId,
    };
  }

  /**
   * Skips active round and transitions directly to revealing with winner null.
   */
  static skipRound(code: string): {
    success: boolean;
    roundState?: RoomRoundState;
    fullSong?: Song;
  } {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);
    if (!state) return { success: false };

    state.roundStatus = "revealing";
    state.winnerPlayerId = null;
    state.roundWinnerPlayerId = null;
    state.buzzedPlayerId = null;
    state.buzzedPlayerName = null;
    state.buzzedAt = null;
    state.buzzDeadline = null;

    return {
      success: true,
      roundState: state,
      fullSong: state.currentSong,
    };
  }

  /**
   * Clears state for a specific room.
   */
  static resetRoom(code: string): boolean {
    const cleanCode = code.trim().toUpperCase();
    return roomRoundStates.delete(cleanCode);
  }

  static clearRoom(code: string): boolean {
    return this.resetRoom(code);
  }

  static deleteRoom(code: string): boolean {
    return this.resetRoom(code);
  }

  /**
   * Clears all room states (useful for tests).
   */
  static clearAll(): void {
    roomRoundStates.clear();
  }
}

/**
 * Sanitizes round state for client delivery.
 * Strips secret song metadata (title, artist, lyrics) while round is active.
 */
export function sanitizeRoundState(state: RoomRoundState | undefined | null): any {
  if (!state) return null;
  const copy = JSON.parse(JSON.stringify(state));
  if (copy.roundStatus !== "revealing" && copy.roundStatus !== "game_over") {
    delete copy.currentSong;
  }
  return copy;
}
