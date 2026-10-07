"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Host Settings Modal
// Host controls for Game Mode, Timing, Rounds, Input Mode & Host Transfer
// ==========================================

import React, { useState, useEffect } from "react";
import type { Player, RoomSettings, GameMode, AnswerInputMode, LyricsType, Playlist, AIVoiceGender } from "@/types";
import {
  X,
  Settings,
  Music,
  Bell,
  Bot,
  Clock,
  RotateCcw,
  Sparkles,
  UserCheck,
  ChevronRight,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import { soundEffects } from "@/lib/sound-effects";
import { PlaylistService } from "@/lib/services/playlist-service";
import { isPlaylistPlayable } from "@/components/playlist/playlist-utils";
import { useAuth } from "@/hooks/use-auth";

export interface HostSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettings;
  players: Player[];
  currentHostPlayerId: string;
  onSaveSettings: (settings: Partial<RoomSettings>) => Promise<boolean | void>;
  onTransferHost: (newHostPlayerId: string) => Promise<boolean | void>;
}

export const SLICE_DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 1.0, label: "1.0s (ยากสุด)" },
  { value: 2.0, label: "2.0s (มาตรฐาน)" },
  { value: 5.0, label: "5.0s (ง่าย)" },
  { value: 10.0, label: "10.0s (สบายๆ)" },
  { value: 15.0, label: "15.0s (ยาวขึ้น)" },
  { value: 20.0, label: "20.0s (สูงสุด)" },
];

export const TOTAL_ROUNDS_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: "5 ข้อ (เกมสั้น)" },
  { value: 10, label: "10 ข้อ (แนะนำ)" },
  { value: 15, label: "15 ข้อ (จัดเต็ม)" },
  { value: 20, label: "20 ข้อ (มาราธอน)" },
];

export const ROUND_TIMEOUT_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10 วินาที (ไฟลุก)" },
  { value: 15, label: "15 วินาที (มาตรฐาน)" },
  { value: 30, label: "30 วินาที (ชิวๆ)" },
];

/**
 * Validates and normalizes settings updates before saving.
 */
export function prepareSettingsPayload(draft: Partial<RoomSettings>): Partial<RoomSettings> {
  const result: Partial<RoomSettings> = { ...draft };

  if (result.gameMode && !["audio-slice", "buzzer", "ai-lyrics"].includes(result.gameMode)) {
    result.gameMode = "audio-slice";
  }

  if (result.gameMode === "ai-lyrics") {
    if (!result.lyricsType || !["chorus", "intro"].includes(result.lyricsType)) {
      result.lyricsType = "intro";
    }
    if (!result.voiceGender || !["female", "male", "random"].includes(result.voiceGender)) {
      result.voiceGender = "female";
    }
  }

  if (result.sliceDurationSec !== undefined) {
    const val = Number(result.sliceDurationSec);
    result.sliceDurationSec = isNaN(val) || val <= 0 ? 2.0 : Math.min(20.0, Math.max(0.5, val));
  }

  if (result.totalRounds !== undefined) {
    const val = Number(result.totalRounds);
    result.totalRounds = isNaN(val) || val <= 0 ? 10 : val;
  }

  if (result.roundTimeoutSec !== undefined) {
    const val = Number(result.roundTimeoutSec);
    result.roundTimeoutSec = isNaN(val) || val <= 0 ? 15 : val;
  }

  if (result.playlistId !== undefined) {
    if (result.playlistId === null) {
      result.playlistId = null;
    } else {
      const trimmed = result.playlistId ? String(result.playlistId).trim() : undefined;
      result.playlistId = trimmed && trimmed.length > 0 ? trimmed : undefined;
    }
  }

  return result;
}

