# Implementation Plan: Fix 7 Issues from should fix.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 7 gameplay, scoring, audio, and UI issues reported in `should fix.md` cleanly without regressions.

**Architecture:** 
1. Fix core store and scoring engine in `RoomStateStore` and `/api/room/[code]/answer` (per-player hint scoring, accurate `scoreDelta`, dynamic `totalPlayers` resolution to eliminate 400 deadlocks).
2. Wire Master Volume listener (`getMasterVolume`, `subscribeMasterVolume`) into `three-vinyl-canvas.tsx` (Lofi), `round-reveal-card.tsx`, and `solo/page.tsx`.
3. Update `GameView` audio-slice playback (play once on mount without loop, add replay snippet button, guard against excluded submission 400s).
4. Build realistic animated vinyl record disc (spins while playing, pauses when paused) and interactive scrubbable seek bar in `RoundRevealCard` and Solo reveal.
5. Enable hint and surrender for all players in `GameView` and `/api/room/[code]/hint`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Lucide Icons, Web Audio / HTMLAudioElement, Vitest.

---

### Task 1: Scoring, Hint & Store Fixes (Items 1, 2, 7 Backend)
**Files:**
- Modify: `src/lib/room-state-store.ts`
- Modify: `src/app/api/room/[code]/answer/route.ts`
- Modify: `src/app/api/room/[code]/hint/route.ts`
- Test: `src/lib/__tests__/room-state-scoring-and-deadlock.test.ts`

- [x] **Step 1: Write tests for hint scoring and totalPlayers deadlock resolution**
- [x] **Step 2: Run test to verify failure**
- [x] **Step 3: Implement fixes in RoomStateStore, answer route, and hint route**
- [x] **Step 4: Run test to verify pass**
- [x] **Step 5: Commit changes** (Commit `71db5b9`)

---

### Task 2: Master Volume Integration (Item 4)
**Files:**
- Modify: `src/components/common/three-vinyl-canvas.tsx`
- Modify: `src/components/room/round-reveal-card.tsx`
- Modify: `src/app/play/solo/page.tsx`
- Test: `src/lib/__tests__/audio-volume-sync.test.ts`

- [x] **Step 1: Write test verifying master volume subscription behavior**
- [x] **Step 2: Run test to verify failure/coverage**
- [x] **Step 3: Connect volume subscription to Lofi player, reveal card, and solo play**
- [x] **Step 4: Run test to verify pass**
- [x] **Step 5: Commit changes** (Commit `4e803f0`)

---

### Task 3: Audio Slice Playback & Replay Control (Item 6 & Item 7 Frontend)
**Files:**
- Modify: `src/components/room/game-view.tsx`
- Modify: `src/hooks/use-room-realtime.ts`
- Test: `src/components/room/__tests__/audio-slice-controls.test.ts`

- [x] **Step 1: Write test for audio slice one-time play and replay trigger**
- [x] **Step 2: Run test to verify failure**
- [x] **Step 3: Remove loop from audio slice, add replay button, and guard against excluded submits**
- [x] **Step 4: Run test to verify pass**
- [x] **Step 5: Commit changes** (Commit `7c3b5e6`)

---

### Task 4: Vinyl Disc & Scrubbable Seek Bar in Song Reveal (Items 3 & 5)
**Files:**
- Modify: `src/components/room/round-reveal-card.tsx`
- Modify: `src/app/play/solo/page.tsx`
- Test: `src/components/room/__tests__/round-reveal-vinyl-seek.test.ts`

- [x] **Step 1: Write test for vinyl animation class and seek bar timestamp calculation**
- [x] **Step 2: Run test to verify failure**
- [x] **Step 3: Implement vinyl disc UI with groove rings and scrubbable progress bar**
- [x] **Step 4: Run test to verify pass**
- [x] **Step 5: Commit changes** (Commit `5d2dc12`)

---

### Task 5: Hint & Surrender UI for All Players (Items 1 & 2 Frontend)
**Files:**
- Modify: `src/components/room/game-view.tsx`
- Modify: `src/hooks/use-room-realtime.ts`
- Test: `src/components/room/__tests__/hint-and-surrender-ui.test.ts`

- [x] **Step 1: Write test verifying non-host can trigger hint and surrender**
- [x] **Step 2: Run test to verify failure**
- [x] **Step 3: Update GameView and use-room-realtime to expose hint and surrender for all players**
- [x] **Step 4: Run test to verify pass**
- [x] **Step 5: Commit changes** (Commit `7c080d4`)

---

### Task 6: Final Verification & Build
- [x] **Step 1: Run complete vitest test suite** (98/98 tests passing)
- [x] **Step 2: Run next build** (100% 0 Errors, 20 routes generated)
- [x] **Step 3: Update `should fix.md` and commit**
