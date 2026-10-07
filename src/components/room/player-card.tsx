"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Player Card Component
// Displays player avatar, host status, ready state & score
// ==========================================

import React from "react";
import type { Player } from "@/types";
import { Crown, Clock, Trophy } from "lucide-react";

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
      colorClass: "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300",
    };
  }
  if (player.isReady) {
    return {
      text: "✓ พร้อมแล้ว",
      variant: "ready",
      colorClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300",
    };
  }
  return {
    text: "รอสักครู่...",
    variant: "waiting",
    colorClass: "bg-stone-200/80 dark:bg-stone-800/80 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-slate-300",
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
  let containerStyle =
    "border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/80 hover:border-stone-300 dark:hover:border-stone-700/80 shadow-sm";
  if (isCurrentPlayer) {
    containerStyle =
      "border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/10";
  } else if (player.isReady) {
    containerStyle =
      "border-emerald-500/40 bg-white/95 dark:bg-stone-900/90 ring-1 ring-emerald-500/30 shadow-sm";
  }

  const displayName = isCurrentPlayer
    ? `${player.displayName} (คุณ)`
    : player.displayName;

  return (
    <div
      className={`relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 sm:gap-4 overflow-hidden ${containerStyle}`}
    >
      {/* Current player subtle gradient badge glow */}
      {isCurrentPlayer && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Left: Avatar container */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700/50 shadow-inner overflow-hidden">
          {isImageAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={player.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl lg:text-3xl select-none" role="img" aria-label="avatar">
              {avatar}
            </span>
          )}
        </div>

        {/* Mini Host Crown in Avatar corner */}
        {player.isHost && (
          <div
            title="ผู้สร้างห้อง"
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border border-white dark:border-stone-900 flex items-center justify-center shadow-sm z-10"
          >
            <Crown className="w-3 h-3 text-stone-950 fill-stone-950" />
          </div>
        )}
      </div>

      {/* Right: Two-row content column */}
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
        {/* Row 1 (Name): full width across card, never squeezed by badge */}
        <div className="min-w-0">
          <span
            className="font-bold text-sm sm:text-base lg:text-base text-stone-900 dark:text-stone-100 break-words line-clamp-1"
            title={displayName}
          >
            {displayName}
          </span>
        </div>

        {/* Row 2 (Badges): flex-wrap container for status and score badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusBadge.colorClass}`}
          >
            {statusBadge.variant === "waiting" && <Clock className="w-3.5 h-3.5" />}
            <span>{statusBadge.text}</span>
          </span>

          {/* Score badge */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30">
            <Trophy className="w-3 h-3" />
            <span>{player.score ?? 0} คะแนน</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default PlayerCard;
