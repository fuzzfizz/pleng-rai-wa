# Audio Slice Song Fidelity, Hint Timer Fix & Unlimited Answer Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the song reveal mismatch bug ("เฉลยเพลงผิด"), fix the countdown timer resetting bug when requesting hints ("ขอคำใบ้เวลารีเซ็ท"), and remove the countdown timer from non-buzzer modes to allow unlimited answering time with selectable Race vs Wait-for-All answer resolution.

**Architecture:**
1. **Server Round Integrity & Song Fidelity:** In `RoomStateStore.ensureRoundState`, detect any state mismatch between in-memory cache and DB (`currentRound !== dbRoundState.currentRound` or `currentSong.id !== room.current_song_id`), immediately rehydrating authoritative song data from DB.
2. **Audio Element Buffer Reset:** In `GameView`, whenever `activeQuestion.sliceUrl` changes, explicitly invoke `audio.load()` and reset `currentTime = 0` to prevent browsers from replaying previously buffered audio tracks. In `SoloPlay`, freeze the active song during initial async library load to prevent in-flight song replacement.
3. **Timer Refactor & Non-Buzzer Unlimited Mode:** Remove the forced 15s countdown timer bar and timeout handlers from non-buzzer modes (`audio-slice`, `ai-lyrics`, `translated-lyrics`), making time unlimited. In `HostSettingsModal`, restrict countdown duration configuration exclusively to `buzzer` mode, and highlight the Answer Resolution Mode (Race vs Wait-for-All). For buzzer mode or any timers, use ref guards so receiving hints never resets timer state.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase Realtime, Vitest, Tailwind CSS.

## Global Constraints
- Vitest suite must remain 100% passing across all tests.
- Audio and SFX volume controls must remain synchronized.
- Zero breaking changes to `buzzer` mode.
- Non-buzzer modes (`audio-slice`, `ai-lyrics`, `translated-lyrics`) must default to unlimited time per round.
- Host and players can still surrender ("ยอมแพ้ข้อนี้") or skip ("ข้ามข้อนี้") at any time.

---

### Task 1: Server Round State & Song Fidelity Invalidation

**Files:**
- Modify: `src/lib/room-state-store.ts:180-275`
- Test: `src/lib/__tests__/audio-slice-song-fidelity.test.ts`

**Interfaces:**
- Consumes: `RoomStateStore.ensureRoundState(code, room, song)`
- Produces: 100% song fidelity guarantee between database `current_song_id` and memory `currentSong`

- [ ] **Step 1: Write failing test for ensureRoundState mismatch detection**

Create `src/lib/__tests__/audio-slice-song-fidelity.test.ts` testing that:
1. When `existing` has `currentRound = 5` (from older game) and `dbRoundState` has `currentRound = 1`, `ensureRoundState` marks it as stale and loads the new song.
2. When `existing` has `currentSong.id = "song-1"` but DB `current_song_id = "song-2"` (even with same round number), `ensureRoundState` invalidates memory and loads `"song-2"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/audio-slice-song-fidelity.test.ts`
Expected: FAIL on stale mismatch checks.

- [ ] **Step 3: Update `RoomStateStore.ensureRoundState`**

In `src/lib/room-state-store.ts`:
Update `isStale` logic:
```typescript
const isStale =
  Boolean(existing) &&
  ((typeof dbRoundState?.currentRound === "number" &&
    dbRoundState.currentRound !== (existing?.currentRound || 0)) ||
   (Array.isArray(room.played_song_ids) &&
    room.played_song_ids.length !== (existing?.currentRound || 0)) ||
   (room.current_song_id &&
    existing?.currentSong?.id &&
    room.current_song_id !== existing.currentSong.id) ||
   (dbRoundState?.currentSong?.id &&
    existing?.currentSong?.id &&
    dbRoundState.currentSong.id !== existing.currentSong.id));
```
And ensure that when rehydrating, if `dbRoundState?.currentSong?.id === room.current_song_id`, use `dbRoundState.currentSong`; otherwise fetch fresh from `SongService.getSongById(room.current_song_id)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/audio-slice-song-fidelity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/room-state-store.ts src/lib/__tests__/audio-slice-song-fidelity.test.ts
git commit -m "fix(gameplay): guarantee 100% song fidelity across serverless instance rehydration"
```

