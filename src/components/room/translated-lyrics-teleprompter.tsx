"use client";

import React, { useState, useEffect, useRef } from "react";
import { Radio, Pause, Play, RotateCcw } from "lucide-react";

export type TeleprompterSpeed = "slow" | "normal" | "fast";

export const TELEPROMPTER_SPEEDS: Record<TeleprompterSpeed, number> = {
  slow: 20,
  normal: 38,
  fast: 65,
};

export interface TranslatedLyricsTeleprompterProps {
  lyrics: string;
  roundKey?: string | number;
  isTvMode?: boolean;
  className?: string;
}

export function TranslatedLyricsTeleprompter({
  lyrics,
  roundKey,
  isTvMode = false,
  className = "",
}: TranslatedLyricsTeleprompterProps) {
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(true);
  const [scrollSpeed, setScrollSpeed] = useState<TeleprompterSpeed>("normal");
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef<number>(0);
  const prevTimeRef = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestartingRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset scroll position and restart auto-scrolling whenever roundKey changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    scrollPosRef.current = 0;
    prevTimeRef.current = null;
    setIsAutoScrolling(true);
    setIsUserInteracting(false);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
  }, [roundKey]);

  // Handle smooth 60fps auto-scroll using requestAnimationFrame and timestamp delta
  useEffect(() => {
    if (typeof window === "undefined") return;

    prevTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (prevTimeRef.current === null) {
        prevTimeRef.current = timestamp;
      }
      const elapsed = timestamp - prevTimeRef.current;
      prevTimeRef.current = timestamp;

      // Bound delta to 100ms to avoid huge jumps on tab switch/freeze
      const deltaSeconds = Math.min(elapsed, 100) / 1000;

      if (isAutoScrolling && !isUserInteracting && !isRestartingRef.current) {
        const container = scrollContainerRef.current;
        if (container) {
          const speedPx = TELEPROMPTER_SPEEDS[scrollSpeed];
          const maxScroll = container.scrollHeight - container.clientHeight;

          if (maxScroll > 0) {
            scrollPosRef.current += speedPx * deltaSeconds;
            if (scrollPosRef.current >= maxScroll) {
              scrollPosRef.current = maxScroll;
            }
            container.scrollTop = scrollPosRef.current;
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isAutoScrolling, isUserInteracting, scrollSpeed]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  const handleUserInteraction = () => {
    setIsUserInteracting(true);
    if (scrollContainerRef.current) {
      scrollPosRef.current = scrollContainerRef.current.scrollTop;
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      if (scrollContainerRef.current) {
        scrollPosRef.current = scrollContainerRef.current.scrollTop;
      }
    }, 2500);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const currentScrollTop = scrollContainerRef.current.scrollTop;
    if (
      !isRestartingRef.current &&
      Math.abs(currentScrollTop - scrollPosRef.current) > 3
    ) {
      handleUserInteraction();
      scrollPosRef.current = currentScrollTop;
    }
  };

  const handleRestart = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    scrollPosRef.current = 0;
    setIsUserInteracting(false);
    setIsAutoScrolling(true);
    isRestartingRef.current = true;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    restartTimeoutRef.current = setTimeout(() => {
      isRestartingRef.current = false;
      if (scrollContainerRef.current) {
        scrollPosRef.current = scrollContainerRef.current.scrollTop;
      }
    }, 400);
  };

  const handleTogglePlayPause = () => {
    setIsAutoScrolling((prev) => {
      const next = !prev;
      if (next && scrollContainerRef.current) {
        scrollPosRef.current = scrollContainerRef.current.scrollTop;
      }
      return next;
    });
  };

  return (
    <div
      className={`w-full rounded-3xl border border-amber-500/40 shadow-xl backdrop-blur-md ${
        isTvMode
          ? "max-w-4xl mb-6 p-6 sm:p-8 bg-stone-950/90 text-white"
          : "max-w-xl sm:max-w-2xl lg:max-w-4xl p-4 sm:p-6 lg:p-7 bg-white/95 dark:bg-stone-900/95 text-stone-800 dark:text-stone-200"
      } ${className}`}
    >
      {/* Header */}
      {isTvMode ? (
        <div className="flex items-center justify-center gap-2 text-amber-400 dark:text-amber-300 text-sm sm:text-base font-bold uppercase tracking-wider mb-3">
          <Radio className="w-4 h-4 animate-pulse text-amber-500" />
          <span>🌐 Google Translate Karaoke (เนื้อเพลงแปลอังกฤษ)</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Radio className="w-4 h-4 animate-pulse text-amber-500" />
            <span>🌐 Google Translate Karaoke (เนื้อเพลงแปลอังกฤษ)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Speed buttons: [ ช้า | ปกติ | เร็ว ] */}
            <div
              role="group"
              aria-label="ความเร็วการเลื่อนเนื้อเพลง"
              className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-0.5 rounded-xl border border-stone-200 dark:border-stone-700/60 text-xs"
            >
              <button
                type="button"
                onClick={() => setScrollSpeed("slow")}
                aria-pressed={scrollSpeed === "slow"}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  scrollSpeed === "slow"
                    ? "bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                    : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                ช้า
              </button>
              <button
                type="button"
                onClick={() => setScrollSpeed("normal")}
                aria-pressed={scrollSpeed === "normal"}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  scrollSpeed === "normal"
                    ? "bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                    : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                ปกติ
              </button>
              <button
                type="button"
                onClick={() => setScrollSpeed("fast")}
                aria-pressed={scrollSpeed === "fast"}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  scrollSpeed === "fast"
                    ? "bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                    : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                เร็ว
              </button>
            </div>

            {/* Play/Pause toggle button */}
            <button
              type="button"
              onClick={handleTogglePlayPause}
              aria-label={isAutoScrolling ? "พักการเลื่อน" : "เลื่อนต่อ"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-stone-200 dark:border-stone-700/60 bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-200 transition cursor-pointer min-h-[32px]"
            >
              {isAutoScrolling ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>พัก</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>เลื่อนต่อ</span>
                </>
              )}
            </button>

            {/* Restart button */}
            <button
              type="button"
              onClick={handleRestart}
              aria-label="เริ่มใหม่"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-stone-200 dark:border-stone-700/60 bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-200 transition cursor-pointer min-h-[32px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>เริ่มใหม่</span>
            </button>
          </div>
        </div>
      )}

      {/* Teleprompter Viewport with Top & Bottom Gradients */}
      <div className="relative">
        {/* Top fade */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b ${
            isTvMode ? "from-stone-950 dark:from-stone-950" : "from-white dark:from-stone-900"
          } to-transparent z-10`}
          aria-hidden="true"
        />

        {/* Scroll viewport */}
        <div
          ref={scrollContainerRef}
          onWheel={handleUserInteraction}
          onTouchStart={handleUserInteraction}
          onTouchMove={handleUserInteraction}
          onPointerDown={handleUserInteraction}
          onScroll={handleScroll}
          className="relative max-h-[300px] sm:max-h-[380px] lg:max-h-[440px] overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4"
        >
          <p
            className={`whitespace-pre-line break-words text-center ${
              isTvMode
                ? "text-white text-xl sm:text-2xl font-bold leading-loose"
                : "text-stone-900 dark:text-stone-100 font-medium leading-relaxed sm:leading-loose text-sm sm:text-base lg:text-lg"
            }`}
          >
            {lyrics || "กำลังสตรีมเสียงเนื้อเพลง..."}
          </p>
        </div>

        {/* Bottom fade */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t ${
            isTvMode ? "from-stone-950 dark:from-stone-950" : "from-white dark:from-stone-900"
          } to-transparent z-10`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default TranslatedLyricsTeleprompter;
