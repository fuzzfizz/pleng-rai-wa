"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Game View Component
// Main in-game arena view coordinating Audio/TTS playback, FCFS buzzer duel,
// answer modal, wrong guess alert banner, and round reveal card
// ==========================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Volume2,
  VolumeX,
  LogOut,
  Trophy,
  Music,
  Sparkles,
  Zap,
  Radio,
  Crown,
  Search,
  Send,
  Loader2,
  Lightbulb,
  Tag,
  Calendar,
  UserCheck,
  Flag,
  RotateCcw,
  Play,
  Pause,
  Clock,
} from "lucide-react";
import type { useRoomRealtime } from "@/hooks/use-room-realtime";
import type { Song, GameMode } from "@/types";
import { ttsReader } from "@/lib/tts-reader";
import { searchSongAutocomplete } from "@/lib/answer-checker";
import { soundEffects } from "@/lib/sound-effects";
import { BuzzerButton, resolveBuzzerStatus } from "./buzzer-button";
import { AnswerModal } from "./answer-modal";
import { WrongGuessBanner } from "./wrong-guess-banner";
import { RoundRevealCard } from "./round-reveal-card";
import { getDeterministicAvatar } from "./player-card";
import { getMasterVolume, isMasterMuted, subscribeMasterVolume } from "@/lib/audio-volume";
import { SettingsMenu } from "@/components/common/settings-menu";

export interface GameViewProps {
  roomRealtime: ReturnType<typeof useRoomRealtime>;
  songLibrary?: Song[];
  onLeaveRoom?: () => void;
  onSkipRound?: () => Promise<boolean>;
}

/**
 * Returns Thai display label for GameMode.
 */
export function getGameModeLabel(mode: GameMode): string {
  switch (mode) {
    case "buzzer":
      return "โหมด แย่งกดกริ่ง";
    case "ai-lyrics":
      return "โหมด AI อ่านเนื้อเพลง";
    case "translated-lyrics":
      return "โหมด แปลไทย-อังกฤษ (Google Karaoke)";
    case "audio-slice":
    default:
      return "โหมด ตัดเสียงเสี้ยววินาที";
  }
}

/**
 * Determines whether a game mode uses direct answer typing instead of the buzzer button.
 */
export function isDirectInputMode(mode: GameMode): boolean {
  return mode !== "buzzer";
}

/**
 * Determines whether the audio snippet should loop automatically.
 * In audio-slice mode, it plays only once on round start and does not loop.
 */
export function shouldLoopAudio(mode: GameMode): boolean {
  return mode === "buzzer";
}

/**
 * Replays audio from the beginning (currentTime = 0).
 */
export function replayAudio(
  audioEl: HTMLAudioElement | null,
  setIsAudioPlaying?: (playing: boolean) => void
): boolean {
  if (!audioEl) return false;
  audioEl.currentTime = 0;
  audioEl.volume = getMasterVolume();
  audioEl.muted = isMasterMuted() || audioEl.volume === 0;
  try {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => console.warn("[GameView] Audio replay error:", err));
    }
  } catch {}
  setIsAudioPlaying?.(true);
  return true;
}

/**
 * Toggles playback: pauses if currently playing, or replays from start if stopped/ended.
 */
export function toggleOrReplayAudio(
  audioEl: HTMLAudioElement | null,
  isPlaying: boolean,
  setIsAudioPlaying?: (playing: boolean) => void
): boolean {
  if (!audioEl) return false;
  if (isPlaying) {
    audioEl.pause();
    setIsAudioPlaying?.(false);
    return false;
  }
  return replayAudio(audioEl, setIsAudioPlaying);
}

/**
 * Determines whether the player is allowed to submit an answer this round.
 */
export function canSubmitAnswer(isExcludedFromBuzz: boolean): boolean {
  return !isExcludedFromBuzz;
}

/**
 * Calculates score delta available for a player based on their hint level.
 * 0 hints: 100 points
 * 1 hint:  75 points
 * 2 hints: 50 points
 * 3 hints: 25 points
 */
export function calculatePointsAvailable(hintLevel: number): number {
  if (hintLevel <= 0) return 100;
  if (hintLevel === 1) return 75;
  if (hintLevel === 2) return 50;
  return 25;
}

/**
 * Resolves the active hint level for a specific player.
 * Checks playerHintLevels first, falls back to room revealedHints level, or defaults to 0.
 */
export function resolvePlayerHintLevel(
  playerId?: string | null,
  playerHintLevels?: Record<string, number>,
  roomRevealedLevel?: number
): number {
  if (playerId && playerHintLevels && typeof playerHintLevels[playerId] === "number") {
    return playerHintLevels[playerId];
  }
  return 0;
}

/**
 * Determines whether the hint button should be visible.
 * Visible for ANY player (host or non-host) as long as status is "question_active"
 * and the player has not yet unlocked all 3 hints.
 */
