"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - 10 Curated Avatars Picker
// Clean grid with glowing active selection border
// ==========================================

import React from "react";
import { soundEffects } from "@/lib/sound-effects";

export interface PresetAvatarItem {
  id: string;
  emoji: string;
  label: string;
}

export const PRESET_AVATARS: PresetAvatarItem[] = [
  { id: "headphones", emoji: "🎧", label: "หูฟัง" },
  { id: "guitar", emoji: "🎸", label: "กีตาร์" },
  { id: "mic", emoji: "🎤", label: "ไมค์" },
  { id: "piano", emoji: "🎹", label: "เปียโน" },
  { id: "drums", emoji: "🥁", label: "กลองชุด" },
  { id: "sax", emoji: "🎷", label: "แซกโซโฟน" },
  { id: "gamer", emoji: "👾", label: "เกมเมอร์" },
  { id: "fox", emoji: "🦊", label: "จิ้งจอก" },
  { id: "cat", emoji: "🐱", label: "แมวเหมียว" },
  { id: "lion", emoji: "🦁", label: "สิงโต" },
];

export interface AvatarPickerProps {
  value: string;
  onChange: (avatarEmoji: string) => void;
  className?: string;
  disabled?: boolean;
}

export function AvatarPicker({
  value,
  onChange,
  className = "",
  disabled = false,
}: AvatarPickerProps): React.JSX.Element {
  const handleSelect = (item: PresetAvatarItem) => {
    if (disabled) return;
    try {
      soundEffects.click();
    } catch {}
    onChange(item.emoji);
  };

  return (
    <div
      role="radiogroup"
      aria-label="เลือกรูปตัวแทน (Avatar)"
      className={`grid grid-cols-5 sm:grid-cols-10 gap-2 p-2.5 sm:p-3 bg-stone-100/90 dark:bg-stone-950/80 rounded-2xl border border-stone-200/80 dark:border-stone-800 ${className}`}
    >
      {PRESET_AVATARS.map((item) => {
        const isSelected = value === item.emoji || value === item.id;

        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => handleSelect(item)}
            title={`${item.label} (${item.emoji})`}
            className={`group relative h-11 sm:h-12 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-xl sm:text-2xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${
              isSelected
                ? "bg-amber-500/20 border-2 border-amber-500 text-stone-900 dark:text-white scale-105 shadow-md shadow-amber-500/20 ring-2 ring-amber-500/30"
                : "bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-amber-400 dark:hover:border-amber-500/50 hover:bg-stone-50 dark:hover:bg-stone-800/80 hover:scale-105"
            }`}
          >
            <span className="transition-transform duration-100 group-hover:scale-110">
              {item.emoji}
            </span>
            {isSelected && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-stone-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AvatarPicker;
