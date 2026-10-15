"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Manage Modal
// Dedicated Host Controls for Room Capacity & Host Transfer
// ==========================================

import React, { useState, useEffect } from "react";
import type { Player, RoomSettings } from "@/types";
import {
  X,
  Users,
  UserCheck,
  Crown,
  AlertTriangle,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import { soundEffects } from "@/lib/sound-effects";

export interface RoomManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettings;
  players: Player[];
  currentHostPlayerId: string;
  onSaveSettings: (settings: Partial<RoomSettings>) => Promise<boolean | void>;
  onTransferHost: (newHostPlayerId: string) => Promise<boolean | void>;
}

export const MAX_PLAYERS_OPTIONS: { value: number; label: string }[] = [
  { value: 4, label: "4 คน" },
  { value: 8, label: "8 คน (แนะนำ)" },
  { value: 12, label: "12 คน" },
];

export function RoomManageModal({
  isOpen,
  onClose,
  settings,
  players,
  currentHostPlayerId,
  onSaveSettings,
  onTransferHost,
}: RoomManageModalProps): React.JSX.Element | null {
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState<number>(
    settings.maxPlayers || 8
  );
  const [selectedTransferTarget, setSelectedTransferTarget] = useState<string>("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state whenever modal opens
  const prevIsOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSelectedMaxPlayers(settings.maxPlayers || 8);
      setSelectedTransferTarget("");
      setShowTransferConfirm(false);
      setErrorMessage(null);
      setSaveSuccess(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, settings.maxPlayers]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving && !isTransferring) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, isTransferring, onClose]);

  if (!isOpen) return null;

  const otherPlayers = players.filter((p) => p.id !== currentHostPlayerId);
  const targetPlayer = otherPlayers.find((p) => p.id === selectedTransferTarget);
  const currentCount = players.length;
  const hasChanges = selectedMaxPlayers !== (settings.maxPlayers || 8);

  // Save room capacity settings
  const handleSaveCapacity = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSaveSuccess(false);
      try {
        soundEffects.click();
      } catch {}

      const res = await onSaveSettings({ maxPlayers: selectedMaxPlayers });
      if (res !== false) {
        setSaveSuccess(true);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "ไม่สามารถบันทึกการตั้งค่าห้องได้");
    } finally {
      setIsSaving(false);
    }
  };

  // Transfer host permissions
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-manage-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => {
        if (!isSaving && !isTransferring) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-left my-auto flex flex-col overflow-hidden text-stone-900 dark:text-stone-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="room-manage-title"
                className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 dark:text-white"
              >
                จัดการห้อง (Room Management)
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                ตั้งค่าความจุห้อง และจัดการสิทธิ์หัวห้อง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isTransferring}
            className="text-stone-500 hover:text-stone-800 dark:hover:text-white p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success message */}
        {saveSuccess && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>บันทึกการตั้งค่าห้องเรียบร้อยแล้ว!</span>
          </div>
        )}

        {/* Body content */}
        <div className="py-4 space-y-6">
          {/* Section 1: Room Capacity */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>👥 จำนวนผู้เล่นสูงสุดในห้อง (Max Players)</span>
              </label>
              <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                {selectedMaxPlayers} คน
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MAX_PLAYERS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSaving || isTransferring}
                  onClick={() => {
                    try {
                      soundEffects.click();
                    } catch {}
                    setSelectedMaxPlayers(opt.value);
                  }}
                  className={`min-h-[44px] py-2.5 px-2 rounded-2xl border text-center transition-all cursor-pointer text-xs sm:text-sm font-medium flex items-center justify-center ${
                    selectedMaxPlayers === opt.value
                      ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/30 font-semibold"
                      : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Current players warning if capacity is reduced below current occupants */}
            {selectedMaxPlayers < currentCount && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  ขณะนี้มีผู้เล่นในห้อง {currentCount} คน (มากกว่า {selectedMaxPlayers} คนที่เลือกไว้) ผู้เล่นเดิมจะยังอยู่ในห้อง แต่ผู้เล่นใหม่จะไม่สามารถเข้าเพิ่มได้
                </span>
              </div>
            )}
          </section>

          {/* Section 2: Host Transfer */}
          <section className="pt-5 border-t border-stone-200 dark:border-stone-800/80 space-y-3">
            <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-4 h-4" />
              <span>👑 โอนสิทธิ์หัวห้อง (Transfer Host)</span>
            </label>

            {otherPlayers.length === 0 ? (
              <p className="text-xs text-stone-500 italic bg-stone-50 dark:bg-stone-950/40 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800/60">
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
                    disabled={isTransferring || isSaving}
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
                      disabled={!selectedTransferTarget || isTransferring || isSaving}
                      onClick={() => {
                        try {
                          soundEffects.click();
                        } catch {}
                        setShowTransferConfirm(true);
                      }}
                      className="px-4 py-2 min-h-[44px] flex items-center justify-center rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      <UserCheck className="w-4 h-4 mr-1.5" />
                      <span>โอนสิทธิ์ Host</span>
                    </button>
                  ) : null}
                </div>

                {/* Inline Confirmation step */}
                {showTransferConfirm && targetPlayer && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in duration-150">
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      ⚠️ ยืนยันโอนสิทธิ์ Host ให้{" "}
                      <strong className="text-stone-900 dark:text-white font-semibold">
                        {targetPlayer.displayName}
                      </strong>{" "}
                      ใช่หรือไม่? คุณจะกลายเป็นผู้เล่นธรรมดาทันที
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTransferConfirm(false)}
                        disabled={isTransferring}
                        className="px-3.5 py-1.5 min-h-[44px] flex items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={isTransferring}
                        onClick={handleExecuteTransfer}
                        className="px-4 py-1.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>กำลังโอนสิทธิ์...</span>
                          </>
                        ) : (
                          <>
                            <Crown className="w-3.5 h-3.5" />
                            <span>ยืนยันโอนสิทธิ์</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isTransferring}
            className="px-5 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {hasChanges ? "ยกเลิก" : "ปิด"}
          </button>
          <button
            type="button"
            onClick={handleSaveCapacity}
            disabled={isSaving || isTransferring || !hasChanges}
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
                <span>บันทึกความจุห้อง</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
export default RoomManageModal;
