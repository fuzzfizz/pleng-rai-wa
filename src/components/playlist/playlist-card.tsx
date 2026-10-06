"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Playlist Card Component
// Card display for public and user playlists with play & management actions
// ==========================================

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Users,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Music2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { Playlist, Song } from "@/types";
import {
  formatPlaylistDuration,
  isPlaylistPlayable,
  calculateTotalDuration,
} from "./playlist-utils";
import { soundEffects } from "@/lib/sound-effects";

export interface PlaylistCardProps {
  playlist: Playlist & { songs?: Song[] };
  currentUserId?: string;
  onPlaySolo?: (playlist: Playlist) => void;
  onPlayRoom?: (playlist: Playlist) => void;
  onEdit?: (playlist: Playlist) => void;
  onDelete?: (playlist: Playlist) => void;
}

export function PlaylistCard({
  playlist,
  currentUserId,
  onPlaySolo,
  onPlayRoom,
  onEdit,
  onDelete,
}: PlaylistCardProps): React.JSX.Element {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const songCount = playlist.songCount ?? playlist.songs?.length ?? 0;
  const isPlayable = isPlaylistPlayable(songCount);
  const isOwner = Boolean(currentUserId && playlist.userId === currentUserId);

  const authorName =
    playlist.authorName ||
    playlist.userProfile?.displayName ||
    "นักฟังเพลง";
  const authorAvatar =
    playlist.authorAvatar ||
    playlist.userProfile?.avatar ||
    "🦊";

  // Calculate duration if songs are attached
  const totalDurationSec =
    playlist.songs && playlist.songs.length > 0
      ? calculateTotalDuration(playlist.songs)
      : 0;

  const handlePlaySoloClick = () => {
    if (!isPlayable) return;
    try {
      soundEffects.click();
    } catch {}

    if (onPlaySolo) {
      onPlaySolo(playlist);
    } else {
      router.push(`/play/solo?playlistId=${encodeURIComponent(playlist.id)}`);
    }
  };

  const handlePlayRoomClick = () => {
    if (!isPlayable) return;
    try {
      soundEffects.click();
    } catch {}

    if (onPlayRoom) {
      onPlayRoom(playlist);
    } else {
      router.push(`/?create=true&playlistId=${encodeURIComponent(playlist.id)}`);
    }
  };

  const handleEditClick = () => {
    try {
      soundEffects.click();
    } catch {}

    if (onEdit) {
      onEdit(playlist);
    } else {
      router.push(`/playlists/${encodeURIComponent(playlist.id)}/edit`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) {
      setShowDeleteConfirm(false);
      return;
    }
    try {
      soundEffects.click();
    } catch {}

    setIsDeleting(true);
    try {
      await onDelete(playlist);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-3xl bg-white dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800/80 p-5 sm:p-6 transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg dark:hover:shadow-amber-500/5 backdrop-blur-md">
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3.5">
          {/* Creator Attribution */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-2xl select-none shrink-0"
              role="img"
              aria-label="avatar"
            >
              {authorAvatar}
            </span>
            <div className="min-w-0">
              <span className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate block">
                {authorName}
              </span>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 block">
                {new Date(playlist.createdAt).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Visibility Badge */}
          <div className="shrink-0 flex items-center gap-1.5">
            {playlist.isPublic ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <Globe className="w-3 h-3" />
                สาธารณะ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                <Lock className="w-3 h-3" />
                ส่วนตัว
              </span>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-4">
          <h3 className="text-lg font-bold font-serif text-stone-900 dark:text-white tracking-tight line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {playlist.title}
          </h3>
          {playlist.description ? (
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
              {playlist.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-600 italic">ไม่มีคำอธิบาย</p>
          )}
        </div>

        {/* Playlist Stats & Threshold Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Song Count Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 text-xs border border-stone-200 dark:border-stone-700/60">
            <Music2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{songCount} เพลง</span>
          </div>

          {/* Duration Badge (if available) */}
          {totalDurationSec > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 text-xs border border-stone-200 dark:border-stone-700/60">
              <Clock className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span>{formatPlaylistDuration(totalDurationSec)}</span>
            </div>
          )}

          {/* 5 Songs Threshold Indicator */}
          {isPlayable ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✓ พร้อมเล่น</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>⚠️ ต้องมีอย่างน้อย 5 เพลงเพื่อใช้เล่นเกม</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions Section */}
      <div className="pt-3 border-t border-stone-200 dark:border-stone-800/80 space-y-2.5">
        {/* Play Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Play Solo */}
          <button
            type="button"
            onClick={handlePlaySoloClick}
            disabled={!isPlayable}
            className={`min-h-[44px] px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isPlayable
                ? "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
                : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 opacity-60 cursor-not-allowed border border-stone-200 dark:border-stone-700/50"
            }`}
            title={isPlayable ? "ซ้อมเดี่ยวด้วยเพลย์ลิสต์นี้" : "เพลย์ลิสต์ต้องมีอย่างน้อย 5 เพลง"}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>ซ้อมเดี่ยว</span>
          </button>

          {/* Host Room */}
          <button
            type="button"
            onClick={handlePlayRoomClick}
            disabled={!isPlayable}
            className={`min-h-[44px] px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isPlayable
                ? "bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-white font-bold border border-stone-300 dark:border-stone-700 active:scale-[0.98] cursor-pointer"
                : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 opacity-60 cursor-not-allowed border border-stone-200 dark:border-stone-700/50"
            }`}
            title={isPlayable ? "สร้างห้องแข่งด้วยเพลย์ลิสต์นี้" : "เพลย์ลิสต์ต้องมีอย่างน้อย 5 เพลง"}
          >
            <Users className="w-4 h-4" />
            <span>สร้างห้อง</span>
          </button>
        </div>

        {/* Owner Controls (Edit & Delete) */}
        {isOwner && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleEditClick}
              className="flex-1 min-h-[44px] px-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-stone-300 dark:border-stone-700 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>แก้ไข</span>
            </button>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 min-h-[44px] px-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>ยืนยันลบ</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="min-h-[44px] px-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 text-xs transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                  setShowDeleteConfirm(true);
                }}
                className="min-h-[44px] px-3 rounded-2xl bg-stone-100 dark:bg-stone-800/80 hover:bg-rose-500/10 text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-stone-300 dark:border-stone-700/80 hover:border-rose-500/30 cursor-pointer"
                title="ลบเพลย์ลิสต์"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
