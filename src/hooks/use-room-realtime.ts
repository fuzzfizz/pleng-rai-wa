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
  loadPlayerSession,
  savePlayerSession,
} from "@/lib/session-storage";
import type { Player, RoomSettings, Song, GameMode } from "@/types";

export interface ActiveQuestion {
  sliceUrl?: string;
  durationSec?: number;
  lyrics?: string;
  startedAt?: string;
}

export interface BuzzedPlayer {
  id: string;
  displayName: string;
  buzzedAt?: string;
  deadline?: string;
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
  isMyBuzz: boolean;
  isExcludedFromBuzz: boolean;
  revealedSong: Partial<Song> | null;
  roundWinner: RoundWinner | null;
  lastWrongGuess: WrongGuessRecord | null;
  wrongGuesses: WrongGuessRecord[];
  scores: Record<string, number>;
  revealedHints: { genre?: string; year?: string; artist?: string; level: number };
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
  | { type: "set_ready"; isReady: boolean };

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
    gameMode: "buzzer",
    activeQuestion: null,
    buzzedPlayer: null,
    isMyBuzz: false,
    isExcludedFromBuzz: false,
    revealedSong: null,
    roundWinner: null,
    lastWrongGuess: null,
    wrongGuesses: [],
    scores: {},
    revealedHints: { level: 0 },
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
      // Update in players list if not present
      const exists = nextState.players.some((pl) => pl.id === p.id);
      if (!exists) {
        nextState.players = [...nextState.players, p];
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
      if (nextState.myPlayer && !map.has(nextState.myPlayer.id)) {
        map.set(nextState.myPlayer.id, nextState.myPlayer);
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

    case "broadcast": {
      const { event, payload } = action;

      switch (event) {
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
          };
          nextState.buzzedPlayer = null;
          nextState.wrongGuesses = [];
          nextState.lastWrongGuess = null;
          nextState.revealedSong = null;
          nextState.roundWinner = null;
          nextState.revealedHints = { level: 0 };
          nextState.isAudioPlaying = true;
          break;
        }

        case "buzzer_hit": {
          if (shouldPlay) {
            try {
              sfx.buzzer();
            } catch {}
          }
          nextState.status = "buzzed";
          nextState.buzzedPlayer = {
            id: payload?.playerId,
            displayName: payload?.displayName || "ผู้เล่น",
            buzzedAt: payload?.buzzedAt,
            deadline: payload?.deadline,
          };
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

          const wrongRecord: WrongGuessRecord = {
            playerId: payload?.playerId,
            displayName: payload?.displayName || "ผู้เล่น",
            answerText: payload?.answerText || "",
          };
          nextState.lastWrongGuess = wrongRecord;

          if (Array.isArray(payload?.wrongGuesses) && payload.wrongGuesses.length > 0) {
            nextState.wrongGuesses = payload.wrongGuesses.map((g: any) => ({
              playerId: g.playerId,
              displayName: g.displayName || "ผู้เล่น",
              answerText: g.answerText || "",
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
          break;
        }

        case "round_reveal": {
          if (shouldPlay) {
            try {
              sfx.correct();
            } catch {}
          }
          nextState.status = "revealing";
          nextState.buzzedPlayer = null;
          nextState.revealedSong = payload?.song || null;
          nextState.roundWinner = {
            playerId: payload?.winnerPlayerId,
            displayName: payload?.winnerDisplayName || "ผู้ชนะ",
            answerText: payload?.answerText || "",
            scoreDelta: typeof payload?.scoreDelta === "number" ? payload.scoreDelta : 100,
          };
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
            nextState.isMyBuzz = false;
            nextState.isExcludedFromBuzz = false;
            nextState.wrongGuesses = [];
            nextState.lastWrongGuess = null;
            nextState.revealedSong = null;
            nextState.roundWinner = null;
            nextState.isAudioPlaying = false;
            if (payload?.scores && typeof payload.scores === "object") {
              nextState.scores = payload.scores;
            } else {
              const resetScores: Record<string, number> = {};
              for (const p of nextState.players) {
                resetScores[p.id] = 0;
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
          const { level, hintType, hintText } = payload || {};
          const currentHints = nextState.revealedHints || { level: 0 };
          const updatedHints = {
            ...currentHints,
            level: typeof level === "number" ? level : (currentHints.level || 0) + 1,
            ...(hintType && hintText ? { [hintType]: hintText } : {}),
          };
          nextState.revealedHints = updatedHints;
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
  nextState.isExcludedFromBuzz = Boolean(
    myId && nextState.wrongGuesses.some((g) => g.playerId === myId)
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
  const [isMutedState, setIsMutedState] = useState(() => soundEffects.isMuted());

  // Keep myPlayerRef synchronized for reconnect presence tracking
  useEffect(() => {
    myPlayerRef.current = state.myPlayer;
  }, [state.myPlayer]);

  // Reactive sync when initialPlayer changes asynchronously
  useEffect(() => {
    if (
      initialPlayer?.id &&
      (!state.myPlayer || state.myPlayer.id !== initialPlayer.id)
    ) {
      dispatch({
        type: "init_player",
        player: {
          id: initialPlayer.id,
          displayName: initialPlayer.displayName || "ผู้เล่น",
          isHost: Boolean(initialPlayer.isHost),
          isReady: Boolean(initialPlayer.isReady),
          score: initialPlayer.score || 0,
          sessionToken: initialPlayer.sessionToken || initialPlayer.id,
          lastSeenAt: new Date().toISOString(),
          avatarUrl: initialPlayer.avatarUrl,
        },
      });
    }
  }, [
    initialPlayer?.id,
    initialPlayer?.displayName,
    initialPlayer?.isHost,
    initialPlayer?.sessionToken,
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
      .on("presence", { event: "join" }, () => {
        const presenceState = channel.presenceState();
        const players = parsePresencePlayers(presenceState);
        dispatch({ type: "presence_sync", players });
      })
      .on("presence", { event: "leave" }, () => {
        const presenceState = channel.presenceState();
        const players = parsePresencePlayers(presenceState);
        dispatch({ type: "presence_sync", players });
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
    ): Promise<{ success: boolean; isCorrect?: boolean; error?: string }> => {
      if (!state.myPlayer) return { success: false, error: "no_player" };
      try {
        const res = await fetch(`/api/room/${cleanCode}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: state.myPlayer.id,
            displayName: state.myPlayer.displayName,
            answerText,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error };
        }
        return {
          success: Boolean(data.success),
          isCorrect: Boolean(data.isCorrect),
          error: data.error,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "network_error" };
      }
    },
    [cleanCode, state.myPlayer]
  );

  // Action: nextRound
  const nextRound = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!state.myPlayer) return { success: false, error: "no_player" };
    try {
      const token = state.myPlayer.sessionToken || state.myPlayer.id;
      const res = await fetch(`/api/room/${cleanCode}/next-round`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionToken: token,
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
  }, [cleanCode, state.myPlayer]);

  // Action: setReady
  const setReady = useCallback(
    async (isReady: boolean): Promise<void> => {
      dispatch({ type: "set_ready", isReady });
      if (channelRef.current && state.myPlayer) {
        try {
          await channelRef.current.track({
            id: state.myPlayer.id,
            displayName: state.myPlayer.displayName,
            isHost: state.myPlayer.isHost,
            isReady,
            score: state.myPlayer.score,
            sessionToken: state.myPlayer.sessionToken,
            lastSeenAt: new Date().toISOString(),
            avatarUrl: state.myPlayer.avatarUrl,
          });
        } catch (err) {
          console.warn("[useRoomRealtime] Failed to update presence ready state:", err);
        }
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
            sessionToken: token,
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
  const resetToLobby = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const res = await fetch(`/api/room/${cleanCode}/reset-lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to reset room to lobby" };
      }
      // Update local state directly
      dispatch({
        type: "broadcast",
        event: "room_state",
        payload: { status: "lobby", scores: {} },
      });
      if (channelRef.current && state.myPlayer) {
        try {
          await channelRef.current.track({
            id: state.myPlayer.id,
            displayName: state.myPlayer.displayName,
            isHost: state.myPlayer.isHost,
            isReady: false,
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

  // Audio helpers
  const playAudio = useCallback(() => {
    dispatch({ type: "set_audio_playing", isPlaying: true });
  }, []);

  const pauseAudio = useCallback(() => {
    dispatch({ type: "set_audio_playing", isPlaying: false });
  }, []);

  const toggleMute = useCallback(() => {
    const current = soundEffects.isMuted();
    soundEffects.setMuted(!current);
    setIsMutedState(!current);
  }, []);

  return {
    ...state,
    isMuted: isMutedState,
    buzz,
    submitAnswer,
    nextRound,
    resetToLobby,
    setReady,
    updateSettings,
    transferHost,
    requestHint,
    playAudio,
    pauseAudio,
    toggleMute,
    refetchState,
  };
}

export default useRoomRealtime;
