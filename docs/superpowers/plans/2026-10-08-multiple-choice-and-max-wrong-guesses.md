# Multiple Choice, Max Wrong Guesses, and Skip/Give-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4-choice Multiple Choice mode with library decoys and anti-cheat masking, configurable max wrong guesses with -20 pt penalty, and a Host/Player Skip & Give-up mechanism across server state, API endpoints, player views, and TV views.

**Architecture:** Extend `RoomStateStore` with authoritative decoy selection, choice shuffling, attempt tracking, and round skipping. Update `next-round` and `answer` API routes to support non-buzzer direct input and masked choice payloads. Enhance `GameView` and `TvView` with 2x2 responsive choice grids and skip controls, and update `HostSettingsModal` with intuitive configuration selectors.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React, Tailwind CSS, Supabase Realtime Broadcast, Vitest.

## Global Constraints

- Thai fuzzy answer checking via `checkAnswer` in `src/lib/answer-checker.ts`.
- Anti-cheat: Never leak actual song IDs or unmasked choices in public payloads. Choice keys must use masked IDs (`choice_0`..`choice_3`).
- Score penalty: Wrong guesses deduct 20 points, clamped to a minimum of 0.
- Buzzer mode constraint: Strictly 1 attempt per buzz to release buzzer lock and allow other players to compete.
- Clean Vinyl Cafe aesthetic with mobile responsive touch-first design (min 44px tap targets).

---

### Task 1: Core Types & Authoritative State Store Enhancements

**Files:**
- Modify: `src/types/index.ts:5-30, 100-140`
- Modify: `src/lib/room-state-store.ts:20-80, 240-390, 480-520`
- Test: `src/lib/__tests__/room-state-multiple-choice-and-wrong-guesses.test.ts`

**Interfaces:**
- Consumes: `RoomSettings`, `Song`, `GameMode` from `src/types/index.ts`.
- Produces: `ChoiceOption`, updated `RoomRoundState`, `RoomStateStore.submitAnswer()`, `RoomStateStore.skipRound()`.

- [ ] **Step 1: Write the failing test for RoomStateStore wrong guess counting and skip**

