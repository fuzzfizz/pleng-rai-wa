"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Answer Modal Component
// Buzzer answer submission modal with real-time countdown timer,
// Fuse.js autocomplete song search, free-text input and instant keyboard handling
// ==========================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Send, Clock, Sparkles, Loader2, Music, X } from "lucide-react";
import { searchSongAutocomplete } from "@/lib/answer-checker";
import type { Song, AnswerInputMode } from "@/types";

export interface AnswerModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSubmitAnswer: (answerText: string) => Promise<void>;
  timeRemainingSec?: number; // default 10 seconds
  inputMode?: AnswerInputMode;
  songLibrary?: Song[];
  isSubmitting?: boolean;
}

/**
 * Returns Tailwind background color class based on the countdown progress ratio (0 to 1).
 */
export function getTimerColorClass(ratio: number): string {
  if (ratio > 0.6) return "bg-emerald-500 shadow-emerald-500/50";
  if (ratio > 0.3) return "bg-amber-500 shadow-amber-500/50";
  return "bg-rose-500 shadow-rose-500/50";
}

export function AnswerModal({
  isOpen,
  onClose,
  onSubmitAnswer,
  timeRemainingSec = 10,
  inputMode = "autocomplete",
  songLibrary = [],
  isSubmitting = false,
}: AnswerModalProps): React.JSX.Element | null {
  const [inputValue, setInputValue] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(timeRemainingSec);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const totalSec = Math.max(1, timeRemainingSec);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setSecondsLeft(timeRemainingSec);
      setHighlightedIndex(-1);

      // Auto-focus input on open
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, timeRemainingSec]);

  // Countdown timer interval (ticks down every 100ms)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 0.1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Autocomplete search suggestions
  const suggestions = useMemo(() => {
    if (inputMode !== "autocomplete" || !songLibrary || songLibrary.length === 0) {
      return [];
    }
    const query = inputValue.trim();
    if (!query) {
      return songLibrary.slice(0, 5);
    }
    return searchSongAutocomplete(query, songLibrary, 6);
  }, [inputMode, inputValue, songLibrary]);

  // Submission handler
  const handleSubmit = useCallback(
    async (answer: string) => {
      const trimmed = (answer || "").trim();
      if (!trimmed || isSubmitting) return;
      await onSubmitAnswer(trimmed);
    },
    [isSubmitting, onSubmitAnswer]
  );

  // Form submit event
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      handleSubmit(suggestions[highlightedIndex].title);
    } else {
      handleSubmit(inputValue);
    }
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (inputMode === "autocomplete" && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  const ratio = Math.max(0, Math.min(1, secondsLeft / totalSec));
  const timerColorClass = getTimerColorClass(ratio);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="answer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-stone-50 dark:bg-stone-900 border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-stone-900 dark:text-stone-100 overflow-hidden">
        {/* Subtle decorative glow */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5 animate-spin" />
            </span>
            <div>
              <h2 id="answer-modal-title" className="text-xl font-bold font-serif text-stone-900 dark:text-amber-300 tracking-wide">
                สิทธิ์ตอบเป็นของคุณ!
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">ตอบด่วนก่อนเวลาจะหมด</p>
            </div>
          </div>

          {/* Close button if optional dismiss allowed */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 transition cursor-pointer"
              aria-label="ปิดหน้าต่างคำตอบ"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Animated Countdown Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1 text-stone-600 dark:text-stone-300">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              เวลาที่เหลือ:
            </span>
            <span
              className={`font-mono text-sm font-bold ${
                secondsLeft <= 3 ? "text-rose-500 dark:text-rose-400 animate-pulse" : "text-amber-600 dark:text-amber-300"
              }`}
            >
              {secondsLeft.toFixed(1)} วินาที
            </span>
          </div>

          <div className="w-full h-3 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden p-0.5 border border-stone-300 dark:border-stone-700/60 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-100 shadow-md ${timerColorClass}`}
              style={{ width: `${(ratio * 100).toFixed(1)}%` }}
            />
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={onFormSubmit} className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              {inputMode === "autocomplete" ? (
                <Search className="w-5 h-5" />
              ) : (
                <Music className="w-5 h-5" />
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              placeholder={
                inputMode === "autocomplete"
                  ? "พิมพ์ชื่อเพลง ศิลปิน หรือคำร้อง..."
                  : "พิมพ์ชื่อเพลงที่คิดว่าใช่..."
              }
              autoComplete="off"
              autoFocus
              className="w-full min-h-[44px] pl-11 pr-4 py-3.5 bg-white dark:bg-stone-950/90 border-2 border-stone-300 dark:border-stone-700 focus:border-amber-500 rounded-2xl text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 font-medium focus:outline-none focus:ring-4 focus:ring-amber-500/20 text-base transition shadow-inner"
            />
          </div>

          {/* Autocomplete Dropdown List */}
          {inputMode === "autocomplete" && suggestions.length > 0 && (
            <div className="bg-white dark:bg-stone-950/95 border border-stone-200 dark:border-stone-800 rounded-2xl p-1.5 max-h-48 overflow-y-auto space-y-1 shadow-2xl">
              {suggestions.map((song, idx) => {
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={song.id || idx}
                    type="button"
                    onClick={() => handleSubmit(song.title)}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-xl flex items-center justify-between text-sm transition group cursor-pointer ${
                      isHighlighted
                        ? "bg-amber-500 text-stone-950 font-bold"
                        : "hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-800 dark:text-stone-200"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold truncate">{song.title}</div>
                      <div
                        className={`text-xs truncate ${
                          isHighlighted ? "text-stone-900" : "text-stone-500 dark:text-stone-400"
                        }`}
                      >
                        {song.artist}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full uppercase font-medium ${
                        isHighlighted
                          ? "bg-stone-950/20 text-stone-950"
                          : "bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-400"
                      }`}
                    >
                      เลือก
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={!inputValue.trim() || isSubmitting}
            className={`w-full min-h-[44px] py-3.5 px-6 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg transition-all duration-150 active:scale-[0.98] ${
              inputValue.trim() && !isSubmitting
                ? "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/30 cursor-pointer"
                : "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed border border-stone-300 dark:border-stone-700/50"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>กำลังส่งคำตอบ...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>ส่งคำตอบ (Submit)</span>
              </>
            )}
          </button>
        </form>

        {/* Modal Footer Note */}
        <p className="text-center text-[11px] text-stone-500 dark:text-stone-400">
          กด <kbd className="px-1 py-0.5 bg-stone-200 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded text-stone-700 dark:text-stone-300 font-mono text-[10px]">Enter</kbd> เพื่อส่งคำตอบทันที
        </p>
      </div>
    </div>
  );
}

export default AnswerModal;
