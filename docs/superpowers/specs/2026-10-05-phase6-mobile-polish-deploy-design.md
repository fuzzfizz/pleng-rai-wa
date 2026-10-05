# Design Specification: Phase 6 Mobile Ergonomics, Game Juice & Production Deployment

**Project:** เพลงไรวะ (Pleng-Rai-Wa)  
**Date:** 2026-10-05  
**Author:** AI Agent & fuzzfizz  
**Branch:** `main` (feature branch `feature/phase-6-polishing-deploy`)  
**Status:** Approved Design  

---

## 1. Background & Goals

Phases 1 through 5 established the entire core foundation of Pleng-Rai-Wa:
- Phase 1: Foundation, Next.js 15, Supabase, Tailwind, TypeScript
- Phase 2: Local Admin Pipeline, YouTube to MP3, Gemini AI metadata extraction, Cloudflare R2
- Phase 3: Core Game Engine, Server-side audio slicing, Procedural Web Audio SFX, Thai fuzzy string checker, AI deadpan lyrics reader
- Phase 4: Realtime multiplayer, 6-character room codes, FCFS buzzer battle, session reconnect, TV party mode, podium
- Phase 5: User profiles, Supabase Auth (Email & Google), custom playlist management (/playlists, /playlists/new, /playlists/[id]/edit), audio preview, multiplayer & solo integration

Phase 6 focuses on **polishing the user experience for real-world devices (iOS Safari, Android Chrome, and Desktop)**, enhancing tactile game juice, adding social sharing & PWA installability, and ensuring smooth production deployment to Vercel and GitHub.

---

## 2. Technical Architecture & Detailed Requirements

### 2.1 Mobile Ergonomics & Safe Area System
1. **Dynamic Viewport Height (`100dvh`)**:
   - Replace standard `min-h-screen` in root layouts and modal backdrops with `min-h-[100dvh]` to eliminate layout shifts when mobile browser address bars collapse on scroll.
2. **Next.js 15 Viewport Configuration**:
   - Export dedicated `viewport: Viewport` in `src/app/layout.tsx`:
     ```ts
     export const viewport: Viewport = {
       width: "device-width",
       initialScale: 1,
       maximumScale: 5,
       themeColor: "#030712",
       colorScheme: "dark",
     };
     ```
3. **Safe Area CSS Utilities**:
   - In `src/app/globals.css`, add support for safe areas:
     ```css
     .pb-safe {
       padding-bottom: max(1rem, env(safe-area-inset-bottom));
     }
     .pt-safe {
       padding-top: max(1rem, env(safe-area-inset-top));
     }
     ```
4. **Form Input Auto-Zoom Prevention (iOS Safari Rule)**:
   - Ensure all `<input>`, `<select>`, and `<textarea>` elements across `LobbyView`, `HostSettingsModal`, `AnswerModal`, `PlaylistEditor`, `AuthModal`, and `SoloPlay` use `text-base` (≥ 16px) on mobile viewports (`text-base sm:text-sm`).
5. **Touch Target Standard (≥ 44px)**:
   - Enforce `min-h-[44px] min-w-[44px]` for all interactive controls (modal close buttons, volume/mute toggles, playlist song play buttons, drag reorder handles, pagination/tabs).

### 2.2 Tactile Game Juice & Animation Feedback
1. **Buzzer Button Responsiveness**:
   - Add `touch-action: manipulation` to `BuzzerButton` to remove the 300ms double-tap delay on mobile browsers.
   - Trigger haptic feedback via `navigator.vibrate?.([45])` on successful buzz tap.
   - Add micro-interaction: `active:scale-95 transition-transform duration-75` for instant tactile response.
   - Multi-breakpoint sizing: `w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64`.
2. **Sound Controls Access**:
   - Ensure `SoundEffectsToggle` (or Mute button) is directly accessible in the room header and solo practice navigation for players on mobile.
3. **Micro-Celebration Effects**:
   - Verify Confetti triggers on round reveal and podium displays without blocking UI interactions.

### 2.3 Social Sharing (OpenGraph) & Web App Manifest
1. **Web App Manifest (`src/app/manifest.ts`)**:
   - Implement Next.js 15 Route Manifest defining `name`, `short_name`, `theme_color`, `background_color`, `display: "standalone"`, and icons.
2. **OpenGraph & Twitter Metadata (`src/app/layout.tsx`)**:
   - Configure OpenGraph cards for attractive link sharing in LINE, Discord, and Facebook:
     - `og:title`: "เพลงไรวะ? (Pleng-Rai-Wa) - เว็บเกมทายเพลงออนไลน์"
     - `og:description`: "เกมทายเพลงออนไลน์เล่นกับเพื่อนหรือเดี่ยว ทายเสี้ยววินาที กดกริ่งแย่งตอบ หรือทายเนื้อเพลงด้วยเสียง AI ฟรี 100%"
     - `og:locale`: "th_TH"
     - `twitter:card`: "summary_large_image"

### 2.4 Production Deployment & Verification
1. **Automated Verification Suite (`scripts/test-phase6-readiness.ts`)**:
   - Viewport configuration export in `layout.tsx`.
   - Manifest route export in `src/app/manifest.ts`.
   - Touch target compliance and input font size check.
   - Buzzer button ergonomics and haptic calls.
   - Clean production build execution (`npm run build`).
2. **GitHub Sync**:
   - Push commit history to `origin main`.
3. **Deployment Documentation (`README.md`)**:
   - Add a step-by-step Vercel deployment checklist with required production environment variables.

---

## 3. Success Criteria & Verification
- All automated test suites (Phase 1-6) pass with 100% green status.
- `npx tsc --noEmit` exits with code 0 (no type errors).
- `npm run build` succeeds cleanly.
- Manifest and OpenGraph tags are valid and accessible.
- Code pushed to `git@github.com:fuzzfizz/pleng-rai-wa.git`.
