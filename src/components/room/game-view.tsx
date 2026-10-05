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
  Award,
  Crown,
} from "lucide-react";
import type { useRoomRealtime } from "@/hooks/use-room-realtime";
import type { Song, GameMode } from "@/types";
import { ttsReader } from "@/lib/tts-reader";
import { soundEffects } from "@/lib/sound-effects";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Audio / TTS Playback Orchestration
  useEffect(() => {
    // Mode: AI Lyrics
    if (gameMode === "ai-lyrics") {
      if (status === "question_active" && activeQuestion?.lyrics) {
        ttsReader.speakLyrics(activeQuestion.lyrics);
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

  // Clean up TTS on unmount
  useEffect(() => {
    return () => {
      ttsReader.stopSpeaking();
    };
  }, []);

  // Handle buzzer press
  const handleBuzzPress = useCallback(async () => {
    await buzz();
  }, [buzz]);

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

  const answerInputMode = roomRealtime.room?.settings?.answerInputMode || "autocomplete";
  const modeLabel = getGameModeLabel(gameMode);
  const roundText = totalRounds > 0 ? `ข้อที่ ${currentRound}/${totalRounds}` : `ข้อที่ ${currentRound}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-pink-500 selection:text-white relative overflow-hidden">
      {/* Background neon ambient gradients */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none"
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
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Round Indicator & Mode Badge */}
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full font-black text-xs sm:text-sm text-white shadow-md shadow-pink-500/20">
              {roundText}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-semibold text-slate-300">
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              {modeLabel}
            </span>
          </div>

          {/* Quick Player Scores Ribbon */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-[50%] sm:max-w-md py-1 no-scrollbar">
            {sortedPlayers.slice(0, 4).map((p, idx) => {
              const isMe = myPlayer && p.id === myPlayer.id;
              const avatar = getDeterministicAvatar({ id: p.id, avatarUrl: p.avatarUrl });
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition ${
                    isMe
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm"
                      : "bg-slate-900/90 text-slate-300 border border-slate-800"
                  }`}
                >
                  <span className="text-[13px]">{avatar}</span>
                  <span className="truncate max-w-[70px] sm:max-w-[90px]">{p.displayName}</span>
                  {idx === 0 && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span className="px-1.5 py-0.2 rounded bg-slate-950 text-amber-400 font-mono text-[11px]">
                    {p.score}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Audio Mute & Exit Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
              className={`p-2 rounded-xl border transition ${
                isMuted
                  ? "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                  : "bg-slate-900 border-pink-500/30 text-pink-400 shadow-sm"
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {onLeaveRoom && (
              <button
                type="button"
                onClick={onLeaveRoom}
                aria-label="ออกจากห้องเล่นเกม"
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
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
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-4xl mx-auto w-full z-10">
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
                <div className="max-w-lg p-4 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.2)] text-purple-200">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    <Radio className="w-4 h-4 animate-pulse text-purple-400" />
                    <span>AI กำลังอ่านท่อนเนื้อเพลง</span>
                  </div>
                  <p className="text-base sm:text-lg font-semibold italic text-white drop-shadow">
                    &ldquo;{activeQuestion?.lyrics || "กำลังสตรีมเสียงเนื้อเพลง..."}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 h-10 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-full">
                  <Music className="w-4 h-4 text-pink-400 mr-1" />
                  <span className="text-xs font-bold text-slate-400 mr-2">
                    {isAudioPlaying ? "กำลังเปิดเสียงตัวอย่าง..." : "เพลงหยุดชั่วคราว"}
                  </span>
                  {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3, 0.8].map((scale, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-300 ${
                        isAudioPlaying
                          ? "bg-gradient-to-t from-pink-500 to-purple-400 animate-pulse"
                          : "bg-slate-700 h-2"
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

            {/* Giant Circular Buzzer Button */}
            <BuzzerButton
              status={buzzerButtonStatus}
              buzzedPlayerName={buzzedPlayer?.displayName}
              onBuzz={handleBuzzPress}
              disabled={status !== "question_active" || isExcludedFromBuzz}
            />
          </div>
        )}

        {/* 3. Game Over Screen */}
        {status === "game_over" && (
          <div className="w-full max-w-lg bg-slate-900/95 border-2 border-amber-400 rounded-3xl p-7 text-center shadow-[0_0_60px_rgba(245,158,11,0.35)] flex flex-col items-center gap-5 animate-in zoom-in-95 duration-200">
            <div className="p-3 bg-amber-500/20 rounded-full text-amber-300">
              <Trophy className="w-12 h-12 animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wide">
                จบการแข่งขัน!
              </h2>
              <p className="text-sm text-slate-400 mt-1">สรุปคะแนนผู้ชนะประจำห้อง</p>
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
                        ? "bg-amber-500/20 border-amber-400/80 text-amber-200 shadow-md"
                        : "bg-slate-950/80 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm w-5 text-slate-400">
                        #{rank + 1}
                      </span>
                      <span className="text-xl">{avatar}</span>
                      <span className="font-bold text-sm truncate max-w-[140px]">
                        {p.displayName}
                      </span>
                    </div>
                    <span className="font-mono font-black text-base text-amber-400">
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
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-base shadow-lg hover:from-pink-400 hover:to-purple-500 transition active:scale-95 cursor-pointer mt-2"
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
        isOpen={Boolean(isMyBuzz && status === "buzzed")}
        onSubmitAnswer={handleSubmitAnswer}
        inputMode={answerInputMode}
        songLibrary={songLibrary}
        isSubmitting={isSubmittingAnswer}
        timeRemainingSec={10}
      />

      {/* ==================================================== */}
      {/* BOTTOM BAR: Status cue pill                          */}
      {/* ==================================================== */}
      <footer className="p-3 text-center text-xs text-slate-500 border-t border-slate-900 bg-slate-950/80">
        <p>
          ห้อง: <span className="font-mono font-bold text-pink-400">{roomCode}</span> •{" "}
          {status === "question_active"
            ? "แตะกริ่งหรือกด Spacebar เพื่อแย่งตอบ"
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