Create `src/lib/__tests__/room-state-multiple-choice-and-wrong-guesses.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateStore } from "../room-state-store";
import type { Song, RoomSettings } from "@/types";

describe("RoomStateStore - Multiple Choice, Max Wrong Guesses, and Skip", () => {
  const dummySong: Song = {
    id: "song-123",
    title: "รักแรก",
    artist: "NONT TANONT",
    aliases: ["First Love"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
  };

  const defaultSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "multiple-choice",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    maxWrongGuesses: 2,
  };

  const roomCode = "TEST99";

  beforeEach(() => {
    RoomStateStore.initRound(roomCode, 1, dummySong, defaultSettings, {
      choices: [
        { id: "choice_0", title: "รักแรก", artist: "NONT TANONT" },
        { id: "choice_1", title: "โต๊ะริม", artist: "NONT TANONT" },
        { id: "choice_2", title: "พิง", artist: "NONT TANONT" },
        { id: "choice_3", title: "วันนั้นฝนก็ตกแบบนี้แหละ", artist: "MEAN" },
      ],
    });
  });

  it("allows guessing again when player wrong guesses are below maxWrongGuesses", () => {
    // Attempt 1: wrong guess
    const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "โต๊ะริม", {
      gameMode: "audio-slice",
      roomSettings: defaultSettings,
      totalPlayers: 2,
    });

    expect(res1.success).toBe(true);
    expect(res1.isCorrect).toBe(false);
    const state1 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state1?.excludedPlayerIds.includes("p1")).toBe(false);
    expect(state1?.playerWrongCounts["p1"]).toBe(1);

    // Attempt 2: wrong guess (reaches maxWrongGuesses = 2)
    const res2 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "พิง", {
      gameMode: "audio-slice",
      roomSettings: defaultSettings,
      totalPlayers: 2,
    });

    expect(res2.success).toBe(true);
    expect(res2.isCorrect).toBe(false);
    const state2 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state2?.excludedPlayerIds.includes("p1")).toBe(true);
    expect(state2?.playerWrongCounts["p1"]).toBe(2);

    // Attempt 3: rejected because excluded
    const res3 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแรก", {
      gameMode: "audio-slice",
      roomSettings: defaultSettings,
      totalPlayers: 2,
    });
    expect(res3.success).toBe(false);
    expect(res3.reason).toBe("already_guessed_wrong");
  });

  it("never excludes players when maxWrongGuesses is 0 (unlimited)", () => {
    const unlimitedSettings: RoomSettings = {
      ...defaultSettings,
      maxWrongGuesses: 0,
    };
    RoomStateStore.initRound(roomCode, 1, dummySong, unlimitedSettings);

    for (let i = 0; i < 5; i++) {
      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", `ผิดครั้งที่ ${i}`, {
        gameMode: "audio-slice",
        roomSettings: unlimitedSettings,
        totalPlayers: 2,
      });
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
    }

    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state?.excludedPlayerIds.includes("p1")).toBe(false);
    expect(state?.playerWrongCounts["p1"]).toBe(5);
  });

  it("strictly excludes player on first wrong guess in buzzer mode regardless of room maxWrongGuesses", () => {
    const buzzerSettings: RoomSettings = {
      ...defaultSettings,
      gameMode: "buzzer",
      maxWrongGuesses: 3,
    };
    RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);

    // Buzz in first
    const buzzRes = RoomStateStore.buzz(roomCode, "p1", "Player 1");
    expect(buzzRes.success).toBe(true);

    // Submit wrong answer
    const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบผิด", {
      gameMode: "buzzer",
      roomSettings: buzzerSettings,
      totalPlayers: 2,
    });

    expect(res.isCorrect).toBe(false);
    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state?.excludedPlayerIds.includes("p1")).toBe(true);
    expect(state?.roundStatus).toBe("question_active"); // Unlocked for next buzzer
  });

  it("skips round and transitions to revealing with winner null when skipRound is called", () => {
    const skipRes = RoomStateStore.skipRound(roomCode);
    expect(skipRes.success).toBe(true);
    expect(skipRes.roundState?.roundStatus).toBe("revealing");
    expect(skipRes.roundState?.winnerPlayerId).toBeNull();
    expect(skipRes.roundState?.roundWinnerPlayerId).toBeNull();
    expect(skipRes.fullSong?.id).toBe("song-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/room-state-multiple-choice-and-wrong-guesses.test.ts`
Expected: FAIL with missing fields or functions (`skipRound`, `playerWrongCounts`, etc.)

- [ ] **Step 3: Update `src/types/index.ts`**

Update `src/types/index.ts`:
- Define `ChoiceOption`:
```typescript
export interface ChoiceOption {
  id: string; // Masked choice key, e.g. "choice_0", "choice_1"
  title: string;
  artist: string;
}
```
- In `RoomSettings`: add `maxWrongGuesses?: number;`
- In `ActiveQuestion`: add `choices?: ChoiceOption[];`

- [ ] **Step 4: Update `src/lib/room-state-store.ts`**

In `src/lib/room-state-store.ts`:
- Update `RoomRoundState`:
  ```typescript
  choices?: ChoiceOption[];
  playerWrongCounts: Record<string, number>;
  ```
- In `initRound()`:
  - Initialize `choices: extra?.choices`
  - Initialize `playerWrongCounts: {}`
- Fix direct answering check:
  ```typescript
  const isDirectAnswer =
    gameMode !== "buzzer" && state.roundStatus === "question_active";
  ```
- In `submitAnswer()`:
  - Increment `playerWrongCounts[playerId] = (state.playerWrongCounts[playerId] || 0) + 1;`
  - Handle exclusion based on mode:
    ```typescript
    if (isStandardBuzzer) {
      if (!state.excludedPlayerIds.includes(playerId)) {
        state.excludedPlayerIds.push(playerId);
      }
    } else {
      const maxWrong = state.settings?.maxWrongGuesses ?? 1;
      if (maxWrong > 0 && state.playerWrongCounts[playerId] >= maxWrong) {
        if (!state.excludedPlayerIds.includes(playerId)) {
          state.excludedPlayerIds.push(playerId);
        }
      }
    }
    ```
