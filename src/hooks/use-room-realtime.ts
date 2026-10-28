"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Client-side Realtime Hook
// Orchestrates Supabase Realtime (Presence & Broadcast),
// procedural sound effects, game state tracking & player actions
// ==========================================

import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { soundEffects } from "@/lib/sound-effects";
import {
  isMasterMuted,
  toggleMasterMute,
  subscribeMasterVolume,
} from "@/lib/audio-volume";
import {
  loadPlayerSession,
  savePlayerSession,
} from "@/lib/session-storage";
import type { Player, RoomSettings, Song, GameMode, ChoiceOption } from "@/types";

export interface ActiveQuestion {
  sliceUrl?: string;
  durationSec?: number;
  lyrics?: string;
  startedAt?: string;
  choices?: ChoiceOption[];
}

export interface BuzzedPlayer {
  id: string;
  displayName: string;
  buzzedAt?: string;
  deadline?: string;
  buzzDeadline?: string;
}

export interface RoundWinner {
  playerId: string;
  displayName: string;
  answerText: string;
  scoreDelta: number;
}

export interface WrongGuessRecord {
  playerId: string;
  displayName: string;
  answerText: string;
  reason?: string;
}

export type RoomRealtimeStatus =
  | "lobby"
  | "question_active"
  | "buzzed"
  | "revealing"
  | "game_over";

export interface RoomRealtimeState {
  roomCode: string;
  players: Player[];
  myPlayer: Player | null;
  isHost: boolean;
  room: any | null;
  status: RoomRealtimeStatus;
  currentRound: number;
  totalRounds: number;
  gameMode: GameMode;
  activeQuestion: ActiveQuestion | null;
  buzzedPlayer: BuzzedPlayer | null;
  buzzDeadline?: string | null;
  isMyBuzz: boolean;
  isExcludedFromBuzz: boolean;
  remainingAttempts?: number;
  revealedSong: Partial<Song> | null;
  roundWinner: RoundWinner | null;
  roundWinners?: RoundWinner[];
  lastWrongGuess: WrongGuessRecord | null;
  wrongGuesses: WrongGuessRecord[];
  scores: Record<string, number>;
  revealedHints: { genre?: string; year?: string; artist?: string; level: number };
  playerHintLevels?: Record<string, number>;
  playerHints?: Record<string, { genre?: string; year?: string; artist?: string }>;
  excludedPlayerIds?: string[];
  isConnected: boolean;
  isAudioPlaying: boolean;
  error: string | null;
}

export type RoomRealtimeAction =
  | { type: "init_player"; player: Player }
  | { type: "init_room"; room: any }
  | { type: "presence_sync"; players: Player[] }
  | { type: "broadcast"; event: string; payload: any }
  | { type: "set_connection"; isConnected: boolean }
  | { type: "set_error"; error: string | null }
  | { type: "set_audio_playing"; isPlaying: boolean }
  | { type: "set_ready"; isReady: boolean }
  | { type: "set_player_lobby_ready"; playerId: string; isLobbyReady: boolean }
  | { type: "set_remote_player_ready"; playerId: string; isReady: boolean };

export interface ReducerOptions {
  playSounds?: boolean;
  soundEffectsInstance?: typeof soundEffects;
}

/**
 * Parses Supabase presence state into clean Player array.
 */
export function parsePresencePlayers(
  presenceState: Record<string, any[]>
): Player[] {
  const playerMap = new Map<string, Player>();
  for (const presences of Object.values(presenceState)) {
    if (Array.isArray(presences)) {
      for (const p of presences) {
        if (p && p.id) {
          playerMap.set(p.id, {
            id: String(p.id),
            displayName: String(p.displayName || "ผู้เล่น"),
            isHost: Boolean(p.isHost),
            isReady: Boolean(p.isReady),
            isLobbyReady: Boolean(p.isLobbyReady),
            score: typeof p.score === "number" ? p.score : 0,
            sessionToken: String(p.sessionToken || ""),
            lastSeenAt: String(p.lastSeenAt || new Date().toISOString()),
            avatarUrl: p.avatarUrl ? String(p.avatarUrl) : undefined,
          });
        }
      }
    }
  }
  return Array.from(playerMap.values());
}

/**
 * Creates initial state for useRoomRealtime hook.
 */
export function createInitialRoomRealtimeState(
  roomCode: string,
  initialPlayer?: Partial<Player>
): RoomRealtimeState {
  const cleanCode = (roomCode || "").trim().toUpperCase();

  let myPlayer: Player | null = null;
  if (initialPlayer && initialPlayer.id) {
    myPlayer = {
      id: initialPlayer.id,
      displayName: initialPlayer.displayName || "ผู้เล่น",
      isHost: Boolean(initialPlayer.isHost),
      isReady: Boolean(initialPlayer.isReady),
      isLobbyReady: Boolean(initialPlayer.isLobbyReady),
      score: initialPlayer.score || 0,
      sessionToken: initialPlayer.sessionToken || initialPlayer.id,
      lastSeenAt: new Date().toISOString(),
      avatarUrl: initialPlayer.avatarUrl,
    };
  }

  const initialPlayers: Player[] = myPlayer ? [myPlayer] : [];

  return {
    roomCode: cleanCode,
    players: initialPlayers,
    myPlayer,
    isHost: Boolean(myPlayer?.isHost),
    room: null,
    status: "lobby",
    currentRound: 0,
    totalRounds: 0,
    gameMode: "audio-slice",
    activeQuestion: null,
    buzzedPlayer: null,
    buzzDeadline: null,
    isMyBuzz: false,
    isExcludedFromBuzz: false,
    remainingAttempts: undefined,
    revealedSong: null,
    roundWinner: null,
    roundWinners: [],
    lastWrongGuess: null,
    wrongGuesses: [],
    scores: {},
    revealedHints: { level: 0 },
    playerHintLevels: {},
    playerHints: {},
    excludedPlayerIds: [],
    isConnected: false,
    isAudioPlaying: false,
    error: null,
  };
}

/**
 * Pure state reducer for Room Realtime events.
 * Can be used by React useReducer or directly verified in test suites.
 */
