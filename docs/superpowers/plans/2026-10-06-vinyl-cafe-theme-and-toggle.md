# 🎨 Vinyl Cafe & Warm Lo-Fi Theme + Light/Dark Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the visual identity of "เพลงไรวะ" from a flashing neon pub into a cozy, artistic "Vinyl Cafe & Warm Lo-Fi" aesthetic, with full Light and Dark mode toggle capability.

**Architecture:** A centralized `ThemeContext` manages `'light' | 'dark' | 'system'` state with `localStorage` persistence and FOUC prevention. CSS custom properties in `globals.css` provide the dual palette tokens (`stone-950` / `stone-50`, `amber-500` / `amber-600`), while Tailwind utility classes across components adapt smoothly between light and dark modes.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Web Audio SFX.

## Global Constraints
- Touch targets must remain $\ge 44\text{px}$ across all interactive controls.
- Font sizes on form inputs must remain $\ge 16\text{px}$ (`text-base sm:text-sm`) to prevent iOS Safari auto-zoom.
- Mobile safe-area utilities (`.pb-safe`, `.pt-safe`) and `min-h-[100dvh]` must be preserved.
- No third-party heavy dependencies; pure lightweight React context with zero layout shifts.

---

### Task 1: Theme Context & FOUC-Safe Script Scaffolding

**Files:**
- Create: `src/contexts/theme-context.tsx`
- Modify: `src/app/layout.tsx`
- Test: `scripts/test-theme-context.ts`

**Interfaces:**
- Produces: `ThemeProvider`, `useTheme() => { theme: 'light' | 'dark' | 'system', resolvedTheme: 'light' | 'dark', setTheme: (t: Theme) => void, toggleTheme: () => void }`

- [ ] **Step 1: Create failing test script for Theme Provider logic**

```typescript
// scripts/test-theme-context.ts
import assert from "assert";

function resolveTheme(preference: string, systemDark: boolean): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemDark ? "dark" : "light";
}

assert.strictEqual(resolveTheme("light", true), "light");
assert.strictEqual(resolveTheme("dark", false), "dark");
assert.strictEqual(resolveTheme("system", true), "dark");
assert.strictEqual(resolveTheme("system", false), "light");
console.log("✓ Theme resolution logic test passed.");
```

- [ ] **Step 2: Run test to verify**

Run: `npx tsx scripts/test-theme-context.ts`
Expected: `✓ Theme resolution logic test passed.`

- [ ] **Step 3: Implement `src/contexts/theme-context.tsx`**

```tsx
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
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("pleng_theme", newTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark = newTheme === "dark" || (newTheme === "system" && mediaQuery.matches);
    setResolvedTheme(isDark ? "dark" : "light");

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
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
```

- [ ] **Step 4: Update `src/app/layout.tsx` to wrap children with ThemeProvider and add FOUC prevention script**

- [ ] **Step 5: Commit**

```bash
git add src/contexts/theme-context.tsx src/app/layout.tsx scripts/test-theme-context.ts
git commit -m "feat(theme): add ThemeProvider with FOUC prevention and persistence"
```

---

### Task 2: Global Vinyl Cafe Tokens in `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Define Dual Palette CSS variables in `src/app/globals.css`**
Configure `--background: #FAF7F2;` for Light Mode, and `.dark { --background: #0c0a09; }` for Dark Mode.
Update `.bg-radial-glow` to warm dusk ember gradient.
Update `.text-gradient` to warm honey cream gradient.

- [ ] **Step 2: Verify CSS build passes**

Run: `npm run build`
Expected: Build successfully without CSS syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style(theme): update globals.css with vinyl cafe dual palette and warm glow"
```

---

### Task 3: Theme Toggle Component & Nav Header Integration

**Files:**
- Create: `src/components/common/theme-toggle.tsx`
- Modify: `src/components/common/nav-header.tsx`

- [ ] **Step 1: Create `src/components/common/theme-toggle.tsx`**
Button with Sun (☀️) and Moon (🌙) icons, accessible tooltip, touch target $\ge 44\text{px}$, audio click sound feedback on toggle.

- [ ] **Step 2: Add `ThemeToggle` into `NavHeader`**
Position beside user profile avatar / login button.

- [ ] **Step 3: Verify touch target and build**

Run: `npm run build`
Expected: Clean compilation with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/theme-toggle.tsx src/components/common/nav-header.tsx
git commit -m "feat(ui): add theme toggle button to NavHeader"
```

