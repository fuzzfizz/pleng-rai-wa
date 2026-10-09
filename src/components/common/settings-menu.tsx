"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Unified Settings Menu
// Combines Light/Dark Theme Switcher & Dual Master and SFX Volume Controls
// Styled with Vinyl Cafe & Warm Lo-Fi Aesthetic
// ==========================================

import React, { useState, useEffect, useRef } from "react";
import {
  SlidersHorizontal,
  Sun,
  Moon,
  Volume2,
  Volume1,
  VolumeX,
  Bell,
  BellOff,
  X,
  Music,
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { soundEffects } from "@/lib/sound-effects";
import {
  getMasterVolume,
  setMasterVolume,
  isMasterMuted,
  toggleMasterMute,
  subscribeMasterVolume,
  getSfxVolume,
  setSfxVolume,
  isSfxMuted,
  toggleSfxMute,
  subscribeSfxVolume,
} from "@/lib/audio-volume";

export interface SettingsMenuProps {
  className?: string;
}

/**
 * Helper to fetch initial volume states synchronously.
 */
export function getInitialSettingsVolumeState() {
  return {
    masterVolume: Math.round(getMasterVolume() * 100),
    isMasterMuted: isMasterMuted(),
    sfxVolume: Math.round(getSfxVolume() * 100),
    isSfxMuted: isSfxMuted(),
  };
}

/**
 * Helper to clamp and dispatch master volume slider change.
 */
export function handleMasterSliderChange(val: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(val)));
  setMasterVolume(clamped / 100);
  return clamped;
}

/**
 * Helper to clamp and dispatch SFX volume slider change.
 */
export function handleSfxSliderChange(val: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(val)));
  setSfxVolume(clamped / 100);
  return clamped;
}

/**
 * Helper to toggle master mute with audio feedback.
 */
export function handleToggleMasterMuteAction(): { isMuted: boolean; volume: number } {
  try {
    soundEffects.click();
  } catch {}
  toggleMasterMute();
  return {
    isMuted: isMasterMuted(),
    volume: Math.round(getMasterVolume() * 100),
  };
}

/**
 * Helper to toggle SFX mute with audio feedback.
 */
export function handleToggleSfxMuteAction(): { isMuted: boolean; sfxVolume: number } {
  try {
    soundEffects.click();
  } catch {}
  const muted = toggleSfxMute();
  return {
    isMuted: muted,
    sfxVolume: Math.round(getSfxVolume() * 100),
  };
}

/**
 * Helper to trigger test SFX chime.
 */
export function handleTestSfxAudio(): void {
  try {
    soundEffects.correct();
  } catch {}
}

