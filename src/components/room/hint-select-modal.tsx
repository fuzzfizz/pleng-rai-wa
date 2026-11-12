"use client";

import React, { useEffect } from "react";
import { X, Tag, Calendar, Disc3, UserCheck, Check, Sparkles, AlertCircle } from "lucide-react";
import type { Song, HintType } from "@/types";
import { HINT_COSTS } from "@/types";

export interface HintSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong?: Partial<Song> | null;
  hasAlbum?: boolean;
  revealedHints?: { genre?: string; year?: string; album?: string; artist?: string };
  pointsAvailable?: number;
  onRequestHint: (hintType: HintType) => void | Promise<void>;
  isLoading?: boolean;
  isSolo?: boolean;
}

export function HintSelectModal({
  isOpen,
  onClose,
  currentSong,
  hasAlbum: propHasAlbum,
  revealedHints = {},
  pointsAvailable = 100,
  onRequestHint,
  isLoading = false,
  isSolo = false,
}: HintSelectModalProps) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasAlbum =
    typeof propHasAlbum === "boolean"
      ? propHasAlbum
      : Boolean(currentSong?.album && currentSong.album.trim().length > 0);

  const handleSelectHint = (hintType: HintType) => {
    if (isLoading) return;
    if (revealedHints[hintType]) return;
    if (hintType === "album" && !hasAlbum) return;

    // Immediately trigger request & close modal so user can immediately view HUD and answer
    onRequestHint(hintType);
    onClose();
  };

  const hintItems: Array<{
    type: HintType;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    cost: number;
    revealedText?: string;
    isAvailable: boolean;
    unavailableReason?: string;
  }> = [
    {
      type: "genre",
      label: "แนวเพลง",
      sublabel: "รู้แนวเพลงหลักของแทร็กนี้",
      icon: <Tag className="w-5 h-5 text-emerald-400" />,
      cost: HINT_COSTS.genre,
      revealedText: revealedHints.genre,
      isAvailable: true,
    },
    {
      type: "year",
      label: "ปีที่ปล่อย & ยุค",
      sublabel: "รู้ปี ค.ศ. และยุคสมัยของเพลง",
      icon: <Calendar className="w-5 h-5 text-blue-400" />,
      cost: HINT_COSTS.year,
      revealedText: revealedHints.year,
      isAvailable: true,
    },
    {
      type: "album",
      label: "อัลบั้ม",
      sublabel: "รู้ชื่ออัลบั้มสตูดิโอหรือ EP",
      icon: <Disc3 className="w-5 h-5 text-amber-400" />,
      cost: HINT_COSTS.album,
      revealedText: revealedHints.album,
      isAvailable: hasAlbum,
      unavailableReason: "ไม่มีข้อมูลอัลบั้ม (ซิงเกิลเดี่ยว/OST)",
    },
    {
      type: "artist",
      label: "ศิลปิน / วงดนตรี",
      sublabel: "รู้ชื่อศิลปินหรือวงเจ้าของผลงาน",
      icon: <UserCheck className="w-5 h-5 text-purple-400" />,
      cost: HINT_COSTS.artist,
      revealedText: revealedHints.artist,
      isAvailable: true,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hint-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h3 id="hint-modal-title" className="text-lg font-bold">
                เลือกขอคำใบ้ (A La Carte)
              </h3>
            </div>
            <p className="text-xs text-stone-400 mt-1.5">
              {isSolo
                ? "เลือกเปิดคำใบ้หมวดที่ต้องการเพื่อช่วยทายเพลง"
                : "เลือกเฉพาะคำใบ้ที่ต้องการ คะแนนจะหักตามหมวดที่เปิด"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างคำใบ้"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Points Banner (Hidden in Solo Mode) */}
        {!isSolo && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <span className="text-xs font-semibold text-amber-200">
              คะแนนที่จะได้รับถ้าตอบถูกตอนนี้:
            </span>
            <span className="text-sm font-extrabold text-amber-400 font-mono">
              {pointsAvailable} คะแนน
            </span>
          </div>
        )}

        {/* Hint Options Grid */}
        <div className="grid grid-cols-1 gap-2.5">
          {hintItems.map((item) => {
            const isRevealed = Boolean(item.revealedText);
            const isDisabled = isRevealed || !item.isAvailable || isLoading;

            return (
              <button
                key={item.type}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelectHint(item.type)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition touch-manipulation ${
                  isRevealed
                    ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300 opacity-90 cursor-default"
                    : !item.isAvailable
                    ? "bg-stone-900/40 border-stone-800/80 text-stone-500 opacity-50 cursor-not-allowed"
                    : "bg-stone-800/60 hover:bg-stone-800 border-stone-700 hover:border-amber-500/50 text-stone-200 cursor-pointer active:scale-[0.99]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="shrink-0">{item.icon}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span>{item.label}</span>
                      {isRevealed && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> เปิดแล้ว
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 truncate mt-0.5">
                      {isRevealed
                        ? item.revealedText
                        : !item.isAvailable
                        ? item.unavailableReason
                        : item.sublabel}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 font-mono text-xs font-bold">
                  {isRevealed ? (
                    <span className="text-emerald-400 font-semibold">✓</span>
                  ) : !item.isAvailable ? (
                    <span className="text-stone-500 text-[11px]">ไม่มี</span>
                  ) : isSolo ? (
                    <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      เปิดดู
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      -{item.cost} แต้ม
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Guarantee (Hidden in Solo Mode) */}
        {!isSolo && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 pt-1 border-t border-stone-800/60">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>ตอบถูกการันตีคะแนนขั้นต่ำ 20 คะแนนเสมอ</span>
          </div>
        )}
      </div>
    </div>
  );
}