---

### Task 2: Audio Buffer Clean Reload & Solo Play Initial Pool Stability

**Files:**
- Modify: `src/components/room/game-view.tsx:580-605`
- Modify: `src/app/play/solo/page.tsx:165-185`
- Test: `src/lib/__tests__/audio-slice-buffer-reload.test.ts`

**Interfaces:**
- Consumes: `<audio>` DOM element reference, `activeQuestion.sliceUrl`
- Produces: Clean audio buffer reloading on round slice changes without playing leftover buffers

- [ ] **Step 1: Write test for audio reload & initial pool safety**

Create `src/lib/__tests__/audio-slice-buffer-reload.test.ts` verifying:
1. Audio element reloads (`load()`) and resets `currentTime = 0` whenever `sliceUrl` changes.
2. Solo play does not replace active song when `loadPublicSongLibrary()` finishes while a round has already started.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/audio-slice-buffer-reload.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement clean audio buffer reload in `GameView` and pool safety in `SoloPlay`**

In `src/components/room/game-view.tsx`:
Add an effect tracking previous `sliceUrl`:
```typescript
const prevSliceUrlRef = useRef<string | undefined>(undefined);
useEffect(() => {
  if (activeQuestion?.sliceUrl && activeQuestion.sliceUrl !== prevSliceUrlRef.current) {
    prevSliceUrlRef.current = activeQuestion.sliceUrl;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      } catch {}
    }
  }
}, [activeQuestion?.sliceUrl]);
```