export function SettingsMenu({ className = "" }: SettingsMenuProps): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [volume, setVolume] = useState<number>(70);
  const [sfxVolume, setSfxVolumeState] = useState<number>(70);
  const [isSfxMutedState, setIsSfxMutedState] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setVolume(Math.round(getMasterVolume() * 100));
    setSfxVolumeState(Math.round(getSfxVolume() * 100));
    setIsSfxMutedState(isSfxMuted());

    const unsubscribeMaster = subscribeMasterVolume((newVol) => {
      setVolume(Math.round(newVol * 100));
    });

    const unsubscribeSfx = subscribeSfxVolume((newVol, muted) => {
      setSfxVolumeState(Math.round(newVol * 100));
      setIsSfxMutedState(muted);
    });

    return () => {
      unsubscribeMaster();
      unsubscribeSfx();
    };
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    try {
      soundEffects.click();
    } catch {}
    setIsOpen((prev) => !prev);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    handleMasterSliderChange(val);
  };

  const handleToggleMute = () => {
    const res = handleToggleMasterMuteAction();
    setVolume(res.volume);
  };

  const handleToggleSfxMute = () => {
    const res = handleToggleSfxMuteAction();
    setIsSfxMutedState(res.isMuted);
    setSfxVolumeState(res.sfxVolume);
  };

  const handleTestAudio = () => {
    handleTestSfxAudio();
  };

  if (!mounted) {
    // Avoid SSR hydration layout shift
    return (
      <div
        className={`w-11 h-11 lg:w-13 lg:h-13 rounded-full border border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900/60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isMuted = volume === 0 || isMasterMuted();
  const isSfxMutedComputed = isSfxMutedState || sfxVolume === 0;
  const isDark = resolvedTheme === "dark";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      {/* Settings Trigger Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="ตั้งค่าระบบและระดับเสียง (Settings)"
        title="ตั้งค่าระบบ (Settings)"
        className={`relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] w-11 h-11 lg:w-13 lg:h-13 rounded-full transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm ${
          isOpen
            ? "bg-amber-500/15 border-2 border-amber-500 text-amber-600 dark:text-amber-400"
            : "bg-white/90 dark:bg-stone-900/90 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
        }`}
      >
        <span className="sr-only">ตั้งค่าระบบ</span>
        <SlidersHorizontal className="w-5 h-5 lg:w-5.5 lg:h-5.5 text-current transition-transform duration-200" />
      </button>

      {/* Settings Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="เมนูตั้งค่าระบบ"
          className="absolute right-0 top-full mt-2.5 w-72 sm:w-80 bg-white/95 dark:bg-stone-900/95 border border-stone-200/90 dark:border-stone-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl shadow-stone-900/10 dark:shadow-black/50 backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                ⚙️ ตั้งค่า
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                (Settings)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="ปิดเมนูตั้งค่า"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Theme Switcher */}
          <div className="py-3 border-b border-stone-200 dark:border-stone-800">
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2">
              🌓 ธีมการแสดงผล <span className="font-normal text-[11px] text-stone-400">(Theme)</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 dark:bg-stone-950/80 rounded-xl border border-stone-200/60 dark:border-stone-800/60">
              <button
                type="button"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                  setTheme("light");
                }}
                className={`flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isDark
                    ? "bg-white text-amber-600 shadow-sm border border-stone-200/80"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>☀️ สว่าง (Light)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                  setTheme("dark");
                }}
                className={`flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isDark
                    ? "bg-stone-800 text-amber-400 shadow-sm border border-stone-700/80"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-amber-400" />
                <span>🌙 มืด (Dark)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Audio Volume Controls (Master & SFX) */}
          <div className="pt-3 flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-stone-200/60 dark:border-stone-800/60">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                🎛️ ตั้งค่าระดับเสียง
              </span>
              <span className="text-[11px] text-stone-400 font-normal">
                (Audio Volume)
              </span>
            </div>

            {/* Row 1: 🔊 เสียงรวม / เพลง (Master Volume) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                  🔊 เสียงรวม / เพลง{" "}
                  <span className="font-normal text-[11px] text-stone-400">(Master)</span>
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  {volume}%
                </span>
              </div>

              {/* Slider & Mute Row */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={isMuted ? "เปิดเสียงรวม" : "ปิดเสียงรวม"}
                  title={isMuted ? "เปิดเสียงรวม" : "ปิดเสียงรวม (Mute)"}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition cursor-pointer shrink-0"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-rose-500" />
                  ) : volume < 50 ? (
                    <Volume1 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </button>

                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={volume}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${volume}%, ${
                        isDark ? "#292524" : "#e7e5e4"
                      } ${volume}%, ${isDark ? "#292524" : "#e7e5e4"} 100%)`,
                    }}
                    aria-label="แถบปรับระดับเสียงรวม"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: 🔔 เสียงเอฟเฟกต์ (Sound Effects / SFX) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                  🔔 เสียงเอฟเฟกต์{" "}
                  <span className="font-normal text-[11px] text-stone-400">(SFX)</span>
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  {sfxVolume}%
                </span>
              </div>

              {/* Slider & Mute Row */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleSfxMute}
                  aria-label={isSfxMutedComputed ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
                  title={isSfxMutedComputed ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์ (Mute SFX)"}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition cursor-pointer shrink-0"
                >
                  {isSfxMutedComputed ? (
                    <BellOff className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </button>

                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={sfxVolume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSfxVolumeState(val);
                      setSfxVolume(val / 100);
                    }}
                    className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${sfxVolume}%, ${
                        isDark ? "#292524" : "#e7e5e4"
                      } ${sfxVolume}%, ${isDark ? "#292524" : "#e7e5e4"} 100%)`,
                    }}
                    aria-label="แถบปรับระดับเสียงเอฟเฟกต์"
                  />
                </div>
              </div>
            </div>

            {/* Test Button: 🎵 ทดสอบเสียงเอฟเฟกต์ (Test SFX) */}
            <button
              type="button"
              onClick={handleTestAudio}
              className="w-full mt-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-stone-800/80 hover:bg-amber-500/15 text-stone-700 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-800 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-sm"
            >
              <Music className="w-4 h-4 text-amber-500" />
              <span>🎵 ทดสอบเสียงเอฟเฟกต์</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
