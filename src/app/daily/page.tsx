"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Daily Challenge Mode (Task 2)
// Heardle-Style Progressive Audio Slice Daily Song Guessing
// Member-Exclusive, Daily Streak, Calendar Archive & Shareable Results
// ==========================================

import React, { useState, useEffect, useRef, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ArrowLeft,
  Calendar,
  Flame,
  BarChart3,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Disc3,
  Share2,
  Copy,
  Check,
  Lock,
  FastForward,
  Flag,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
  Music,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth/auth-modal";
import { SettingsMenu } from "@/components/common/settings-menu";
import {
  PROGRESSIVE_SLICE_STEPS,
  getProgressiveStep,
} from "@/lib/audio-slice-utils";
import {
  DailyChallengeService,
  getTodayDateString,
  isValidDateString,
  getPastDatesList,
} from "@/lib/services/daily-challenge-service";
import { searchSongAutocomplete } from "@/lib/answer-checker";
import { loadPublicSongLibrary } from "@/lib/services/song-library-cache";
import {
  soundEffects,
  playCorrectSound,
  playWrongSound,
  playClickSound,
} from "@/lib/sound-effects";
import {
  getMasterVolume,
  isMasterMuted,
  subscribeMasterVolume,
  toggleMasterMute,
} from "@/lib/audio-volume";
import type { Song, DailyAttempt, DailyUserStats, ProgressiveSliceStep } from "@/types";

// ==========================================
// Formatting & Share Helpers
// ==========================================

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function formatThaiDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const month = THAI_MONTHS_SHORT[monthIdx] || parts[1];
  return `${day} ${month} ${year}`;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function generateDailyShareText({
  dateFormatted,
  isCorrect,
  step,
  score,
  currentStreak,
  url = "https://pleng-rai-wa.com/daily",
}: {
  dateFormatted: string;
  isCorrect: boolean;
  step: number;
  score: number;
  currentStreak: number;
  url?: string;
}): string {
  let blocks = "";
  if (isCorrect) {
    blocks = Array.from({ length: 5 }, (_, i) => {
      if (i + 1 < step) return "🟥";
      if (i + 1 === step) return "🟩";
      return "⬛";
    }).join("");
  } else {
    blocks = "🟥🟥🟥🟥🟥";
  }

  const resultLine = isCorrect
    ? `🔊 ${blocks} (สเต็ป ${step}/5 • ${score} แต้ม)`
    : `🔊 ${blocks} (ไม่สำเร็จ)`;

  const streakLine = `🔥 สตรีค ${currentStreak} วันติด`;

  return [
    `เพลงไรวะ รายวัน ${dateFormatted}`,
    resultLine,
    streakLine,
    url,
  ].join("\n");
}

// ==========================================
// Loading Skeleton
// ==========================================

export function DailyLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      {/* Top Bar Skeleton */}
      <header className="border-b border-stone-200 dark:border-stone-800/80 bg-white/70 dark:bg-stone-900/60 backdrop-blur-md px-4 sm:px-8 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
          <div className="h-6 w-36 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-20 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
          <div className="h-9 w-20 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
        </div>
      </header>

      {/* Main Skeleton */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center items-center gap-6">
        <div className="w-full h-12 rounded-2xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
        <div className="w-32 h-32 rounded-full bg-stone-200 dark:bg-stone-800 animate-pulse" />
        <div className="w-full h-14 rounded-2xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
        <div className="w-full h-32 rounded-3xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
      </main>
    </div>
  );
}

// ==========================================
// Member-Only Exclusive Gate Card
// ==========================================