- Add `skipRound()` method:
  ```typescript
  static skipRound(code: string): {
    success: boolean;
    roundState?: RoomRoundState;
    fullSong?: Song;
  } {
    const cleanCode = code.trim().toUpperCase();
    const state = roomRoundStates.get(cleanCode);
    if (!state) return { success: false };

    state.roundStatus = "revealing";
    state.winnerPlayerId = null;
    state.roundWinnerPlayerId = null;
    state.buzzedPlayerId = null;
    state.buzzedPlayerName = null;
    state.buzzedAt = null;
    state.buzzDeadline = null;

    return {
      success: true,
      roundState: state,
      fullSong: state.currentSong,
    };
  }
  ```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/room-state-multiple-choice-and-wrong-guesses.test.ts`
Expected: PASS (4 tests passing)

- [ ] **Step 6: Commit changes**

```bash
git add src/types/index.ts src/lib/room-state-store.ts src/lib/__tests__/room-state-multiple-choice-and-wrong-guesses.test.ts
git commit -m "feat(store): add multiple choice, max wrong guesses tracking, and skipRound to RoomStateStore"
```

---

### Task 2: Decoy Generation in Next Round API & Skip Route

**Files:**
- Modify: `src/app/api/room/[code]/next-round/route.ts:160-235`
- Modify: `src/app/api/room/[code]/answer/route.ts:80-100`
- Create: `src/app/api/room/[code]/skip/route.ts`
- Test: `src/app/api/room/__tests__/skip-and-next-round.test.ts`

**Interfaces:**
- Consumes: `SongService.getRandomSongs`, `RoomStateStore.skipRound`, `RealtimeBroadcastService.broadcast`.
- Produces: `POST /api/room/[code]/skip`, masked `choices` in `round_start` broadcast and `/next-round` response.

- [ ] **Step 1: Write the failing test for skip route and next-round decoy generation**

Create `src/app/api/room/__tests__/skip-and-next-round.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import type { Song, RoomSettings } from "@/types";

