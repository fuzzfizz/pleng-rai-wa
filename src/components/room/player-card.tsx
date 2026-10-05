"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Player Card Component
// Displays player avatar, host status, ready state & score
// ==========================================

import React from "react";
import type { Player } from "@/types";
import { Crown, Check, Clock, Trophy, Sparkles } from "lucide-react";

export interface PlayerCardProps {
  player: Player;
  isCurrentPlayer?: boolean;
}

export const DETERMINISTIC_AVATARS: string[] = [
  "🎧", "🎸", "🎤", "🎹", "🥁", "🎷", "🎺", "🎻", "🪕", "🎵",
  "🎶", "👾", "🦊", "🐱", "🐶", "🐼", "🦁", "🐯", "🐨", "🐸"
];

/**
 * Returns deterministic cheerful emoji or custom avatarUrl.
 */
export function getDeterministicAvatar(player: {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
}): string {
  if (player.avatarUrl && player.avatarUrl.trim().length > 0) {
    return player.avatarUrl.trim();
  }
  const seed = player.id || player.displayName || "player";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DETERMINISTIC_AVATARS.length;
  return DETERMINISTIC_AVATARS[index];
}

export interface PlayerStatusBadgeInfo {
  text: string;
  variant: "host" | "ready" | "waiting";
  colorClass: string;
}

/**
 * Derives player ready status badge label and style variants.
 */
export function getPlayerStatusBadge(player: Player): PlayerStatusBadgeInfo {
  if (player.isHost) {
    return {
      text: "👑 ผู้สร้างห้อง",
      variant: "host",
      colorClass: "bg-amber-500/15 border-amber-500/40 text-amber-300",
    };
  }
  if (player.isReady) {
    return {
      text: "✓ พร้อมแล้ว",
      variant: "ready",
      colorClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
    };
  }
  return {
    text: "รอสักครู่...",
    variant: "waiting",
    colorClass: "bg-slate-800/80 border-slate-700/60 text-slate-400",
  };
}

export function PlayerCard({ player, isCurrentPlayer = false }: PlayerCardProps): React.JSX.Element {
  const avatar = getDeterministicAvatar(player);
  const statusBadge = getPlayerStatusBadge(player);
  const isImageAvatar =
    avatar.startsWith("http://") ||
    avatar.startsWith("https://") ||
    avatar.startsWith("/");

  // Determine card container borders and glow
  let containerStyle = "border-slate-800 bg-slate-900/80 hover:border-slate-700/80";
  if (isCurrentPlayer) {
    containerStyle =
      "border-pink-500/50 bg-slate-900/95 ring-2 ring-pink-500/40 shadow-lg shadow-pink-500/10";
  } else if (player.isReady) {
    containerStyle =
      "border-emerald-500/40 bg-slate-900/90 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-500/5";
  }

  const displayName = isCurrentPlayer
    ? `${player.displayName} (คุณ)`
    : player.displayName;

  return (
    <div
      className={`relative p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 overflow-hidden ${containerStyle}`}
    >
      {/* Current player subtle gradient badge glow */}
      {isCurrentPlayer && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Left: Avatar & Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-slate-800 to-slate-700/60 border border-slate-700/50 shadow-inner overflow-hidden">
          {isImageAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={player.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl select-none" role="img" aria-label="avatar">
              {avatar}
            </span>
          )}

          {/* Mini Host Crown in Avatar corner */}
          {player.isHost && (
            <div
              title="Host"
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border border-amber-300 flex items-center justify-center shadow-sm"
            >
              <Crown className="w-3 h-3 text-slate-950 fill-slate-950" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold text-sm sm:text-base truncate ${
                isCurrentPlayer ? "text-pink-300" : "text-white"
              }`}
              title={displayName}
            >
              {displayName}
            </span>
          </div>

          {/* Score display */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
              <Trophy className="w-3 h-3" />
              <span>{player.score ?? 0} คะแนน</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Status Badge */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <div
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusBadge.colorClass}`}
        >
          {statusBadge.variant === "host" && <Crown className="w-3.5 h-3.5" />}
          {statusBadge.variant === "ready" && <Check className="w-3.5 h-3.5" />}
          {statusBadge.variant === "waiting" && <Clock className="w-3.5 h-3.5" />}
          <span>{statusBadge.text}</span>
        </div>
      </div>
    </div>
  );
}

export default PlayerCard;
