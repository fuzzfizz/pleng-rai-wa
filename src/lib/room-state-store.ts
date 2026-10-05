// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room State Store
// Authoritative active round manager, FCFS buzzer arbitration & scoring
// ==========================================

import type { Song, RoomSettings } from "@/types";
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
if (process.env.NODE_ENV !== "production") {
  globalForRoomState.__roomRoundStates = roomRoundStates;
}

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

    if (state.excludedPlayerIds.includes(playerId)) {
      return { success: false, reason: "already_guessed_wrong" };
    }

    if (state.buzzedPlayerId || state.roundStatus === "buzzed") {
      return { success: false, reason: "already_buzzed" };
    }

    if (state.roundStatus !== "question_active") {
      return { success: false, reason: "round_not_active" };
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
   * Validates buzzer holder's answer with Thai fuzzy checker.
   * Multi-chance rules:
   * - Correct: +100 points, roundStatus -> 'revealing', winner declared.
   * - Wrong: -20 points (clamped to 0), excluded from re-buzzing this round, buzzer unlocked, roundStatus -> 'question_active'.
   */
  static submitAnswer(
    code: string,
    playerId: string,
    displayName: string,
    answerText: string
  ): SubmitAnswerResult {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);

    const defaultScore = state?.scores[playerId] ?? 0;
    const scoresSnapshot = state?.scores ? { ...state.scores } : {};

    if (!state || state.roundStatus !== "buzzed" || state.buzzedPlayerId !== playerId) {
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
      // +100 points on correct guess
      const currentScore = state.scores[playerId] || 0;
      const newScore = currentScore + 100;
      state.scores[playerId] = newScore;
      state.roundStatus = "revealing";
      state.winnerPlayerId = playerId;

      return {
        success: true,
        isCorrect: true,
        matchedAs: check.matchedAs,
        similarity: check.similarity,
        scoreDelta: 100,
        newScore,
        scores: { ...state.scores },
        roundState: state,
        fullSong: state.currentSong,
      };
    } else {
      // -20 points on wrong guess (clamped to 0)
      const currentScore = state.scores[playerId] || 0;
      const newScore = Math.max(0, currentScore - 20);
      state.scores[playerId] = newScore;

      // Exclude player from re-buzzing this song
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

      // Release buzzer lock and allow other players to buzz
      state.buzzedPlayerId = null;
      state.buzzedPlayerName = null;
      state.buzzedAt = null;
      state.buzzDeadline = null;
      state.roundStatus = "question_active";

      return {
        success: true,
        isCorrect: false,
        matchedAs: check.matchedAs,
        similarity: check.similarity,
        scoreDelta: -20,
        newScore,
        scores: { ...state.scores },
        roundState: state,
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
   * Clears state for a specific room.
   */
  static resetRoom(code: string): boolean {
    const cleanCode = code.trim().toUpperCase();
    return roomRoundStates.delete(cleanCode);
  }

  static clearRoom(code: string): boolean {
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
