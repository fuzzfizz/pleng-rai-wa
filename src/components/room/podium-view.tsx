"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Animated Podium View
// Celebrates game winners with a 3-tier podium (1st, 2nd, 3rd),
// automatic confetti explosion, victory fanfare SFX,
// 4th+ runner-up rankings, and post-game host controls
// ==========================================

import React, { useState, useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { Trophy, Crown, RotateCcw, Home, LogOut, Sparkles, Award, Loader2, Users } from "lucide-react";
import type { Player } from "@/types";
import { soundEffects } from "@/lib/sound-effects";
import { getDeterministicAvatar } from "./player-card";

export interface PodiumViewProps {
  players: Player[];
  isHost?: boolean;
  onPlayAgain?: () => void | Promise<unknown>;
  onBackToLobby?: () => void | Promise<unknown>;
  onResetAllToLobby?: () => void | Promise<unknown>;
  onLeaveRoom?: () => void;
}

export interface PodiumMedalInfo {
  medal: string;
  label: string;
  colorClass: string;
  borderColorClass: string;
  glowClass: string;
}

/**
 * Returns rank styling and icons for podium rankings.
 */
export function getPodiumMedal(rank: number): PodiumMedalInfo {
  switch (rank) {
    case 1:
      return {
        medal: "👑",
        label: "อันดับ 1 (Champion)",
        colorClass: "text-amber-300 bg-amber-500/20",
        borderColorClass: "border-amber-400",
        glowClass: "shadow-[0_0_35px_rgba(245,158,11,0.5)]",
      };
    case 2:
      return {
        medal: "🥈",
        label: "อันดับ 2 (2nd Place)",
        colorClass: "text-slate-200 bg-slate-400/20",
        borderColorClass: "border-slate-300",
        glowClass: "shadow-[0_0_25px_rgba(203,213,225,0.4)]",
      };
    case 3:
      return {
        medal: "🥉",
        label: "อันดับ 3 (3rd Place)",
        colorClass: "text-amber-500 bg-amber-700/20",
        borderColorClass: "border-amber-600",
        glowClass: "shadow-[0_0_25px_rgba(217,119,6,0.35)]",
      };
    default:
      return {
        medal: `#${rank}`,
        label: `อันดับ ${rank}`,
        colorClass: "text-slate-400 bg-slate-800/40",
        borderColorClass: "border-slate-700",
        glowClass: "",
      };
  }
}

/**
 * Sorts players descending by score with stable tie-breaking:
 * primary: score DESC
 * secondary: displayName ASC
 * tertiary: id ASC
 */
export function getSortedPodiumPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;

    const nameA = a.displayName || "";
    const nameB = b.displayName || "";
    const nameDiff = nameA.localeCompare(nameB);
    if (nameDiff !== 0) return nameDiff;

    return (a.id || "").localeCompare(b.id || "");
  });
}

