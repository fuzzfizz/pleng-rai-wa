"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Buzzer Button Component
// Giant arcade buzzer button with FCFS locking, Spacebar hotkey,
// haptic vibration and responsive neon glow states
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
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(40);
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
          className="absolute w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full bg-pink-500/20 animate-ping pointer-events-none"
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
        className={`relative z-10 w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 rounded-full flex flex-col items-center justify-center p-4 text-center transition-all duration-200 border-4 shadow-2xl focus:outline-none focus:ring-4 focus:ring-pink-500/50 ${
          status === "ready" && !disabled
            ? "bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 border-pink-300 text-white shadow-[0_0_50px_rgba(236,72,153,0.7)] hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
            : status === "buzzed_by_me"
            ? "bg-gradient-to-br from-amber-500/30 to-amber-700/40 border-amber-400 text-amber-200 shadow-[0_0_45px_rgba(245,158,11,0.6)] cursor-default ring-4 ring-amber-400/40"
            : status === "locked_by_other"
            ? "bg-slate-900/90 border-slate-700 text-slate-400 shadow-none cursor-not-allowed opacity-80"
            : status === "excluded"
            ? "bg-rose-950/60 border-rose-500/50 text-rose-300 shadow-none cursor-not-allowed"
            : "bg-slate-900/60 border-slate-800 text-slate-500 shadow-none cursor-not-allowed"
        }`}
      >
        {status === "ready" && (
          <>
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm mb-2 shadow-inner">
              <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-bounce" />
            </div>
            <span className="text-xl sm:text-2xl font-black tracking-wide drop-shadow-md">
              กดกริ่ง!
            </span>
            <span className="text-xs sm:text-sm font-semibold text-pink-100/90 mt-1 uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full">
              (SPACE)
            </span>
          </>
        )}

        {status === "buzzed_by_me" && (
          <>
            <div className="p-3 bg-amber-400/20 rounded-full mb-2">
              <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300 animate-spin" />
            </div>
            <span className="text-base sm:text-lg font-black text-amber-300 leading-tight">
              คุณได้สิทธิ์ตอบ!
            </span>
            <span className="text-xs sm:text-sm font-semibold text-amber-200/80 mt-1 bg-amber-950/60 px-2 py-0.5 rounded-full">
              (ตอบด่วน)
            </span>
          </>
        )}

        {status === "locked_by_other" && (
          <>
            <div className="p-3 bg-slate-800 rounded-full mb-2">
              <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
            </div>
            <span className="text-sm sm:text-base font-bold text-slate-200 px-3 line-clamp-2 leading-tight">
              {buzzedPlayerName ? `[${buzzedPlayerName}]` : "ผู้เล่นอื่น"}
            </span>
            <span className="text-xs text-slate-400 mt-1">กำลังตอบ...</span>
          </>
        )}

        {status === "excluded" && (
          <>
            <div className="p-3 bg-rose-950/80 rounded-full mb-2 border border-rose-500/30">
              <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-rose-300 px-2 leading-tight">
              คุณตอบผิดในข้อนี้แล้ว
            </span>
            <span className="text-[11px] text-rose-400/70 mt-1">
              รอข้อถัดไป
            </span>
          </>
        )}

        {status === "idle" && (
          <>
            <div className="p-3 bg-slate-800/60 rounded-full mb-2">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600 animate-spin" />
            </div>
            <span className="text-sm font-medium text-slate-500">
              รอเริ่มรอบถัดไป...
            </span>
          </>
        )}
      </button>

      {/* Helper cue label underneath button */}
      <div className="mt-3 text-center">
        {status === "ready" && !disabled && (
          <p className="text-xs sm:text-sm text-pink-300/80 font-medium">
            กดปุ่มด้านบน หรือเคาะ <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-xs font-mono shadow-sm">Spacebar</kbd>
          </p>
        )}
        {status === "locked_by_other" && (
          <p className="text-xs text-slate-400 font-medium animate-pulse">
            รอฟังผลคำตอบ ถ้าตอบผิด กริ่งจะเปิดอีกครั้ง!
          </p>
        )}
        {status === "excluded" && (
          <p className="text-xs text-rose-400/80 font-medium">
            สิทธิ์ตอบข้อนี้หมดลงแล้ว ให้กำลังใจเพื่อนๆ อยู่ตรงนี้!
          </p>
        )}
      </div>
    </div>
  );
}

export default BuzzerButton;
