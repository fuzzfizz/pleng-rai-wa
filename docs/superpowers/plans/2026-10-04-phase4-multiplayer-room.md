# Phase 4: ระบบห้องและ Realtime Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, responsive, real-time multiplayer room system for Pleng-Rai-Wa with 6-character room codes, QR sharing, host controls, server-authoritative buzzer arbitration with multi-chance wrong guess party rules, session persistence/reconnection, and a TV Party Display mode.

**Architecture:** Hybrid Next.js 15 Serverless App Router + Supabase Realtime (Presence for player tracking, Broadcast for low-latency game events, and Route Handlers for authoritative FCFS buzzer lock and secret answer verification).

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Lucide Icons, Supabase JS (`@supabase/supabase-js`), Canvas Confetti, Web Audio API SFX.

## Global Constraints
- 100% Free Public Feasibility (no external paid services, runs on Vercel hobby tier + Supabase free tier).
- Zero secret song metadata leaked to client network traffic before round reveal.
- Safe 6-character room code generator excluding ambiguous characters (`0`, `O`, `1`, `I`, `L`).
- Mobile-first responsive touch targets (huge buzzer button accessible via thumb).
- Strict adherence to TypeScript types in `src/types/index.ts`.

---

### Task 1: Room Code Utility & Room Service

**Files:**
- Create: `src/lib/room-code.ts`
- Create: `src/lib/services/room-service.ts`
- Create: `src/lib/__tests__/room-code.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`, types from `src/types/index.ts`
- Produces:
  - `generateRoomCode(): string`
  - `isValidRoomCode(code: string): boolean`
  - `RoomService.createRoom(hostDisplayName: string, settings?: Partial<RoomSettings>)`
  - `RoomService.getRoomByCode(code: string)`
  - `RoomService.updateRoomStatus(code: string, status: RoomState['status'])`
  - `RoomService.updateRoomSettings(code: string, settings: Partial<RoomSettings>)`

- [ ] **Step 1: Write test for room code generator**

```typescript
// src/lib/__tests__/room-code.test.ts
import { generateRoomCode, isValidRoomCode } from "../room-code";

describe("Room Code Utilities", () => {
  it("should generate a 6-character uppercase alphanumeric code", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true);
  });

  it("should exclude ambiguous characters 0, O, 1, I, L", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[01IOL]/);
    }
  });

  it("should validate valid and invalid room codes", () => {
    expect(isValidRoomCode("ABC234")).toBe(true);
    expect(isValidRoomCode("abc234")).toBe(true); // case-insensitive check
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode("TOOLONG123")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/room-code.test.ts` or execute node runner.

- [ ] **Step 3: Implement room-code.ts and room-service.ts**

```typescript
// src/lib/room-code.ts
const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let result = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * SAFE_CHARS.length);
    result += SAFE_CHARS[randomIndex];
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const clean = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(clean);
}
```