export function HostSettingsModal({
  isOpen,
  onClose,
  settings,
  players,
  currentHostPlayerId,
  onSaveSettings,
  onTransferHost,
}: HostSettingsModalProps): React.JSX.Element | null {
  const { user } = useAuth();
  // Local draft state
  const [draft, setDraft] = useState<RoomSettings>({ ...settings });
  const [songSourceType, setSongSourceType] = useState<"all" | "playlist">(
    settings.playlistId ? "playlist" : "all"
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [selectedTransferTarget, setSelectedTransferTarget] = useState<string>("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync draft whenever modal opens or parent settings update
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...settings });
      setSongSourceType(settings.playlistId ? "playlist" : "all");
      setErrorMessage(null);
      setShowTransferConfirm(false);
      setSelectedTransferTarget("");
    }
  }, [isOpen, settings]);

  // Load playlists when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingPlaylists(true);

    async function loadPlaylists() {
      try {
        const publicPromise = PlaylistService.getPublicPlaylists();
        const userPromise = user?.id
          ? PlaylistService.getUserPlaylists(user.id)
          : Promise.resolve([]);

        const [publicList, userList] = await Promise.all([
          publicPromise.catch(() => []),
          userPromise.catch(() => []),
        ]);

        if (!isMounted) return;

        const map = new Map<string, Playlist>();
        for (const p of userList) map.set(p.id, p);
        for (const p of publicList) {
          if (!map.has(p.id)) map.set(p.id, p);
        }
        setPlaylists(Array.from(map.values()));
      } catch (err) {
        console.warn("Could not load playlists in modal:", err);
      } finally {
        if (isMounted) setIsLoadingPlaylists(false);
      }
    }

    loadPlaylists();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving && !isTransferring) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSaving, isTransferring]);

  if (!isOpen) return null;

  // Other players eligible to become host
  const otherPlayers = players.filter((p) => p.id !== currentHostPlayerId);

  const selectedPlaylist = playlists.find((p) => p.id === draft.playlistId);
  const isSelectedValid = Boolean(
    selectedPlaylist && isPlaylistPlayable(selectedPlaylist.songCount || 0)
  );

  const isPlaylistInvalid =
    songSourceType === "playlist" &&
    (!draft.playlistId || (!isLoadingPlaylists && !isSelectedValid));

  const isSaveDisabled =
    isSaving ||
    isTransferring ||
    isLoadingPlaylists ||
    Boolean(isPlaylistInvalid);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      try {
        soundEffects.click();
      } catch {}

      const effectivePlaylistId =
        songSourceType === "playlist" && draft.playlistId
          ? draft.playlistId.trim()
          : null;

      const payload = prepareSettingsPayload({
        ...draft,
        playlistId: effectivePlaylistId,
      });
      const res = await onSaveSettings(payload);
      // If callback returns boolean false, keep modal open
      if (res !== false) {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "ไม่สามารถบันทึกการตั้งค่าได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteTransfer = async () => {
    if (!selectedTransferTarget) return;
    try {
      setIsTransferring(true);
      setErrorMessage(null);
      try {
        soundEffects.click();
      } catch {}

      const res = await onTransferHost(selectedTransferTarget);
      if (res !== false) {
        setShowTransferConfirm(false);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "ไม่สามารถโอนสิทธิ์ Host ได้");
    } finally {
      setIsTransferring(false);
    }
  };

  const targetPlayer = otherPlayers.find((p) => p.id === selectedTransferTarget);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="host-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => {
        if (!isSaving && !isTransferring) onClose();
      }}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-left my-auto max-h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-60 h-28 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="host-settings-title" className="text-lg sm:text-xl font-bold font-serif text-stone-900 dark:text-white tracking-tight">
                ตั้งค่าห้องเกม (Host Settings)
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">ปรับเปลี่ยนโหมด กติกา และเวลาสำหรับทุกคนในห้อง</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving || isTransferring}
            aria-label="ปิดหน้าต่าง"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800/80 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Form */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Game Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
              🎮 โหมดเกม (Game Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Audio Slice */}
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, gameMode: "audio-slice" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.gameMode === "audio-slice"
                    ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🎧</span>
                  {draft.gameMode === "audio-slice" && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <span className="font-semibold text-sm text-stone-900 dark:text-white">Audio Slice</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">ตัดเสียงเสี้ยววินาที</span>
              </button>

              {/* Buzzer Battle */}
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, gameMode: "buzzer" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.gameMode === "buzzer"
                    ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🔔</span>
                  {draft.gameMode === "buzzer" && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <span className="font-semibold text-sm text-stone-900 dark:text-white">Buzzer Battle</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">แย่งกดกริ่งตอบ</span>
              </button>

              {/* AI Lyrics */}
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    gameMode: "ai-lyrics",
                    lyricsType: prev.lyricsType || "intro",
                    voiceGender: prev.voiceGender || "female",
                  }))
                }
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.gameMode === "ai-lyrics"
                    ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🤖</span>
                  {draft.gameMode === "ai-lyrics" && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <span className="font-semibold text-sm text-stone-900 dark:text-white">AI Lyrics</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">AI อ่านเนื้อเพลงไร้อารมณ์</span>
              </button>
            </div>
          </div>

          {/* 2. Audio Slice Duration (Shown for audio-slice and buzzer, up to 20 seconds) */}
          {(draft.gameMode === "audio-slice" || draft.gameMode === "buzzer") && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                  ⏱️ ความยาวท่อนเสียงที่ตัดมาให้ฟัง (สูงสุด 20 วิ)
                </label>
                <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                  {draft.sliceDurationSec.toFixed(1)} วินาที
                </span>
              </div>

              {/* Slider up to 20 seconds */}
              <div className="flex items-center gap-3 px-1 mb-3">
                <span className="text-[11px] font-mono text-stone-500">0.5s</span>
                <input
                  type="range"
                  min="0.5"
                  max="20.0"
                  step="0.5"
                  value={draft.sliceDurationSec}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      sliceDurationSec: parseFloat(e.target.value),
                    }))
                  }
                  className="flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-stone-500">20.0s</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SLICE_DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, sliceDurationSec: opt.value }))}
                    className={`min-h-[40px] py-2 px-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-medium flex items-center justify-center ${
                      draft.sliceDurationSec === opt.value
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Lyrics Type & Voice Gender (Shown for AI Lyrics) */}
          {draft.gameMode === "ai-lyrics" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
                  📖 ส่วนของเนื้อเพลงที่ให้ AI อ่าน
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, lyricsType: "intro" }))}
                    className={`min-h-[44px] py-3 px-4 rounded-2xl border text-center transition-all cursor-pointer text-sm font-medium ${
                      draft.lyricsType === "intro" || !draft.lyricsType
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    <div className="font-semibold">🚀 ท่อนเปิด (Intro / Verse 1)</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">ท้าทายความจำระดับแฟนพันธุ์แท้</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, lyricsType: "chorus" }))}
                    className={`min-h-[44px] py-3 px-4 rounded-2xl border text-center transition-all cursor-pointer text-sm font-medium ${
                      draft.lyricsType === "chorus"
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    <div className="font-semibold">🎵 ท่อนฮุก (Chorus)</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">เนื้อเพลงท่อนจำ คุ้นหูง่ายกว่า</div>
                  </button>
                </div>
              </div>

              {/* Voice Gender Switcher */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
                  🗣️ โทนเสียง AI อ่าน (ฟรี)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, voiceGender: "female" }))}
                    className={`min-h-[44px] py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium flex items-center justify-center ${
                      draft.voiceGender === "female" || !draft.voiceGender
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    👩 เสียงหญิง
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, voiceGender: "male" }))}
                    className={`min-h-[44px] py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium flex items-center justify-center ${
                      draft.voiceGender === "male"
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    👨 เสียงชาย
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, voiceGender: "random" }))}
                    className={`min-h-[44px] py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium flex items-center justify-center ${
                      draft.voiceGender === "random"
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    🎲 สุ่มสลับเสียง
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Song Source Selector (All Songs vs Custom Playlist) */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>🎵 แหล่งเพลง (Song Source)</span>
              {songSourceType === "playlist" && draft.playlistId && selectedPlaylist && isSelectedValid && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                  เลือกแล้ว: {selectedPlaylist.title}
                </span>
              )}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: All Songs */}
              <button
                type="button"
                onClick={() => {
                  setSongSourceType("all");
                  setDraft((prev) => ({ ...prev, playlistId: undefined }));
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer min-h-[44px] ${
                  songSourceType === "all"
                    ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>🌐</span>
                    <span>สุ่มจากคลังทั้งหมด (All Songs)</span>
                  </span>
                  {songSourceType === "all" && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  สุ่มเพลงจากคลังเพลงหลักทั้งหมดของระบบ
                </span>
              </button>

              {/* Option 2: Custom Playlist */}
              <button
                type="button"
                onClick={() => {
                  setSongSourceType("playlist");
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer min-h-[44px] ${
                  songSourceType === "playlist"
                    ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>🎶</span>
                    <span>ใช้เพลย์ลิสต์ (Custom Playlist)</span>
                  </span>
                  {songSourceType === "playlist" && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  เลือกเล่นเฉพาะเพลงจากเพลย์ลิสต์ที่กำหนด
                </span>
              </button>
            </div>

            {/* Custom Playlist Dropdown & Notices */}
            {songSourceType === "playlist" && (
              <div className="mt-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">เลือกเพลย์ลิสต์สำหรับห้องนี้:</span>
                  {isLoadingPlaylists && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังโหลด...</span>
                    </span>
                  )}
                </div>

                <select
                  value={draft.playlistId || ""}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setDraft((prev) => ({
                      ...prev,
                      playlistId: val.length > 0 ? val : undefined,
                    }));
                  }}
                  disabled={isLoadingPlaylists}
                  className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-amber-500 transition-colors min-h-[44px] cursor-pointer"
                >
                  <option value="">-- กรุณาเลือกเพลย์ลิสต์ --</option>
                  {playlists.map((pl) => {
                    const playable = isPlaylistPlayable(pl.songCount || 0);
                    return (
                      <option key={pl.id} value={pl.id}>
                        {playable ? "🎵" : "⚠️"} {pl.title} ({pl.songCount || 0} เพลง)
                        {!playable ? " (มีไม่ถึง 5 เพลง - เล่นไม่ได้)" : ""}
                      </option>
                    );
                  })}
                </select>

                {/* Validation Warnings / Feedback */}
                {!draft.playlistId && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>กรุณาเลือกเพลย์ลิสต์ที่พร้อมใช้งาน (มีเพลงอย่างน้อย 5 เพลง) หรือเปลี่ยนเป็น &quot;สุ่มจากคลังทั้งหมด&quot;</span>
                  </div>
                )}

                {draft.playlistId && selectedPlaylist && !isSelectedValid && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      เพลย์ลิสต์ &quot;{selectedPlaylist.title}&quot; มีเพียง {selectedPlaylist.songCount || 0} เพลง ไม่สามารถเริ่มเล่นได้ (ต้องมีอย่างน้อย 5 เพลง)
                    </span>
                  </div>
                )}

                {draft.playlistId && !isLoadingPlaylists && !selectedPlaylist && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>ไม่พบข้อมูลเพลย์ลิสต์ที่เลือก กรุณาเลือกเพลย์ลิสต์ใหม่จากรายการ</span>
                  </div>
                )}

                {draft.playlistId && selectedPlaylist && isSelectedValid && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>
                      เพลย์ลิสต์พร้อมเล่น: &quot;{selectedPlaylist.title}&quot; ({selectedPlaylist.songCount} เพลง)
                      {selectedPlaylist.authorName ? ` โดย ${selectedPlaylist.authorName}` : ""}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Total Rounds */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
              🎯 จำนวนข้อทั้งหมด (Total Rounds)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TOTAL_ROUNDS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, totalRounds: opt.value }))}
                  className={`min-h-[44px] py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium flex items-center justify-center ${
                    draft.totalRounds === opt.value
                      ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                      : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Round Timeout */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
              ⏳ เวลาตอบต่อข้อ (Round Timeout)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROUND_TIMEOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, roundTimeoutSec: opt.value }))}
                  className={`min-h-[44px] py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium flex items-center justify-center ${
                    draft.roundTimeoutSec === opt.value
                      ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                      : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Answer Input Mode */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
              ✍️ รูปแบบการส่งคำตอบ (Answer Input Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, answerInputMode: "autocomplete" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.answerInputMode === "autocomplete"
                    ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/30 text-stone-900 dark:text-white"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-stone-900 dark:text-white">Autocomplete (ค้นหาชื่อเพลง)</span>
                  {draft.answerInputMode === "autocomplete" && (
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  พิมพ์คำแรกแล้วจะมีตัวเลือกขึ้นมาให้กด สะดวกบนมือถือ
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, answerInputMode: "free-text" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.answerInputMode === "free-text"
                    ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/30 text-stone-900 dark:text-white"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-stone-900 dark:text-white">Free-text (พิมพ์เองทั้งหมด)</span>
                  {draft.answerInputMode === "free-text" && (
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  พิมพ์ชื่อเพลงแบบไม่มีตัวเลือกช่วย ท้าทายความแม่นยำ
                </span>
              </button>
            </div>
          </div>

          {/* 7. Host Transfer Section */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80">
            <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              <span>โอนสิทธิ์ความเป็น Host (Transfer Host)</span>
            </label>

            {otherPlayers.length === 0 ? (
              <p className="text-xs text-stone-500 italic bg-stone-50 dark:bg-stone-950/40 p-3 rounded-2xl border border-stone-200 dark:border-stone-800/60">
                ไม่มีผู้เล่นอื่นในห้อง สามารถโอนสิทธิ์ได้เมื่อมีเพื่อนคนอื่นเข้าร่วมห้องแล้ว
              </p>
            ) : (
              <div className="space-y-3 bg-stone-50 dark:bg-stone-950/40 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800/60">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedTransferTarget}
                    onChange={(e) => {
                      setSelectedTransferTarget(e.target.value);
                      setShowTransferConfirm(false);
                    }}
                    className="flex-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
                  >
                    <option value="">-- เลือกผู้เล่นที่จะโอนสิทธิ์ให้ --</option>
                    {otherPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.displayName} ({player.score ?? 0} คะแนน)
                      </option>
                    ))}
                  </select>

                  {!showTransferConfirm ? (
                    <button
                      type="button"
                      disabled={!selectedTransferTarget || isTransferring}
                      onClick={() => setShowTransferConfirm(true)}
                      className="px-4 py-2 min-h-[44px] flex items-center justify-center rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      โอนสิทธิ์ Host
                    </button>
                  ) : null}
                </div>

                {showTransferConfirm && targetPlayer && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      ⚠️ ยืนยันโอนสิทธิ์ Host ให้{" "}
                      <strong className="text-stone-900 dark:text-white font-semibold">{targetPlayer.displayName}</strong>{" "}
                      ใช่หรือไม่? คุณจะกลายเป็นผู้เล่นธรรมดาทันที
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTransferConfirm(false)}
                        className="px-3 py-1.5 min-h-[44px] flex items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={isTransferring}
                        onClick={handleExecuteTransfer}
                        className="px-3.5 py-1.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>กำลังโอนสิทธิ์...</span>
                          </>
                        ) : (
                          <span>ยืนยันโอนสิทธิ์</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isTransferring}
            className="px-5 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold shadow-md shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>บันทึกการตั้งค่า</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HostSettingsModal;
