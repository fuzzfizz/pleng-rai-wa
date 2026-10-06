"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("pleng_theme") as Theme | null;
    const initialTheme: Theme = saved || "dark";
    setThemeState(initialTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (t: Theme) => {
      const isDark = t === "dark" || (t === "system" && mediaQuery.matches);
      const active = isDark ? "dark" : "light";
      setResolvedTheme(active);

      const root = document.documentElement;
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme(initialTheme);

    const listener = () => {
      if (theme === "system") applyTheme("system");
    };
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("pleng_theme", newTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark = newTheme === "dark" || (newTheme === "system" && mediaQuery.matches);
    setResolvedTheme(isDark ? "dark" : "light");

    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