export function reduceRoomRealtimeEvent(
  state: RoomRealtimeState,
  action: RoomRealtimeAction,
  options?: ReducerOptions
): RoomRealtimeState {
  const sfx = options?.soundEffectsInstance ?? soundEffects;
  const shouldPlay = options?.playSounds !== false;

  let nextState: RoomRealtimeState = { ...state };

  switch (action.type) {
    case "init_player": {
      const p = action.player;
      nextState.myPlayer = p;
      if (p.isHost !== undefined) {
        nextState.isHost = Boolean(p.isHost);
      }
      // Update in players list if not present, or merge with existing player
      const exists = nextState.players.some((pl) => pl.id === p.id);
      if (!exists) {
        nextState.players = [...nextState.players, p];
      } else {
        nextState.players = nextState.players.map((pl) =>
          pl.id === p.id ? { ...pl, ...p } : pl
        );
      }
      break;
    }

    case "init_room": {
      const r = action.room;
      nextState.room = r;
      if (r.status && ["lobby", "question_active", "buzzed", "revealing", "game_over"].includes(r.status)) {
        nextState.status = r.status as RoomRealtimeStatus;
      }
      if (r.settings?.totalRounds !== undefined) {
        nextState.totalRounds = Number(r.settings.totalRounds) || 0;
      }
      if (r.settings?.gameMode) {
        nextState.gameMode = r.settings.gameMode as GameMode;
      }
      if (typeof r.current_round === "number") {
        nextState.currentRound = r.current_round;
      }
      if (r.revealedHints || r.roundState?.revealedHints) {
        nextState.revealedHints = r.revealedHints || r.roundState?.revealedHints;
      }
      if (r.playerHintLevels || r.roundState?.playerHintLevels) {
        nextState.playerHintLevels = r.playerHintLevels || r.roundState?.playerHintLevels;
      }
      const rs = r.roundState;
      if (rs && (r.status === "question_active" || r.status === "buzzed" || r.status === "revealing")) {
        nextState.activeQuestion = {
          sliceUrl: rs.sliceUrl,
          durationSec: rs.sliceDurationSec,
          lyrics: rs.lyrics,
          startedAt: rs.startedAt || new Date().toISOString(),
          choices: rs.choices,
        };
      }
      break;
    }

    case "presence_sync": {
      // Merge presence players
      const presenceList = action.players;
      // Preserve myPlayer if missing from remote presence temporarily
      const map = new Map<string, Player>();
      for (const p of presenceList) {
        map.set(p.id, p);
      }
      // Soft-retain existing players who were recently active to guard against transient presence diff drops
      const now = Date.now();
      const GRACE_PERIOD_MS = 10000;
      for (const existing of nextState.players) {
        if (!map.has(existing.id)) {
          const lastSeenMs = existing.lastSeenAt ? new Date(existing.lastSeenAt).getTime() : 0;
          if (now - lastSeenMs < GRACE_PERIOD_MS) {
            map.set(existing.id, existing);
          }
        }
      }
      if (nextState.myPlayer) {
        if (!map.has(nextState.myPlayer.id)) {
          map.set(nextState.myPlayer.id, nextState.myPlayer);
        } else {
          const remoteMe = map.get(nextState.myPlayer.id)!;
          const mergedMe: Player = {
            ...nextState.myPlayer,
            ...remoteMe,
            isLobbyReady: nextState.myPlayer.isLobbyReady || Boolean(remoteMe.isLobbyReady),
          };
          nextState.myPlayer = mergedMe;
          map.set(nextState.myPlayer.id, mergedMe);
        }
      }
      nextState.players = Array.from(map.values());
      break;
    }

    case "set_connection": {
      nextState.isConnected = action.isConnected;
      break;
    }

    case "set_error": {
      nextState.error = action.error;
      break;
    }

    case "set_audio_playing": {
      nextState.isAudioPlaying = action.isPlaying;
      break;
    }

    case "set_ready": {
      if (nextState.myPlayer) {
        nextState.myPlayer = { ...nextState.myPlayer, isReady: action.isReady };
        nextState.players = nextState.players.map((p) =>
          p.id === nextState.myPlayer!.id ? { ...p, isReady: action.isReady } : p
        );
      }
      break;
    }

    case "set_player_lobby_ready": {
      if (nextState.myPlayer && nextState.myPlayer.id === action.playerId) {
        nextState.myPlayer = {
          ...nextState.myPlayer,
          isLobbyReady: action.isLobbyReady,
        };
      }
      nextState.players = nextState.players.map((p) =>
        p.id === action.playerId ? { ...p, isLobbyReady: action.isLobbyReady } : p
      );
      break;
    }

    case "set_remote_player_ready": {
      if (nextState.myPlayer && nextState.myPlayer.id === action.playerId) {
        nextState.myPlayer = {
          ...nextState.myPlayer,
          isReady: action.isReady,
        };
      }
      nextState.players = nextState.players.map((p) =>
        p.id === action.playerId ? { ...p, isReady: action.isReady } : p
      );
      break;
    }

    case "broadcast": {
      const { event, payload } = action;

      switch (event) {
        case "player_ready": {
          const targetPlayerId = payload?.playerId;
          const isReady = Boolean(payload?.isReady);
          if (targetPlayerId) {
            if (nextState.myPlayer && nextState.myPlayer.id === targetPlayerId) {
              nextState.myPlayer = { ...nextState.myPlayer, isReady };
            }
            nextState.players = nextState.players.map((p) =>
              p.id === targetPlayerId ? { ...p, isReady } : p
            );
          }
          break;
        }

        case "round_start": {
          if (shouldPlay) {
            try {
              sfx.countdownTick();
            } catch {}
          }
          nextState.status = "question_active";
          nextState.currentRound = payload?.round ?? nextState.currentRound + 1;
          if (payload?.totalRounds !== undefined) {
            nextState.totalRounds = payload.totalRounds;
          }
          if (payload?.gameMode) {
            nextState.gameMode = payload.gameMode;
          }
          nextState.activeQuestion = {
            sliceUrl: payload?.sliceUrl,
            durationSec: payload?.durationSec,
            lyrics: payload?.lyrics,
            startedAt: payload?.startedAt || new Date().toISOString(),
            choices: payload?.choices,
          };
          nextState.buzzedPlayer = null;
          nextState.buzzDeadline = null;
          nextState.wrongGuesses = [];
          nextState.lastWrongGuess = null;
          nextState.revealedSong = null;
          nextState.roundWinner = null;
          nextState.roundWinners = [];
          nextState.revealedHints = { level: 0 };
          nextState.playerHintLevels = {};
          nextState.playerHints = {};
          nextState.excludedPlayerIds = [];
          nextState.remainingAttempts = undefined;
          nextState.isExcludedFromBuzz = false;
          nextState.isAudioPlaying = true;
          nextState.players = nextState.players.map((p) => ({ ...p, isLobbyReady: false }));
          if (nextState.myPlayer) {
            nextState.myPlayer = { ...nextState.myPlayer, isLobbyReady: false };
          }
          break;
        }

        case "buzzer_hit": {
          if (shouldPlay) {
            try {
              sfx.buzzer();
            } catch {}
          }
          nextState.status = "buzzed";
          const deadline = payload?.deadline || payload?.buzzDeadline || null;
          nextState.buzzedPlayer = {
            id: payload?.playerId,
            displayName: payload?.displayName || "ผู้เล่น",
            buzzedAt: payload?.buzzedAt,
            deadline: deadline || undefined,
            buzzDeadline: deadline || undefined,
          };
          nextState.buzzDeadline = deadline;
          nextState.isAudioPlaying = false;
          break;
        }

        case "wrong_guess": {
          if (shouldPlay) {
            try {
              sfx.wrong();
            } catch {}
          }
          nextState.status = "question_active";
          nextState.buzzedPlayer = null;
          nextState.buzzDeadline = null;

          const wrongRecord: WrongGuessRecord = {
            playerId: payload?.playerId,
            displayName: payload?.displayName || "ผู้เล่น",
            answerText: payload?.answerText || "",
            reason: payload?.reason,
          };
          nextState.lastWrongGuess = wrongRecord;

          if (Array.isArray(payload?.wrongGuesses) && payload.wrongGuesses.length > 0) {
            nextState.wrongGuesses = payload.wrongGuesses.map((g: any) => ({
              playerId: g.playerId,
              displayName: g.displayName || "ผู้เล่น",
              answerText: g.answerText || "",
              reason: g.reason,
            }));
          } else {
            const alreadyExists = nextState.wrongGuesses.some(
              (g) => g.playerId === wrongRecord.playerId && g.answerText === wrongRecord.answerText
            );
            if (!alreadyExists) {
              nextState.wrongGuesses = [...nextState.wrongGuesses, wrongRecord];
            }
          }

          if (payload?.scores && typeof payload.scores === "object") {
            nextState.scores = { ...nextState.scores, ...payload.scores };
          }
          if (payload?.resumeAudio !== undefined) {
            nextState.isAudioPlaying = Boolean(payload.resumeAudio);
          } else {
            nextState.isAudioPlaying = true;
          }

          const isPlayerExcluded =
            payload?.isExcluded === true ||
            payload?.canRetry === false ||
            (payload?.excluded !== false && payload?.canRetry !== true && payload?.isExcluded !== false);

          if (payload?.playerId && nextState.myPlayer && payload.playerId === nextState.myPlayer.id) {
            if (typeof payload?.remainingAttempts === "number") {
              nextState.remainingAttempts = payload.remainingAttempts;
            }
            if (payload?.canRetry === true || payload?.isExcluded === false) {
              nextState.isExcludedFromBuzz = false;
            } else if (isPlayerExcluded) {
              nextState.isExcludedFromBuzz = true;
            }
          }

          if (isPlayerExcluded) {
            if (payload?.playerId) {
              const currentExcluded = nextState.excludedPlayerIds || [];
              if (!currentExcluded.includes(payload.playerId)) {
                nextState.excludedPlayerIds = [...currentExcluded, payload.playerId];
              }
              if (nextState.myPlayer && payload.playerId === nextState.myPlayer.id) {
                nextState.isExcludedFromBuzz = true;
              }
            }
          } else {
            if (payload?.playerId) {
              if (nextState.excludedPlayerIds) {
                nextState.excludedPlayerIds = nextState.excludedPlayerIds.filter(
                  (id) => id !== payload.playerId
                );
              }
              if (nextState.myPlayer && payload.playerId === nextState.myPlayer.id) {
                nextState.isExcludedFromBuzz = false;
              }
            }
          }
          break;
        }

        case "round_reveal": {
          if (shouldPlay && (payload?.winnerPlayerId || (Array.isArray(payload?.winners) && payload.winners.length > 0))) {
            try {
              sfx.correct();
            } catch {}
          }
          nextState.status = "revealing";
          nextState.buzzedPlayer = null;
          nextState.buzzDeadline = null;
          nextState.revealedSong = payload?.song || null;
          const singleWinner = payload?.winnerPlayerId
            ? {
                playerId: payload.winnerPlayerId,
                displayName: payload.winnerDisplayName || "ผู้ชนะ",
                answerText: payload.answerText || "",
                scoreDelta: typeof payload.scoreDelta === "number" ? payload.scoreDelta : 100,
              }
            : null;
          nextState.roundWinner = singleWinner;
          nextState.roundWinners = Array.isArray(payload?.winners) && payload.winners.length > 0
            ? payload.winners
            : singleWinner
            ? [singleWinner]
            : [];
          if (payload?.scores && typeof payload.scores === "object") {
            nextState.scores = { ...nextState.scores, ...payload.scores };
          }
          nextState.isAudioPlaying = false;
          break;
        }

        case "game_over": {
          if (shouldPlay) {
            try {
              sfx.victoryFanfare();
            } catch {}
          }
          nextState.status = "game_over";
          nextState.isAudioPlaying = false;
          if (payload?.finalScores && typeof payload.finalScores === "object") {
            nextState.scores = { ...nextState.scores, ...payload.finalScores };
          }
          break;
        }

        case "room_state": {
          if (payload?.status) {
            nextState.status = payload.status as RoomRealtimeStatus;
          }
          if (payload?.status === "lobby") {
            nextState.status = "lobby";
            nextState.currentRound = 0;
            nextState.activeQuestion = null;
            nextState.buzzedPlayer = null;
            nextState.buzzDeadline = null;
            nextState.isMyBuzz = false;
            nextState.isExcludedFromBuzz = false;
            nextState.wrongGuesses = [];
            nextState.lastWrongGuess = null;
            nextState.revealedSong = null;
            nextState.roundWinner = null;
            nextState.roundWinners = [];
            nextState.isAudioPlaying = false;
            nextState.revealedHints = { level: 0 };
            nextState.playerHintLevels = {};
            nextState.playerHints = {};
            nextState.excludedPlayerIds = [];
            nextState.players = nextState.players.map((p) => ({ ...p, isLobbyReady: false }));
            if (nextState.myPlayer) {
              nextState.myPlayer = { ...nextState.myPlayer, isLobbyReady: false };
            }
            if (payload?.scores && Object.keys(payload.scores).length > 0) {
              nextState.scores = payload.scores;
            } else {
              const resetScores: Record<string, number> = {};
              for (const p of nextState.players) {
                resetScores[p.id] = 0;
              }
              if (nextState.myPlayer && resetScores[nextState.myPlayer.id] === undefined) {
                resetScores[nextState.myPlayer.id] = 0;
              }
              nextState.scores = resetScores;
            }
            if (nextState.room) {
              nextState.room = {
                ...nextState.room,
                status: "lobby",
                current_round: 0,
                played_song_ids: [],
                current_song_id: null,
              };
            }
          }
          break;
        }

        case "hint_revealed": {
          if (shouldPlay) {
            try {
              sfx.click();
            } catch {}
          }
          const { level, hintType, hintText, playerId } = payload || {};
          if (playerId && typeof level === "number") {
            nextState.playerHintLevels = {
              ...(nextState.playerHintLevels || {}),
              [playerId]: level,
            };
          }
          if (playerId && hintType && hintText) {
            const currentPlayerHints = nextState.playerHints?.[playerId] || {};
            nextState.playerHints = {
              ...(nextState.playerHints || {}),
              [playerId]: {
                ...currentPlayerHints,
                [hintType]: hintText,
              },
            };
          }

          // Only update revealedHints if this hint belongs to me or was broadcast globally
          const isForMe = !playerId || (nextState.myPlayer && playerId === nextState.myPlayer.id);
          if (isForMe) {
            const currentHints = nextState.revealedHints || { level: 0 };
            const updatedHints = {
              ...currentHints,
              level: typeof level === "number" ? level : (currentHints.level || 0) + 1,
              ...(hintType && hintText ? { [hintType]: hintText } : {}),
            };
            nextState.revealedHints = updatedHints;
          }
          break;
        }

        case "player_surrendered": {
          const surrenderedId = payload?.playerId;
          if (surrenderedId) {
            const currentExcluded = nextState.excludedPlayerIds || [];
            if (!currentExcluded.includes(surrenderedId)) {
              nextState.excludedPlayerIds = [...currentExcluded, surrenderedId];
            }
            if (nextState.myPlayer && nextState.myPlayer.id === surrenderedId) {
              nextState.isExcludedFromBuzz = true;
            }
          }
          break;
        }

        case "player_submitted": {
          const submittedId = payload?.playerId;
          if (submittedId) {
            const currentExcluded = nextState.excludedPlayerIds || [];
            if (!currentExcluded.includes(submittedId)) {
              nextState.excludedPlayerIds = [...currentExcluded, submittedId];
            }
            if (nextState.myPlayer && nextState.myPlayer.id === submittedId) {
              nextState.isExcludedFromBuzz = true;
            }
          }
          break;
        }

        case "host_changed": {
          const newHostId = payload?.newHostPlayerId;
          if (newHostId) {
            const isMeNewHost = Boolean(nextState.myPlayer && nextState.myPlayer.id === newHostId);
            if (nextState.myPlayer) {
              nextState.myPlayer = {
                ...nextState.myPlayer,
                isHost: isMeNewHost,
              };
            }
            nextState.isHost = isMeNewHost;

            nextState.room = {
              ...(nextState.room || {}),
              host_player_id: newHostId,
              settings: {
                ...(nextState.room?.settings || {}),
                ...(payload?.settings || {}),
                hostDisplayName: payload?.hostDisplayName || nextState.room?.settings?.hostDisplayName,
                hostAvatar: payload?.hostAvatar || nextState.room?.settings?.hostAvatar,
              },
            };

            if (Array.isArray(payload?.remainingPlayers) && payload.remainingPlayers.length > 0) {
              const playerMap = new Map<string, Player>();
              for (const p of payload.remainingPlayers) {
                if (p && p.id) {
                  playerMap.set(p.id, {
                    id: String(p.id),
                    displayName: String(p.displayName || "ผู้เล่น"),
                    isHost: p.id === newHostId,
                    isReady: Boolean(p.isReady),
                    score: typeof p.score === "number" ? p.score : 0,
                    sessionToken: String(p.sessionToken || p.id),
                    lastSeenAt: String(p.lastSeenAt || new Date().toISOString()),
                    avatarUrl: p.avatarUrl ? String(p.avatarUrl) : undefined,
                  });
                }
              }
              if (nextState.myPlayer && playerMap.has(nextState.myPlayer.id)) {
                const existingMe = playerMap.get(nextState.myPlayer.id)!;
                playerMap.set(nextState.myPlayer.id, {
                  ...existingMe,
                  ...nextState.myPlayer,
                  isHost: isMeNewHost,
                });
              }
              nextState.players = Array.from(playerMap.values());
            } else {
              nextState.players = nextState.players.map((p) => ({
                ...p,
                isHost: p.id === newHostId,
              }));
              if (payload?.formerHostPlayerId) {
                nextState.players = nextState.players.filter(
                  (p) => p.id !== payload.formerHostPlayerId
                );
              }
            }
          }
          break;
        }

        case "room_settings": {
          const newSettings = payload?.settings || payload?.room?.settings;
          const hostId = payload?.room?.host_player_id || payload?.host_player_id || newSettings?.hostPlayerId;
          nextState.room = {
            ...nextState.room,
            ...payload?.room,
            ...(hostId ? { host_player_id: hostId } : {}),
            settings: newSettings || nextState.room?.settings,
          };
          if (newSettings?.gameMode) {
            nextState.gameMode = newSettings.gameMode as GameMode;
          } else if (payload?.room?.settings?.gameMode) {
            nextState.gameMode = payload.room.settings.gameMode as GameMode;
          }
          if (newSettings?.totalRounds !== undefined) {
            nextState.totalRounds = Number(newSettings.totalRounds) || nextState.totalRounds;
          }
          if (hostId && nextState.myPlayer) {
            const isHost = nextState.myPlayer.id === hostId;
            nextState.isHost = isHost;
            nextState.myPlayer = { ...nextState.myPlayer, isHost };
            nextState.players = nextState.players.map((p) => ({
              ...p,
              isHost: p.id === hostId,
            }));
          }
          break;
        }

        case "room_dissolved": {
          nextState.error = payload?.reason || "หัวหน้าห้องออกจากห้องแล้ว ห้องถูกยุบเรียบร้อย";
          nextState.status = "game_over";
          nextState.isAudioPlaying = false;
          break;
        }

        default:
          break;
      }
      break;
    }

    default:
      break;
  }

  // Update scores on players
  if (Object.keys(nextState.scores).length > 0) {
    nextState.players = nextState.players.map((p) => ({
      ...p,
      score: nextState.scores[p.id] !== undefined ? nextState.scores[p.id] : p.score,
    }));
    if (nextState.myPlayer && nextState.scores[nextState.myPlayer.id] !== undefined) {
      const newScore = nextState.scores[nextState.myPlayer.id];
      if (nextState.myPlayer.score !== newScore) {
        nextState.myPlayer = {
          ...nextState.myPlayer,
          score: newScore,
        };
      }
    }
  }

  // Reactive computed properties
  const myId = nextState.myPlayer?.id;
  nextState.isMyBuzz = Boolean(
    myId && nextState.buzzedPlayer && nextState.buzzedPlayer.id === myId
  );
  const isExcludedInList = Boolean(
    myId && nextState.excludedPlayerIds && nextState.excludedPlayerIds.includes(myId)
  );
  const hasRemainingAttempts =
    typeof nextState.remainingAttempts === "number" && nextState.remainingAttempts > 0;
  nextState.isExcludedFromBuzz = Boolean(
    myId &&
      !hasRemainingAttempts &&
      (isExcludedInList ||
        (nextState.isExcludedFromBuzz && nextState.wrongGuesses.some((g) => g.playerId === myId)))
  );
  nextState.isHost = Boolean(
    nextState.myPlayer?.isHost ||
      (nextState.room && nextState.room.host_player_id === myId)
  );

  return nextState;
}