In `src/app/play/solo/page.tsx`:
Only update `songsPool` if user is still on initial unplayed state (`score === 0 && currentSongIndex === 0 && !isPlayingAudio && !isRevealed`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/audio-slice-buffer-reload.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/room/game-view.tsx src/app/play/solo/page.tsx src/lib/__tests__/audio-slice-buffer-reload.test.ts
git commit -m "fix(audio): ensure clean audio buffer reload on slice change and protect solo play song pool"
```

---

### Task 3: Remove Countdown Timer from Non-Buzzer Modes & Fix Hint Reset Bug

**Files:**
- Modify: `src/components/room/game-view.tsx:345-390, 495-545, 975-1010`
- Modify: `src/components/room/tv-view.tsx:195-225`
- Test: `src/components/room/__tests__/non-buzzer-unlimited-timer.test.ts`

**Interfaces:**
- Consumes: `gameMode`, `status`, `requestHint`
- Produces: Unlimited answering time in `audio-slice`, `ai-lyrics`, `translated-lyrics`. Hint request does not reset timer or state.

- [ ] **Step 1: Write test for non-buzzer unlimited mode and hint immunity**

Create `src/components/room/__tests__/non-buzzer-unlimited-timer.test.ts`:
1. In `audio-slice` mode, `countdownRemaining` remains `null`, countdown bar is NOT rendered, and no auto-timeout is scheduled.
2. In `buzzer` mode, countdown only runs when status is `buzzed`.
3. When hint is revealed, timer does not reset.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/room/__tests__/non-buzzer-unlimited-timer.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `GameView` & `TVView`**

In `src/components/room/game-view.tsx`:
1. Only start `countdownRemaining` if `gameMode === "buzzer" && status === "buzzed"`.
2. For non-buzzer modes (`audio-slice`, `ai-lyrics`, `translated-lyrics`):
   - Set `countdownRemaining = null`.
   - Do NOT mount 15s timer interval.
   - Do NOT render 15s countdown timer bar.
3. In `handleTimeoutRef`:
   ```typescript
   const handleTimeoutRef = useRef(handleTimeout);
   useEffect(() => {
     handleTimeoutRef.current = handleTimeout;
   });
   ```
   So timer interval doesn't re-run or reset when callbacks change identity.

In `src/components/room/tv-view.tsx`:
Only run question timer if `gameMode === "buzzer"`. In non-buzzer modes, show unhurried round info.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/room/__tests__/non-buzzer-unlimited-timer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/room/game-view.tsx src/components/room/tv-view.tsx src/components/room/__tests__/non-buzzer-unlimited-timer.test.ts
git commit -m "feat(gameplay): remove countdown timer from non-buzzer modes and fix hint reset bug"
```

---

### Task 4: Host Settings Modal & Lobby Alignment (Buzzer-only Timer vs Race/Wait-All)

**Files:**
- Modify: `src/components/room/host-settings-modal.tsx:670-715, 765-815`
- Modify: `src/components/room/lobby-view.tsx:75-95`
- Test: `src/components/room/__tests__/host-settings-modes-alignment.test.ts`

**Interfaces:**
- Consumes: `draft.gameMode`, `draft.roundTimeoutSec`, `draft.answerResolutionMode`
- Produces: Host UI where Round Timeout is only configurable for Buzzer mode, and Answer Resolution Mode is clearly selected for non-buzzer modes.

- [ ] **Step 1: Write test for host settings mode-specific controls**

Create `src/components/room/__tests__/host-settings-modes-alignment.test.ts`:
1. When `gameMode === "buzzer"`: Round Timeout options (10s, 15s, 30s) are visible as "⏱️ เวลานับถอยหลังตอบหลังกดกริ่ง".
2. When `gameMode === "audio-slice"`: Round Timeout selector is hidden or shows "ไม่จำกัดเวลา (Unlimited)". Answer Resolution Mode (Race vs Wait-for-All) is prominently selectable.
3. Lobby summary badge displays "ไม่จำกัดเวลา • แย่งกันตอบ" or "ไม่จำกัดเวลา • รอตอบให้หมด".

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/room/__tests__/host-settings-modes-alignment.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `HostSettingsModal` and `LobbyView`**

1. In `src/components/room/host-settings-modal.tsx`:
   - Conditionally render Round Timeout only when `draft.gameMode === "buzzer"` (or render informative note "โหมดนี้ไม่จำกัดเวลาในการตอบ" when non-buzzer).
   - Ensure `answerResolutionMode` is prominent and default is `"race"`, with option `"wait_all"`.
2. In `src/components/room/lobby-view.tsx`:
   - Update settings badges in lobby to clearly show the mode ("ไม่จำกัดเวลา", "⚡ แย่งกันตอบ" / "👥 รอตอบให้หมด").

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/room/__tests__/host-settings-modes-alignment.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/room/host-settings-modal.tsx src/components/room/lobby-view.tsx src/components/room/__tests__/host-settings-modes-alignment.test.ts
git commit -m "feat(settings): scope answer timeout to buzzer mode and highlight answer resolution options"
```

---

### Task 5: Full Regression Testing, Build Verification & Documentation Update

**Files:**
- Modify: `should fix.md`
- Test: All test suites (`npx vitest run`)

- [ ] **Step 1: Run all vitest test suites**

Run: `npx vitest run`
Expected: All 25+ test suites pass with 100% success rate.

- [ ] **Step 2: Run Next.js production build**

Run: `npm run build`
Expected: Successful compile with 0 TypeScript or Lint errors.

- [ ] **Step 3: Update `should fix.md`**

Mark all items as completed with detailed root cause explanations and verification results.

- [ ] **Step 4: Commit**

```bash
git add should fix.md
git commit -m "docs: document fixes for wrong reveal, hint timer reset, and unlimited non-buzzer mode"
```
