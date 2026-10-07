"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Round Reveal Card Component
// Displays revealed song metadata, winner points announcement,
// celebratory confetti effect, audio hook player and host round progression button
// ==========================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Trophy,
  Clock,
  Play,
  Pause,
  ArrowRight,
  Disc,
  Tag,
  Calendar,
  Loader2,
} from "lucide-react";
import type { Song } from "@/types";

export interface RoundWinnerInfo {
  playerId: string;
  displayName: string;
  answerText: string;
  scoreDelta: number;
}

export interface RoundRevealCardProps {
  song: Partial<Song> | null;
  winner: RoundWinnerInfo | null;
  isHost: boolean;
  onNextRound: () => Promise<void>;
  isLoadingNext?: boolean;
  currentRound?: number;
  totalRounds?: number;
}

/**
 * Formats winner announcement headline.
 */
export function formatRoundWinnerAnnouncement(
  winner: RoundWinnerInfo | null
): string {
  if (!winner || !winner.displayName) {
    return "⏱️ ไม่มีใครตอบถูกในข้อนี้!";
  }
  const delta = typeof winner.scoreDelta === "number" ? winner.scoreDelta : 100;
  return `🎉 ${winner.displayName} ตอบถูก! (+${delta} คะแนน)`;
}

export function RoundRevealCard({
  song,
  winner,
  isHost,
  onNextRound,
  isLoadingNext = false,
  currentRound,
  totalRounds,
}: RoundRevealCardProps): React.JSX.Element {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasWinner = Boolean(winner && winner.displayName);
  const announcement = formatRoundWinnerAnnouncement(winner);

  const isFinalRound = Boolean(
    currentRound && totalRounds && totalRounds > 0 && currentRound >= totalRounds
  );

  // Trigger confetti burst on mount / winner change
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        confetti({
          particleCount: hasWinner ? 100 : 35,
          spread: 75,
          origin: { y: 0.6 },
          colors: hasWinner
            ? ["#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#8b5cf6"]
            : ["#94a3b8", "#cbd5e1", "#64748b"],
        });
      }
    } catch {}
  }, [hasWinner]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Audio hook player toggling
  const handleToggleAudio = useCallback(() => {
    if (!audioRef.current || !song?.audioUrl) return;

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      if (
        audioRef.current.currentTime === 0 &&
        typeof song.hookStartSec === "number" &&
        song.hookStartSec > 0
      ) {
        audioRef.current.currentTime = song.hookStartSec;
      }
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((err) => {
          console.warn("[RoundRevealCard] Audio playback failed:", err);
          setIsPlayingAudio(false);
        });
    }
  }, [isPlayingAudio, song]);

  return (
    <div className="w-full max-w-xl lg:max-w-2xl mx-auto my-4 bg-slate-900/95 border-2 border-amber-400/80 rounded-3xl p-6 sm:p-7 lg:p-8 shadow-[0_0_60px_rgba(245,158,11,0.3)] text-white flex flex-col gap-6 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      {/* Hidden audio element for full hook playback */}
      {song?.audioUrl && (
        <audio
          ref={audioRef}
          src={song.audioUrl}
          onEnded={() => setIsPlayingAudio(false)}
          onPause={() => setIsPlayingAudio(false)}
          preload="metadata"
        />
      )}

      {/* Winner Announcement Banner */}
      <div
        className={`p-4 lg:p-5 rounded-2xl border text-center transition-all ${
          hasWinner
            ? "bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.25)]"
            : "bg-slate-800/80 border-slate-700/80 text-slate-300"
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {hasWinner ? (
            <Trophy className="w-6 h-6 lg:w-7 lg:h-7 text-amber-400 animate-bounce" />
          ) : (
            <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-slate-400" />
          )}
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-amber-300 tracking-wide">
            {announcement}
          </h3>
        </div>

        {hasWinner && winner?.answerText && (
          <p className="text-xs sm:text-sm lg:text-base text-amber-200/90 font-medium">
            คำตอบที่ถูกต้อง: &ldquo;<span className="font-bold underline decoration-amber-400/50">{winner.answerText}</span>&rdquo;
          </p>
        )}
      </div>

      {/* Revealed Song Metadata Card */}
      <div className="flex flex-col sm:flex-row items-center gap-5 lg:gap-6 p-4 sm:p-5 lg:p-6 bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-inner">
        {/* Vinyl / Cover Art Graphic */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-2xl bg-gradient-to-br from-amber-600 via-amber-500 to-orange-600 p-0.5 shadow-md shrink-0 flex items-center justify-center group overflow-hidden">
          <div className="w-full h-full bg-stone-100 dark:bg-stone-950 rounded-2xl flex items-center justify-center relative overflow-hidden">
            <Disc
              className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-amber-600 dark:text-amber-400 transition-transform duration-1000 ${
                isPlayingAudio ? "animate-spin" : "group-hover:rotate-45"
              }`}
            />
            {isPlayingAudio && (
              <span className="absolute inset-0 bg-amber-500/20 animate-pulse pointer-events-none" />
            )}
          </div>
        </div>

        {/* Song Info */}
        <div className="flex-1 text-center sm:text-left overflow-hidden w-full">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
            {song?.genre?.nameTh && (
              <span className="inline-flex items-center gap-1 text-[11px] lg:text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Tag className="w-3 h-3" />
                {song.genre.nameTh}
              </span>
            )}
            {song?.releaseYear && (
              <span className="inline-flex items-center gap-1 text-[11px] lg:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
                <Calendar className="w-3 h-3 text-stone-500 dark:text-slate-400" />
                ปี {song.releaseYear}
              </span>
            )}
            {song?.era && (
              <span className="text-[11px] lg:text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                ยุค {song.era}
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-stone-900 dark:text-white truncate drop-shadow-sm">
            {song?.title || "ไม่ทราบชื่อเพลง"}
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-stone-600 dark:text-slate-300 font-medium truncate mt-0.5">
            ศิลปิน: <span className="text-amber-700 dark:text-amber-400 font-semibold">{song?.artist || "ไม่ระบุศิลปิน"}</span>
          </p>

          {/* Audio Hook Player Button */}
          {song?.audioUrl && (
            <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={handleToggleAudio}
                aria-label={isPlayingAudio ? "หยุดเสียงท่อนฮุก" : "ฟังท่อนฮุกเต็ม"}
                className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-xs sm:text-sm font-bold transition shadow-sm active:scale-95 touch-manipulation cursor-pointer ${
                  isPlayingAudio
                    ? "bg-rose-500 text-white shadow-rose-500/30"
                    : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700"
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>หยุดเสียง</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>ฟังท่อนฮุกเต็ม</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action / Next Round Progression */}
      <div className="pt-1">
        {isHost ? (
          <button
            type="button"
            onClick={onNextRound}
            disabled={isLoadingNext}
            className={`w-full min-h-[48px] py-3.5 lg:py-4 px-6 rounded-2xl font-black text-base lg:text-lg flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] shadow-md touch-manipulation ${
              isLoadingNext
                ? "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-slate-500 cursor-not-allowed border border-stone-300 dark:border-stone-700"
                : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20 cursor-pointer"
            }`}
          >
            {isLoadingNext ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>กำลังเตรียมข้อถัดไป...</span>
              </>
            ) : isFinalRound ? (
              <>
                <span>ดูผลสรุปการแข่งขัน (Game Over)</span>
                <Trophy className="w-5 h-5 text-stone-950" />
              </>
            ) : (
              <>
                <span>ข้อถัดไป (Next Round)</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        ) : (
          <div className="w-full py-3.5 px-4 bg-stone-100 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-2xl flex items-center justify-center gap-2.5 text-stone-600 dark:text-slate-400 text-sm font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>รอ Host เริ่มข้อถัดไป...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoundRevealCard;