---

### Task 4: Restyle Landing Page (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace neon pub elements with warm Vinyl Cafe aesthetics**
- Change hero background ambient lights from neon pink/purple to warm amber/terracotta dusk glow.
- Change badge from pink neon to cozy amber indie pill (`border-amber-500/25 bg-amber-500/10 text-amber-400 dark:text-amber-300`).
- Change hero CTA button to tactile warm amber (`bg-amber-500 hover:bg-amber-400 text-stone-950`).
- Change 3 Game Modes cards from dark pub slate to warm stone / linen cards (`bg-white/80 dark:bg-stone-900/80 border-stone-200 dark:border-stone-800`).

- [ ] **Step 2: Test build and responsive layout**

Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(home): restyle landing page to vinyl cafe aesthetic"
```

---

### Task 5: Restyle Buzzer Button & Multiplayer Room Views

**Files:**
- Modify: `src/components/room/buzzer-button.tsx`
- Modify: `src/components/room/lobby-view.tsx`
- Modify: `src/components/room/game-view.tsx`
- Modify: `src/components/room/round-reveal-card.tsx`
- Modify: `src/components/room/podium-view.tsx`
- Modify: `src/components/room/tv-view.tsx`
- Modify: `src/components/room/host-settings-modal.tsx`
- Modify: `src/components/room/answer-modal.tsx`

- [ ] **Step 1: Restyle `buzzer-button.tsx`**
Transform from flashing neon pink to a tactile vintage brass & warm amber buzzer button with leather/wood depth, tactile haptics, and responsive sizing.

- [ ] **Step 2: Restyle room components**
Replace purple/pink badges and borders with warm stone and amber accents across lobby, game view, round reveal, and podium.

- [ ] **Step 3: Run Phase 6 readiness test**

Run: `npx tsx scripts/test-phase6-readiness.ts`
Expected: All 5 test suites PASS (100% Green).

- [ ] **Step 4: Commit**

```bash
git add src/components/room/*
git commit -m "style(room): restyle buzzer button and room views with vinyl cafe palette"
```

---

### Task 6: Restyle Solo Play, Playlists, and Admin Portal

**Files:**
- Modify: `src/app/play/solo/page.tsx`
- Modify: `src/app/playlists/page.tsx`
- Modify: `src/app/playlists/new/page.tsx`
- Modify: `src/app/playlists/[id]/edit/page.tsx`
- Modify: `src/components/playlist/playlist-card.tsx`
- Modify: `src/components/playlist/playlist-editor.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Update Solo Play screen**
Replace neon options with warm vinyl lo-fi cards.

- [ ] **Step 2: Update Playlists & Editor**
Cozy vinyl collection styling for playlist cards and song selector.

- [ ] **Step 3: Update Admin Portal**
Warm, comfortable reading palette for song library management.

- [ ] **Step 4: Commit**

```bash
git add src/app/play/solo/page.tsx src/app/playlists/* src/components/playlist/* src/app/admin/page.tsx
git commit -m "style(app): restyle solo play, playlists, and admin to warm lo-fi aesthetic"
```

---

### Task 7: Full Automated Verification & Production Build

**Files:**
- Test: `scripts/test-phase6-readiness.ts`

- [ ] **Step 1: Run Next.js production build**

Run: `npm run build`
Expected: Clean compilation with 0 TypeScript/CSS errors.

- [ ] **Step 2: Run Phase 6 mobile readiness verification**

Run: `npx tsx scripts/test-phase6-readiness.ts`
Expected: All 5 test suites PASS.

- [ ] **Step 3: Push changes to GitHub**

Run: `git push origin main`
Expected: Successfully pushed to `origin/main`.
