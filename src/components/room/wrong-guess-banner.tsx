"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Wrong Guess Banner Component
// Realtime feedback banner shown when a player answers incorrectly:
// displays incorrect guess details, resumed audio cue & auto-dismisses after 4 seconds
// ==========================================

import React, { useState, useEffect } from "react";
import { AlertCircle, X, Volume2, Clock } from "lucide-react";

export interface WrongGuessRecord {
  playerId: string;
  displayName: string;
  answerText: string;
  reason?: string;
}

export interface WrongGuessBannerProps {
  wrongGuess: WrongGuessRecord | null;
  showResumeCue?: boolean;
  gameMode?: string;
  currentPlayerId?: string;
  onDismiss?: () => void;
}

export const RESUME_AUDIO_CUE = "🎵 เพลงเล่นต่อ แย่งกันกดกริ่งเลย!";

/**
 * Formats wrong guess into standard user announcement string.
 */
export function formatWrongGuessMessage(
  wrongGuess: {
    displayName: string;
    answerText: string;
    reason?: string;
    playerId?: string;
  },
  currentPlayerId?: string
): string {
  const isTimeout =
    wrongGuess.answerText === "(หมดเวลา)" ||
    wrongGuess.answerText === "หมดเวลา" ||
    (wrongGuess as any).reason === "buzzer_timeout";

  const name = wrongGuess.displayName || "ผู้เล่น";
  const isCurrentPlayer =
    name === "คุณ" ||
    name.trim() === "คุณ" ||
    Boolean(currentPlayerId && wrongGuess.playerId && wrongGuess.playerId === currentPlayerId);

  if (isTimeout) {
    if (isCurrentPlayer) {
      return "⏰ คุณตอบไม่ทัน (หมดเวลา)!";
    }
    return `⏰ ${name} ตอบไม่ทัน (หมดเวลา)!`;
  }

  const answer = wrongGuess.answerText || "";
  return `❌ ${name} ตอบว่า '${answer}' (ยังไม่ใช่!)`;
}

export function WrongGuessBanner({
  wrongGuess,
  showResumeCue = true,
  gameMode,
  currentPlayerId,
  onDismiss,
}: WrongGuessBannerProps): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!wrongGuess) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        onDismiss();
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [wrongGuess, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (
    !wrongGuess ||
    !isVisible ||
    wrongGuess.answerText === "(ยอมแพ้)" ||
    wrongGuess.answerText.includes("ยอมแพ้")
  ) {
    return null;
  }

  const isTimeout =
    wrongGuess.answerText === "(หมดเวลา)" ||
    wrongGuess.answerText === "หมดเวลา" ||
    (wrongGuess as any).reason === "buzzer_timeout";

  const message = formatWrongGuessMessage(wrongGuess, currentPlayerId);
  const shouldShowResumeCue = showResumeCue && (gameMode ? gameMode === "buzzer" : true);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full max-w-xl mx-auto my-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div
        className={`relative flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 border-2 rounded-2xl shadow-lg backdrop-blur-md ${
          isTimeout
            ? "bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-500/80 text-amber-950 dark:text-amber-100 dark:shadow-[0_0_35px_rgba(245,158,11,0.3)]"
            : "bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-500/80 text-rose-950 dark:text-rose-100 dark:shadow-[0_0_35px_rgba(244,63,94,0.4)]"
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isTimeout
                ? "bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300"
                : "bg-rose-500/15 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300"
            }`}
          >
            {isTimeout ? (
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 animate-pulse" />
            )}
          </div>

          <div className="overflow-hidden">
            <p
              className={`text-sm sm:text-base font-bold truncate leading-snug ${
                isTimeout
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-rose-900 dark:text-rose-200"
              }`}
            >
              {message}
            </p>
            {shouldShowResumeCue && (
              <p
                className={`text-xs font-medium flex items-center gap-1.5 mt-0.5 ${
                  isTimeout
                    ? "text-amber-700 dark:text-amber-300/90"
                    : "text-rose-700 dark:text-rose-300/90"
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{RESUME_AUDIO_CUE}</span>
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="ปิดการแจ้งเตือน"
          className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isTimeout
              ? "text-amber-600 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/50 dark:hover:bg-amber-800/40"
              : "text-rose-600 dark:text-rose-400 hover:text-rose-950 dark:hover:text-rose-100 hover:bg-rose-200/50 dark:hover:bg-rose-800/40"
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default WrongGuessBanner;
