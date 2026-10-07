"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Buzzer Button Component
// Vintage Brass & Amber Lo-Fi Buzzer Button
// FCFS locking, Spacebar hotkey, haptic feedback and dual light/dark styling
// ==========================================

import React, { useEffect, useCallback } from "react";
import { Bell, Sparkles, Lock, XCircle, Loader2 } from "lucide-react";

export type BuzzerStatus =
  | "idle"
  | "ready"
  | "buzzed_by_me"
  | "locked_by_other"
  | "excluded";

export interface BuzzerButtonProps {
  status: BuzzerStatus;
  buzzedPlayerName?: string;
  onBuzz: () => void;
  disabled?: boolean;
}

/**
 * Resolves room realtime state into one of the 5 canonical BuzzerStatus states.
 */
export function resolveBuzzerStatus(params: {
  status: string;
  isMyBuzz: boolean;
  buzzedPlayer?: { id?: string; displayName?: string } | null;
  isExcludedFromBuzz: boolean;
}): BuzzerStatus {
  if (params.status === "buzzed") {
    if (params.isMyBuzz) return "buzzed_by_me";
    return "locked_by_other";
  }
  if (params.status === "question_active") {
    if (params.isExcludedFromBuzz) return "excluded";
    return "ready";
  }
  return "idle";
}

