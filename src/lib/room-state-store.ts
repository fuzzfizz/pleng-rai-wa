// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room State Store
// Authoritative active round manager, FCFS buzzer arbitration & scoring
// ==========================================

import type { Song, RoomSettings, GameMode } from "@/types";
import { checkAnswer } from "@/lib/answer-checker";

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

export class RoomStateStore {
  /**
   * Retrieves active round state for room code.
   */
  static getRoomRoundState(code: string): RoomRoundState | undefined {
    if (!code || typeof code !== "string") return undefined;
    const cleanCode = code.trim().toUpperCase();
    return roomRoundStates.get(cleanCode);
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
      (gameMode === "ai-lyrics" || gameMode === "translated-lyrics") &&
      state.roundStatus === "question_active";

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
      const hintLevel = state.revealedHintLevel || 0;
      const points = hintLevel === 1 ? 75 : hintLevel === 2 ? 50 : hintLevel === 3 ? 25 : 100;
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
      const currentScore = state.scores[playerId] || 0;
      const newScore = Math.max(0, currentScore - 20);
      state.scores[playerId] = newScore;

      // Exclude player from re-guessing this song
      if (!state.excludedPlayerIds.includes(playerId)) {
        state.excludedPlayerIds.push(playerId);
      }

      // Record wrong guess history
      state.wrongGuesses.push({
        playerId,
        displayName: displayName || state.buzzedPlayerName || "ผู้เล่น",
        answerText,
        timestamp: new Date().toISOString(),
      });

      if (isStandardBuzzer) {
        // Release buzzer lock and allow other players to buzz
        state.buzzedPlayerId = null;
        state.buzzedPlayerName = null;
        state.buzzedAt = null;
        state.buzzDeadline = null;

        const totalPlayers = options?.totalPlayers;
        if (totalPlayers !== undefined && totalPlayers > 0 && state.excludedPlayerIds.length >= totalPlayers) {
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
        const totalPlayers = options?.totalPlayers;
        if (totalPlayers !== undefined && totalPlayers > 0 && state.excludedPlayerIds.length >= totalPlayers) {
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
    state.roundStatus = "question_active";

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
  static revealNextHint(code: string): {
    success: boolean;
    level: number;
    hintType?: "genre" | "year" | "artist";
    hintText?: string;
    pointsAvailable: number;
  } {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);
    if (!state || !state.currentSong) {
      return { success: false, level: 0, pointsAvailable: 100 };
    }

    const currentLevel = state.revealedHintLevel || 0;
    if (currentLevel >= 3) {
      return { success: false, level: 3, pointsAvailable: 25 };
    }

    const nextLevel = currentLevel + 1;
    state.revealedHintLevel = nextLevel;

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
