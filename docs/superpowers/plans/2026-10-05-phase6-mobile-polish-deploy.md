# Implementation Plan - Phase 6: Mobile Ergonomics, Game Juice & Production Deployment

**Project:** เพลงไรวะ (Pleng-Rai-Wa)  
**Spec Document:** [`docs/superpowers/specs/2026-10-05-phase6-mobile-polish-deploy-design.md`](file:///D:/pleng-rai-wa/docs/superpowers/specs/2026-10-05-phase6-mobile-polish-deploy-design.md)  
**Target Branch:** `feature/phase-6-polishing-deploy`  

---

## Global Constraints & Binding Rules
1. **100% Free Public Feasibility**: Runs on Supabase Free Tier + Cloudflare R2 + Vercel Hobby Tier.
2. **Mobile-First Discipline**: All interactive elements strictly adhere to $\ge 44\text{px}$ touch targets, inputs $\ge 16\text{px}$ to prevent iOS auto-zoom, and dynamic viewport height (`100dvh`).
3. **Tactile Zero-Delay Touch**: `touch-action: manipulation` and haptic feedback on active game actions.
4. **Clean TypeScript Build**: `npm run build` and `npx tsc --noEmit` must exit with code 0.
5. **No Regressions**: All 13 previous test suites must remain 100% green.

---

## Tasks Breakdown

### Task 1: Mobile-First Layout, Viewport, Safe Area & Input Auto-Zoom Prevention
- **Brief**: Update `src/app/layout.tsx` to export Next.js 15 `viewport: Viewport` (`themeColor`, `colorScheme`, `width`, `initialScale`). Update body container to `min-h-[100dvh]`. Add `.pb-safe` and `.pt-safe` utilities in `src/app/globals.css`. Audit and enforce `text-base` ($\ge 16\text{px}$) on all inputs in `AnswerModal`, `HostSettingsModal`, `LobbyView`, `PlaylistEditor`, `AuthModal`, and `SoloPlay` on mobile to prevent iOS Safari auto-zoom.
- **Files**:
  - `src/app/layout.tsx`
  - `src/app/globals.css`
  - `src/components/room/answer-modal.tsx`
  - `src/components/room/host-settings-modal.tsx`
  - `src/components/auth/auth-modal.tsx`
- **Verification**: `npx tsc --noEmit` and input font size check.

### Task 2: Buzzer Tactile Juice, Sound Controls & Haptic Touch Ergonomics
- **Brief**: Enhance `BuzzerButton` (`src/components/room/buzzer-button.tsx`) with `touch-action: manipulation`, haptic feedback `navigator.vibrate?.([45])`, responsive multi-breakpoint dimensions (`w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64`), and active scale transitions. Ensure sound controls (mute/unmute) meet the $\ge 44\text{px}$ touch target in header bars.
- **Files**:
  - `src/components/room/buzzer-button.tsx`
  - `src/components/room/game-view.tsx`
  - `src/app/play/solo/page.tsx`
- **Verification**: `scripts/test-room-gameplay-ui.ts` and tactile interaction assertions.

### Task 3: Web App Manifest & Social Share Metadata
- **Brief**: Implement Next.js 15 App Route `src/app/manifest.ts` returning web app manifest config (PWA standalone mode, name, theme color). Expand metadata in `src/app/layout.tsx` with OpenGraph (`th_TH`, title, description) and Twitter card configuration for rich link sharing.
- **Files**:
  - `src/app/manifest.ts`
  - `src/app/layout.tsx`
- **Verification**: Next.js route build and manifest resolution check.

### Task 4: Comprehensive Phase 6 Verification Suite & Deployment Guide
- **Brief**: Create `scripts/test-phase6-readiness.ts` asserting viewport config, manifest route, input font sizes, touch targets, and buzzer tactile properties. Run all 14 test suites and verify `npm run build` exits 0. Update `README.md` with a complete Vercel Deployment Checklist and Environment Variables guide.
- **Files**:
  - `scripts/test-phase6-readiness.ts`
  - `README.md`
- **Verification**: All 14 test suites green, `npm run build` exits 0.

### Task 5: GitHub Push & Production Launch Sync
- **Brief**: Push `main` to `origin main` on GitHub. Update `PLAN.md` marking Phase 6 as complete.
- **Files**:
  - `PLAN.md`
- **Verification**: `git status` clean, remote up-to-date with `origin main`.