export function BuzzerButton({
  status,
  buzzedPlayerName,
  onBuzz,
  disabled = false,
}: BuzzerButtonProps): React.JSX.Element {
  // Safe haptic feedback trigger
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([45]);
      }
    } catch {}
  }, []);

  // Handle buzzer press
  const handlePress = useCallback(() => {
    if (status !== "ready" || disabled) return;
    triggerHaptic();
    onBuzz();
  }, [status, disabled, onBuzz, triggerHaptic]);

  // Spacebar keyboard listener when status is "ready"
  useEffect(() => {
    if (status !== "ready" || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // Don't intercept Spacebar if focused inside an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        triggerHaptic();
        onBuzz();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [status, disabled, onBuzz, triggerHaptic]);

  // Visual layout based on status
  const isClickable = status === "ready" && !disabled;

  return (
    <div className="flex flex-col items-center justify-center relative my-4 select-none">
      {/* Outer pulse wave for ready state */}
      {status === "ready" && !disabled && (
        <div
          aria-hidden="true"
          className="absolute w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-[380px] lg:h-[380px] xl:w-[440px] xl:h-[440px] rounded-full bg-amber-500/20 animate-ping pointer-events-none"
        />
      )}

      {/* Main giant circular button */}
      <button
        type="button"
        onClick={handlePress}
        disabled={!isClickable}
        aria-label={
          status === "ready"
            ? "กดกริ่งแย่งตอบ (Space)"
            : status === "buzzed_by_me"
            ? "คุณได้สิทธิ์ตอบ"
            : status === "locked_by_other"
            ? `${buzzedPlayerName || "มีผู้เล่นอื่น"} กำลังตอบ`
            : status === "excluded"
            ? "คุณตอบผิดในข้อนี้แล้ว"
            : "รอเริ่มรอบ"
        }
        className={`relative z-10 w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96 rounded-full flex flex-col items-center justify-center p-4 text-center touch-manipulation [touch-action:manipulation] active:scale-95 transition-transform duration-75 border-4 shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/50 ${
          status === "ready" && !disabled
            ? "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 border-amber-200 dark:border-amber-300 text-stone-950 shadow-[0_0_40px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
            : status === "buzzed_by_me"
            ? "bg-gradient-to-br from-amber-500/30 to-amber-700/40 border-amber-400 text-amber-800 dark:text-amber-200 shadow-[0_0_45px_rgba(245,158,11,0.6)] cursor-default ring-4 ring-amber-400/40"
            : status === "locked_by_other"
            ? "bg-stone-200/90 dark:bg-stone-900/90 border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 shadow-none cursor-not-allowed opacity-80"
            : status === "excluded"
            ? "bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/50 text-rose-800 dark:text-rose-300 shadow-none cursor-not-allowed"
            : "bg-stone-100 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500 shadow-none cursor-not-allowed"
        }`}
      >
        {status === "ready" && (
          <>
            <div className="p-3 sm:p-3.5 md:p-4 lg:p-5 xl:p-6 bg-white/30 rounded-full backdrop-blur-sm mb-2 lg:mb-3 shadow-inner">
              <Bell className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 xl:w-22 xl:h-22 text-stone-950 animate-bounce" />
            </div>
            <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black tracking-wide drop-shadow-sm text-stone-950">
              กดกริ่ง!
            </span>
            <span className="text-xs sm:text-sm lg:text-base font-semibold text-stone-900 mt-1 uppercase tracking-wider bg-black/15 px-2.5 py-0.5 lg:px-4 lg:py-1 rounded-full">
              (SPACE)
            </span>
          </>
        )}

        {status === "buzzed_by_me" && (
          <>
            <div className="p-3 sm:p-3.5 md:p-4 lg:p-5 xl:p-6 bg-amber-400/20 rounded-full mb-2 lg:mb-3">
              <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 xl:w-22 xl:h-22 text-amber-500 dark:text-amber-300 animate-spin" />
            </div>
            <span className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-black text-amber-800 dark:text-amber-300 leading-tight">
              คุณได้สิทธิ์ตอบ!
            </span>
            <span className="text-xs sm:text-sm lg:text-base font-semibold text-amber-700 dark:text-amber-200/80 mt-1 bg-amber-500/20 dark:bg-amber-950/60 px-2 py-0.5 lg:px-3 lg:py-1 rounded-full">
              (ตอบด่วน)
            </span>
          </>
        )}

        {status === "locked_by_other" && (
          <>
            <div className="p-3 sm:p-3.5 md:p-4 lg:p-5 xl:p-6 bg-stone-300 dark:bg-stone-800 rounded-full mb-2 lg:mb-3">
              <Lock className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-stone-600 dark:text-stone-400" />
            </div>
            <span className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-stone-800 dark:text-stone-200 px-3 line-clamp-2 leading-tight">
              {buzzedPlayerName ? `[${buzzedPlayerName}]` : "ผู้เล่นอื่น"}
            </span>
            <span className="text-xs sm:text-sm lg:text-base text-stone-500 dark:text-stone-400 mt-1">กำลังตอบ...</span>
          </>
        )}

        {status === "excluded" && (
          <>
            <div className="p-3 sm:p-3.5 md:p-4 lg:p-5 xl:p-6 bg-rose-200 dark:bg-rose-950/80 rounded-full mb-2 lg:mb-3 border border-rose-300 dark:border-rose-500/30">
              <XCircle className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-rose-600 dark:text-rose-400" />
            </div>
            <span className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold text-rose-800 dark:text-rose-300 px-2 leading-tight">
              คุณตอบผิดในข้อนี้แล้ว
            </span>
            <span className="text-[11px] sm:text-xs lg:text-sm text-rose-600 dark:text-rose-400/70 mt-1">
              รอข้อถัดไป
            </span>
          </>
        )}

        {status === "idle" && (
          <>
            <div className="p-3 sm:p-3.5 md:p-4 lg:p-5 xl:p-6 bg-stone-200 dark:bg-stone-800/60 rounded-full mb-2 lg:mb-3">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-stone-500 dark:text-slate-600 animate-spin" />
            </div>
            <span className="text-sm sm:text-base lg:text-lg font-medium text-stone-500">
              รอเริ่มรอบถัดไป...
            </span>
          </>
        )}
      </button>

      {/* Helper cue label underneath button */}
      <div className="mt-3 text-center">
        {status === "ready" && !disabled && (
          <p className="text-xs sm:text-sm lg:text-base text-amber-800 dark:text-amber-300/90 font-medium">
            กดปุ่มด้านบน หรือเคาะ <kbd className="px-1.5 py-0.5 lg:px-2.5 lg:py-1 bg-stone-200 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded text-stone-800 dark:text-stone-200 text-xs lg:text-sm font-mono shadow-sm">Spacebar</kbd>
          </p>
        )}
        {status === "locked_by_other" && (
          <p className="text-xs sm:text-sm lg:text-base text-stone-500 dark:text-stone-400 font-medium animate-pulse">
            รอฟังผลคำตอบ ถ้าตอบผิด กริ่งจะเปิดอีกครั้ง!
          </p>
        )}
        {status === "excluded" && (
          <p className="text-xs sm:text-sm lg:text-base text-rose-600 dark:text-rose-400/80 font-medium">
            สิทธิ์ตอบข้อนี้หมดลงแล้ว ให้กำลังใจเพื่อนๆ อยู่ตรงนี้!
          </p>
        )}
      </div>
    </div>
  );
}

export default BuzzerButton;
