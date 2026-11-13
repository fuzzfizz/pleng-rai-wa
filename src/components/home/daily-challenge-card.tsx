"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Daily Challenge Homepage Card
// Warm Lo-Fi Aesthetic, Heardle-style daily song teaser & streak indicator
// Member-exclusive prompt for guests, play/results action for members
// ==========================================

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Flame,
  Lock,
  ArrowRight,
  Music,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getTodayDateString,
  formatThaiDate,
} from "@/lib/services/daily-challenge-service";
import { soundEffects } from "@/lib/sound-effects";

export interface DailyChallengeCardProps {
  onOpenAuth?: (tab?: "signin" | "signup") => void;
  className?: string;
  date?: string;
  initialDailyData?: {
    isCompleted?: boolean;
    userAttempt?: {
      step?: number;
      score?: number;
      isCorrect?: boolean;
      [key: string]: any;
    } | null;
    userStats?: {
      currentStreak?: number;
      [key: string]: any;
    } | null;
    [key: string]: any;
  } | null;
}

export function DailyChallengeCard({
  onOpenAuth,
  className = "",
  date,
  initialDailyData,
}: DailyChallengeCardProps): React.JSX.Element {
  const { user, isGuest } = useAuth();
  const isMember = Boolean(user && !isGuest);

  const todayStr = date || getTodayDateString();
  const formattedDate = formatThaiDate(todayStr);

  const [dailyData, setDailyData] = useState<{
    isCompleted?: boolean;
    userAttempt?: {
      step?: number;
      score?: number;
      isCorrect?: boolean;
    } | null;
    userStats?: {
      currentStreak?: number;
    } | null;
  } | null>(initialDailyData || null);

  const [isLoading, setIsLoading] = useState(false);

  // Sync initialDailyData if prop changes
  useEffect(() => {
    if (initialDailyData !== undefined) {
      setDailyData(initialDailyData);
    }
  }, [initialDailyData]);

  // Fetch daily challenge attempt and stats if user is authenticated member
  useEffect(() => {
    if (!isMember || initialDailyData !== undefined) {
      return;
    }

    let isMounted = true;
    async function fetchDailyStatus() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/daily?date=${todayStr}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setDailyData({
            isCompleted: Boolean(data.isCompleted),
            userAttempt: data.userAttempt || null,
            userStats: data.userStats || null,
          });
        }
      } catch (err) {
        console.error("Failed to fetch daily challenge status:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDailyStatus();
    return () => {
      isMounted = false;
    };
  }, [isMember, todayStr, initialDailyData, user?.id]);

  const streak = isMember ? dailyData?.userStats?.currentStreak || 0 : 0;
  const isCompleted = isMember && Boolean(dailyData?.isCompleted || dailyData?.userAttempt);
  const attempt = dailyData?.userAttempt;

  return (
    <div
      data-testid="daily-challenge-card"
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 dark:from-amber-950/30 dark:via-stone-900/80 dark:to-orange-950/20 border border-amber-500/30 dark:border-amber-500/20 p-4 sm:p-5 shadow-lg shadow-amber-500/5 backdrop-blur-xl transition-all ${className}`}
    >
      {/* Decorative Warm Ambient Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 dark:bg-amber-400/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />

      {/* Header Area */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10">
            <span>📅 เพลงรายวัน (Daily Challenge)</span>
          </span>

          {/* Streak Badge */}
          {streak > 0 && (
            <span
              data-testid="daily-streak-badge"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 animate-pulse shadow-sm"
            >
              <span>{`🔥 สตรีค ${streak} วัน`}</span>
            </span>
          )}
        </div>

        {/* Formatted Date in Thai */}
        <span
          data-testid="daily-formatted-date"
          className="text-xs text-stone-500 dark:text-stone-400 font-medium tracking-wide flex items-center gap-1"
        >
          <span>{formattedDate}</span>
        </span>
      </div>

      {/* Body Area */}
      <div className="relative z-10">
        {!isMember ? (
          // Guest / Unauthenticated Mode
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                🔒 โหมดทายเพลงรายวันวันละ 1 เพลง เล่นย้อนหลังได้ สะสมสตรีค (เฉพาะสมาชิก)
              </span>
            </p>

            <button
              type="button"
              data-testid="daily-login-cta"
              onClick={() => {
                try {
                  soundEffects.click();
                } catch {}
                onOpenAuth?.("signin");
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer min-h-[44px]"
            >
              <span>เข้าสู่ระบบเพื่อเล่น (Daily) ➔</span>
            </button>
          </div>
        ) : isLoading ? (
          // Loading Skeleton
          <div className="py-2 space-y-2">
            <div className="h-4 w-3/4 bg-amber-500/10 rounded-full animate-pulse" />
            <div className="h-10 bg-amber-500/10 rounded-2xl animate-pulse" />
          </div>
        ) : isCompleted ? (
          // Authenticated & Completed Mode
          <div className="space-y-3">
            <div
              data-testid="daily-completed-status"
              className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                {attempt?.isCorrect
                  ? `🎉 สำเร็จในสเต็ป ${attempt.step}/5 (${attempt.score} แต้ม)`
                  : "เล่นเพลงวันนี้แล้ว"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Link
                href="/daily"
                data-testid="daily-view-result-btn"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-900 dark:text-white font-bold text-sm border border-stone-200 dark:border-stone-700 transition-all active:scale-[0.98] cursor-pointer min-h-[44px]"
              >
                <span>ดูผลลัพธ์ / แชร์เพลงวันนี้ ➔</span>
              </Link>
              <Link
                href="/daily"
                data-testid="daily-archive-quicklink"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                }}
                className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline px-3 py-2 text-center shrink-0 transition-colors"
              >
                <span>📅 เล่นย้อนหลัง (Archive)</span>
              </Link>
            </div>
          </div>
        ) : (
          // Authenticated & Not Completed Yet Mode
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Link
                href="/daily"
                data-testid="daily-start-btn"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer min-h-[44px]"
              >
                <span>🎵 เริ่มเล่นเพลงวันนี้ ➔</span>
              </Link>
              <Link
                href="/daily"
                data-testid="daily-archive-quicklink"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                }}
                className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline px-3 py-2 text-center shrink-0 transition-colors"
              >
                <span>📅 เล่นย้อนหลัง (Archive)</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