export function PodiumView({
  players,
  isHost = false,
  onPlayAgain,
  onBackToLobby,
  onResetAllToLobby,
  onLeaveRoom,
}: PodiumViewProps): React.JSX.Element {
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Sort players descending by score
  const sortedPlayers = useMemo(() => getSortedPodiumPlayers(players), [players]);

  const firstPlace = sortedPlayers[0] || null;
  const secondPlace = sortedPlayers[1] || null;
  const thirdPlace = sortedPlayers[2] || null;
  const runnersUp = sortedPlayers.slice(3);

  // Trigger celebration fanfare SFX and confetti bursts on mount
  useEffect(() => {
    try {
      soundEffects.victoryFanfare();
    } catch {
      // Audio context might be restricted before user gesture
    }

    if (typeof window !== "undefined") {
      try {
        // Initial center burst
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#F59E0B", "#EC4899", "#8B5CF6", "#10B981", "#3B82F6"],
        });

        // Left cannon burst
        const t1 = setTimeout(() => {
          try {
            confetti({
              particleCount: 70,
              angle: 60,
              spread: 55,
              origin: { x: 0, y: 0.65 },
              colors: ["#F59E0B", "#EAB308", "#FDE047"],
            });
          } catch {}
        }, 300);

        // Right cannon burst
        const t2 = setTimeout(() => {
          try {
            confetti({
              particleCount: 70,
              angle: 120,
              spread: 55,
              origin: { x: 1, y: 0.65 },
              colors: ["#EC4899", "#A855F7", "#3B82F6"],
            });
          } catch {}
        }, 500);

        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          try {
            confetti.reset?.();
          } catch {}
        };
      } catch {
        // Non-browser or canvas-unsupported environment
      }
    }
  }, []);

  const handlePlayAgain = async () => {
    if (!onPlayAgain || isProcessingAction) return;
    try {
      setIsProcessingAction(true);
      await onPlayAgain();
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleBackToLobby = async () => {
    if (!onBackToLobby || isProcessingAction) return;
    try {
      setIsProcessingAction(true);
      await onBackToLobby();
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleResetAllToLobby = async () => {
    if (!onResetAllToLobby || isProcessingAction) return;
    try {
      setIsProcessingAction(true);
      await onResetAllToLobby();
    } finally {
      setIsProcessingAction(false);
    }
  };

  const renderPodiumAvatar = (player: Player, rank: 1 | 2 | 3) => {
    const avatar = getDeterministicAvatar(player);
    const isImage =
      avatar.startsWith("http://") ||
      avatar.startsWith("https://") ||
      avatar.startsWith("/");

    const sizeClasses = {
      1: "w-[72px] h-[72px] sm:w-[104px] sm:h-[104px] md:w-32 md:h-32 text-3xl sm:text-4xl md:text-5xl border-3 sm:border-4 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.5)]",
      2: "w-14 h-14 sm:w-[88px] sm:h-[88px] md:w-28 md:h-28 text-2xl sm:text-3xl md:text-4xl border-2 sm:border-4 border-slate-300 shadow-[0_0_25px_rgba(203,213,225,0.4)]",
      3: "w-12 h-12 sm:w-[72px] sm:h-[72px] md:w-24 md:h-24 text-xl sm:text-2xl md:text-3xl border-2 sm:border-4 border-amber-600 shadow-[0_0_25px_rgba(217,119,6,0.35)]",
    }[rank];

    return (
      <div className="relative flex flex-col items-center">
        {/* Crown on 1st place */}
        {rank === 1 && (
          <div className="absolute -top-6 sm:-top-11 z-20 flex items-center justify-center animate-bounce">
            <span className="text-3xl sm:text-5xl select-none filter drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
              👑
            </span>
          </div>
        )}

        {/* Medal on 2nd and 3rd place */}
        {rank === 2 && (
          <div className="absolute -top-5 sm:-top-8 z-20">
            <span className="text-xl sm:text-3xl select-none filter drop-shadow">🥈</span>
          </div>
        )}
        {rank === 3 && (
          <div className="absolute -top-5 sm:-top-8 z-20">
            <span className="text-lg sm:text-3xl select-none filter drop-shadow">🥉</span>
          </div>
        )}

        {/* Avatar circle */}
        <div
          className={`relative rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center bg-slate-900 transition-transform duration-300 hover:scale-105 ${sizeClasses}`}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={player.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="select-none" role="img" aria-label="avatar">
              {avatar}
            </span>
          )}
        </div>

        {/* Player Name */}
        <div className="mt-2 sm:mt-3 text-center w-full max-w-[95px] sm:max-w-[160px] md:max-w-[200px]">
          <p
            className={`font-black truncate ${
              rank === 1
                ? "text-xs sm:text-xl md:text-2xl text-amber-200"
                : rank === 2
                ? "text-[11px] sm:text-lg md:text-xl text-slate-100"
                : "text-[11px] sm:text-base md:text-lg text-amber-400"
            }`}
            title={player.displayName}
          >
            {player.displayName}
          </p>
          <div className="mt-1 flex items-center justify-center">
            <span
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-extrabold border ${
                rank === 1
                  ? "bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  : rank === 2
                  ? "bg-slate-400/25 text-slate-200 border-slate-300/50"
                  : "bg-amber-700/25 text-amber-400 border-amber-600/50"
              }`}
            >
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{player.score ?? 0} คะแนน</span>
            </span>
          </div>

          {/* LoL-style individual lobby ready badge */}
          {player.isLobbyReady && (
            <div className="mt-1 flex items-center justify-center">
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                ⏳ รอกลับห้องแล้ว
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full min-h-screen min-h-[100dvh] max-w-5xl mx-auto flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 select-none pt-safe pb-safe overflow-x-hidden max-w-full">
      {/* Ambient background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-60 sm:w-72 h-60 sm:h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-60 sm:w-72 h-60 sm:h-72 bg-amber-600/08 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Header Banner */}
      <div className="text-center mb-4 sm:mb-10 z-10 w-full max-w-full px-2">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] sm:text-sm font-bold uppercase tracking-wider mb-2 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-amber-400" />
          <span>จบการแข่งขัน • Game Over</span>
        </div>
        <h1 className="text-2xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 tracking-tight">
          แท่นรับรางวัล (Podium)
        </h1>
        <p className="text-xs sm:text-base text-slate-300 mt-1 sm:mt-2 font-medium">
          ขอแสดงความยินดีกับผู้ชนะและผู้ร่วมสนุกทุกคน!
        </p>
      </div>

      {/* Top 3 Podium Platform */}
      {sortedPlayers.length === 0 ? (
        <div className="p-8 my-10 bg-slate-900/60 border border-slate-800 rounded-3xl text-center text-slate-400">
          <p className="text-lg">ยังไม่มีข้อมูลผู้เล่นหรือคะแนนในการแข่งขัน</p>
        </div>
      ) : (
        <div className="w-full max-w-full flex items-end justify-center gap-1.5 sm:gap-3 md:gap-6 my-4 sm:my-10 px-1 sm:px-2 z-10">
          {/* 2nd Place (Left) */}
          <div className="flex-1 min-w-0 max-w-[105px] sm:max-w-[200px] md:max-w-[240px] flex flex-col items-center">
            {secondPlace ? (
              renderPodiumAvatar(secondPlace, 2)
            ) : (
              <div className="h-28 sm:h-36 opacity-30 flex items-center justify-center text-slate-500 text-xs">
                ไม่มีผู้เล่น
              </div>
            )}
            {/* Pedestal Box 2 */}
            <div className="w-full h-32 sm:h-48 md:h-60 mt-2 sm:mt-4 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700/80 border-t-4 border-x border-slate-300/80 shadow-[0_0_30px_rgba(203,213,225,0.2)] flex flex-col items-center justify-start pt-3 sm:pt-6">
              <span className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-300 tracking-wider">
                2
              </span>
              <span className="text-[10px] sm:text-sm font-bold text-slate-400 mt-0.5 sm:mt-1">อันดับ 2</span>
            </div>
          </div>

          {/* 1st Place (Center / Tallest) */}
          <div className="flex-1 min-w-0 max-w-[125px] sm:max-w-[230px] md:max-w-[280px] flex flex-col items-center">
            {firstPlace ? (
              renderPodiumAvatar(firstPlace, 1)
            ) : (
              <div className="h-36 sm:h-44 opacity-30 flex items-center justify-center text-slate-500 text-xs">
                ไม่มีผู้เล่น
              </div>
            )}
            {/* Pedestal Box 1 (Tallest Gold) */}
            <div className="w-full h-44 sm:h-64 md:h-80 mt-2 sm:mt-4 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-t from-amber-950/80 via-amber-900/60 to-amber-500/40 border-t-4 border-x border-amber-400 shadow-[0_0_45px_rgba(245,158,11,0.4)] flex flex-col items-center justify-start pt-4 sm:pt-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent animate-pulse pointer-events-none" />
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Crown className="w-4 h-4 sm:w-8 sm:h-8 text-amber-300 fill-amber-300" />
                <span className="text-4xl sm:text-6xl md:text-7xl font-black text-amber-300 tracking-wider drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]">
                  1
                </span>
              </div>
              <span className="text-[11px] sm:text-base font-extrabold text-amber-200 mt-0.5 sm:mt-1 uppercase tracking-widest">
                แชมเปี้ยน
              </span>
            </div>
          </div>

          {/* 3rd Place (Right) */}
          <div className="flex-1 min-w-0 max-w-[105px] sm:max-w-[200px] md:max-w-[240px] flex flex-col items-center">
            {thirdPlace ? (
              renderPodiumAvatar(thirdPlace, 3)
            ) : (
              <div className="h-24 sm:h-32 opacity-30 flex items-center justify-center text-slate-500 text-xs">
                ไม่มีผู้เล่น
              </div>
            )}
            {/* Pedestal Box 3 */}
            <div className="w-full h-24 sm:h-36 md:h-48 mt-2 sm:mt-4 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-t from-slate-900 via-amber-950/60 to-amber-800/40 border-t-4 border-x border-amber-600/80 shadow-[0_0_25px_rgba(217,119,6,0.2)] flex flex-col items-center justify-start pt-2 sm:pt-5">
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-amber-500 tracking-wider">
                3
              </span>
              <span className="text-[10px] sm:text-sm font-bold text-amber-400 mt-0.5 sm:mt-1">อันดับ 3</span>
            </div>
          </div>
        </div>
      )}

      {/* Runners-up / 4th Place and below list */}
      {runnersUp.length > 0 && (
        <div className="w-full max-w-2xl mt-6 sm:mt-8 mb-4 sm:mb-6 z-10 px-1">
          <div className="flex items-center gap-2 mb-3 px-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-base sm:text-lg font-bold text-stone-800 dark:text-stone-200">
              อันดับผู้ร่วมแข่งขันอื่นๆ ({runnersUp.length} คน)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {runnersUp.map((player, idx) => {
              const rank = idx + 4;
              const avatar = getDeterministicAvatar(player);
              const isImage =
                avatar.startsWith("http://") ||
                avatar.startsWith("https://") ||
                avatar.startsWith("/");

              return (
                <div
                  key={player.id || idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800/90 shadow-sm backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-stone-400 w-5 sm:w-6 text-center">
                      #{rank}
                    </span>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-stone-200 dark:border-stone-700 shrink-0">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt={player.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg sm:text-xl select-none">{avatar}</span>
                      )}
                    </div>
                    <span
                      className="font-bold text-xs sm:text-sm text-stone-800 dark:text-slate-200 truncate"
                      title={player.displayName}
                    >
                      {player.displayName}
                    </span>
                  </div>

                  <div className="shrink-0 pl-2 flex items-center gap-1.5">
                    {player.isLobbyReady && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                        ⏳ อยู่ในล็อบบี้
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                      <Trophy className="w-3 h-3" />
                      <span>{player.score ?? 0}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post-Game Actions */}
      <div className="w-full max-w-xl flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-6 sm:mt-8 z-10 px-2">
        {isHost && onPlayAgain && (
          <button
            type="button"
            onClick={handlePlayAgain}
            disabled={isProcessingAction}
            className="w-full sm:w-auto flex-1 min-w-[150px] min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-sm sm:text-base shadow-md shadow-amber-500/20 transition transform active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>เริ่มเกมใหม่ (Play Again)</span>
          </button>
        )}

        {isHost && onResetAllToLobby && (
          <button
            type="button"
            onClick={handleResetAllToLobby}
            disabled={isProcessingAction}
            className="w-full sm:w-auto flex-1 min-w-[150px] min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-bold text-sm sm:text-base transition transform active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation"
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            <span>พาทุกคนกลับล็อบบี้</span>
          </button>
        )}

        {onBackToLobby && (
          <button
            type="button"
            onClick={handleBackToLobby}
            disabled={isProcessingAction}
            className={`w-full sm:w-auto flex-1 min-w-[150px] min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition transform active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation ${
              isHost
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20"
            }`}
          >
            {isProcessingAction ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>กำลังกลับล็อบบี้...</span>
              </>
            ) : (
              <>
                <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>กลับสู่ห้องล็อบบี้ (Back to Lobby)</span>
              </>
            )}
          </button>
        )}

        {/* All players: Leave Room */}
        {onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            disabled={isProcessingAction}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-bold text-sm sm:text-base transition transform active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากห้อง</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default PodiumView;
