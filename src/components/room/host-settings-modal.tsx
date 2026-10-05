"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Host Settings Modal
// Host controls for Game Mode, Timing, Rounds, Input Mode & Host Transfer
// ==========================================

import React, { useState, useEffect } from "react";
import type { Player, RoomSettings, GameMode, AnswerInputMode, LyricsType } from "@/types";
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
  { value: 1.0, label: "1.0 วินาที (ยากสุด)" },
  { value: 2.0, label: "2.0 วินาที (มาตรฐาน)" },
  { value: 5.0, label: "5.0 วินาที (ง่าย)" },
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
      result.lyricsType = "chorus";
    }
  }

  if (result.sliceDurationSec !== undefined) {
    const val = Number(result.sliceDurationSec);
    result.sliceDurationSec = isNaN(val) || val <= 0 ? 2.0 : val;
  }

  if (result.totalRounds !== undefined) {
    const val = Number(result.totalRounds);
    result.totalRounds = isNaN(val) || val <= 0 ? 10 : val;
  }

  if (result.roundTimeoutSec !== undefined) {
    const val = Number(result.roundTimeoutSec);
    result.roundTimeoutSec = isNaN(val) || val <= 0 ? 15 : val;
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
  // Local draft state
  const [draft, setDraft] = useState<RoomSettings>({ ...settings });
  const [selectedTransferTarget, setSelectedTransferTarget] = useState<string>("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync draft whenever modal opens or parent settings update
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...settings });
      setErrorMessage(null);
      setShowTransferConfirm(false);
      setSelectedTransferTarget("");
    }
  }, [isOpen, settings]);

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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      try {
        soundEffects.click();
      } catch {}

      const payload = prepareSettingsPayload(draft);
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
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-left my-auto max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-60 h-28 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="host-settings-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                ตั้งค่าห้องเกม (Host Settings)
              </h2>
              <p className="text-xs text-slate-400">ปรับเปลี่ยนโหมด กติกา และเวลาสำหรับทุกคนในห้อง</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving || isTransferring}
            aria-label="ปิดหน้าต่าง"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Form */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Game Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              🎮 โหมดเกม (Game Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Audio Slice */}
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, gameMode: "audio-slice" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.gameMode === "audio-slice"
                    ? "bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/30 text-white shadow-lg shadow-purple-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🎧</span>
                  {draft.gameMode === "audio-slice" && <Check className="w-4 h-4 text-purple-400" />}
                </div>
                <span className="font-semibold text-sm text-white">Audio Slice</span>
                <span className="text-[11px] text-slate-400 leading-tight">ตัดเสียงเสี้ยววินาที</span>
              </button>

              {/* Buzzer Battle */}
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, gameMode: "buzzer" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.gameMode === "buzzer"
                    ? "bg-pink-600/20 border-pink-500 ring-2 ring-pink-500/30 text-white shadow-lg shadow-pink-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🔔</span>
                  {draft.gameMode === "buzzer" && <Check className="w-4 h-4 text-pink-400" />}
                </div>
                <span className="font-semibold text-sm text-white">Buzzer Battle</span>
                <span className="text-[11px] text-slate-400 leading-tight">แย่งกดกริ่งตอบ</span>
              </button>

              {/* AI Lyrics */}
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    gameMode: "ai-lyrics",
                    lyricsType: prev.lyricsType || "chorus",
                  }))
                }
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.gameMode === "ai-lyrics"
                    ? "bg-cyan-600/20 border-cyan-500 ring-2 ring-cyan-500/30 text-white shadow-lg shadow-cyan-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🤖</span>
                  {draft.gameMode === "ai-lyrics" && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <span className="font-semibold text-sm text-white">AI Lyrics</span>
                <span className="text-[11px] text-slate-400 leading-tight">AI อ่านเนื้อเพลงไร้อารมณ์</span>
              </button>
            </div>
          </div>

          {/* 2. Audio Slice Duration (Shown for audio-slice and buzzer) */}
          {(draft.gameMode === "audio-slice" || draft.gameMode === "buzzer") && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                ⏱️ ความยาวท่อนเสียงที่ตัดมาให้ฟัง
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SLICE_DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, sliceDurationSec: opt.value }))}
                    className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium ${
                      draft.sliceDurationSec === opt.value
                        ? "bg-purple-600/20 border-purple-500 text-purple-200 ring-1 ring-purple-500/30"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Lyrics Type (Shown for AI Lyrics) */}
          {draft.gameMode === "ai-lyrics" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                📖 ส่วนของเนื้อเพลงที่ให้ AI อ่าน
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, lyricsType: "chorus" }))}
                  className={`py-3 px-4 rounded-2xl border text-center transition-all cursor-pointer text-sm font-medium ${
                    draft.lyricsType === "chorus" || !draft.lyricsType
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-semibold">ท่อนฮุก (Chorus)</div>
                  <div className="text-[11px] text-slate-400">เนื้อเพลงท่อนจำ คุ้นหูง่ายกว่า</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, lyricsType: "intro" }))}
                  className={`py-3 px-4 rounded-2xl border text-center transition-all cursor-pointer text-sm font-medium ${
                    draft.lyricsType === "intro"
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-semibold">ท่อนเปิด (Intro / Verse 1)</div>
                  <div className="text-[11px] text-slate-400">ท้าทายความจำระดับแฟนพันธุ์แท้</div>
                </button>
              </div>
            </div>
          )}

          {/* 4. Total Rounds */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              🎯 จำนวนข้อทั้งหมด (Total Rounds)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TOTAL_ROUNDS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, totalRounds: opt.value }))}
                  className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium ${
                    draft.totalRounds === opt.value
                      ? "bg-purple-600/20 border-purple-500 text-purple-200 ring-1 ring-purple-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Round Timeout */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              ⏳ เวลาตอบต่อข้อ (Round Timeout)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROUND_TIMEOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, roundTimeoutSec: opt.value }))}
                  className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium ${
                    draft.roundTimeoutSec === opt.value
                      ? "bg-purple-600/20 border-purple-500 text-purple-200 ring-1 ring-purple-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Answer Input Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              ✍️ รูปแบบการส่งคำตอบ (Answer Input Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, answerInputMode: "autocomplete" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.answerInputMode === "autocomplete"
                    ? "bg-pink-600/20 border-pink-500 ring-1 ring-pink-500/30 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">Autocomplete (ค้นหาชื่อเพลง)</span>
                  {draft.answerInputMode === "autocomplete" && (
                    <Check className="w-4 h-4 text-pink-400" />
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  พิมพ์คำแรกแล้วจะมีตัวเลือกขึ้นมาให้กด สะดวกบนมือถือ
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, answerInputMode: "free-text" }))}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  draft.answerInputMode === "free-text"
                    ? "bg-pink-600/20 border-pink-500 ring-1 ring-pink-500/30 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">Free-text (พิมพ์เองทั้งหมด)</span>
                  {draft.answerInputMode === "free-text" && (
                    <Check className="w-4 h-4 text-pink-400" />
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  พิมพ์ชื่อเพลงแบบไม่มีตัวเลือกช่วย ท้าทายความแม่นยำ
                </span>
              </button>
            </div>
          </div>

          {/* 7. Host Transfer Section */}
          <div className="pt-4 border-t border-slate-800/80">
            <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              <span>โอนสิทธิ์ความเป็น Host (Transfer Host)</span>
            </label>

            {otherPlayers.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
                ไม่มีผู้เล่นอื่นในห้อง สามารถโอนสิทธิ์ได้เมื่อมีเพื่อนคนอื่นเข้าร่วมห้องแล้ว
              </p>
            ) : (
              <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/60">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedTransferTarget}
                    onChange={(e) => {
                      setSelectedTransferTarget(e.target.value);
                      setShowTransferConfirm(false);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
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
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      โอนสิทธิ์ Host
                    </button>
                  ) : null}
                </div>

                {showTransferConfirm && targetPlayer && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <p className="text-xs text-amber-200">
                      ⚠️ ยืนยันโอนสิทธิ์ Host ให้{" "}
                      <strong className="text-white font-semibold">{targetPlayer.displayName}</strong>{" "}
                      ใช่หรือไม่? คุณจะกลายเป็นผู้เล่นธรรมดาทันที
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTransferConfirm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={isTransferring}
                        onClick={handleExecuteTransfer}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
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
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isTransferring}
            className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isTransferring}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
