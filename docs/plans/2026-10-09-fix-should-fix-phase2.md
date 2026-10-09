# Implementation Plan: Fix Issues in should fix.md (Phase 2)

**Goal:** Resolve all 7 issues identified in `should fix.md`:
1. Autocomplete not showing suggestions
2. 15s answer countdown timer after audio slice finishes
3. Per-player isolated hints and scoring
4. Remove host immediate skip right; all players must answer or surrender
5. Wrong song revealed in audio-slice mode
6. Surrender incorrectly treated as wrong guess "(ยอมแพ้)" with -20 penalty and wrong guess banner
7. Game over looping back to round 5 and crashing with HTTP 400

---

## Task 1: Server State & Song Integrity (Items 5 & 7)
### Objectives:
1. In `src/lib/room-state-store.ts`:
   - In `serializeRoundState`: include `currentSong: state.currentSong`.
   - In `ensureRoundState`:
     - Rehydrate `resolvedSong` directly from `dbRoundState?.currentSong` if present.
     - Ensure `currentRound` and `totalRounds` are accurately read from `dbRoundState`.
2. In `src/app/api/room/[code]/next-round/route.ts`:
   - Rehydrate state using `await RoomStateStore.ensureRoundState(cleanCode, room)` before calculating `completedRounds`.
   - If `room.status === "game_over"` or host starts new game (`isPlayAgain`):
     - Reset `current_round: 0`, `played_song_ids: []`, `scores: {}`, and clear `round_state`.
   - Accurately transition to `game_over` when `completedRounds >= settings.totalRounds`.
3. In `src/app/room/[code]/page.tsx` & `src/components/room/podium-view.tsx`:
   - Pass reset/play-again signal properly so the room state resets cleanly.

---

## Task 2: Per-Player Hints & Fair Scoring (Item 3)
### Objectives:
1. In `src/lib/room-state-store.ts`:
   - In `RoomRoundState`, add `playerHints?: Record<string, { genre?: string; year?: string; artist?: string }>;`
   - In `revealNextHint(code, playerId)`:
     - Store the hint details under `state.playerHints[playerId]`.
     - Return `hintPayload` containing `playerId`.
   - In `submitAnswer`:
     - Calculate `playerHintLevel = (playerId && state.playerHintLevels?.[playerId]) ?? 0;` (NO fallback to `state.revealedHintLevel`!).
2. In `src/hooks/use-room-realtime.ts`:
   - In `RoomRealtimeState`, track `playerHints?: Record<string, { genre?: string; year?: string; artist?: string }>`.
   - In `hint_revealed` reducer:
     - Save hint to `nextState.playerHints[playerId]`.
     - Only update `nextState.revealedHints` if it belongs to `myPlayer.id`.
3. In `src/components/room/game-view.tsx`:
   - `myHintLevel = (myPlayer?.id && roomRealtime.playerHintLevels?.[myPlayer.id]) ?? 0;`
   - Only render hint badges belonging to `myPlayer.id`.
   - Available points displays: 100 (0 hints), 75 (1 hint), 50 (2 hints), 25 (3 hints) strictly based on `myHintLevel`.

---

## Task 3: Surrender System & Host Skip Alignment (Items 4 & 6)
### Objectives:
1. Create new endpoint `src/app/api/room/[code]/surrender/route.ts` (or integrate in answer route):
   - Accepts `{ playerId: string }`.
   - Adds player to `state.excludedPlayerIds`.
   - Does NOT penalize -20 points (delta = 0).
   - Does NOT record as a wrong guess `answerText: "(ยอมแพ้)"`.
   - Broadcasts `player_surrendered` event: `{ playerId, displayName }`.
   - If `state.excludedPlayerIds.length >= effectiveTotalPlayers`, transitions room to `revealing`.
2. In `src/components/room/game-view.tsx`:
   - Host button is ALSO "ยอมแพ้ข้อนี้" (Host cannot force-skip immediately; must wait for all players to answer or surrender).
   - Surrender button calls `/api/room/[code]/surrender`.
   - Display neutral toast/banner on `player_surrendered` instead of wrong guess banner.
3. In `src/components/room/wrong-guess-banner.tsx`:
   - Filter out or never show `(ยอมแพ้)` in wrong guess banner.

---

## Task 4: Autocomplete Catalog & 15s Countdown Timer (Items 1 & 2)
### Objectives:
1. Autocomplete (Item 1):
   - In `src/app/room/[code]/page.tsx`:
     - Fetch songs on mount (from `/api/admin/songs?limit=200` or demo songs fallback).
     - Pass `songLibrary` to `<GameView songLibrary={songLibrary} ... />`.
   - In `src/components/room/game-view.tsx`:
     - Add fallback: if `songLibrary` is empty, fetch from `/api/admin/songs` on mount.
2. 15s Countdown Timer (Item 2):
   - In `src/components/room/game-view.tsx` & `src/components/room/tv-view.tsx`:
     - Read `answerTimeLimit` from `roomRealtime.room?.settings?.answerTimeLimit` (default 15s).
     - When slice audio finishes playing for the first time (`onEnded` -> `hasPlayedOnce = true`), start `countdownSeconds` from `answerTimeLimit`.
     - Display a prominent, elegant countdown progress bar & seconds badge.
     - Play soft tick SFX in the last 5 seconds.
     - When timer reaches 0: auto-surrender or trigger timeout for active player.