export function shouldShowHintButton(
  hintLevel: number,
  status: string
): boolean {
  return hintLevel < 3 && status === "question_active";
}

/**
 * Determines whether the surrender / skip button should be displayed.
 * Visible for all players when status is "question_active" or "buzzed".
 */
export function shouldShowSurrenderButton(status: string): boolean {
  return status === "question_active" || status === "buzzed";
}

/**
 * Returns the button label and action type for surrender/skip.
 * Host & non-host alike surrender this round; round only advances when all players surrender or guess wrong.
 */
export function getSurrenderButtonConfig(isHost: boolean) {
  return {
    label: "ยอมแพ้ข้อนี้",
    actionType: "surrender_player" as const,
    tooltip: "ยอมแพ้ข้อนี้ (รอเล่นข้อถัดไปหรือรอคนอื่นตอบครบ)",
  };
}

/**
 * Executes the surrender action.
 */
export async function executeSurrender({
  isHost,
  skipRound,
  surrender,
  onSkipRound,
}: {
  isHost: boolean;
  skipRound?: () => Promise<boolean>;
  surrender?: () => Promise<{ success: boolean; error?: string }>;
  onSkipRound?: () => Promise<boolean>;
}): Promise<{ success: boolean; error?: string }> {
  if (surrender) {
    return surrender();
  }
  if (isHost && onSkipRound) {
    const ok = await onSkipRound();
    return { success: ok };
  }
  if (isHost && skipRound) {
    const ok = await skipRound();
    return { success: ok };
  }
  return { success: false, error: "no_surrender_handler" };
}

