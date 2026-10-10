# Implementation Plan: Audio Slice Comprehensive Gameplay Fixes

## Problem Statement & Context
Multiple interrelated issues in Audio Slice mode were identified in `should fix.md`:
1. "❌ คุณตอบผิดในข้อนี้แล้ว (รอข้อถัดไป)" pops up when clicking surrender.
2. In audio slice mode, answering wrong replays the audio slice and restarts countdown; excluded players still see countdown timer.
3. When answer countdown reaches 0 without anyone answering, it counts down a second time before skipping.
4. Host cannot hear audio on round 8, and replay button is stuck / does not show.
5. Autocomplete is not showing suggestions when typing.
6. Round 9 deadlocks into infinite countdown loop when all players answer wrong.
7. Other players' wrong guesses flash intrusive banners across everyone's screen in audio slice mode.
8. Round number swaps back and forth between previous and new rounds due to serverless container reuse.

---

## Task Breakdown

### Task 1: Server State & Round Integrity (Issues 6 & 8)
- **Files:** `src/lib/room-state-store.ts`, `src/app/api/room/[code]/answer/route.ts`, `src/app/api/room/[code]/next-round/route.ts`
- **Changes:**
  1. In `RoomStateStore.ensureRoundState`:
     - Compare `dbRoundState?.currentRound` with `existing?.currentRound`.
     - If `dbRoundState` exists and has `currentRound > (existing?.currentRound || 0)` or `played_song_ids.length > (existing?.currentRound || 0)`, overwrite the stale in-memory state and rehydrate fresh state from DB/Redis.
  2. In `RoomStateStore.submitAnswer` and `surrenderPlayer`:
     - Calculate `effectiveTotalPlayers` prioritizing `options?.totalPlayers` (passed from active clients).
     - If `state.excludedPlayerIds.length >= effectiveTotalPlayers`, or if all known players are in `excludedPlayerIds`, transition `roundStatus` to `"revealing"` immediately.
  3. In `src/app/api/room/[code]/next-round/route.ts`:
     - Prioritize DB `currentRound` and `playedSongIds.length` to avoid stale instance regressions.

### Task 2: Audio & Countdown Timer Orchestration (Issues 2, 3 & 4)
- **Files:** `src/app/api/room/[code]/answer/route.ts`, `src/components/room/game-view.tsx`
- **Changes:**
  1. In `src/app/api/room/[code]/answer/route.ts`:
     - In wrong guess response and broadcast: set `resumeAudio: effectiveGameMode === "buzzer"` so audio slice does not restart.
  2. In `src/components/room/game-view.tsx`:
     - Remove `isExcludedFromBuzz` from timer `useEffect` dependency array so it doesn't reset to 15s on guess/surrender.
     - Hide the timer bar if `isExcludedFromBuzz === true`.
     - In `<audio>` element: add `onError` handler that sets `isAudioPlaying = false` and `hasPlayedOnce = true`.
     - In `audioRef.current.play().catch(...)`: set `isAudioPlaying = false` and `hasPlayedOnce = true` so the button flips to "ฟังซ้ำ" instead of getting stuck on "หยุดชั่วคราว".
     - When timer reaches 0, lock at 0 and trigger surrender.

### Task 3: Neutral Surrender Feedback & Isolated Wrong Guess Notification (Issues 1 & 7)
- **Files:** `src/components/room/game-view.tsx`, `src/components/room/wrong-guess-banner.tsx`
- **Changes:**
  1. In `src/components/room/game-view.tsx`:
     - Track `myExclusionReason: "surrendered" | "wrong_guess" | null`.
     - If `surrendered`: show `🏳️ คุณกดยอมแพ้ในข้อนี้แล้ว (รอข้อถัดไป)` with gentle neutral styling.
     - If `wrong_guess`: show `❌ คุณตอบผิดในข้อนี้แล้ว (รอข้อถัดไป)`.
     - In `audio-slice` mode, do NOT show `WrongGuessBanner` unless `lastWrongGuess.playerId === myPlayer?.id`.
  2. In `src/components/room/wrong-guess-banner.tsx`:
     - Do not show `RESUME_AUDIO_CUE` ("แย่งกันกดกริ่งเลย") if game mode is not buzzer.

### Task 4: Autocomplete Catalog & Universal Fallback (Issue 5)
- **Files:** `src/lib/constants/demo-songs.ts`, `src/app/api/admin/songs/route.ts`, `src/app/room/[code]/page.tsx`, `src/components/room/game-view.tsx`
- **Changes:**
  1. Create `src/lib/constants/demo-songs.ts` exporting default `DEMO_SONGS`.
  2. Support dynamic `limit` in `/api/admin/songs/route.ts` (e.g. `Math.min(500, Number(searchParams.get("limit")) || 100)`).
  3. In `page.tsx` and `game-view.tsx`: initialize `songLibrary` with `DEMO_SONGS` so suggestions are instantly available even before the network request completes or if it fails.

### Task 5: Testing & Verification
- **Files:** `src/lib/__tests__/audio-slice-gameplay-fixes.test.ts`
- **Changes:**
  - Verify all 8 fixes with automated Vitest suites.
  - Run `npm run build` to verify 0 errors.
  - Update `should fix.md`.