export function MemberExclusiveLandingCard({
  onOpenAuth,
}: {
  onOpenAuth: () => void;
}): React.JSX.Element {
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-stone-200 dark:border-stone-800/80 bg-white/70 dark:bg-stone-900/60 backdrop-blur-md px-4 sm:px-8 py-3 sticky top-0 z-30 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs sm:text-sm font-semibold">กลับหน้าแรก</span>
        </Link>
        <div className="flex items-center gap-2">
          <SettingsMenu />
        </div>
      </header>

      {/* Center Gate Card */}
      <main className="flex-1 max-w-lg w-full mx-auto p-6 sm:p-8 flex flex-col justify-center items-center">
        <div className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center flex flex-col items-center gap-5">
          {/* Animated Lock / Calendar Icon Badge */}
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-md">
              <Calendar className="w-9 h-9" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-stone-900 dark:bg-stone-800 border-2 border-amber-500 text-amber-400 flex items-center justify-center shadow-md">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 dark:text-white mb-2">
              โหมดเพลงรายวัน (Daily Challenge)
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-sm">
              ทายเพลงรายวันวันละ 1 เพลง เล่นย้อนหลังได้ สะสมสตรีค และแชร์ผลลัพธ์กับเพื่อน เฉพาะสมาชิกเท่านั้น
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="w-full bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/80 rounded-2xl p-4 text-left space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
              <span className="text-amber-500 font-bold">🎵</span>
              <span>เพลงปริศนาชุดเดียวกันสำหรับทุกคนในแต่ละวัน</span>
            </div>
            <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
              <span className="text-amber-500 font-bold">🔥</span>
              <span>บันทึกสถิติและสตรีคประจำตัวแบบไม่มีวันหาย</span>
            </div>
            <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
              <span className="text-amber-500 font-bold">📅</span>
              <span>เล่นย้อนหลังได้สูงสุด 30 วัน</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="w-full flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm sm:text-base transition-transform active:scale-[0.98] shadow-md shadow-amber-500/20 cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
            </button>

            <Link
              href="/"
              className="w-full py-3 px-6 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs sm:text-sm transition-colors text-center cursor-pointer min-h-[44px] flex items-center justify-center"
            >
              กลับหน้าแรก
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// ==========================================
// Modal 1: Rules Modal ("❓ วิธีเล่น")
// ==========================================

export function DailyRulesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded-xl transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-serif text-stone-900 dark:text-white">
              วิธีเล่นโหมดเพลงรายวัน
            </h3>
            <p className="text-xs text-stone-500">Heardle Progressive Audio Slice</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <div className="flex gap-3">
            <span className="font-bold text-amber-500 shrink-0">1.</span>
            <span>ฟังตัวอย่างเสี้ยววินาทีของเพลงประจำวันนี้ เริ่มต้นเพียง <strong>0.1 วินาที (100 คะแนน)</strong></span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-amber-500 shrink-0">2.</span>
            <span>พิมพ์ชื่อเพลงในช่องค้นหาหรือเลือกจากตัวช่วย หากตอบถูกจะได้รับคะแนนตามสเต็ปนั้นทันที</span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-amber-500 shrink-0">3.</span>
            <span>หากตอบผิดหรือกด <strong>&quot;ฟังเพิ่ม (+วิ)&quot;</strong> เสียงจะยาวขึ้น (0.5s, 1.0s, 2.0s, 4.0s) โดยคะแนนจะลดลงทีละ 20 แต้ม</span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-amber-500 shrink-0">4.</span>
            <span>มีโอกาสทาย 5 สเต็ปต่อวัน หากทายผิดครบ 5 ครั้งหรือกดยอมแพ้ เพลงจะเฉลยทันที</span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-amber-500 shrink-0">5.</span>
            <span>เล่นต่อเนื่องทุกวันเพื่อสะสมสตรีค (Streak) หรือคลิก <strong>&quot;📅 เล่นย้อนหลัง&quot;</strong> เพื่อเล่นวันก่อนหน้าได้</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
        >
          เข้าใจแล้ว เริ่มเล่นเลย
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Modal 2: Stats Modal ("📊 สถิติ")
// ==========================================

export function DailyStatsModal({
  isOpen,
  onClose,
  stats,
}: {
  isOpen: boolean;
  onClose: () => void;
  stats: DailyUserStats | null;
}): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded-xl transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-serif text-stone-900 dark:text-white">
              สถิติเพลงรายวัน
            </h3>
            <p className="text-xs text-stone-500">Daily Challenge Statistics</p>
          </div>
        </div>

        {/* 4 Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 text-center">
            <div className="text-2xl font-black font-mono text-stone-900 dark:text-white">
              {stats?.totalPlayed ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-stone-500 mt-0.5">เล่นทั้งหมด</div>
          </div>
          <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 text-center">
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {`${stats?.winRate ?? 0}%`}
            </div>
            <div className="text-[11px] font-semibold text-stone-500 mt-0.5">ชนะ (%)</div>
          </div>
          <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 text-center">
            <div className="text-2xl font-black font-mono text-amber-500 flex items-center justify-center gap-1">
              <Flame className="w-5 h-5 fill-amber-500" />
              <span>{stats?.currentStreak ?? 0}</span>
            </div>
            <div className="text-[11px] font-semibold text-stone-500 mt-0.5">สตรีคปัจจุบัน</div>
          </div>
          <div className="bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 text-center">
            <div className="text-2xl font-black font-mono text-orange-500">
              {stats?.maxStreak ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-stone-500 mt-0.5">สตรีคสูงสุด</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-sm transition-colors cursor-pointer"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Modal 3: Archive Drawer / Modal ("📅 เล่นย้อนหลัง")
// ==========================================

export function DailyArchiveModal({
  isOpen,
  onClose,
  pastDates,
  attemptsByDate,
  currentDate,
  onSelectDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  pastDates: string[];
  attemptsByDate: Map<string, DailyAttempt>;
  currentDate: string;
  onSelectDate: (date: string) => void;
}): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded-xl transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-serif text-stone-900 dark:text-white">
              ปฏิทินเพลงรายวัน
            </h3>
            <p className="text-xs text-stone-500">เลือกเล่นเพลงย้อนหลังได้สูงสุด 30 วัน</p>
          </div>
        </div>

        {/* Scrollable Date List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {pastDates.map((dateStr) => {
            const attempt = attemptsByDate.get(dateStr);
            const isToday = dateStr === getTodayDateString();
            const isSelected = dateStr === currentDate;

            let statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                ⚪ ยังไม่ได้เล่น
              </span>
            );

            if (attempt) {
              if (attempt.isCorrect) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    {`🟢 ชนะ (สเต็ป ${attempt.step}/5 • ${attempt.score} แต้ม)`}
                  </span>
                );
              } else {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                    🔴 ไม่สำเร็จ
                  </span>
                );
              }
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  onSelectDate(dateStr);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer min-h-[48px] ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-sm"
                    : "border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/60 dark:bg-stone-950/40"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs sm:text-sm font-bold font-mono text-stone-900 dark:text-white">
                    {formatThaiDate(dateStr)}
                  </span>
                  {isToday && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-stone-950">
                      วันนี้
                    </span>
                  )}
                </div>

                <div className="shrink-0">{statusBadge}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Modal 4: Surrender Confirm Dialog ("ขอยอมแพ้")
// ==========================================

export function DailySurrenderModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-2xl relative text-center animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
          <Flag className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold font-serif text-stone-900 dark:text-white mb-1.5">
          ขอยอมแพ้เพลงประจำวันนี้?
        </h3>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
          หากกดยอมแพ้ ระบบจะเฉลยเพลงประจำวันนี้ทันที และรอบนี้จะถือว่าไม่สำเร็จ (ได้ 0 คะแนน)
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            เล่นต่อ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm transition cursor-pointer"
          >
            ยืนยันยอมแพ้
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Authenticated Gameplay Screen Component
// ==========================================

function DailyGameplayContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading, isGuest } = useAuth();

  // Query parameter Date
  const dateParam = searchParams.get("date");
  const currentDate = useMemo(() => {
    if (dateParam && isValidDateString(dateParam)) {
      return dateParam;
    }
    return getTodayDateString();
  }, [dateParam]);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Challenge Loading State
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Gameplay State
  const [step, setStep] = useState<number>(1);
  const [songId, setSongId] = useState<string>("");
  const [sliceStartSec, setSliceStartSec] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [userScore, setUserScore] = useState<number>(0);
  const [previousGuesses, setPreviousGuesses] = useState<string[]>([]);
  const [revealedSong, setRevealedSong] = useState<Partial<Song> | null>(null);
  const [userStats, setUserStats] = useState<DailyUserStats | null>(null);
  const [allAttempts, setAllAttempts] = useState<DailyAttempt[]>([]);

  // Guess Input & Autocomplete State
  const [userGuess, setUserGuess] = useState("");
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [songsPool, setSongsPool] = useState<Song[]>([]);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);

  // Audio Playback State
  const [isPlayingSlice, setIsPlayingSlice] = useState(false);
  const [isMuted, setIsMuted] = useState(isMasterMuted());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Full Song Playback State (for revealed answer)
  const [isFullPlaying, setIsFullPlaying] = useState(false);
  const [fullCurrentTime, setFullCurrentTime] = useState(0);
  const [fullDuration, setFullDuration] = useState(0);
  const fullAudioRef = useRef<HTMLAudioElement | null>(null);

  // Modals State
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isSurrenderOpen, setIsSurrenderOpen] = useState(false);
  const [hasCopiedShare, setHasCopiedShare] = useState(false);

  // Master volume subscription
  useEffect(() => {
    const unsub = subscribeMasterVolume((vol: number) => {
      const muted = isMasterMuted();
      setIsMuted(muted);
      if (audioRef.current) {
        audioRef.current.volume = vol;
        audioRef.current.muted = muted;
      }
      if (fullAudioRef.current) {
        fullAudioRef.current.volume = vol;
        fullAudioRef.current.muted = muted;
      }
    });
    return () => unsub();
  }, []);

  // Preload song library for autocomplete
  useEffect(() => {
    loadPublicSongLibrary()
      .then((songs) => {
        if (Array.isArray(songs)) setSongsPool(songs);
      })
      .catch(() => {});
  }, []);

  // Map attempts by date for fast status lookup in Archive Modal
  const attemptsByDate = useMemo(() => {
    const map = new Map<string, DailyAttempt>();
    for (const att of allAttempts) {
      map.set(att.date, att);
    }
    return map;
  }, [allAttempts]);

  // Past 30 days list
  const past30Dates = useMemo(() => {
    return getPastDatesList(30);
  }, []);

  // Load Daily Challenge Info for current date
  useEffect(() => {
    if (isAuthLoading || !user || isGuest) return;

    let isCancelled = false;
    setIsLoadingChallenge(true);
    setChallengeError(null);
    setUserGuess("");
    setSuggestions([]);

    // Stop existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (fullAudioRef.current) {
      fullAudioRef.current.pause();
      fullAudioRef.current = null;
    }
    setIsPlayingSlice(false);
    setIsFullPlaying(false);

    fetch(`/api/daily?date=${currentDate}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "ไม่สามารถโหลดข้อมูลเพลงประจำวันได้");
        }
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;
        setSongId(data.songId || "");
        setSliceStartSec(data.sliceStartSec || 0);
        setUserStats(data.userStats || null);
        if (Array.isArray(data.allAttempts)) {
          setAllAttempts(data.allAttempts);
        }

        if (data.isCompleted && data.revealedSong) {
          setIsCompleted(true);
          setIsCorrect(Boolean(data.userAttempt?.isCorrect));
          setUserScore(data.userAttempt?.score ?? 0);
          setStep(data.userAttempt?.step ?? 5);
          setPreviousGuesses(data.userAttempt?.guesses ?? []);
          setRevealedSong(data.revealedSong);
        } else {
          setIsCompleted(false);
          setIsCorrect(false);
          setUserScore(0);
          setStep(1);
          setPreviousGuesses([]);
          setRevealedSong(null);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setChallengeError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingChallenge(false);
      });

    return () => {
      isCancelled = true;
      if (sliceTimeoutRef.current) clearTimeout(sliceTimeoutRef.current);
    };
  }, [currentDate, user, isAuthLoading, isGuest]);

  // Current progressive step config
  const currentStepConfig = getProgressiveStep(step);
  const nextStepConfig = step < 5 ? PROGRESSIVE_SLICE_STEPS[step] : null;

  // Stop slice audio safely
  const stopSliceAudio = () => {
    if (sliceTimeoutRef.current) {
      clearTimeout(sliceTimeoutRef.current);
      sliceTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingSlice(false);
  };

  // Play audio slice for duration
  const handlePlaySlice = (customDuration?: number) => {
    if (!songId) return;

    stopSliceAudio();

    const duration = customDuration ?? currentStepConfig.durationSec;
    const sliceUrl = `/api/audio/slice?id=${songId}&start=${sliceStartSec}&duration=${duration}`;

    try {
      playClickSound();
      const audio = new Audio(sliceUrl);
      audio.volume = getMasterVolume();
      audio.muted = isMasterMuted();
      audioRef.current = audio;
      setIsPlayingSlice(true);

      audio.onended = () => {
        setIsPlayingSlice(false);
      };

      audio.onerror = () => {
        setIsPlayingSlice(false);
      };

      audio.play().catch(() => {
        setIsPlayingSlice(false);
      });

      // Strict timeout guarantee for precise Heardle slice
      sliceTimeoutRef.current = setTimeout(() => {
        if (audioRef.current === audio) {
          audio.pause();
          setIsPlayingSlice(false);
        }
      }, duration * 1000 + 250);
    } catch {
      setIsPlayingSlice(false);
    }
  };

  // Advance step ("ฟังเพิ่ม (+วิ)")
  const handleAdvanceStep = () => {
    if (step >= 5 || isCompleted) return;
    const nextStep = step + 1;
    setStep(nextStep);

    // Record skipped step in previous attempts
    const skipLabel = `ข้าม (สเต็ป ${step})`;
    const updatedGuesses = [...previousGuesses, skipLabel];
    setPreviousGuesses(updatedGuesses);

    const nextConfig = PROGRESSIVE_SLICE_STEPS[nextStep - 1];
    if (nextConfig) {
      handlePlaySlice(nextConfig.durationSec);
    }
  };

  // Handle Autocomplete Suggestions
  const handleInputChange = (val: string) => {
    setUserGuess(val);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    const matched = searchSongAutocomplete(val, songsPool, 6);
    setSuggestions(matched);
  };

  // Submit Guess
  const handleSubmitGuess = async (guessOverride?: string) => {
    const guess = (guessOverride ?? userGuess).trim();
    if (!guess || isSubmittingGuess || isCompleted) return;

    setIsSubmittingGuess(true);
    setSuggestions([]);

    try {
      playClickSound();
      const res = await fetch("/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: currentDate,
          guessTitle: guess,
          step,
          isSurrender: false,
          previousGuesses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการส่งคำตอบ");
      }

      if (Array.isArray(data.allAttempts)) {
        setAllAttempts(data.allAttempts);
      }
      if (data.userStats) {
        setUserStats(data.userStats);
      }

      const updatedGuesses = data.userAttempt?.guesses ?? [...previousGuesses, guess];
      setPreviousGuesses(updatedGuesses);

      if (data.isCorrect) {
        playCorrectSound();
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
        setIsCompleted(true);
        setIsCorrect(true);
        setUserScore(data.scoreDelta || currentStepConfig.points);
        setRevealedSong(data.revealedSong);
      } else {
        playWrongSound();
        if (data.isCompleted) {
          // Reached step 5 and wrong
          setIsCompleted(true);
          setIsCorrect(false);
          setUserScore(0);
          setRevealedSong(data.revealedSong);
        } else {
          // Advance to next step
          setStep((prev) => Math.min(5, prev + 1));
          setUserGuess("");
        }
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการส่งคำตอบ");
    } finally {
      setIsSubmittingGuess(false);
    }
  };

  // Confirm Surrender
  const handleConfirmSurrender = async () => {
    setIsSurrenderOpen(false);
    if (isCompleted) return;

    try {
      playClickSound();
      const res = await fetch("/api/daily/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: currentDate,
          step,
          isSurrender: true,
          previousGuesses,
        }),
      });

      const data = await res.json();
      if (data.revealedSong) {
        setIsCompleted(true);
        setIsCorrect(false);
        setUserScore(0);
        setRevealedSong(data.revealedSong);
        if (data.userStats) setUserStats(data.userStats);
        if (Array.isArray(data.allAttempts)) setAllAttempts(data.allAttempts);
      }
    } catch {
      // Graceful fallback
    }
  };

  // Revealed Full Song Playback
  const handleToggleFullAudio = () => {
    if (!revealedSong?.audioUrl) return;

    if (isFullPlaying && fullAudioRef.current) {
      fullAudioRef.current.pause();
      setIsFullPlaying(false);
      return;
    }

    if (!fullAudioRef.current) {
      const audio = new Audio(revealedSong.audioUrl);
      audio.volume = getMasterVolume();
      audio.muted = isMasterMuted();
      audio.ontimeupdate = () => setFullCurrentTime(audio.currentTime);
      audio.onloadedmetadata = () => setFullDuration(audio.duration);
      audio.onended = () => setIsFullPlaying(false);
      fullAudioRef.current = audio;
    }

    fullAudioRef.current
      .play()
      .then(() => setIsFullPlaying(true))
      .catch(() => setIsFullPlaying(false));
  };

  const handleFullSeek = (sec: number) => {
    if (fullAudioRef.current) {
      fullAudioRef.current.currentTime = sec;
      setFullCurrentTime(sec);
    }
  };

  // Wordle/Heardle Style Share
  const handleShareResult = async () => {
    const formattedThai = formatThaiDate(currentDate);
    const shareText = generateDailyShareText({
      dateFormatted: formattedThai,
      isCorrect,
      step,
      score: userScore,
      currentStreak: userStats?.currentStreak ?? 0,
    });

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setHasCopiedShare(true);
        setTimeout(() => setHasCopiedShare(false), 3000);
      }
    } catch {
      // Fallback
    }
  };

  // ==========================================
  // Render Branch 1: Auth Loading
  // ==========================================
  if (isAuthLoading) {
    return <DailyLoadingSkeleton />;
  }

  // ==========================================
  // Render Branch 2: Member Exclusive Gate
  // ==========================================
  if (!user || isGuest) {
    return (
      <>
        <MemberExclusiveLandingCard onOpenAuth={() => setIsAuthModalOpen(true)} />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  // ==========================================
  // Render Branch 3: Authenticated Gameplay
  // ==========================================
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-stone-200 dark:border-stone-800/80 bg-white/80 dark:bg-stone-900/70 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 sticky top-0 z-30 flex items-center justify-between">
        {/* Left: Home link & Date badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
            title="กลับหน้าแรก"
            aria-label="กลับหน้าแรก"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-sm font-bold font-serif text-stone-900 dark:text-white">
                เพลงรายวัน
              </h1>
              <span className="text-[11px] sm:text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                {formatThaiDate(currentDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Streak, Archive, Stats & Help Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Streak Flame Badge */}
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-xs sm:text-sm"
            title={`สตรีคปัจจุบัน: ${userStats?.currentStreak || 0} วัน`}
          >
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>{`🔥 ${userStats?.currentStreak || 0} วัน`}</span>
          </div>

          {/* Calendar / Archive Button */}
          <button
            type="button"
            onClick={() => setIsArchiveOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-amber-500/40 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer min-h-[38px]"
            title="เล่นย้อนหลัง"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">เล่นย้อนหลัง</span>
            <span className="sm:hidden">ปฏิทิน</span>
          </button>

          {/* Stats Button */}
          <button
            type="button"
            onClick={() => setIsStatsOpen(true)}
            className="w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-amber-500/40 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-h-[38px]"
            title="สถิติ"
            aria-label="สถิติ"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">สถิติ</span>
          </button>

          {/* Help Button */}
          <button
            type="button"
            onClick={() => setIsRulesOpen(true)}
            className="w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-amber-500/40 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-h-[38px]"
            title="วิธีเล่น"
            aria-label="วิธีเล่น"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">วิธีเล่น</span>
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={toggleMasterMute}
            aria-label={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer ${
              isMuted
                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-500 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center items-center gap-6">
        {isLoadingChallenge ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-xs sm:text-sm font-medium text-stone-500">
              กำลังโหลดเพลงประจำวัน...
            </p>
          </div>
        ) : challengeError ? (
          <div className="w-full bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-3xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-rose-900 dark:text-rose-200 mb-1">
              เกิดข้อผิดพลาด
            </h3>
            <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 mb-4">
              {challengeError}
            </p>
            <button
              type="button"
              onClick={() => router.push(`/daily?date=${getTodayDateString()}`)}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
            >
              กลับสู่วันนี้
            </button>
          </div>
        ) : isCompleted ? (
          /* ======================================================== */
          /* GAME COMPLETION STATE (WIN OR LOSS)                      */
          /* ======================================================== */
          <div className="w-full space-y-5 animate-in fade-in duration-300">
            {/* Banner */}
            <div
              className={`p-4 sm:p-5 rounded-3xl border flex items-center justify-between gap-3 shadow-md ${
                isCorrect
                  ? "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100"
                  : "bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100"
              }`}
            >
              <div className="flex items-center gap-3">
                {isCorrect ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-7 h-7 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    {isCorrect
                      ? `🎉 ยินดีด้วย! คุณทายถูกในสเต็ป ${step}/5 (${userScore} คะแนน)`
                      : "😢 หมดโอกาสแล้ว! เพลงประจำวันนี้คือ..."}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    {isCorrect
                      ? `ยอดเยี่ยม! คุณสะสมสตรีคได้ ${userStats?.currentStreak || 0} วันติดต่อกัน`
                      : "อย่าเพิ่งท้อ! กลับมาแก้มือใหม่ได้ในวันพรุ่งนี้ หรือเลือกเล่นย้อนหลัง"}
                  </p>
                </div>
              </div>
            </div>

            {/* Vinyl Disc & Revealed Song Card */}
            {revealedSong && (
              <div className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row items-center gap-5">
                {/* Spinning Vinyl Disc */}
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-stone-950 border-4 border-stone-700 shadow-xl relative flex items-center justify-center shrink-0 select-none animate-[spin_6s_linear_infinite] ${
                    !isFullPlaying ? "[animation-play-state:paused]" : ""
                  }`}
                  aria-hidden="true"
                >
                  <div className="absolute inset-2 rounded-full border border-stone-800" />
                  <div className="absolute inset-4 rounded-full border border-stone-800/80" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
                  <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shadow-md relative">
                    <Disc3 className="w-5 h-5 text-stone-950" />
                    <div className="absolute w-2 h-2 rounded-full bg-stone-950 shadow-inner" />
                  </div>
                </div>

                {/* Song Meta & Audio Player */}
                <div className="flex-1 min-w-0 text-center sm:text-left w-full">
                  <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">
                    เฉลยเพลงประจำวัน
                  </div>
                  <h4 className="text-base sm:text-lg lg:text-xl font-bold font-serif text-stone-900 dark:text-white truncate">
                    {revealedSong.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate">
                    {revealedSong.artist}
                    {revealedSong.album ? ` • อัลบั้ม ${revealedSong.album}` : ""}
                    {revealedSong.releaseYear ? ` • ปี ${revealedSong.releaseYear}` : ""}
                  </p>

                  {/* Audio Player Controls */}
                  {revealedSong.audioUrl && (
                    <div className="mt-3 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleToggleFullAudio}
                        aria-label={isFullPlaying ? "หยุดเพลง" : "ฟังเพลงเต็ม"}
                        className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center transition shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                          isFullPlaying
                            ? "bg-rose-500 hover:bg-rose-600 text-white"
                            : "bg-amber-500 hover:bg-amber-400 text-stone-950"
                        }`}
                      >
                        {isFullPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {formatTime(fullCurrentTime)}
                          </span>
                          <span className="text-stone-400">
                            {fullDuration > 0 ? formatTime(fullDuration) : "--:--"}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={fullDuration > 0 ? fullDuration : 100}
                          step="0.5"
                          value={Math.min(fullCurrentTime, fullDuration > 0 ? fullDuration : 100)}
                          onChange={(e) => handleFullSeek(parseFloat(e.target.value))}
                          aria-label="แถบเลื่อนเวลาเพลง"
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Wordle/Heardle Style Share Box */}
            <div className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-6 shadow-md">
              <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                แชร์ผลลัพธ์ของคุณ
              </div>

              {/* Preformatted Box */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950 font-mono text-xs sm:text-sm text-stone-800 dark:text-stone-200 whitespace-pre leading-relaxed border border-stone-200 dark:border-stone-800/80 mb-4 select-all">
                {generateDailyShareText({
                  dateFormatted: formatThaiDate(currentDate),
                  isCorrect,
                  step,
                  score: userScore,
                  currentStreak: userStats?.currentStreak ?? 0,
                })}
              </div>

              {/* Copy CTA Button */}
              <button
                type="button"
                onClick={handleShareResult}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  hasCopiedShare
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 hover:bg-amber-400 text-stone-950"
                }`}
              >
                {hasCopiedShare ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>คัดลอกแล้ว! พร้อมแชร์</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกผลลัพธ์ (Copy)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* HEARDLE-STYLE 5-STEP PROGRESSIVE GAMEPLAY                */
          /* ======================================================== */
          <div className="w-full space-y-6">
            {/* 5-block Segmented Timeline Bar */}
            <div className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 shadow-xs">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {PROGRESSIVE_SLICE_STEPS.map((sConfig) => {
                  const isActive = step === sConfig.step;
                  const isPassed = step > sConfig.step;
                  return (
                    <div
                      key={sConfig.step}
                      className={`h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center transition-all ${
                        isActive
                          ? "bg-amber-500 text-stone-950 ring-2 ring-amber-400 font-bold shadow-md shadow-amber-500/20"
                          : isPassed
                          ? "bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                          : "bg-stone-100 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800/60 text-stone-400 dark:text-stone-600"
                      }`}
                    >
                      <span className="text-[11px] sm:text-xs font-mono font-bold">
                        {sConfig.label}
                      </span>
                      <span className="text-[9px] sm:text-[10px] opacity-80">
                        {`${sConfig.points} แต้ม`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Central Audio Play & Advance Action Buttons */}
            <div className="flex flex-col items-center justify-center gap-4 py-2">
              {/* Play Button */}
              <button
                type="button"
                onClick={() => handlePlaySlice()}
                disabled={isPlayingSlice}
                aria-label={`ฟัง ${currentStepConfig.durationSec}s`}
                className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center gap-1.5 transition-transform duration-75 active:scale-95 touch-manipulation cursor-pointer ${
                  isPlayingSlice
                    ? "bg-amber-500 text-stone-950 scale-105 shadow-2xl shadow-amber-500/40 animate-pulse"
                    : "bg-amber-500 hover:bg-amber-400 hover:scale-105 text-stone-950 shadow-lg shadow-amber-500/25"
                }`}
              >
                {isPlayingSlice ? (
                  <>
                    <Volume2 className="w-10 h-10 animate-bounce text-stone-950" />
                    <span className="text-xs font-bold font-mono">
                      {`กำลังเล่น... (${currentStepConfig.durationSec}s)`}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-10 h-10 fill-current ml-1 text-stone-950" />
                    <span className="text-xs font-bold font-mono">
                      {`ฟัง ${currentStepConfig.durationSec}s`}
                    </span>
                  </>
                )}
              </button>

              {/* Action Buttons: Advance Step & Surrender */}
              <div className="flex items-center gap-2">
                {step < 5 ? (
                  <button
                    type="button"
                    onClick={handleAdvanceStep}
                    disabled={isPlayingSlice}
                    className="px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 min-h-[44px]"
                  >
                    <FastForward className="w-4 h-4 text-amber-500" />
                    <span>
                      {`ฟังเพิ่ม (+วิ) ➔ ${nextStepConfig?.durationSec}s (-20 แต้ม)`}
                    </span>
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-800/60 text-stone-500 text-xs font-semibold">
                    ความยาวสูงสุดแล้ว (4.0s)
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsSurrenderOpen(true)}
                  className="px-3 py-2.5 rounded-2xl text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer min-h-[44px]"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>ขอยอมแพ้</span>
                </button>
              </div>
            </div>

            {/* Autocomplete Input & Submit Box */}
            <div className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
              <label className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 block">
                {`ทายชื่อเพลง (สเต็ป ${step}/5 • สูงสุด ${currentStepConfig.points} คะแนน):`}
              </label>

              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userGuess}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && userGuess.trim()) {
                        handleSubmitGuess();
                      }
                    }}
                    placeholder="พิมพ์ชื่อเพลงที่คิดว่าเป็น..."
                    disabled={isSubmittingGuess}
                    className="flex-1 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-2xl px-4 py-3 text-sm sm:text-base text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition min-h-[48px]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmitGuess()}
                    disabled={!userGuess.trim() || isSubmittingGuess}
                    className="px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-bold text-sm sm:text-base transition-colors cursor-pointer min-h-[48px] flex items-center justify-center shrink-0"
                  >
                    {isSubmittingGuess ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "ตอบ"
                    )}
                  </button>
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-1.5 shadow-2xl z-20 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                    {suggestions.map((song) => (
                      <button
                        key={song.id || song.title}
                        type="button"
                        onClick={() => {
                          setUserGuess(song.title);
                          setSuggestions([]);
                          handleSubmitGuess(song.title);
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition flex items-center justify-between text-stone-800 dark:text-stone-200 cursor-pointer min-h-[40px]"
                      >
                        <span className="font-semibold text-stone-900 dark:text-white truncate">
                          {song.title}
                        </span>
                        <span className="text-stone-400 text-xs ml-2 shrink-0">
                          {song.artist}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Previous Attempts List */}
              {previousGuesses.length > 0 && (
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 space-y-1.5">
                  <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    ประวัติการทายในรอบนี้:
                  </div>
                  {previousGuesses.map((guess, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-950/40 px-3 py-2 rounded-xl border border-stone-200/80 dark:border-stone-800/60"
                    >
                      <span className="text-rose-500 font-bold shrink-0">❌ {idx + 1}.</span>
                      <span className="truncate">{guess}</span>
                      <span className="text-[11px] text-stone-400 ml-auto shrink-0">
                        (ข้าม/ตอบผิด)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <DailyRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <DailyStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={userStats}
      />
      <DailyArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        pastDates={past30Dates}
        attemptsByDate={attemptsByDate}
        currentDate={currentDate}
        onSelectDate={(newDate) => {
          router.push(`/daily?date=${newDate}`);
        }}
      />
      <DailySurrenderModal
        isOpen={isSurrenderOpen}
        onClose={() => setIsSurrenderOpen(false)}
        onConfirm={handleConfirmSurrender}
      />
    </div>
  );
}

// ==========================================
// Root Page Component with Suspense Boundary
// ==========================================

export default function DailyPage(): React.JSX.Element {
  return (
    <Suspense fallback={<DailyLoadingSkeleton />}>
      <DailyGameplayContent />
    </Suspense>
  );
}