export function GameView({
  roomRealtime,
  songLibrary = [],
  onLeaveRoom,
  onSkipRound,
}: GameViewProps): React.JSX.Element {
  const {
    roomCode,
    status,
    currentRound,
    totalRounds,
    gameMode,
    room,
    activeQuestion,
    buzzedPlayer,
    isMyBuzz,
    isExcludedFromBuzz,
    revealedSong,
    roundWinner,
    lastWrongGuess,
    players,
    myPlayer,
    isHost,
    isMuted,
    isAudioPlaying: realtimeIsAudioPlaying,
    setIsAudioPlaying: realtimeSetIsAudioPlaying,
    revealedHints,
    playerHintLevels,
    buzz,
    submitAnswer,
    nextRound,
    skipRound,
    surrender,
    requestHint,
    toggleMute,
    playAudio,
    pauseAudio,
  } = roomRealtime;

  const myHintLevel = resolvePlayerHintLevel(
    myPlayer?.id,
    playerHintLevels,
    revealedHints?.level
  );
  const pointsAvailable = calculatePointsAvailable(myHintLevel);
  const surrenderButtonConfig = getSurrenderButtonConfig(isHost);

  // Fallback song library fetch if not supplied by parent
  const [internalSongs, setInternalSongs] = useState<Song[]>(songLibrary || []);

  useEffect(() => {
    if (songLibrary && songLibrary.length > 0) {
      setInternalSongs(songLibrary);
      return;
    }
    let isMounted = true;
    fetch("/api/admin/songs?limit=200")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.songs)) {
          setInternalSongs(data.songs);
        }
      })
      .catch((err) => console.warn("[GameView] Autocomplete fallback songs fetch failed:", err));
    return () => {
      isMounted = false;
    };
  }, [songLibrary]);

  const effectiveSongLibrary = songLibrary && songLibrary.length > 0 ? songLibrary : internalSongs;

  // Hints resolution strictly per player
  const myPlayerHints =
    myPlayer?.id && roomRealtime.playerHints ? roomRealtime.playerHints[myPlayer.id] : undefined;
  const myHints = myPlayerHints || (myHintLevel > 0 ? revealedHints : undefined);

  // 15-second answer countdown timer (starts after slice audio finishes playing for the first time)
  const answerTimeLimit =
    roomRealtime.room?.settings?.roundTimeoutSec ||
    roomRealtime.room?.settings?.answerTimeLimit ||
    15;

  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);

  // Reset countdown on new round or status change
  useEffect(() => {
    setHasPlayedOnce(false);
    setCountdownRemaining(null);
  }, [currentRound, status]);

  // Safety timer to start countdown if audio autoplay is delayed or for AI lyrics modes
  useEffect(() => {
    if (status !== "question_active") {
      setCountdownRemaining(null);
      return;
    }

    if (gameMode === "ai-lyrics" || gameMode === "translated-lyrics") {
      const timer = setTimeout(() => {
        setHasPlayedOnce(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    const durationSec = activeQuestion?.durationSec || 2.0;
    const fallbackTimer = setTimeout(() => {
      setHasPlayedOnce(true);
    }, (durationSec + 1.5) * 1000);

    return () => clearTimeout(fallbackTimer);
  }, [status, currentRound, gameMode, activeQuestion?.durationSec]);

  const [isAudioPlaying, setIsAudioPlaying] = useState(Boolean(realtimeIsAudioPlaying));

  useEffect(() => {
    setIsAudioPlaying(Boolean(realtimeIsAudioPlaying));
  }, [realtimeIsAudioPlaying]);

  const handleSetIsAudioPlaying = useCallback(
    (playing: boolean) => {
      setIsAudioPlaying(playing);
      if (realtimeSetIsAudioPlaying) {
        realtimeSetIsAudioPlaying(playing);
      } else if (playing) {
        playAudio?.();
      } else {
        pauseAudio?.();
      }
    },
    [realtimeSetIsAudioPlaying, playAudio, pauseAudio]
  );

  const handleAudioEnded = useCallback(() => {
    handleSetIsAudioPlaying(false);
    setHasPlayedOnce(true);
  }, [handleSetIsAudioPlaying]);

  const handleToggleOrReplayAudio = useCallback(() => {
    toggleOrReplayAudio(audioRef.current, isAudioPlaying, handleSetIsAudioPlaying);
  }, [isAudioPlaying, handleSetIsAudioPlaying]);

  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isBuzzing, setIsBuzzing] = useState(false);
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [clickedWrongChoices, setClickedWrongChoices] = useState<string[]>([]);
  const [isSurrendering, setIsSurrendering] = useState(false);
  const isSkipping = isSurrendering;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset wrong choices when currentRound changes or status transitions
  useEffect(() => {
    setClickedWrongChoices([]);
  }, [currentRound, status]);

  // Sync wrong guess to clickedWrongChoices
  useEffect(() => {
    if (myPlayer && lastWrongGuess?.playerId === myPlayer.id && lastWrongGuess.answerText) {
      setClickedWrongChoices((prev) => {
        if (!prev.includes(lastWrongGuess.answerText)) {
          return [...prev, lastWrongGuess.answerText];
        }
        return prev;
      });
    }
  }, [lastWrongGuess, myPlayer]);

  const handleSurrender = useCallback(async () => {
    if (isSurrendering || isExcludedFromBuzz) return;
    setIsSurrendering(true);
    try {
      await executeSurrender({
        isHost,
        onSkipRound,
        surrender,
        skipRound,
      });
    } finally {
      setIsSurrendering(false);
    }
  }, [isSurrendering, isExcludedFromBuzz, isHost, onSkipRound, surrender, skipRound]);

  const handleSkipQuestion = handleSurrender;

  // Interval countdown after slice plays for the first time
  useEffect(() => {
    if (!hasPlayedOnce || status !== "question_active") {
      return;
    }

    setCountdownRemaining(answerTimeLimit);

    const timer = setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev === null) return answerTimeLimit;
        if (prev <= 1) {
          clearInterval(timer);
          if (!isExcludedFromBuzz) {
            handleSurrender();
          }
          return 0;
        }

        const nextVal = prev - 1;
        if (nextVal <= 5 && nextVal > 0) {
          try {
            soundEffects.countdownTick();
          } catch {}
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasPlayedOnce, status, answerTimeLimit, isExcludedFromBuzz, handleSurrender]);

  const handleRequestHint = useCallback(async () => {
    if (isRequestingHint) return;
    setIsRequestingHint(true);
    try {
      await requestHint();
    } finally {
      setIsRequestingHint(false);
    }
  }, [isRequestingHint, requestHint]);

  // 1. Master Volume Synchronization
  useEffect(() => {
    const applyVolume = (vol: number) => {
      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, vol));
        audioRef.current.muted = vol === 0 || isMasterMuted();
      }
    };
    applyVolume(getMasterVolume());
    return subscribeMasterVolume(applyVolume);
  }, []);

  // 1.5. Audio / TTS Playback Orchestration
  useEffect(() => {
    // Mode: AI Lyrics or Translated Lyrics
    if (gameMode === "ai-lyrics" || gameMode === "translated-lyrics") {
      if (status === "question_active" && activeQuestion?.lyrics && !isMasterMuted() && getMasterVolume() > 0) {
        ttsReader.speakLyrics(activeQuestion.lyrics, {
          gender: roomRealtime.room?.settings?.voiceGender,
          lang: gameMode === "translated-lyrics" ? "en-US" : "th-TH",
          volume: getMasterVolume(),
        });
      } else {
        ttsReader.stopSpeaking();
      }
      return;
    }

    // Mode: Audio Slice or Buzzer with audio slice URL
    if (status === "question_active" && activeQuestion?.sliceUrl && audioRef.current) {
      audioRef.current.volume = getMasterVolume();
      audioRef.current.muted = isMasterMuted() || getMasterVolume() === 0;
      if (isAudioPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn("[GameView] Audio play error (browser autoplay policy):", err);
        });
      } else {
        audioRef.current.pause();
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [status, gameMode, activeQuestion?.sliceUrl, activeQuestion?.lyrics, isAudioPlaying]);

  // Clean up audio & TTS on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      ttsReader.stopSpeaking();
    };
  }, []);

  // Handle buzzer press with in-flight guard (disabled for non-buzzer modes)
  const handleBuzzPress = useCallback(async () => {
    if (gameMode !== "buzzer" || isBuzzing) return;
    setIsBuzzing(true);
    try {
      await buzz();
    } finally {
      setIsBuzzing(false);
    }
  }, [buzz, isBuzzing, gameMode]);

  // Handle answer submission
  const handleSubmitAnswer = useCallback(
    async (answerText: string) => {
      if (!canSubmitAnswer(isExcludedFromBuzz)) return;
      setIsSubmittingAnswer(true);
      try {
        await submitAnswer(answerText);
      } finally {
        setIsSubmittingAnswer(false);
      }
    },
    [submitAnswer, isExcludedFromBuzz]
  );

  const answerInputMode = roomRealtime.room?.settings?.answerInputMode || "autocomplete";

  // Direct answer state for AI Lyrics mode
  const [directAnswer, setDirectAnswer] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const directInputRef = useRef<HTMLInputElement | null>(null);

  // Clear direct answer input on round or status change
  useEffect(() => {
    setDirectAnswer("");
    setHighlightedIndex(-1);
    setShowSuggestions(false);
  }, [currentRound, status]);

  // Autocomplete suggestions for direct answer mode
  const directSuggestions = useMemo(() => {
    if (answerInputMode !== "autocomplete" || !effectiveSongLibrary || effectiveSongLibrary.length === 0) {
      return [];
    }
    const query = directAnswer.trim();
    if (!query) {
      return [];
    }
    return searchSongAutocomplete(query, effectiveSongLibrary, 5);
  }, [answerInputMode, directAnswer, effectiveSongLibrary]);

  const handleSelectSuggestion = useCallback(
    (title: string) => {
      if (!canSubmitAnswer(isExcludedFromBuzz)) return;
      setDirectAnswer(title);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      handleSubmitAnswer(title);
    },
    [handleSubmitAnswer, isExcludedFromBuzz]
  );

  const handleChoiceSubmit = useCallback(
    async (choiceTitle: string) => {
      if (
        isExcludedFromBuzz ||
        isSubmittingAnswer ||
        clickedWrongChoices.includes(choiceTitle) ||
        status !== "question_active"
      ) {
        return;
      }
      await handleSubmitAnswer(choiceTitle);
    },
    [isExcludedFromBuzz, isSubmittingAnswer, clickedWrongChoices, status, handleSubmitAnswer]
  );

  const handleDirectAnswerSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (highlightedIndex >= 0 && directSuggestions[highlightedIndex]) {
        const selectedTitle = directSuggestions[highlightedIndex].title;
        setDirectAnswer(selectedTitle);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        handleSubmitAnswer(selectedTitle);
      } else {
        const trimmed = directAnswer.trim();
        if (!trimmed || isSubmittingAnswer || isExcludedFromBuzz || status !== "question_active") return;
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        handleSubmitAnswer(trimmed);
      }
    },
    [directAnswer, directSuggestions, highlightedIndex, handleSubmitAnswer, isSubmittingAnswer, isExcludedFromBuzz, status]
  );

  const handleDirectInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (answerInputMode === "autocomplete" && directSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setShowSuggestions(true);
          setHighlightedIndex((prev) => (prev + 1) % directSuggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setShowSuggestions(true);
          setHighlightedIndex((prev) => (prev - 1 + directSuggestions.length) % directSuggestions.length);
          return;
        }
        if (e.key === "Escape") {
          setShowSuggestions(false);
          setHighlightedIndex(-1);
          return;
        }
      }
    },
    [answerInputMode, directSuggestions.length]
  );

  // Handle next round trigger
  const handleNextRound = useCallback(async () => {
    setIsLoadingNext(true);
    try {
      await nextRound();
    } finally {
      setIsLoadingNext(false);
    }
  }, [nextRound]);

  // Buzzer status mapping
  const buzzerButtonStatus = resolveBuzzerStatus({
    status,
    isMyBuzz,
    buzzedPlayer,
    isExcludedFromBuzz,
  });

  // Sorted leaderboard for top ribbon
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => b.score - a.score);
  }, [players]);

  const modeLabel = getGameModeLabel(gameMode);
  const roundText = totalRounds > 0 ? `ข้อที่ ${currentRound}/${totalRounds}` : `ข้อที่ ${currentRound}`;

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0c0a09] text-stone-900 dark:text-white flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950 relative overflow-hidden transition-colors duration-200">
      {/* Background warm ambient gradients */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-1/4 w-96 h-96 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 dark:bg-orange-700/08 rounded-full blur-3xl pointer-events-none"
      />

      {/* Hidden Audio Player for question slice */}
      {activeQuestion?.sliceUrl && (
        <audio
          ref={(el) => {
            audioRef.current = el;
            if (el) {
              el.volume = getMasterVolume();
              el.muted = isMasterMuted() || el.volume === 0;
            }
          }}
          src={activeQuestion.sliceUrl}
          preload="auto"
          loop={shouldLoopAudio(gameMode)}
          onEnded={handleAudioEnded}
        />
      )}

      {/* ==================================================== */}
      {/* TOP HEADER: Round info, game mode badge, sound mute  */}
      {/* ==================================================== */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-stone-950/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800/80 px-4 py-3 sm:px-6 lg:py-4">
        <div className="max-w-6xl lg:max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Round Indicator & Mode Badge */}
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 lg:px-4 lg:py-1.5 bg-amber-500 rounded-full font-black text-xs sm:text-sm lg:text-base text-stone-950 shadow-md shadow-amber-500/20">
              {roundText}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 lg:px-4 lg:py-1.5 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full text-xs font-semibold text-stone-700 dark:text-stone-300">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {modeLabel}
            </span>
          </div>

          {/* Quick Player Scores Ribbon */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-[50%] sm:max-w-md lg:max-w-xl py-1 no-scrollbar">
            {sortedPlayers.slice(0, 4).map((p, idx) => {
              const isMe = myPlayer && p.id === myPlayer.id;
              const avatar = getDeterministicAvatar({ id: p.id, avatarUrl: p.avatarUrl });
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition ${
                    isMe
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50 shadow-sm"
                      : "bg-white/80 dark:bg-stone-900/90 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800"
                  }`}
                >
                  <span className="text-[13px] lg:text-base">{avatar}</span>
                  <span className="truncate max-w-[70px] sm:max-w-[90px] lg:max-w-[130px] lg:text-sm">{p.displayName}</span>
                  {idx === 0 && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                  <span className="px-1.5 lg:px-2 py-0.2 rounded bg-stone-100 dark:bg-stone-950 text-amber-600 dark:text-amber-400 font-mono text-[11px] lg:text-xs">
                    {p.score}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Settings Menu & Exit Button */}
          <div className="flex items-center gap-2 shrink-0">
            <SettingsMenu />

            {onLeaveRoom && (
              <button
                type="button"
                onClick={onLeaveRoom}
                aria-label="ออกจากห้องเล่นเกม"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-500 hover:text-rose-500 hover:border-rose-500/40 transition flex items-center justify-center touch-manipulation cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* CENTER STAGE: Gameplay arena                         */}
      {/* ==================================================== */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-4xl lg:max-w-5xl mx-auto w-full z-10">
        {/* Wrong Guess Feedback Banner */}
        <WrongGuessBanner wrongGuess={lastWrongGuess} showResumeCue={true} />

        {/* 1. Revealing state -> Show Round Reveal Card */}
        {status === "revealing" && (
          <RoundRevealCard
            song={revealedSong}
            winner={roundWinner}
            isHost={isHost}
            onNextRound={handleNextRound}
            isLoadingNext={isLoadingNext}
            currentRound={currentRound}
            totalRounds={totalRounds}
          />
        )}

        {/* 2. Question Active or Buzzed state -> Buzzer Arena */}
        {(status === "question_active" || status === "buzzed") && (
          <div className="w-full flex flex-col items-center justify-center gap-4">
            {/* Audio Wave / Lyrics Reading Visualization */}
            <div className="flex flex-col items-center gap-2 my-2 text-center">
              {gameMode === "ai-lyrics" || gameMode === "translated-lyrics" ? (
                <div className="max-w-lg lg:max-w-2xl p-4 lg:p-6 rounded-2xl bg-white/90 dark:bg-stone-900/90 border border-amber-500/40 shadow-lg text-amber-800 dark:text-amber-200">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    <Radio className="w-4 h-4 animate-pulse text-amber-500" />
                    <span>
                      {gameMode === "translated-lyrics"
                        ? "🌐 Google Translate Karaoke (เนื้อเพลงแปลอังกฤษ)"
                        : "AI กำลังอ่านท่อนเนื้อเพลง"}
                    </span>
                  </div>
                  <p className="text-base sm:text-lg lg:text-2xl font-semibold italic text-stone-900 dark:text-white drop-shadow">
                    &ldquo;{activeQuestion?.lyrics || "กำลังสตรีมเสียงเนื้อเพลง..."}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <div className="flex items-center gap-1.5 h-10 lg:h-12 px-4 lg:px-6 py-2 bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 rounded-full shadow-sm">
                    <Music className="w-4 h-4 text-amber-500 mr-1 shrink-0" />
                    <span className="text-xs lg:text-sm font-bold text-stone-600 dark:text-stone-400 mr-2">
                      {isAudioPlaying ? "กำลังเปิดเสียงตัวอย่าง..." : "เพลงหยุดชั่วคราว"}
                    </span>
                    {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3, 0.8].map((scale, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full transition-all duration-300 ${
                          isAudioPlaying
                            ? "bg-gradient-to-t from-amber-500 to-orange-400 animate-pulse"
                            : "bg-stone-300 dark:bg-stone-700 h-2"
                        }`}
                        style={{
                          height: isAudioPlaying ? `${Math.round(scale * 24)}px` : "6px",
                          animationDelay: `${i * 120}ms`,
                        }}
                      />
                    ))}
                  </div>

                  {gameMode === "audio-slice" && (
                    <button
                      type="button"
                      onClick={handleToggleOrReplayAudio}
                      aria-label={isAudioPlaying ? "หยุดเสียงตัวอย่างชั่วคราว" : "ฟังเสียงตัวอย่างซ้ำ"}
                      className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 bg-white/90 dark:bg-stone-900/90 hover:bg-amber-500/15 active:scale-95 border border-stone-200 dark:border-stone-800 hover:border-amber-500/40 text-stone-700 dark:text-stone-200 hover:text-amber-700 dark:hover:text-amber-300 font-bold text-xs lg:text-sm rounded-full shadow-sm transition touch-manipulation cursor-pointer"
                    >
                      {isAudioPlaying ? (
                        <>
                          <Pause className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>หยุดชั่วคราว</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>ฟังซ้ำ</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 15s Answer Countdown Timer Bar (starts after audio slice finishes playing for the first time) */}
            {countdownRemaining !== null && status === "question_active" && (
              <div className="w-full max-w-sm sm:max-w-md mx-auto my-1 px-4 py-2 rounded-2xl bg-white/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col gap-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
                    <Clock
                      className={`w-3.5 h-3.5 ${
                        countdownRemaining <= 5 ? "text-rose-500 animate-pulse" : "text-amber-500"
                      }`}
                    />
                    <span>เวลาตอบคำถาม</span>
                  </span>
                  <span
                    className={`font-mono text-xs sm:text-sm font-black ${
                      countdownRemaining <= 5 ? "text-rose-500 animate-bounce" : "text-amber-500"
                    }`}
                  >
                    {countdownRemaining} วินาที
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-1.5 sm:h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 rounded-full ${
                      countdownRemaining <= 5
                        ? "bg-gradient-to-r from-rose-500 to-red-600"
                        : "bg-gradient-to-r from-amber-400 to-amber-500"
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, (countdownRemaining / answerTimeLimit) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Progressive Hint Bar & Player Actions */}
            <div className="w-full max-w-lg lg:max-w-2xl flex flex-col items-center gap-2">
              {/* Revealed Hints Badges (Isolated for this player) */}
              {myHintLevel > 0 && (myHints?.genre || myHints?.year || myHints?.artist) && (
                <div className="flex flex-wrap items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                  {myHintLevel >= 1 && myHints?.genre && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                      <Tag className="w-3.5 h-3.5 text-emerald-500" />
                      <span>แนวเพลง: {myHints.genre}</span>
                    </span>
                  )}
                  {myHintLevel >= 2 && myHints?.year && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-800 dark:text-blue-300">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>{myHints.year}</span>
                    </span>
                  )}
                  {myHintLevel >= 3 && myHints?.artist && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-300">
                      <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                      <span>ศิลปิน: {myHints.artist}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Points Available & Player Actions */}
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-stone-400">
                  คะแนนตอบถูกรอบนี้:{" "}
                  <span className="text-amber-500 font-extrabold font-mono text-xs sm:text-sm">
                    {`+${pointsAvailable}`}
                  </span>
                </span>

                {shouldShowHintButton(myHintLevel, status) && (
                  <button
                    type="button"
                    onClick={handleRequestHint}
                    disabled={isRequestingHint}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 transition cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    {isRequestingHint ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>ขอคำใบ้ (ขั้นที่ {myHintLevel + 1}/3)</span>
                  </button>
                )}

                {shouldShowSurrenderButton(status) && (
                  <button
                    type="button"
                    onClick={handleSurrender}
                    disabled={isSurrendering || isExcludedFromBuzz}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-700 dark:text-rose-300 transition cursor-pointer touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                    title={surrenderButtonConfig.tooltip}
                  >
                    <Flag className="w-3.5 h-3.5 text-rose-500" />
                    <span>
                      {isSurrendering
                        ? "กำลังยอมแพ้..."
                        : surrenderButtonConfig.label}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {gameMode !== "buzzer" ? (
              <div className="w-full max-w-lg lg:max-w-2xl bg-white/95 dark:bg-stone-900/95 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-200">
                {/* Instructions cue */}
                <p className="text-xs lg:text-sm font-semibold text-amber-700 dark:text-amber-300/90 text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                  <span>
                    {gameMode === "audio-slice"
                      ? "ฟังเสียงเสี้ยววินาทีแล้วพิมพ์ชื่อเพลงได้ทันที ใครตอบถูกคนแรกชนะ!"
                      : "พิมพ์ชื่อเพลงและส่งคำตอบได้ทันที ใครตอบถูกคนแรกชนะ!"}
                  </span>
                </p>

                {/* Excluded feedback banner */}
                {isExcludedFromBuzz && (
                  <div className="w-full p-3 lg:p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-center shadow-sm">
                    <span>❌ คุณตอบผิดในข้อนี้แล้ว (รอข้อถัดไป)</span>
                  </div>
                )}

                {answerInputMode === "multiple-choice" ? (
                  <div className="w-full max-w-lg lg:max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-200">
                    {(activeQuestion?.choices || []).map((choice, idx) => {
                      const choiceLetter = ["A", "B", "C", "D"][idx] || `${idx + 1}`;
                      const isWrong = clickedWrongChoices.includes(choice.title);
                      return (
                        <button
                          key={choice.id || idx}
                          type="button"
                          disabled={isExcludedFromBuzz || isSubmittingAnswer || isWrong || status !== "question_active"}
                          onClick={() => handleChoiceSubmit(choice.title)}
                          className={`min-h-[58px] sm:min-h-[66px] p-4 rounded-2xl border-2 text-left flex items-center gap-3.5 transition-all cursor-pointer touch-manipulation shadow-md ${
                            isWrong
                              ? "bg-rose-500/10 border-rose-500/40 text-rose-400 line-through opacity-60 cursor-not-allowed"
                              : "bg-white/95 dark:bg-stone-900/95 border-stone-200 dark:border-stone-800 hover:border-amber-500 hover:bg-amber-500/10 active:scale-[0.98] text-stone-900 dark:text-white"
                          } disabled:cursor-not-allowed disabled:active:scale-100`}
                        >
                          <span
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner ${
                              isWrong
                                ? "bg-rose-500 text-white"
                                : "bg-amber-500 text-stone-950"
                            }`}
                          >
                            {isWrong ? "✕" : choiceLetter}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm sm:text-base truncate">{choice.title}</div>
                            <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{choice.artist}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Input form */
                  <form onSubmit={handleDirectAnswerSubmit} className="relative space-y-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 lg:pl-4 flex items-center pointer-events-none text-stone-400">
                        {answerInputMode === "autocomplete" ? (
                          <Search className="w-5 h-5 lg:w-6 lg:h-6" />
                        ) : (
                          <Music className="w-5 h-5 lg:w-6 lg:h-6" />
                        )}
                      </div>

                      <input
                        ref={directInputRef}
                        type="text"
                        value={directAnswer}
                        onChange={(e) => {
                          setDirectAnswer(e.target.value);
                          setHighlightedIndex(-1);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => {
                          setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        onKeyDown={handleDirectInputKeyDown}
                        disabled={isExcludedFromBuzz || isSubmittingAnswer || status !== "question_active"}
                        placeholder={
                          isExcludedFromBuzz
                            ? "คุณหมดสิทธิ์ตอบในข้อนี้แล้ว"
                            : answerInputMode === "autocomplete"
                            ? "พิมพ์ชื่อเพลง ศิลปิน หรือคำร้อง..."
                            : "พิมพ์ชื่อเพลงที่คิดว่าใช่..."
                        }
                        autoComplete="off"
                        className="w-full min-h-[48px] lg:min-h-[54px] pl-11 lg:pl-12 pr-4 py-3 bg-stone-50 dark:bg-stone-950/90 border-2 border-stone-300 dark:border-stone-700 focus:border-amber-500 rounded-2xl text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 font-medium focus:outline-none focus:ring-4 focus:ring-amber-500/20 text-base lg:text-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                      />
                    </div>

                    {/* Autocomplete Dropdown List */}
                    {answerInputMode === "autocomplete" && showSuggestions && directSuggestions.length > 0 && !isExcludedFromBuzz && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl p-1.5 max-h-48 overflow-y-auto space-y-1 shadow-2xl">
                        {directSuggestions.map((song, idx) => {
                          const isHighlighted = idx === highlightedIndex;
                          return (
                            <button
                              key={song.id || idx}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(song.title);
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between text-sm lg:text-base transition cursor-pointer ${
                                isHighlighted
                                  ? "bg-amber-500 text-stone-950 font-bold"
                                  : "hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-800 dark:text-stone-200"
                              }`}
                            >
                              <div className="truncate pr-2">
                                <div className="font-semibold truncate">{song.title}</div>
                                <div
                                  className={`text-xs truncate ${
                                    isHighlighted ? "text-stone-900" : "text-stone-500 dark:text-stone-400"
                                  }`}
                                >
                                  {song.artist}
                                </div>
                              </div>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full uppercase font-medium shrink-0 ${
                                  isHighlighted
                                    ? "bg-stone-950/20 text-stone-950"
                                    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                                }`}
                              >
                                เลือก
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={
                        !directAnswer.trim() ||
                        isExcludedFromBuzz ||
                        isSubmittingAnswer ||
                        status !== "question_active"
                      }
                      className="w-full min-h-[46px] lg:min-h-[52px] py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-stone-950 font-bold text-base lg:text-lg shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500 touch-manipulation"
                    >
                      {isSubmittingAnswer ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>กำลังตรวจสอบ...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          <span>ส่งคำตอบ</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* Giant Circular Buzzer Button */
              <BuzzerButton
                status={buzzerButtonStatus}
                buzzedPlayerName={buzzedPlayer?.displayName}
                onBuzz={handleBuzzPress}
                disabled={status !== "question_active" || isExcludedFromBuzz || isBuzzing}
              />
            )}
          </div>
        )}

        {/* 3. Game Over Screen */}
        {status === "game_over" && (
          <div className="w-full max-w-lg lg:max-w-2xl bg-white/95 dark:bg-stone-900/95 border-2 border-amber-400 rounded-3xl p-7 lg:p-9 text-center shadow-2xl flex flex-col items-center gap-5 animate-in zoom-in-95 duration-200">
            <div className="p-3 bg-amber-500/20 rounded-full text-amber-600 dark:text-amber-300">
              <Trophy className="w-12 h-12 animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-300 tracking-wide">
                จบการแข่งขัน!
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">สรุปคะแนนผู้ชนะประจำห้อง</p>
            </div>

            <div className="w-full space-y-2">
              {sortedPlayers.map((p, rank) => {
                const isWinner = rank === 0;
                const avatar = getDeterministicAvatar({ id: p.id, avatarUrl: p.avatarUrl });
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border ${
                      isWinner
                        ? "bg-amber-500/15 border-amber-400/80 text-amber-800 dark:text-amber-200 shadow-sm"
                        : "bg-stone-50 dark:bg-stone-950/80 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm w-5 text-stone-400">
                        #{rank + 1}
                      </span>
                      <span className="text-xl">{avatar}</span>
                      <span className="font-bold text-sm truncate max-w-[140px]">
                        {p.displayName}
                      </span>
                    </div>
                    <span className="font-mono font-black text-base text-amber-600 dark:text-amber-400">
                      {p.score} แต้ม
                    </span>
                  </div>
                );
              })}
            </div>

            {onLeaveRoom && (
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full min-h-[44px] py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer mt-2 touch-manipulation"
              >
                กลับสู่หน้าหลัก / ล็อบบี้
              </button>
            )}
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* ANSWER MODAL: Opened when current player buzzes      */}
      {/* ==================================================== */}
      <AnswerModal
        isOpen={Boolean(gameMode === "buzzer" && isMyBuzz && status === "buzzed")}
        onSubmitAnswer={handleSubmitAnswer}
        inputMode={answerInputMode}
        choices={activeQuestion?.choices}
        songLibrary={effectiveSongLibrary}
        isSubmitting={isSubmittingAnswer}
        timeRemainingSec={room?.settings?.roundTimeoutSec ?? 15}
      />

      {/* ==================================================== */}
      {/* BOTTOM BAR: Status cue pill                          */}
      {/* ==================================================== */}
      <footer className="p-3 lg:p-4 pb-safe text-center text-xs lg:text-sm text-stone-500 border-t border-stone-200 dark:border-stone-900 bg-white/80 dark:bg-stone-950/80">
        <p>
          ห้อง: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{roomCode}</span> •{" "}
          {status === "question_active"
            ? gameMode === "audio-slice"
              ? "ฟังเสียงเสี้ยววินาทีแล้วพิมพ์ชื่อเพลงได้ทันที ใครตอบถูกคนแรกชนะ!"
              : gameMode === "ai-lyrics" || gameMode === "translated-lyrics"
              ? "พิมพ์ชื่อเพลงและส่งคำตอบได้ทันที ใครตอบถูกคนแรกชนะ!"
              : "แตะกริ่งหรือกด Spacebar เพื่อแย่งตอบ"
            : status === "buzzed"
            ? "กำลังตอบคำถาม..."
            : status === "revealing"
            ? "เฉลยเพลงและผู้ชนะรอบ"
            : "รอเริ่มรอบถัดไป"}
        </p>
      </footer>
    </div>
  );
}

export default GameView;
