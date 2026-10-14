"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Round Reveal Card Component
// Displays revealed song metadata, winner points announcement,
// celebratory confetti effect, audio hook player and host round progression button
// ==========================================

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  Trophy,
  Clock,
  Play,
  Pause,
  ArrowRight,
  Disc3,
  Tag,
  Calendar,
  Loader2,
} from "lucide-react";
import type { Song, Player } from "@/types";
import { getMasterVolume, isMasterMuted, subscribeMasterVolume } from "@/lib/audio-volume";
import { getDeterministicAvatar } from "./player-card";

export interface RoundWinnerInfo {
  playerId: string;
  displayName: string;
  answerText: string;
  scoreDelta: number;
}

export interface RoundRevealCardProps {
  song: Partial<Song> | null;
  winner: RoundWinnerInfo | null;
  winners?: Array<{ playerId: string; displayName: string; scoreDelta: number }>;
  players?: Player[];
  currentPlayerId?: string;
  isHost: boolean;
  onNextRound: () => Promise<void>;
  isLoadingNext?: boolean;
  currentRound?: number;
  totalRounds?: number;
}

/**
 * Formats seconds into mm:ss string (e.g. 0 -> "00:00", 65 -> "01:05", 220 -> "03:40")
 */
export function formatTime(sec: number): string {
  if (typeof sec !== "number" || isNaN(sec) || !isFinite(sec) || sec < 0) {
    return "00:00";
  }
  const totalSec = Math.floor(sec);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Calculates initial hook seek position from song metadata.
 */
export function getInitialHookPosition(hookStartSec?: number | null): number {
  if (typeof hookStartSec === "number" && !isNaN(hookStartSec) && isFinite(hookStartSec) && hookStartSec > 0) {
    return hookStartSec;
  }
  return 0;
}

/**
 * Clamps seek time between 0 and maximum duration.
 */
export function clampSeekTime(time: number, duration: number): number {
  if (typeof time !== "number" || isNaN(time) || !isFinite(time) || time < 0) {
    return 0;
  }
  const maxDur = typeof duration === "number" && !isNaN(duration) && isFinite(duration) && duration > 0 ? duration : 0;
  if (time > maxDur) {
    return maxDur;
  }
  return time;
}

/**
 * Returns vinyl animation class based on playback state.
 * Empty string when playing so infinite spin runs, or paused state class when paused.
 */
export function getVinylAnimationClass(isPlaying: boolean): string {
  return isPlaying ? "" : "[animation-play-state:paused]";
}

/**
 * Sorts players descending by score for round reveal leaderboard.
 */
export function getSortedRevealPlayers(players: Player[] = []): Player[] {
  return [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Formats winner announcement headline.
 */
export function formatRoundWinnerAnnouncement(
  winner: RoundWinnerInfo | null,
  winners?: Array<{ playerId: string; displayName: string; scoreDelta: number }>
): string {
  if (winners && winners.length > 1) {
    return `🎉 ผู้ตอบถูกในรอบนี้ (${winners.length} คน)`;
  }
  if (winners && winners.length === 1) {
    const w = winners[0];
    const delta = typeof w.scoreDelta === "number" ? w.scoreDelta : 100;
    return `🎉 ${w.displayName} ตอบถูก! (+${delta} คะแนน)`;
  }
  if (!winner || !winner.displayName || !winner.playerId) {
    return "🏳️ ข้ามข้อนี้ / ไม่มีใครได้คะแนนในรอบนี้";
  }
  const delta = typeof winner.scoreDelta === "number" ? winner.scoreDelta : 100;
  return `🎉 ${winner.displayName} ตอบถูก! (+${delta} คะแนน)`;
}

export function RoundRevealCard({
  song,
  winner,
  winners,
  players = [],
  currentPlayerId,
  isHost,
  onNextRound,
  isLoadingNext = false,
  currentRound,
  totalRounds,
}: RoundRevealCardProps): React.JSX.Element {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(() =>
    getInitialHookPosition(song?.hookStartSec)
  );
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasMultiWinners = Boolean(winners && winners.length > 1);
  const hasWinner = Boolean(
    (winner && winner.displayName && winner.playerId) ||
    (winners && winners.length > 0)
  );
  const announcement = formatRoundWinnerAnnouncement(winner, winners);

  const sortedPlayers = useMemo(() => getSortedRevealPlayers(players), [players]);
  const top3Players = useMemo(() => sortedPlayers.slice(0, 3), [sortedPlayers]);
  const currentPlayerRank = useMemo(() => {
    if (!currentPlayerId) return -1;
    const idx = sortedPlayers.findIndex((p: Player) => p.id === currentPlayerId);
    return idx >= 0 ? idx + 1 : -1;
  }, [sortedPlayers, currentPlayerId]);
  const currentPlayer = useMemo(() => {
    if (!currentPlayerId) return undefined;
    return sortedPlayers.find((p: Player) => p.id === currentPlayerId);
  }, [sortedPlayers, currentPlayerId]);

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

  // Autoplay hook audio on reveal mount
  useEffect(() => {
    if (!audioRef.current || !song?.audioUrl) return;

    const startSec = getInitialHookPosition(song.hookStartSec);
    setCurrentTime(startSec);

    audioRef.current.currentTime = startSec;
    audioRef.current.volume = getMasterVolume();
    audioRef.current.muted = isMasterMuted() || getMasterVolume() === 0;
    const playPromise = audioRef.current.play();
    if (playPromise) {
      playPromise
        .then(() => setIsPlayingAudio(true))
        .catch((err) => {
          console.warn("[RoundRevealCard] Autoplay blocked by browser policy:", err);
          setIsPlayingAudio(false);
        });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [song?.audioUrl, song?.hookStartSec]);

  // Sync audio element volume with master volume in real-time
  useEffect(() => {
    const unsubscribe = subscribeMasterVolume((newVol) => {
      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, newVol));
        audioRef.current.muted = newVol === 0 || isMasterMuted();
      }
    });
    return () => unsubscribe();
  }, []);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Scrubbing/seeking audio
  const handleSeek = useCallback(
    (newTime: number) => {
      const clamped = clampSeekTime(newTime, duration || 100);
      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
    },
    [duration]
  );

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
        const startSec = getInitialHookPosition(song.hookStartSec);
        audioRef.current.currentTime = startSec;
        setCurrentTime(startSec);
      }
      audioRef.current.volume = getMasterVolume();
      audioRef.current.muted = isMasterMuted() || getMasterVolume() === 0;
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
      {/* Audio element for full hook playback and seeking */}
      {song?.audioUrl && (
        <audio
          ref={(el) => {
            audioRef.current = el;
            if (el) {
              el.volume = getMasterVolume();
              el.muted = isMasterMuted() || el.volume === 0;
            }
          }}
          src={song.audioUrl}
          loop
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (!isNaN(dur) && dur > 0) setDuration(dur);
          }}
          onDurationChange={(e) => {
            const dur = e.currentTarget.duration;
            if (!isNaN(dur) && dur > 0) setDuration(dur);
          }}
          onPlay={() => setIsPlayingAudio(true)}
          onPause={() => setIsPlayingAudio(false)}
          onEnded={() => setIsPlayingAudio(false)}
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

        {/* Multi-winner badge chips */}
        {hasMultiWinners && winners && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
            {winners.map((w) => (
              <span
                key={w.playerId}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-sm"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{w.displayName}</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  (+{w.scoreDelta || 100})
                </span>
              </span>
            ))}
          </div>
        )}

        {!hasMultiWinners && hasWinner && winner?.answerText && (
          <p className="text-xs sm:text-sm lg:text-base text-amber-200/90 font-medium">
            คำตอบที่ถูกต้อง: &ldquo;<span className="font-bold underline decoration-amber-400/50">{winner.answerText}</span>&rdquo;
          </p>
        )}
      </div>

      {/* Revealed Song Metadata Card */}
      <div className="flex flex-col sm:flex-row items-center gap-5 lg:gap-6 p-4 sm:p-5 lg:p-6 bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-inner">
        {/* Realistic Vinyl Record Disc */}
        <div
          className={`w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-stone-900 border-4 border-stone-700 shadow-xl relative flex items-center justify-center overflow-hidden shrink-0 select-none animate-[spin_6s_linear_infinite] ${getVinylAnimationClass(
            isPlayingAudio
          )}`}
          aria-hidden="true"
        >
          {/* Concentric vinyl groove rings */}
          <div className="absolute inset-2 rounded-full border border-stone-800" />
          <div className="absolute inset-4 rounded-full border border-stone-800/80" />
          <div className="absolute inset-6 rounded-full border border-stone-800/60" />

          {/* Vinyl Sheen/Gloss Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 pointer-events-none" />

          {/* Center sticker label */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500 flex items-center justify-center shadow-md relative">
            <Disc3 className="w-6 h-6 text-stone-950/80" />
            {/* Center spindle hole */}
            <div className="absolute w-2.5 h-2.5 rounded-full bg-stone-950 shadow-inner" />
          </div>
        </div>

        {/* Song Info & Seekable Audio Controls */}
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

          {/* Interactive Scrubbable Seek Bar & Playback Control */}
          {song?.audioUrl && (
            <div className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  aria-label={isPlayingAudio ? "หยุดเสียงท่อนฮุก" : "ฟังท่อนฮุกเต็ม"}
                  className={`inline-flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition shadow-sm active:scale-95 touch-manipulation cursor-pointer shrink-0 ${
                    isPlayingAudio
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30"
                      : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20"
                  }`}
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-white text-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-stone-950 text-stone-950 ml-0.5" />
                  )}
                </button>

                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono">
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-stone-500 dark:text-stone-400">
                      {duration > 0 ? formatTime(duration) : "--:--"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration > 0 ? duration : 100}
                    step="0.5"
                    value={Math.min(currentTime, duration > 0 ? duration : 100)}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    onInput={(e) => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
                    aria-label="แถบเลื่อนเวลาเพลง"
                    className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none touch-manipulation"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Round Reveal Leaderboard / Mini Scoreboard */}
      {sortedPlayers.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/90 border border-amber-500/30 shadow-lg text-white">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              <h4 className="text-sm sm:text-base font-extrabold text-amber-300">
                🏆 ตารางคะแนนล่าสุด (ใครกำลังนำอยู่)
              </h4>
            </div>
            <span className="text-[11px] font-bold text-stone-400 bg-stone-800 px-2 py-0.5 rounded-full">
              {sortedPlayers.length} ผู้เล่น
            </span>
          </div>

          <div className="space-y-2">
            {top3Players.map((p: Player, idx: number) => {
              const rank = idx + 1;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
              const isCurrent = currentPlayerId && p.id === currentPlayerId;
              const avatar = getDeterministicAvatar(p);

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition-all ${
                    isCurrent
                      ? "bg-amber-500/20 border border-amber-400/60 text-amber-200"
                      : "bg-stone-950/60 border border-stone-800/80 text-stone-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{medal}</span>
                    <span className="w-6 h-6 rounded-lg bg-stone-800 flex items-center justify-center text-sm shrink-0">
                      {avatar}
                    </span>
                    <span className="font-bold truncate max-w-[150px] sm:max-w-[200px]">
                      {p.displayName}
                      {isCurrent && " (คุณ)"}
                    </span>
                  </div>
                  <span className="font-mono font-black text-amber-400 shrink-0 ml-2">
                    {p.score ?? 0} แต้ม
                  </span>
                </div>
              );
            })}

            {/* If current player is outside top 3, show their rank as well */}
            {currentPlayerRank > 3 && currentPlayer && (
              <>
                <div className="text-center text-[10px] text-stone-500 py-0.5">• • •</div>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm bg-amber-500/20 border border-amber-400/60 text-amber-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs text-stone-400 w-5">
                      #{currentPlayerRank}
                    </span>
                    <span className="w-6 h-6 rounded-lg bg-stone-800 flex items-center justify-center text-sm shrink-0">
                      {getDeterministicAvatar(currentPlayer)}
                    </span>
                    <span className="font-bold truncate max-w-[150px] sm:max-w-[200px]">
                      {currentPlayer.displayName} (คุณ)
                    </span>
                  </div>
                  <span className="font-mono font-black text-amber-400 shrink-0 ml-2">
                    {currentPlayer.score ?? 0} แต้ม
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