export function useRoomRealtime(
  roomCode: string,
  initialPlayer?: Partial<Player>
) {
  const cleanCode = (roomCode || "").trim().toUpperCase();

  // Initialize state via pure state generator (pass playSounds: false to keep reducer pure)
  const [state, dispatch] = useReducer(
    (s: RoomRealtimeState, a: RoomRealtimeAction) =>
      reduceRoomRealtimeEvent(s, a, { playSounds: false }),
    createInitialRoomRealtimeState(cleanCode, initialPlayer)
  );

  const channelRef = useRef<any>(null);
  const lastEventRef = useRef<{ key: string; time: number } | null>(null);
  const myPlayerRef = useRef<Player | null>(state.myPlayer);
  const [isMutedState, setIsMutedState] = useState(() => isMasterMuted());

  // Keep mute state in sync with master volume changes
  useEffect(() => {
    return subscribeMasterVolume((vol) => {
      setIsMutedState(vol === 0);
    });
  }, []);

  // Keep myPlayerRef synchronized for reconnect presence tracking
  useEffect(() => {
    myPlayerRef.current = state.myPlayer;
  }, [state.myPlayer]);

  // Reactive sync when initialPlayer changes asynchronously
  useEffect(() => {
    if (
      initialPlayer?.id &&
      (!state.myPlayer ||
        state.myPlayer.id !== initialPlayer.id ||
        (initialPlayer.avatarUrl && state.myPlayer.avatarUrl !== initialPlayer.avatarUrl) ||
        (initialPlayer.displayName && state.myPlayer.displayName !== initialPlayer.displayName) ||
        (initialPlayer.isHost !== undefined && state.myPlayer.isHost !== initialPlayer.isHost))
    ) {
      dispatch({
        type: "init_player",
        player: {
          id: initialPlayer.id,
          displayName:
            initialPlayer.displayName ||
            (state.myPlayer && state.myPlayer.id === initialPlayer.id
              ? state.myPlayer.displayName
              : "ผู้เล่น"),
          isHost:
            initialPlayer.isHost !== undefined
              ? Boolean(initialPlayer.isHost)
              : Boolean(state.myPlayer?.isHost),
          isReady:
            state.myPlayer && state.myPlayer.id === initialPlayer.id
              ? state.myPlayer.isReady
              : Boolean(initialPlayer.isReady),
          score:
            state.myPlayer && state.myPlayer.id === initialPlayer.id
              ? state.myPlayer.score
              : (initialPlayer.score || 0),
          sessionToken:
            initialPlayer.sessionToken ||
            (state.myPlayer && state.myPlayer.id === initialPlayer.id
              ? state.myPlayer.sessionToken
              : initialPlayer.id),
          lastSeenAt: new Date().toISOString(),
          avatarUrl: initialPlayer.avatarUrl || state.myPlayer?.avatarUrl,
        },
      });
    }
  }, [
    initialPlayer?.id,
    initialPlayer?.displayName,
    initialPlayer?.isHost,
    initialPlayer?.sessionToken,
    initialPlayer?.avatarUrl,
    state.myPlayer,
  ]);

  // 1. Session persistence / restoration
  useEffect(() => {
    if (!cleanCode) return;

    if (!state.myPlayer) {
      const stored = loadPlayerSession(cleanCode);
      if (stored) {
        const restored: Player = {
          id: stored.playerId,
          displayName: stored.displayName,
          sessionToken: stored.sessionToken,
          isHost: Boolean(stored.isHost),
          isReady: false,
          score: 0,
          lastSeenAt: new Date().toISOString(),
          avatarUrl: stored.avatar,
        };
        dispatch({ type: "init_player", player: restored });
      }
    } else {
      // Save current player to session
      savePlayerSession(cleanCode, {
        playerId: state.myPlayer.id,
        displayName: state.myPlayer.displayName,
        sessionToken: state.myPlayer.sessionToken,
        isHost: state.myPlayer.isHost,
        avatar: state.myPlayer.avatarUrl,
      });
    }
  }, [cleanCode, state.myPlayer]);

  // 2. Fetch room state on mount / code change
  const refetchState = useCallback(async () => {
    if (!cleanCode) return;
    try {
      const res = await fetch(`/api/room/${cleanCode}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          dispatch({ type: "init_room", room: data.room });
        }
      }
    } catch (err: any) {
      dispatch({ type: "set_error", error: err?.message || "Failed to fetch room state" });
    }
  }, [cleanCode]);

  useEffect(() => {
    refetchState();
  }, [refetchState]);

  // 3. Supabase Realtime channel (Presence & Broadcast) + in-memory broadcast bus
  useEffect(() => {
    if (!cleanCode) return;

    // Helper to safely dispatch broadcast event with de-duplication and sound triggers
    const handleBroadcast = (event: string, payload: any) => {
      const key = `${event}:${JSON.stringify(payload || {})}`;
      const now = Date.now();
      if (
        lastEventRef.current &&
        lastEventRef.current.key === key &&
        now - lastEventRef.current.time < 1500
      ) {
        return; // Ignore duplicate delivery within 1.5s
      }
      lastEventRef.current = { key, time: now };

      // Trigger audio cues safely outside of the reducer
      try {
        switch (event) {
          case "round_start":
            soundEffects.countdownTick();
            break;
          case "buzzer_hit":
            soundEffects.buzzer();
            break;
          case "wrong_guess":
            soundEffects.wrong();
            break;
          case "round_reveal":
            soundEffects.correct();
            break;
          case "game_over":
            soundEffects.victoryFanfare();
            break;
        }
      } catch {}

      // Host migration promotion & session persistence (Requirement 6)
      if (event === "host_changed" || event === "room_settings") {
        const newHostId =
          payload?.newHostPlayerId ||
          payload?.room?.host_player_id ||
          payload?.host_player_id ||
          payload?.settings?.hostPlayerId;

        if (newHostId && myPlayerRef.current?.id === newHostId) {
          if (typeof window !== "undefined" && window.sessionStorage) {
            try {
              window.sessionStorage.setItem(`pleng_host_${cleanCode}`, "true");
            } catch {}
          }
          if (myPlayerRef.current) {
            myPlayerRef.current = {
              ...myPlayerRef.current,
              isHost: true,
            };
            savePlayerSession(cleanCode, {
              playerId: myPlayerRef.current.id,
              displayName: myPlayerRef.current.displayName,
              sessionToken: myPlayerRef.current.sessionToken,
              avatar: myPlayerRef.current.avatarUrl,
              isHost: true,
            });
          }
          if (channelRef.current && myPlayerRef.current) {
            try {
              channelRef.current.track({
                id: myPlayerRef.current.id,
                displayName: myPlayerRef.current.displayName,
                isHost: true,
                isReady: myPlayerRef.current.isReady,
                isLobbyReady: Boolean(myPlayerRef.current.isLobbyReady),
                score: myPlayerRef.current.score,
                sessionToken: myPlayerRef.current.sessionToken,
                lastSeenAt: new Date().toISOString(),
                avatarUrl: myPlayerRef.current.avatarUrl,
              });
            } catch {}
          }
        }
      }

      dispatch({ type: "broadcast", event, payload });
    };

    // A. In-process event bus subscription (for local dev, tests & immediate server broadcasts)
    const unsubLocal = RealtimeBroadcastService.subscribe(cleanCode, (event, payload) => {
      handleBroadcast(event, payload);
    });

    // B. Supabase Realtime channel subscription
    const channelName = `room:${cleanCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: state.myPlayer ? state.myPlayer.id : "guest",
        },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const players = parsePresencePlayers(presenceState);
        dispatch({ type: "presence_sync", players });
      })
      .on("presence", { event: "leave" }, () => {
        // When all human players have left, dissolve empty room (Issue 2)
        const presenceState = channel.presenceState();
        const players = parsePresencePlayers(presenceState);
        const remainingHumanPlayers = players.filter(
          (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
        );
        if (remainingHumanPlayers.length === 0 && !myPlayerRef.current) {
          fetch(`/api/room/${cleanCode}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ remainingPlayers: [] }),
          }).catch(() => {});
        }
      })
      .on("broadcast", { event: "round_start" }, ({ payload }) => {
        handleBroadcast("round_start", payload);
      })
      .on("broadcast", { event: "buzzer_hit" }, ({ payload }) => {
        handleBroadcast("buzzer_hit", payload);
      })
      .on("broadcast", { event: "wrong_guess" }, ({ payload }) => {
        handleBroadcast("wrong_guess", payload);
      })
      .on("broadcast", { event: "round_reveal" }, ({ payload }) => {
        handleBroadcast("round_reveal", payload);
      })
      .on("broadcast", { event: "game_over" }, ({ payload }) => {
        handleBroadcast("game_over", payload);
      })
      .on("broadcast", { event: "room_state" }, ({ payload }) => {
        handleBroadcast("room_state", payload);
      })
      .on("broadcast", { event: "hint_revealed" }, ({ payload }) => {
        handleBroadcast("hint_revealed", payload);
      })
      .on("broadcast", { event: "player_surrendered" }, ({ payload }) => {
        handleBroadcast("player_surrendered", payload);
      })
      .on("broadcast", { event: "player_submitted" }, ({ payload }) => {
        handleBroadcast("player_submitted", payload);
      })
      .on("broadcast", { event: "room_settings" }, ({ payload }) => {
        handleBroadcast("room_settings", payload);
      })
      .on("broadcast", { event: "host_changed" }, ({ payload }) => {
        handleBroadcast("host_changed", payload);
      })
      .on("broadcast", { event: "player_ready" }, ({ payload }) => {
        handleBroadcast("player_ready", payload);
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        dispatch({ type: "set_connection", isConnected: true });
        const currentPlayer = myPlayerRef.current;
        if (currentPlayer) {
          try {
            await channel.track({
              id: currentPlayer.id,
              displayName: currentPlayer.displayName,
              isHost: currentPlayer.isHost,
              isReady: currentPlayer.isReady,
              isLobbyReady: Boolean(currentPlayer.isLobbyReady),
              score: currentPlayer.score,
              sessionToken: currentPlayer.sessionToken,
              lastSeenAt: new Date().toISOString(),
              avatarUrl: currentPlayer.avatarUrl,
            });
          } catch (err) {
            console.warn("[useRoomRealtime] Presence track failed:", err);
          }
        }
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        dispatch({ type: "set_connection", isConnected: false });
      }
    });

    return () => {
      unsubLocal();
      if (channel) {
        supabase.removeChannel(channel);
      }
      channelRef.current = null;
    };
  }, [cleanCode, state.myPlayer?.id]);

  // Re-track presence on avatar/displayName update
  useEffect(() => {
    if (
      channelRef.current &&
      state.isConnected &&
      state.myPlayer?.avatarUrl &&
      typeof channelRef.current.track === "function"
    ) {
      channelRef.current
        .track({
          id: state.myPlayer.id,
          displayName: state.myPlayer.displayName,
          isHost: state.myPlayer.isHost,
          isReady: state.myPlayer.isReady,
          isLobbyReady: state.myPlayer?.isLobbyReady ?? false,
          score: state.myPlayer.score,
          sessionToken: state.myPlayer.sessionToken,
          lastSeenAt: new Date().toISOString(),
          avatarUrl: state.myPlayer.avatarUrl,
        })
        .catch((err: any) => {
          console.warn("[useRoomRealtime] Re-track presence failed:", err);
        });
    }
  }, [
    state.isConnected,
    state.myPlayer?.id,
    state.myPlayer?.avatarUrl,
    state.myPlayer?.displayName,
    state.myPlayer?.isHost,
    state.myPlayer?.score,
    state.myPlayer?.sessionToken,
  ]);

  // Action: buzz
  const buzz = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    if (!state.myPlayer) return { success: false, reason: "no_player" };
    try {
      const res = await fetch(`/api/room/${cleanCode}/buzz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: state.myPlayer.id,
          displayName: state.myPlayer.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, reason: data.reason || data.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, reason: err?.message || "network_error" };
    }
  }, [cleanCode, state.myPlayer]);

  // Action: submitAnswer
  const submitAnswer = useCallback(
    async (
      answerText: string
    ): Promise<{
      success: boolean;
      isCorrect?: boolean;
      waitingForOthers?: boolean;
      canRetry?: boolean;
      remainingAttempts?: number;
      scoreDelta?: number;
      error?: string;
    }> => {
      if (!state.myPlayer) return { success: false, error: "no_player" };
      if (state.isExcludedFromBuzz) {
        return { success: false, error: "already_excluded" };
      }
      try {
        const activeHumanPlayers = state.players.filter(
          (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
        );
        const totalPlayers = activeHumanPlayers.length > 0 ? activeHumanPlayers.length : 1;

        const res = await fetch(`/api/room/${cleanCode}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: state.myPlayer.id,
            displayName: state.myPlayer.displayName,
            answerText,
            totalPlayers,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error };
        }
        return {
          success: Boolean(data.success),
          isCorrect: Boolean(data.isCorrect),
          waitingForOthers: Boolean(data.waitingForOthers),
          canRetry: Boolean(data.canRetry),
          remainingAttempts:
            typeof data.remainingAttempts === "number"
              ? data.remainingAttempts
              : undefined,
          scoreDelta:
            typeof data.scoreDelta === "number"
              ? data.scoreDelta
              : typeof data.result?.scoreDelta === "number"
              ? data.result.scoreDelta
              : undefined,
          error: data.error,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "network_error" };
      }
    },
    [cleanCode, state.myPlayer, state.isExcludedFromBuzz, state.players]
  );

  // Action: nextRound
  const nextRound = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!state.myPlayer) return { success: false, error: "no_player" };
    try {
      const token = state.myPlayer.sessionToken || state.myPlayer.id;
      const isPlayAgain = state.status === "game_over" || state.status === "lobby";
      const res = await fetch(`/api/room/${cleanCode}/next-round`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionToken: state.myPlayer.sessionToken,
          playerId: state.myPlayer.id,
          playAgain: isPlayAgain,
          isNewGame: isPlayAgain,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      return { success: Boolean(data.success), error: data.error };
    } catch (err: any) {
      return { success: false, error: err?.message || "network_error" };
    }
  }, [cleanCode, state.myPlayer, state.status]);

  // Action: setReady
  const setReady = useCallback(
    async (isReady: boolean): Promise<void> => {
      dispatch({ type: "set_ready", isReady });
      if (state.myPlayer) {
        RealtimeBroadcastService.broadcast(cleanCode, "player_ready", {
          playerId: state.myPlayer.id,
          isReady,
        }).catch(() => {});

        if (channelRef.current) {
          try {
            channelRef.current.send({
              type: "broadcast",
              event: "player_ready",
              payload: { playerId: state.myPlayer.id, isReady },
            });
          } catch {}

          try {
            await channelRef.current.track({
              id: state.myPlayer.id,
              displayName: state.myPlayer.displayName,
              isHost: state.myPlayer.isHost,
              isReady,
              isLobbyReady: state.myPlayer.isLobbyReady ?? false,
              score: state.myPlayer.score,
              sessionToken: state.myPlayer.sessionToken,
              lastSeenAt: new Date().toISOString(),
              avatarUrl: state.myPlayer.avatarUrl,
            });
          } catch (err) {
            console.warn("[useRoomRealtime] Failed to update presence ready state:", err);
          }
        }
      }
    },
    [cleanCode, state.myPlayer]
  );

  // Action: setLobbyReady
  const setLobbyReady = useCallback(
    async (isReady: boolean = true): Promise<void> => {
      if (!channelRef.current || !state.myPlayer) return;
      try {
        const updated = { ...state.myPlayer, isLobbyReady: isReady };
        await channelRef.current.track({
          id: updated.id,
          displayName: updated.displayName,
          isHost: updated.isHost,
          isReady: updated.isReady,
          isLobbyReady: isReady,
          score: updated.score,
          sessionToken: updated.sessionToken,
          lastSeenAt: new Date().toISOString(),
          avatarUrl: updated.avatarUrl,
        });
        dispatch({
          type: "set_player_lobby_ready",
          playerId: state.myPlayer.id,
          isLobbyReady: isReady,
        });
      } catch (err) {
        console.warn("[useRoomRealtime] setLobbyReady track warning:", err);
      }
    },
    [state.myPlayer]
  );

  // Action: updateSettings
  const updateSettings = useCallback(
    async (settings: Partial<RoomSettings>): Promise<boolean> => {
      if (!state.myPlayer) return false;
      try {
        const token = state.myPlayer.sessionToken || state.myPlayer.id;
        const res = await fetch(`/api/room/${cleanCode}/settings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionToken: state.myPlayer.sessionToken,
            playerId: state.myPlayer.id,
            settings: {
              ...settings,
              ...("playlistId" in settings ? { playlistId: settings.playlistId ?? null } : {}),
            },
          }),
        });
        const data = await res.json();
        if (data.success && data.room) {
          dispatch({ type: "init_room", room: data.room });
        }
        return Boolean(data.success);
      } catch {
        return false;
      }
    },
    [cleanCode, state.myPlayer]
  );

  // Host automatically syncs live presence player count to DB room settings
  const lastSyncedCountRef = useRef<number>(0);
  useEffect(() => {
    if (!state.isHost || !cleanCode || state.players.length === 0) return;
    const currentCount = state.players.length;
    if (lastSyncedCountRef.current === currentCount) return;

    lastSyncedCountRef.current = currentCount;
    updateSettings({ playerCount: currentCount }).catch(() => {});
  }, [state.isHost, cleanCode, state.players.length, updateSettings]);

  // Lightweight heartbeat effect when host is in lobby to keep room updated_at fresh
  useEffect(() => {
    if (!state.isHost || !cleanCode || state.status !== "lobby") return;

    const interval = setInterval(() => {
      const myPlayer = myPlayerRef.current;
      if (!myPlayer) return;
      const token = myPlayer.sessionToken || myPlayer.id;

      fetch(`/api/room/${cleanCode}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sessionToken: myPlayer.sessionToken,
          playerId: myPlayer.id,
          settings: {
            playerCount: state.players.length > 0 ? state.players.length : 1,
          },
        }),
      }).catch((err) => {
        console.warn("[useRoomRealtime] Lobby heartbeat warning:", err);
      });
    }, 60000); // Send heartbeat every 60 seconds

    return () => clearInterval(interval);
  }, [state.isHost, cleanCode, state.status, state.players.length]);

  // Action: transferHost
  const transferHost = useCallback(
    async (newHostPlayerId: string): Promise<boolean> => {
      if (!state.myPlayer) return false;
      try {
        const token = state.myPlayer.sessionToken || state.myPlayer.id;
        const res = await fetch(`/api/room/${cleanCode}/settings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionToken: token,
            newHostPlayerId,
          }),
        });
        const data = await res.json();
        if (data.success && data.room) {
          dispatch({ type: "init_room", room: data.room });
        }
        return Boolean(data.success);
      } catch {
        return false;
      }
    },
    [cleanCode, state.myPlayer]
  );

  // Action: resetToLobby
  const resetToLobby = useCallback(async (options?: { reason?: string }): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const playerId = state.myPlayer?.id;
      const res = await fetch(`/api/room/${cleanCode}/reset-lobby`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(playerId ? { Authorization: `Bearer ${playerId}` } : {}),
        },
        body: JSON.stringify({
          playerId,
          sessionToken: state.myPlayer?.sessionToken || playerId,
          reason: options?.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to reset room to lobby" };
      }
      // Update local state directly
      dispatch({
        type: "broadcast",
        event: "room_state",
        payload: { status: "lobby", round: 0, scores: {}, room: data.room },
      });
      if (channelRef.current && state.myPlayer) {
        try {
          await channelRef.current.track({
            id: state.myPlayer.id,
            displayName: state.myPlayer.displayName,
            isHost: state.myPlayer.isHost,
            isReady: false,
            isLobbyReady: false,
            score: 0,
            sessionToken: state.myPlayer.sessionToken,
            lastSeenAt: new Date().toISOString(),
            avatarUrl: state.myPlayer.avatarUrl,
          });
        } catch (err) {
          console.warn("[useRoomRealtime] Reset presence ready/score failed:", err);
        }
      }
      await refetchState();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "network_error" };
    }
  }, [cleanCode, refetchState, state.myPlayer]);

  // Action: requestHint
  const requestHint = useCallback(async (): Promise<{
    success: boolean;
    level?: number;
    error?: string;
  }> => {
    if (!state.myPlayer) return { success: false, error: "no_player" };
    try {
      const res = await fetch(`/api/room/${cleanCode}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: state.myPlayer.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to reveal hint" };
      }
      return { success: true, level: data.level };
    } catch (err: any) {
      return { success: false, error: err?.message || "network_error" };
    }
  }, [cleanCode, state.myPlayer]);

  // Action: skipRound
  const skipRound = useCallback(async (): Promise<boolean> => {
    if (!state.roomCode) return false;
    try {
      const token = state.myPlayer?.sessionToken || state.myPlayer?.id;
      const res = await fetch(`/api/room/${state.roomCode}/skip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          playerId: state.myPlayer?.id,
          sessionToken: state.myPlayer?.sessionToken,
        }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error("Error skipping round:", err);
      return false;
    }
  }, [state.roomCode, state.myPlayer?.id, state.myPlayer?.sessionToken]);

  // Action: surrender (neutral surrender for any player including host, no score penalty)
  const surrender = useCallback(
    async (
      reason: "surrendered" | "timed_out" = "surrendered"
    ): Promise<{
      success: boolean;
      error?: string;
    }> => {
      if (!state.myPlayer) return { success: false, error: "no_player" };
      const activeHumanPlayers = state.players.filter(
        (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
      );
      const totalPlayers = activeHumanPlayers.length > 0 ? activeHumanPlayers.length : 1;
      const payload = {
        playerId: state.myPlayer.id,
        displayName: state.myPlayer.displayName,
        totalPlayers,
        reason,
        isHost: Boolean(state.isHost),
      };

      try {
        let res = await fetch(`/api/room/${cleanCode}/surrender`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // Fail-safe: If the dedicated /surrender endpoint returns 404
        // (e.g. Next.js dev server hasn't hot-reloaded the new route directory),
        // seamlessly fallback to /api/room/[code]/answer with isSurrender: true
        if (res.status === 404) {
          res = await fetch(`/api/room/${cleanCode}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              answerText: reason === "timed_out" ? "(หมดเวลา)" : "(ยอมแพ้)",
              isSurrender: true,
            }),
          });
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Failed to surrender" };
        }
        return { success: true };
      } catch (err: any) {
        // Fallback on network error to /answer route as well
        try {
          const fallbackRes = await fetch(`/api/room/${cleanCode}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              answerText: reason === "timed_out" ? "(หมดเวลา)" : "(ยอมแพ้)",
              isSurrender: true,
            }),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok && fallbackData.success) {
            return { success: true };
          }
        } catch {}

        return { success: false, error: err?.message || "network_error" };
      }
    },
    [cleanCode, state.myPlayer, state.players]
  );

  // Audio helpers
  const playAudio = useCallback(() => {
    dispatch({ type: "set_audio_playing", isPlaying: true });
  }, []);

  const pauseAudio = useCallback(() => {
    dispatch({ type: "set_audio_playing", isPlaying: false });
  }, []);

  const setIsAudioPlaying = useCallback((isPlaying: boolean) => {
    dispatch({ type: "set_audio_playing", isPlaying });
  }, []);

  const toggleMute = useCallback(() => {
    const muted = toggleMasterMute();
    setIsMutedState(muted);
  }, []);

  return {
    ...state,
    buzzDeadline: state.buzzDeadline || state.buzzedPlayer?.deadline || state.buzzedPlayer?.buzzDeadline || null,
    isMuted: isMutedState,
    buzz,
    submitAnswer,
    nextRound,
    skipRound,
    surrender,
    resetToLobby,
    setReady,
    setLobbyReady,
    updateSettings,
    transferHost,
    requestHint,
    playAudio,
    pauseAudio,
    setIsAudioPlaying,
    toggleMute,
    refetchState,
  };
}

export default useRoomRealtime;