```typescript
// src/lib/services/room-service.ts
import { supabase, getServiceSupabase } from "@/lib/supabase";
import { generateRoomCode } from "@/lib/room-code";
import type { RoomSettings, RoomState, Player } from "@/types";

export interface CreateRoomResult {
  roomCode: string;
  sessionToken: string;
  playerId: string;
  room: any;
}

export class RoomService {
  private static getClient() {
    try {
      return getServiceSupabase();
    } catch {
      return supabase;
    }
  }

  static async createRoom(
    hostDisplayName: string,
    initialSettings?: Partial<RoomSettings>
  ): Promise<CreateRoomResult> {
    const client = this.getClient();
    const playerId = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();
    const roomCode = generateRoomCode();

    const defaultSettings: RoomSettings = {
      gameMode: "buzzer",
      answerInputMode: "autocomplete",
      sliceDurationSec: 2.0,
      roundTimeoutSec: 15,
      totalRounds: 10,
      targetScore: 0,
      ...initialSettings,
    };

    const { data, error } = await client
      .from("rooms")
      .insert({
        room_code: roomCode,
        host_player_id: playerId,
        status: "lobby",
        settings: defaultSettings,
        played_song_ids: [],
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create room: ${error.message}`);
    }

    return {
      roomCode,
      sessionToken,
      playerId,
      room: data,
    };
  }

  static async getRoomByCode(code: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from("rooms")
      .select("*, songs(*)")
      .eq("room_code", code.toUpperCase())
      .single();

    if (error) return null;
    return data;
  }

  static async updateRoomSettings(code: string, settings: Partial<RoomSettings>) {
    const client = this.getClient();
    const current = await this.getRoomByCode(code);
    if (!current) throw new Error("Room not found");

    const updatedSettings = { ...current.settings, ...settings };
    const { data, error } = await client
      .from("rooms")
      .update({ settings: updatedSettings })
      .eq("room_code", code.toUpperCase())
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateRoomStatus(code: string, status: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from("rooms")
      .update({ status })
      .eq("room_code", code.toUpperCase())
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async transferHost(code: string, newHostPlayerId: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from("rooms")
      .update({ host_player_id: newHostPlayerId })
      .eq("room_code", code.toUpperCase())
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
```

- [ ] **Step 4: Verify test passes**
- [ ] **Step 5: Commit**
```bash
git add src/lib/room-code.ts src/lib/services/room-service.ts
git commit -m "feat: add room code generator and RoomService"
```

---

### Task 2: Room Management API Endpoints

**Files:**
- Create: `src/app/api/room/create/route.ts`
- Create: `src/app/api/room/join/route.ts`
- Create: `src/app/api/room/[code]/state/route.ts`
- Create: `src/app/api/room/[code]/settings/route.ts`

**Interfaces:**
- Consumes: `RoomService` from `src/lib/services/room-service.ts`
- Produces: JSON responses with room codes, session tokens, and current room state.

- [ ] **Step 1: Implement `POST /api/room/create`**
  - Accepts `{ hostDisplayName, settings }`.
  - Calls `RoomService.createRoom()`.
  - Returns `{ success: true, roomCode, sessionToken, playerId }`.

- [ ] **Step 2: Implement `POST /api/room/join`**
  - Accepts `{ roomCode, displayName, existingSessionToken }`.
  - Checks if room exists and is active.
  - Returns `{ success: true, roomCode, sessionToken, playerId, isHost }`.

- [ ] **Step 3: Implement `GET /api/room/[code]/state`**
  - Fetches room data from DB.
  - Hides `current_song_id` and secrets if round is still active and not revealed.
  - Returns current sanitized state.

- [ ] **Step 4: Implement `POST /api/room/[code]/settings`**
  - Validates host session token.
  - Updates room settings or transfers host.

- [ ] **Step 5: Test API endpoints via curl/powershell and Commit**
```bash
git add src/app/api/room/
git commit -m "feat: implement room management API endpoints"
```

---

### Task 3: Realtime Gameplay & Buzzer Arbitration API Endpoints

**Files:**
- Create: `src/lib/room-state-store.ts` (Active in-memory round manager for FCFS lock & wrong guesses)
- Create: `src/app/api/room/[code]/next-round/route.ts`
- Create: `src/app/api/room/[code]/buzz/route.ts`
- Create: `src/app/api/room/[code]/answer/route.ts`

**Interfaces:**
- Consumes: `isFuzzyMatch` from `src/lib/answer-checker.ts`, `SongService` from `src/lib/services/song-service.ts`, Supabase Broadcast
- Produces: Atomic buzzer lock resolution, multi-chance wrong answer broadcast, and round reveal.

- [ ] **Step 1: Implement `src/lib/room-state-store.ts`**
  - Maintains active round state per `roomCode`:
    - `currentSong`: full song metadata (kept on server)
    - `sanitizedSong`: only audioSliceUrl, duration, lyrics
    - `buzzedPlayerId`: current buzzer lock holder
    - `buzzedAt`: timestamp of lock
    - `excludedPlayerIds`: list of players who guessed wrong in this round
    - `wrongGuesses`: history of wrong answers in current round

- [ ] **Step 2: Implement `POST /api/room/[code]/next-round`**
  - Picks a random unplayed song from DB (matching genre if selected).
  - Prepares slice URL (e.g. `/api/audio/slice?id=...&start=...&duration=...`) or lyrics.
  - Resets buzzer lock and excluded players.
  - Broadcasts `round_start` to Supabase channel `room:{code}`.

- [ ] **Step 3: Implement `POST /api/room/[code]/buzz`**
  - Checks if round is active and not currently buzzed.
  - Checks if `playerId` is in `excludedPlayerIds`. If excluded, returns `{ success: false, reason: "already_guessed_wrong" }`.
  - Atomically sets `buzzedPlayerId = playerId`.
  - Broadcasts `buzzer_hit` to Supabase channel `{ playerId, displayName }`.

- [ ] **Step 4: Implement `POST /api/room/[code]/answer`**
  - Validates that caller is `buzzedPlayerId`.
  - Uses `isFuzzyMatch(answerText, song.title, song.aliases)`.
  - **If correct**:
    - Awards +100 points.
    - Sets round status to `revealing`.
    - Broadcasts `round_reveal` with full song details, winner, and scores.
  - **If wrong**:
    - Deducts -20 points penalty.
    - Adds `playerId` to `excludedPlayerIds`.
    - Unlocks buzzer (`buzzedPlayerId = null`).
    - Appends to `wrongGuesses`.
    - Broadcasts `wrong_guess` event with `{ playerId, displayName, answerText, resumeAudio: true }`.

- [ ] **Step 5: Verify buzzer logic with test script and Commit**
```bash
git add src/lib/room-state-store.ts src/app/api/room/[code]/
git commit -m "feat: implement buzzer arbitration and multi-chance answer verification API"
```

---

### Task 4: Client-side Realtime Hook (`useRoomRealtime`)

**Files:**
- Create: `src/hooks/use-room-realtime.ts`
- Create: `src/lib/session-storage.ts`

**Interfaces:**
- Consumes: Supabase Realtime Channel (`presence` and `broadcast`), Web Audio SFX (`soundEffects`)
- Produces:
  - React hook `useRoomRealtime(roomCode: string, initialPlayer?: Player)`
  - State: `players`, `activeRound`, `myPlayer`, `isHost`, `gameStatus`, `lastWrongGuess`, `buzzState`
  - Actions: `buzz()`, `submitAnswer(text)`, `nextRound()`, `updateSettings()`, `setReady()`

- [ ] **Step 1: Create session storage helper `src/lib/session-storage.ts`**
  - `savePlayerSession(roomCode, playerId, sessionToken, displayName)`
  - `loadPlayerSession(roomCode)`
  - `clearPlayerSession(roomCode)`

- [ ] **Step 2: Implement `useRoomRealtime` hook**
  - Subscribes to Supabase channel `room:${roomCode}`.
  - Handles `presence.track({ id, displayName, isReady, score, isHost })`.
  - Listens to broadcast events:
    - `round_start`: play countdown sound, load audio, reset local round state.
    - `buzzer_hit`: play buzzer SFX, pause audio, display buzzed player banner.
    - `wrong_guess`: play buzzer wrong SFX, display wrong answer banner, resume audio playback.
    - `round_reveal`: play chime SFX, show song metadata, trigger confetti.
    - `game_over`: play fanfare SFX, transition to podium screen.
  - Auto-reconnects on mount using stored session token.

- [ ] **Step 3: Commit**
```bash
git add src/lib/session-storage.ts src/hooks/use-room-realtime.ts
git commit -m "feat: implement useRoomRealtime hook with Presence and Broadcast synchronization"
```

---

### Task 5: Room UI Components: Lobby View, QR Code & Host Settings

**Files:**
- Create: `src/components/room/lobby-view.tsx`
- Create: `src/components/room/player-card.tsx`
- Create: `src/components/room/host-settings-modal.tsx`
- Create: `src/components/room/qr-code-modal.tsx`

**Interfaces:**
- Consumes: `useRoomRealtime`, `QRCode` from `qrcode`
- Produces: Rendered Lobby UI with full responsive layout.

- [ ] **Step 1: Implement `QRCodeModal`**
  - Renders canvas QR code with room join link (`/room/${roomCode}`).
  - Copy link button with toast feedback ("คัดลอกลิงก์แล้ว!").

- [ ] **Step 2: Implement `PlayerCard`**
  - Shows Avatar emoji, display name, Crown icon if Host, green badge if Ready, and current score.

- [ ] **Step 3: Implement `HostSettingsModal`**
  - Allows selecting Game Mode (Audio Slice, Buzzer Battle, AI Lyrics).
  - Allows picking Genre, Round time (10s, 15s, 30s), Total rounds (5, 10, 15).
  - Transfer host dropdown.

- [ ] **Step 4: Implement `LobbyView`**
  - Big 6-character room code with copy button and QR code button.
  - Grid of connected players via Presence.
  - Ready toggle button for players.
  - "เริ่มเกม (Start Game)" button for Host.

- [ ] **Step 5: Commit**
```bash
git add src/components/room/
git commit -m "feat: implement Lobby UI, PlayerCard, QRCodeModal, and HostSettingsModal"
```

---

### Task 6: In-Game UI Components: Buzzer, Answer Input & Wrong Guess Banner

**Files:**
- Create: `src/components/room/game-view.tsx`
- Create: `src/components/room/buzzer-button.tsx`
- Create: `src/components/room/answer-modal.tsx`
- Create: `src/components/room/wrong-guess-banner.tsx`
- Create: `src/components/room/round-reveal-card.tsx`

**Interfaces:**
- Consumes: `useRoomRealtime`, `soundEffects`, `TTSReader`
- Produces: Interactive in-game screens for all 3 game modes.

- [ ] **Step 1: Implement `BuzzerButton`**
  - Giant circular glowing button, responsive for thumb taps on mobile.
  - Spacebar keyboard listener on desktop.
  - Dynamic states: Ready to buzz (neon pink), Buzzed by me (neon yellow), Locked by someone else (disabled slate), Excluded because guessed wrong (red crossed).

- [ ] **Step 2: Implement `AnswerModal`**
  - Displays 10-second countdown bar.
  - Dual input: Quick search autocomplete from song library + free-text input.
  - Auto-focuses on open.

- [ ] **Step 3: Implement `WrongGuessBanner`**
  - Displays prominent alert: `"❌ [Player] ตอบว่า '[Answer]' (ยังไม่ใช่!)"`.
  - Displays cue: `"เพลงเล่นต่อ แย่งกันกดกริ่งเลย!"`.

- [ ] **Step 4: Implement `RoundRevealCard`**
  - Shows Album art, Song title, Artist, Release year.
  - Play full hook audio button.
  - Shows who scored points.

- [ ] **Step 5: Implement `GameView` orchestrator**
  - Combines audio player/slicer, buzzer, answer modal, wrong guess banner, and round reveal card.

- [ ] **Step 6: Commit**
```bash
git add src/components/room/
git commit -m "feat: implement GameView, BuzzerButton, AnswerModal, and WrongGuessBanner"
```

---

### Task 7: TV Party Display Mode & Podium Screen

**Files:**
- Create: `src/components/room/tv-view.tsx`
- Create: `src/components/room/podium-view.tsx`

**Interfaces:**
- Consumes: `useRoomRealtime`
- Produces: 1080p-optimized big-screen view for TVs and projectors, and winner celebration screen.

- [ ] **Step 1: Implement `TVView`**
  - Scales up typography for 3-5 meter readability.
  - Large audio visualizer wave animation.
  - Prominent scoreboard column with live rank indicators.
  - Full-screen banners for buzzer hits and wrong guesses.
  - QR Code in corner so spectators can join mid-game.

- [ ] **Step 2: Implement `PodiumView`**
  - Animated 1st, 2nd, 3rd place podium.
  - Confetti explosion (`canvas-confetti`).
  - Fun party awards (Fastest Buzzer, Most Guesses).
  - Buttons: "เล่นอีกรอบ (Play Again)" or "กลับสู่ Lobby".

- [ ] **Step 3: Commit**
```bash
git add src/components/room/tv-view.tsx src/components/room/podium-view.tsx
git commit -m "feat: implement TV Party Display Mode and animated Podium Screen"
```

---

### Task 8: Room Route Integration & Home Page Linking

**Files:**
- Create: `src/app/room/[code]/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: All room components, `useRoomRealtime`
- Produces: Seamless `/room/[code]` page with join/create flows.

- [ ] **Step 1: Implement `src/app/room/[code]/page.tsx`**
  - Extracts `code` and `?view=tv` from URL.
  - Checks if user has a name; if not, prompts with quick nickname dialog before entering room.
  - Dynamically renders `TVView`, `LobbyView`, `GameView`, or `PodiumView` based on room state.

- [ ] **Step 2: Update `src/app/page.tsx`**
  - Connect "สร้างห้องเล่นกับเพื่อน" button to call `/api/room/create` and redirect to `/room/[code]`.
  - Connect room code input to redirect to `/room/[code]`.

- [ ] **Step 3: Commit**
```bash
git add src/app/room/[code]/page.tsx src/app/page.tsx
git commit -m "feat: connect room page and home page create/join room flows"
```

---

### Task 9: Verification & Documentation Update

**Files:**
- Modify: `PLAN.md`
- Modify: `README.md`

- [ ] **Step 1: Run Next.js build to verify zero compile or type errors**
  - Run: `npm run build`
  - Expected: Build succeeds without errors.

- [ ] **Step 2: Verify multi-client testing**
  - Open 2 browser tabs, create room in tab 1, join in tab 2.
  - Verify Presence sync (both players appear).
  - Test buzz in tab 1 -> verify tab 2 audio pauses and button locks.
  - Test wrong answer in tab 1 -> verify wrong guess banner displays on tab 2 and tab 2 can buzz.

- [ ] **Step 3: Update `PLAN.md` with Phase 4 completed items**

- [ ] **Step 4: Commit**
```bash
git add PLAN.md README.md
git commit -m "docs: complete Phase 4 implementation and update documentation"
```