describe("Skip Route & Decoy Generation Logic", () => {
  const dummySong: Song = {
    id: "song-1",
    title: "เพลงจริง",
    artist: "ศิลปินจริง",
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 10,
    hookEndSec: 30,
  };

  const dummyDecoys: Song[] = [
    { id: "song-2", title: "เพลงหลอก 1", artist: "ศิลปิน 1", audioUrl: "" },
    { id: "song-3", title: "เพลงหลอก 2", artist: "ศิลปิน 2", audioUrl: "" },
    { id: "song-4", title: "เพลงหลอก 3", artist: "ศิลปิน 3", audioUrl: "" },
  ];

  it("generates 4 choices with masked keys and no leaked target song id", () => {
    const rawChoices = [
      { realId: dummySong.id, title: dummySong.title, artist: dummySong.artist },
      ...dummyDecoys.map((d) => ({ realId: d.id, title: d.title, artist: d.artist })),
    ];
    // Fisher-Yates shuffle & mask
    const shuffled = [...rawChoices].sort(() => 0.5 - Math.random());
    const masked = shuffled.map((c, idx) => ({
      id: `choice_${idx}`,
      title: c.title,
      artist: c.artist,
    }));

    expect(masked).toHaveLength(4);
    expect(masked.map((m) => m.id)).toEqual(["choice_0", "choice_1", "choice_2", "choice_3"]);
    expect(masked.some((m) => m.title === "เพลงจริง")).toBe(true);
    // Ensure raw song IDs are NOT exposed in masked choices
    expect(masked.some((m) => m.id === "song-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Update `src/app/api/room/[code]/next-round/route.ts`**

In `src/app/api/room/[code]/next-round/route.ts`:
- Check if `settings.answerInputMode === "multiple-choice"`.
- If true:
  ```typescript
  let decoys: Song[] = [];
  try {
    decoys = await SongService.getRandomSongs(3, {
      genreId: filterGenreId,
      era: filterEra,
      artist: filterArtist,
      yearStart: filterYearStart,
      yearEnd: filterYearEnd,
      playlistId: filterPlaylistId,
      excludeIds: [song.id, ...playedSongIds],
    });
  } catch (err) {
    console.warn("Failed to fetch filtered decoys, falling back to general pool", err);
  }

  // Fallback if fewer than 3 decoys returned
  if (decoys.length < 3) {
    const needed = 3 - decoys.length;
    const existingIds = [song.id, ...playedSongIds, ...decoys.map((d) => d.id)];
    const fallbackDecoys = await SongService.getRandomSongs(needed, {
      excludeIds: existingIds,
    });
    decoys = [...decoys, ...fallbackDecoys];
  }

  const rawChoices = [
    { realId: song.id, title: song.title, artist: song.artist },
    ...decoys.map((d) => ({ realId: d.id, title: d.title, artist: d.artist })),
  ];
  // Shuffle Fisher-Yates
  for (let i = rawChoices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rawChoices[i], rawChoices[j]] = [rawChoices[j], rawChoices[i]];
  }
  const choices = rawChoices.map((c, idx) => ({
    id: `choice_${idx}`,
    title: c.title,
    artist: c.artist,
  }));
  ```
- Pass `choices` to `RoomStateStore.initRound(cleanCode, nextRound, song, settings, { ..., choices })`.
- Include `choices` in `roundStartPayload` and the route's JSON response.

- [ ] **Step 3: Update `src/app/api/room/[code]/answer/route.ts`**

In `src/app/api/room/[code]/answer/route.ts` lines 87-90:
Update:
```typescript
const isDirectAnswerAllowed =
  room.settings.gameMode !== "buzzer" &&
  currentRoundState?.roundStatus === "question_active";
```
This ensures direct answers for `audio-slice`, `ai-lyrics`, and `translated-lyrics` are accepted without requiring buzzer.

- [ ] **Step 4: Create `src/app/api/room/[code]/skip/route.ts`**

Create `src/app/api/room/[code]/skip/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";
import { RoomStateStore } from "@/lib/room-state-store";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { isValidRoomCode } from "@/lib/room-code";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    if (!code || !isValidRoomCode(code)) {
      return NextResponse.json({ success: false, error: "รหัสห้องไม่ถูกต้อง" }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const room = await RoomService.getRoomByCode(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: "ไม่พบห้องนี้ในระบบ" }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { playerId } = body || {};
    // Verify caller is in room and is host (or allow if solo / 1 player)
    const isHost = playerId ? room.hostPlayerId === playerId : true;
    if (!isHost) {
      return NextResponse.json({ success: false, error: "เฉพาะ Host เท่านั้นที่ข้ามข้อได้" }, { status: 403 });
    }

    const state = RoomStateStore.getRoomRoundState(cleanCode);
    if (!state || (state.roundStatus !== "question_active" && state.roundStatus !== "buzzed")) {
      return NextResponse.json({ success: false, error: "ไม่อยู่ในช่วงเวลาที่ข้ามได้" }, { status: 400 });
    }

    const skipResult = RoomStateStore.skipRound(cleanCode);
    if (!skipResult.success || !skipResult.fullSong) {
      return NextResponse.json({ success: false, error: "ไม่สามารถข้ามข้อนี้ได้" }, { status: 500 });
    }

    await RoomService.updateRoomStatus(cleanCode, "revealing");

    // Broadcast round_reveal with skipped = true and winnerPlayerId = null
    await RealtimeBroadcastService.broadcast(cleanCode, "round_reveal", {
      song: skipResult.fullSong,
      winnerPlayerId: null,
      winnerDisplayName: null,
      answerText: null,
      scoreDelta: 0,
      scores: skipResult.roundState?.scores || {},
      skipped: true,
    });

    return NextResponse.json({
      success: true,
      message: "ข้ามข้อนี้เรียบร้อยแล้ว",
      roundStatus: "revealing",
    });
  } catch (error: any) {
    console.error("Skip route error:", error);
    return NextResponse.json({ success: false, error: error.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests and type check**

Run: `npx vitest run src/app/api/room/__tests__/skip-and-next-round.test.ts`
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/app/api/room/[code]/next-round/route.ts src/app/api/room/[code]/answer/route.ts src/app/api/room/[code]/skip/route.ts src/app/api/room/__tests__/skip-and-next-round.test.ts
git commit -m "feat(api): implement decoy choice generation in next-round and POST /api/room/[code]/skip"
```

---

### Task 3: Client Realtime Hook & Host Settings Modal UI

**Files:**
- Modify: `src/hooks/use-room-realtime.ts:24-35, 260-290, 355-380, 800-840`
- Modify: `src/components/room/host-settings-modal.tsx:40-120, 680-740`
- Test: `src/components/room/__tests__/host-settings-modal.test.ts`

**Interfaces:**
- Consumes: `RoomSettings.maxWrongGuesses`, `RoomSettings.answerInputMode`.
- Produces: `skipRound()` action on `useRoomRealtime`, HostSettingsModal selectors for 4-choice and max wrong guesses.

- [ ] **Step 1: Write test for HostSettingsModal payload preparation**

Create `src/components/room/__tests__/host-settings-modal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { prepareSettingsPayload } from "../host-settings-modal";

describe("HostSettingsModal - prepareSettingsPayload", () => {
  it("preserves multiple-choice answerInputMode and valid maxWrongGuesses", () => {
    const payload = prepareSettingsPayload({
      answerInputMode: "multiple-choice",
      maxWrongGuesses: 2,
    });

    expect(payload.answerInputMode).toBe("multiple-choice");
    expect(payload.maxWrongGuesses).toBe(2);
  });

  it("normalizes maxWrongGuesses to default 1 if negative or NaN", () => {
    const payload1 = prepareSettingsPayload({
      maxWrongGuesses: -1 as any,
    });
    expect(payload1.maxWrongGuesses).toBe(1);

    const payload2 = prepareSettingsPayload({
      maxWrongGuesses: 0, // 0 is valid (unlimited)
    });
    expect(payload2.maxWrongGuesses).toBe(0);
  });
});
```

- [ ] **Step 2: Update `src/hooks/use-room-realtime.ts`**

In `src/hooks/use-room-realtime.ts`:
- Update `ActiveQuestion`:
  ```typescript
  export interface ActiveQuestion {
    sliceUrl?: string;
    durationSec?: number;
    lyrics?: string;
    startedAt?: string;
    choices?: ChoiceOption[];
  }
  ```
- In `round_start` reducer:
  ```typescript
  nextState.activeQuestion = {
    sliceUrl: payload?.sliceUrl,
    durationSec: payload?.durationSec,
    lyrics: payload?.lyrics,
    startedAt: payload?.startedAt,
    choices: payload?.choices,
  };
  ```
- In `round_reveal` reducer:
  ```typescript
  nextState.roundWinner = payload?.winnerPlayerId
    ? {
        playerId: payload.winnerPlayerId,
        displayName: payload.winnerDisplayName || "ผู้ชนะ",
        answerText: payload.answerText || "",
        scoreDelta: typeof payload.scoreDelta === "number" ? payload.scoreDelta : 100,
      }
    : null;
  ```
- Add `skipRound` callback:
  ```typescript
  const skipRound = useCallback(async (): Promise<boolean> => {
    if (!state.roomCode) return false;
    try {
      const res = await fetch(`/api/room/${state.roomCode}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: state.myPlayer?.id }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error("Error skipping round:", err);
      return false;
    }
  }, [state.roomCode, state.myPlayer?.id]);
  ```
- Export `skipRound` in the return object of `useRoomRealtime`.

- [ ] **Step 3: Update `src/components/room/host-settings-modal.tsx`**

In `src/components/room/host-settings-modal.tsx`:
- In `prepareSettingsPayload`:
  ```typescript
  if (result.answerInputMode && !["autocomplete", "free-text", "multiple-choice"].includes(result.answerInputMode)) {
    result.answerInputMode = "autocomplete";
  }
  if (result.maxWrongGuesses !== undefined) {
    const val = Number(result.maxWrongGuesses);
    result.maxWrongGuesses = isNaN(val) || val < 0 ? 1 : val;
  }
  ```
- Add Option 3 under `Answer Input Mode`:
  ```tsx
  <button
    type="button"
    onClick={() => setDraft((prev) => ({ ...prev, answerInputMode: "multiple-choice" }))}
    className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
      draft.answerInputMode === "multiple-choice"
        ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/30 text-stone-900 dark:text-white"
        : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="font-semibold text-sm text-stone-900 dark:text-white">Multiple Choice (ปรนัย 4 ตัวเลือก)</span>
      {draft.answerInputMode === "multiple-choice" && (
        <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      )}
    </div>
    <span className="text-[11px] text-stone-500 dark:text-stone-400">
      สุ่มเพลงหลอก 3 เพลง รวมเพลงจริงเป็น 4 ช้อยส์ กดตอบได้ทันใจ
    </span>
  </button>
  ```
- Add section `❌ จำนวนครั้งที่ตอบผิดได้ต่อข้อ (Max Wrong Guesses)`:
  ```tsx
  <div>
    <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-wider">
      ❌ จำนวนครั้งที่ตอบผิดได้ต่อข้อ (Allowed Wrong Guesses)
    </label>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        { value: 1, label: "1 ครั้ง (ค่าเริ่มต้น)" },
        { value: 2, label: "2 ครั้ง" },
        { value: 3, label: "3 ครั้ง" },
        { value: 0, label: "ไม่จำกัด" },
      ].map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setDraft((prev) => ({ ...prev, maxWrongGuesses: opt.value }))}
          className={`p-3 rounded-2xl border text-center text-xs font-bold transition cursor-pointer ${
            (draft.maxWrongGuesses ?? 1) === opt.value
              ? "bg-amber-500 text-stone-950 border-amber-500 shadow-sm"
              : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5 italic">
      *หมายเหตุ: ในโหมดกดกริ่ง (Buzzer) จะให้ตอบได้ 1 ครั้งต่อการกด เพื่อเปิดโอกาสให้ผู้อื่นแย่งกดตอบ
    </p>
  </div>
  ```

- [ ] **Step 4: Run tests and type check**

Run: `npx vitest run src/components/room/__tests__/host-settings-modal.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS and 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/hooks/use-room-realtime.ts src/components/room/host-settings-modal.tsx src/components/room/__tests__/host-settings-modal.test.ts
git commit -m "feat(ui): add skipRound in realtime hook and configure multiple choice & max wrong guesses in HostSettingsModal"
```

---

### Task 4: Player UI (GameView & AnswerModal) & Big Screen (TvView)

**Files:**
- Modify: `src/components/room/game-view.tsx:80-120, 480-640`
- Modify: `src/components/room/answer-modal.tsx:15-30, 80-160`
- Modify: `src/components/room/tv-view.tsx:85-110, 430-500`
- Modify: `src/components/room/round-reveal-card.tsx:40-55`
- Test: `src/components/room/__tests__/multiple-choice-ui.test.ts`

**Interfaces:**
- Consumes: `activeQuestion.choices`, `answerInputMode === "multiple-choice"`, `skipRound`.
- Produces: 4-choice button grid on player and TV, choice error marking, host skip button, reveal banner.

- [ ] **Step 1: Write UI logic unit test**

Create `src/components/room/__tests__/multiple-choice-ui.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatRoundWinnerAnnouncement } from "../round-reveal-card";

describe("Round Reveal Announcement", () => {
  it("formats winner announcement correctly when winner exists", () => {
    const text = formatRoundWinnerAnnouncement({
      playerId: "p1",
      displayName: "Alice",
      answerText: "รักแรก",
      scoreDelta: 100,
    });
    expect(text).toContain("Alice ตอบถูก!");
  });

  it("formats skipped announcement when winner is null", () => {
    const text = formatRoundWinnerAnnouncement(null);
    expect(text).toBe("⏱️ ไม่มีใครตอบถูกในข้อนี้!");
  });
});
```

- [ ] **Step 2: Update `src/components/room/game-view.tsx`**

In `src/components/room/game-view.tsx`:
- Import `Flag` from `"lucide-react"`.
- Pull `skipRound` from `useRoomRealtime` (passed via props or hook).
- Add state for tracking wrong choices clicked in current round:
  `const [clickedWrongChoices, setClickedWrongChoices] = useState<string[]>([]);`
  Reset `setClickedWrongChoices([])` when `status === "question_active"` and `currentRound` changes.
- If wrong guess event occurs and matches `myPlayer.id`, add the wrong guess answer to `clickedWrongChoices`.
- Add Host Skip Button in Hint Bar / Stage:
  ```tsx
  {isHost && status === "question_active" && (
    <button
      type="button"
      onClick={handleSkipQuestion}
      disabled={isSkipping}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-700 dark:text-rose-300 transition cursor-pointer touch-manipulation disabled:opacity-50"
      title="ยอมแพ้ / ข้ามข้อนี้และเปิดเฉลยทันที"
    >
      <Flag className="w-3.5 h-3.5 text-rose-500" />
      <span>ข้ามข้อนี้ (ยอมแพ้)</span>
    </button>
  )}
  ```
- If `gameMode !== "buzzer"`:
  - If `answerInputMode === "multiple-choice"`:
    Render the 4-choice button grid:
    ```tsx
    <div className="w-full max-w-lg lg:max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-200">
      {(activeQuestion?.choices || []).map((choice, idx) => {
        const choiceLetter = ["A", "B", "C", "D"][idx] || `${idx + 1}`;
        const isWrong = clickedWrongChoices.includes(choice.title);
        return (
          <button
            key={choice.id || idx}
            type="button"
            disabled={isExcludedFromBuzz || isSubmittingAnswer || isWrong || status !== "question_active"}
            onClick={() => handleChoiceSubmit(choice.title)}
            className={`min-h-[58px] sm:min-h-[66px] p-4 rounded-2xl border-2 text-left flex items-center gap-3.5 transition-all cursor-pointer touch-manipulation shadow-md ${
              isWrong
                ? "bg-rose-500/10 border-rose-500/40 text-rose-400 line-through opacity-60 cursor-not-allowed"
                : "bg-white/95 dark:bg-stone-900/95 border-stone-200 dark:border-stone-800 hover:border-amber-500 hover:bg-amber-500/10 active:scale-[0.98] text-stone-900 dark:text-white"
            } disabled:cursor-not-allowed disabled:active:scale-100`}
          >
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-inner ${
              isWrong
                ? "bg-rose-500 text-white"
                : "bg-amber-500 text-stone-950"
            }`}>
              {isWrong ? "✕" : choiceLetter}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm sm:text-base truncate">{choice.title}</div>
              <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{choice.artist}</div>
            </div>
          </button>
        );
      })}
    </div>
    ```

- [ ] **Step 3: Update `src/components/room/answer-modal.tsx`**

In `src/components/room/answer-modal.tsx`:
- Pass `choices?: ChoiceOption[]` into `AnswerModalProps`.
- If `inputMode === "multiple-choice"`:
  - Render the 4 choice cards inside the modal:
    ```tsx
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">
      {(choices || []).map((choice, idx) => {
        const letter = ["A", "B", "C", "D"][idx] || `${idx + 1}`;
        return (
          <button
            key={choice.id || idx}
            type="button"
            onClick={() => handleSubmit(choice.title)}
            disabled={isSubmitting}
            className="p-3.5 rounded-xl border-2 border-stone-200 dark:border-stone-800 hover:border-amber-500 bg-stone-50 dark:bg-stone-900 flex items-center gap-3 text-left transition cursor-pointer"
          >
            <span className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center shrink-0">
              {letter}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate text-stone-900 dark:text-white">{choice.title}</div>
              <div className="text-xs text-stone-500 truncate">{choice.artist}</div>
            </div>
          </button>
        );
      })}
    </div>
    ```

- [ ] **Step 4: Update `src/components/room/tv-view.tsx`**

In `src/components/room/tv-view.tsx`:
- If `answerInputMode === "multiple-choice"` and `activeQuestion?.choices`:
  - During `question_active` and `buzzed`:
    Render the 4-choice Question Board in a 2x2 grid on the TV screen.
  - During `revealing`:
    Highlight the correct choice in emerald green with a pulsing halo!
- If round was skipped (`roundWinner === null` and `status === "revealing"`):
  Show headline: `"🏳️ ข้ามข้อนี้ / ยอมแพ้ (ไม่มีใครได้คะแนน)"`.

- [ ] **Step 5: Run tests and type check**

Run: `npx vitest run src/components/room/__tests__/multiple-choice-ui.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS and 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/room/game-view.tsx src/components/room/answer-modal.tsx src/components/room/tv-view.tsx src/components/room/round-reveal-card.tsx src/components/room/__tests__/multiple-choice-ui.test.ts
git commit -m "feat(ui): implement 4-choice grid on GameView, AnswerModal, TvView, and Host skip button"
```

---

### Task 5: End-to-End Verification & Test Suite

**Files:**
- Test: All tests in `src/`

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All test suites pass.

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run production build check**

Run: `npm run build`
Expected: Production build compiles successfully.

- [ ] **Step 4: Final commit & push**

```bash
git push origin main
```
