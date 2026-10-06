"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Theme Toggle Button
// Dual Mode (Sun ☀️ / Moon 🌙) with Audio Click & Tactile Feel
// ==========================================

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { soundEffects } from "@/lib/sound-effects";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps): React.JSX.Element {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = () => {
    try {
      soundEffects.click();
    } catch {}
    toggleTheme();
  };

  if (!mounted) {
    // Placeholder to avoid hydration mismatch
    return (
      <div
        className={`w-11 h-11 rounded-full border border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900/60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] w-11 h-11 rounded-full bg-white/90 dark:bg-stone-900/90 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 shadow-sm transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${className}`}
      title={isDark ? "สลับเป็นโหมดกลางวัน (Light Mode)" : "สลับเป็นโหมดกลางคืน (Dark Mode)"}
      aria-label={isDark ? "สลับเป็นโหมดกลางวัน" : "สลับเป็นโหมดกลางคืน"}
    >
      <span className="sr-only">Toggle Theme</span>
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400 rotate-0 scale-100 transition-all duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-amber-600 rotate-0 scale-100 transition-all duration-300" />
        )}
      </div>
    </button>
  );
}
