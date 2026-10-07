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
} from "lucide-react";
import type { useRoomRealtime } from "@/hooks/use-room-realtime";
import type { Song, GameMode } from "@/types";
import { ttsReader } from "@/lib/tts-reader";
import { searchSongAutocomplete } from "@/lib/answer-checker";
import { BuzzerButton, resolveBuzzerStatus } from "./buzzer-button";
import { AnswerModal } from "./answer-modal";
import { WrongGuessBanner } from "./wrong-guess-banner";
import { RoundRevealCard } from "./round-reveal-card";
import { getDeterministicAvatar } from "./player-card";

export interface GameViewProps {
  roomRealtime: ReturnType<typeof useRoomRealtime>;
  songLibrary?: Song[];
  onLeaveRoom?: () => void;
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
    case "audio-slice":
    default:
      return "โหมด ตัดเสียงเสี้ยววินาที";
  }
}

export function GameView({
  roomRealtime,
  songLibrary = [],
  onLeaveRoom,
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
    isAudioPlaying,
    buzz,
    submitAnswer,
    nextRound,
    toggleMute,
  } = roomRealtime;

  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isBuzzing, setIsBuzzing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Audio / TTS Playback Orchestration
  useEffect(() => {
    // Mode: AI Lyrics
    if (gameMode === "ai-lyrics") {
      if (status === "question_active" && activeQuestion?.lyrics) {
        ttsReader.speakLyrics(activeQuestion.lyrics, {
          gender: roomRealtime.room?.settings?.voiceGender,
        });
      } else {
        ttsReader.stopSpeaking();
      }
      return;
    }

    // Mode: Audio Slice or Buzzer with audio slice URL
    if (status === "question_active" && activeQuestion?.sliceUrl && audioRef.current) {
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

  // Handle buzzer press with in-flight guard (disabled in AI lyrics mode)
  const handleBuzzPress = useCallback(async () => {
    if (gameMode === "ai-lyrics" || isBuzzing) return;
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
      setIsSubmittingAnswer(true);
      try {
        await submitAnswer(answerText);
      } finally {
        setIsSubmittingAnswer(false);
      }
    },
    [submitAnswer]
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
    if (answerInputMode !== "autocomplete" || !songLibrary || songLibrary.length === 0) {
      return [];
    }
    const query = directAnswer.trim();
    if (!query) {
      return [];
    }
    return searchSongAutocomplete(query, songLibrary, 5);
  }, [answerInputMode, directAnswer, songLibrary]);

  const handleSelectSuggestion = useCallback(
    (title: string) => {
      setDirectAnswer(title);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      handleSubmitAnswer(title);
    },
    [handleSubmitAnswer]
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
          ref={audioRef}
          src={activeQuestion.sliceUrl}
          preload="auto"
          loop={gameMode === "buzzer"}
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

          {/* Audio Mute & Exit Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition touch-manipulation cursor-pointer ${
                isMuted
                  ? "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-sm"
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

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
              {gameMode === "ai-lyrics" ? (
                <div className="max-w-lg lg:max-w-2xl p-4 lg:p-6 rounded-2xl bg-white/90 dark:bg-stone-900/90 border border-amber-500/40 shadow-lg text-amber-800 dark:text-amber-200">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    <Radio className="w-4 h-4 animate-pulse text-amber-500" />
                    <span>AI กำลังอ่านท่อนเนื้อเพลง</span>
                  </div>
                  <p className="text-base sm:text-lg lg:text-2xl font-semibold italic text-stone-900 dark:text-white drop-shadow">
                    &ldquo;{activeQuestion?.lyrics || "กำลังสตรีมเสียงเนื้อเพลง..."}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 h-10 lg:h-12 px-4 lg:px-6 py-2 bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 rounded-full shadow-sm">
                  <Music className="w-4 h-4 text-amber-500 mr-1" />
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
              )}
            </div>

            {gameMode === "ai-lyrics" ? (
              <div className="w-full max-w-lg lg:max-w-2xl bg-white/95 dark:bg-stone-900/95 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-200">
                {/* Instructions cue */}
                <p className="text-xs lg:text-sm font-semibold text-amber-700 dark:text-amber-300/90 text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                  <span>พิมพ์ชื่อเพลงและส่งคำตอบได้ทันที ใครตอบถูกคนแรกชนะ!</span>
                </p>

                {/* Excluded feedback banner */}
                {isExcludedFromBuzz && (
                  <div className="w-full p-3 lg:p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-center shadow-sm">
                    <span>❌ คุณตอบผิดในข้อนี้แล้ว (รอข้อถัดไป)</span>
                  </div>
                )}

                {/* Input form */}
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
        isOpen={Boolean(gameMode !== "ai-lyrics" && isMyBuzz && status === "buzzed")}
        onSubmitAnswer={handleSubmitAnswer}
        inputMode={answerInputMode}
        songLibrary={songLibrary}
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
            ? gameMode === "ai-lyrics"
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
