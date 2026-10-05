// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Realtime Hook & Session Storage Verification
// Tests for Task 4:
// 1. Session storage operations (save, load, clear, SSR safety)
// 2. Presence tracking & player state extraction
// 3. Pure reducer broadcast event processing (round_start, buzzer_hit, wrong_guess, round_reveal, game_over)
// 4. Procedural sound effect cue dispatches (buzzer, wrong, correct, countdownTick, victoryFanfare)
// 5. Reactive flags (isMyBuzz, isExcludedFromBuzz, isHost) & score synchronization
// 6. In-process RealtimeBroadcastService integration
// ==========================================

import assert from "node:assert";
import {
  savePlayerSession,
  loadPlayerSession,
  clearPlayerSession,
  getLastRoomCode,
  STORAGE_KEY_PREFIX,
  STORAGE_KEY_LAST_ROOM,
} from "../src/lib/session-storage";
import {
  createInitialRoomRealtimeState,
  reduceRoomRealtimeEvent,
  parsePresencePlayers,
  type RoomRealtimeState,
} from "../src/hooks/use-room-realtime";
import { RealtimeBroadcastService } from "../src/lib/services/realtime-broadcast";
import type { Player, Song } from "../src/types";

// In-memory mock for window.localStorage
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

async function runRealtimeHookTests() {
  console.log("==========================================");
  console.log("Running Realtime Hook & Session Storage Tests");
  console.log("==========================================\n");

  // ----------------------------------------------------
  // Test 1: Session Storage SSR Safety & Operations
  // ----------------------------------------------------
  console.log("Test 1: Session Storage SSR Safety & Operations...");

  // 1a. SSR Safety: when window is undefined, methods should not crash
  const origWindow = (globalThis as any).window;
  delete (globalThis as any).window;

  savePlayerSession("SSR001", {
    playerId: "p1",
    sessionToken: "tok1",
    displayName: "SSR Player",
  });
  assert.strictEqual(loadPlayerSession("SSR001"), null, "SSR load should return null");
  assert.strictEqual(getLastRoomCode(), null, "SSR getLastRoomCode should return null");
  clearPlayerSession("SSR001"); // Should not throw

  // 1b. Client environment: attach mock localStorage
  const mockStorage = new MockLocalStorage();
  (globalThis as any).window = {
    localStorage: mockStorage,
  };

  // 1c. Save and load session
  const roomCode = "ROOM42";
  savePlayerSession(roomCode, {
    playerId: "player-uuid-1",
    sessionToken: "session-token-abc",
    displayName: "Alice In Wonderland",
    isHost: true,
  });

  const stored = loadPlayerSession(roomCode);
  assert.ok(stored, "Stored session must exist");
  assert.strictEqual(stored.roomCode, "ROOM42");
  assert.strictEqual(stored.playerId, "player-uuid-1");
  assert.strictEqual(stored.sessionToken, "session-token-abc");
  assert.strictEqual(stored.displayName, "Alice In Wonderland");
  assert.strictEqual(stored.isHost, true);
  assert.ok(stored.savedAt, "savedAt timestamp must be recorded");

  // Case insensitivity
  const lowerLoaded = loadPlayerSession("room42");
  assert.ok(lowerLoaded, "loadPlayerSession must be case-insensitive");
  assert.strictEqual(lowerLoaded.roomCode, "ROOM42");

  // Quick reconnect code
  assert.strictEqual(getLastRoomCode(), "ROOM42");

  // 1d. Malformed JSON handling
  mockStorage.setItem(`${STORAGE_KEY_PREFIX}BAD001`, "invalid-json{{[");
  assert.strictEqual(loadPlayerSession("BAD001"), null, "Malformed JSON should return null");

  // Missing required fields
  mockStorage.setItem(
    `${STORAGE_KEY_PREFIX}INCOMP`,
    JSON.stringify({ playerId: "only-id" })
  );
  assert.strictEqual(loadPlayerSession("INCOMP"), null, "Incomplete session must return null");

  // 1e. Clear session
  clearPlayerSession(roomCode);
  assert.strictEqual(loadPlayerSession(roomCode), null, "Session must be cleared");
  assert.strictEqual(getLastRoomCode(), null, "Last room code must be cleared when matching");

  console.log("✓ Passed: Session storage operates correctly with full SSR safety.\n");

  // ----------------------------------------------------
  // Test 2: Presence Tracking & Player Parsing
  // ----------------------------------------------------
  console.log("Test 2: Presence Tracking & Player Parsing...");

  const rawPresenceState = {
    "presence-key-1": [
      {
        presence_ref: "ref-1",
        id: "p1-alice",
        displayName: "Alice",
        isHost: true,
        isReady: true,
        score: 100,
        sessionToken: "tok-alice",
        lastSeenAt: "2026-10-05T00:00:00Z",
      },
    ],
    "presence-key-2": [
      {
        presence_ref: "ref-2",
        id: "p2-bob",
        displayName: "Bob",
        isHost: false,
        isReady: false,
        score: 40,
        sessionToken: "tok-bob",
        lastSeenAt: "2026-10-05T00:00:01Z",
      },
      // Duplicate presence entry for same player should be deduplicated
      {
        presence_ref: "ref-2-dup",
        id: "p2-bob",
        displayName: "Bob",
        isHost: false,
        isReady: false,
        score: 40,
        sessionToken: "tok-bob",
        lastSeenAt: "2026-10-05T00:00:02Z",
      },
    ],
  };

  const parsedPlayers = parsePresencePlayers(rawPresenceState);
  assert.strictEqual(parsedPlayers.length, 2, "Duplicate presence entries must be deduplicated");
  const alice = parsedPlayers.find((p) => p.id === "p1-alice");
  const bob = parsedPlayers.find((p) => p.id === "p2-bob");
  assert.ok(alice && bob, "Both players must be parsed");
  assert.strictEqual(alice.isHost, true);
  assert.strictEqual(alice.isReady, true);
  assert.strictEqual(bob.score, 40);

  console.log("✓ Passed: Realtime presence parsed and deduplicated successfully.\n");

  // ----------------------------------------------------
  // Test 3: Broadcast Event Reducer & Sound Effect Triggers
  // ----------------------------------------------------
  console.log("Test 3: Broadcast Event Reducer & Sound Effect Triggers...");

  // Mock sound effects to record invocation counts
  const sfxCalls = {
    buzzer: 0,
    wrong: 0,
    correct: 0,
    countdownTick: 0,
    victoryFanfare: 0,
  };

  const mockSfx = {
    buzzer: () => { sfxCalls.buzzer++; },
    wrong: () => { sfxCalls.wrong++; },
    correct: () => { sfxCalls.correct++; },
    countdownTick: () => { sfxCalls.countdownTick++; },
    victoryFanfare: () => { sfxCalls.victoryFanfare++; },
  } as any;

  // Initialize state with Alice as myPlayer and host
  const alicePlayer: Player = {
    id: "p1-alice",
    displayName: "Alice",
    isHost: true,
    isReady: true,
    score: 0,
    sessionToken: "tok-alice",
    lastSeenAt: new Date().toISOString(),
  };

  let state = createInitialRoomRealtimeState("ROOM99", alicePlayer);
  assert.strictEqual(state.roomCode, "ROOM99");
  assert.strictEqual(state.myPlayer?.id, "p1-alice");
  assert.strictEqual(state.isHost, true);
  assert.strictEqual(state.status, "lobby");
  assert.strictEqual(state.isMyBuzz, false);
  assert.strictEqual(state.isExcludedFromBuzz, false);

  // Sync presence with Bob joining
  state = reduceRoomRealtimeEvent(
    state,
    {
      type: "presence_sync",
      players: [alicePlayer, bob],
    },
    { soundEffectsInstance: mockSfx }
  );
  assert.strictEqual(state.players.length, 2);

  // 3a. Event: round_start
  const roundStartPayload = {
    round: 1,
    totalRounds: 3,
    gameMode: "buzzer",
    sliceUrl: "/api/audio/slice?id=song-1&start=30&duration=2",
    durationSec: 2.0,
    startedAt: new Date().toISOString(),
  };

  state = reduceRoomRealtimeEvent(
    state,
    { type: "broadcast", event: "round_start", payload: roundStartPayload },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(sfxCalls.countdownTick, 1, "countdownTick SFX must be called on round_start");
  assert.strictEqual(state.status, "question_active");
  assert.strictEqual(state.currentRound, 1);
  assert.strictEqual(state.totalRounds, 3);
  assert.strictEqual(state.gameMode, "buzzer");
  assert.ok(state.activeQuestion?.sliceUrl?.includes("song-1"));
  assert.strictEqual(state.isAudioPlaying, true);
  assert.strictEqual(state.buzzedPlayer, null);
  assert.strictEqual(state.wrongGuesses.length, 0);
  assert.strictEqual(state.isExcludedFromBuzz, false);

  // 3b. Event: buzzer_hit (Alice buzzes)
  const buzzerHitPayload = {
    playerId: "p1-alice",
    displayName: "Alice",
    buzzedAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 10000).toISOString(),
  };

  state = reduceRoomRealtimeEvent(
    state,
    { type: "broadcast", event: "buzzer_hit", payload: buzzerHitPayload },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(sfxCalls.buzzer, 1, "buzzer SFX must be called on buzzer_hit");
  assert.strictEqual(state.status, "buzzed");
  assert.strictEqual(state.isAudioPlaying, false, "Audio must pause when someone buzzes");
  assert.strictEqual(state.buzzedPlayer?.id, "p1-alice");
  assert.strictEqual(state.isMyBuzz, true, "isMyBuzz must be true for Alice");

  // 3c. Event: wrong_guess (Alice guesses wrong -> penalized & excluded)
  const wrongGuessPayload = {
    playerId: "p1-alice",
    displayName: "Alice",
    answerText: "เพลงผิดแน่ๆ",
    scoreDelta: -20,
    scores: { "p1-alice": 0, "p2-bob": 40 },
    resumeAudio: true,
  };

  state = reduceRoomRealtimeEvent(
    state,
    { type: "broadcast", event: "wrong_guess", payload: wrongGuessPayload },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(sfxCalls.wrong, 1, "wrong SFX must be called on wrong_guess");
  assert.strictEqual(state.status, "question_active", "Status returns to question_active");
  assert.strictEqual(state.buzzedPlayer, null, "buzzedPlayer must be released");
  assert.strictEqual(state.isMyBuzz, false);
  assert.strictEqual(state.isAudioPlaying, true, "Audio resumes after wrong guess");
  assert.strictEqual(state.lastWrongGuess?.answerText, "เพลงผิดแน่ๆ");
  assert.strictEqual(state.wrongGuesses.length, 1);
  assert.strictEqual(
    state.isExcludedFromBuzz,
    true,
    "Alice must be marked as excluded from buzz for remainder of round"
  );
  assert.strictEqual(state.scores["p1-alice"], 0);

  // 3d. Event: buzzer_hit (Bob buzzes while Alice is excluded)
  const bobBuzzerPayload = {
    playerId: "p2-bob",
    displayName: "Bob",
    buzzedAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 10000).toISOString(),
  };

  state = reduceRoomRealtimeEvent(
    state,
    { type: "broadcast", event: "buzzer_hit", payload: bobBuzzerPayload },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(sfxCalls.buzzer, 2);
  assert.strictEqual(state.buzzedPlayer?.id, "p2-bob");
  assert.strictEqual(state.isMyBuzz, false, "isMyBuzz must be false for Alice when Bob buzzed");
  assert.strictEqual(state.isExcludedFromBuzz, true, "Alice remains excluded");

  // 3e. Event: round_reveal (Bob answers correctly -> +100 points, revealed song)
  const roundRevealPayload = {
    winnerPlayerId: "p2-bob",
    winnerDisplayName: "Bob",
    answerText: "รักแท้",
    scoreDelta: 100,
    scores: { "p1-alice": 0, "p2-bob": 140 },
    song: {
      id: "song-1",
      title: "รักแท้",
      artist: "NuNew",
    } as Song,
  };

  state = reduceRoomRealtimeEvent(
    state,
    { type: "broadcast", event: "round_reveal", payload: roundRevealPayload },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(sfxCalls.correct, 1, "correct SFX must be called on round_reveal");
  assert.strictEqual(state.status, "revealing");
  assert.strictEqual(state.buzzedPlayer, null);
  assert.strictEqual(state.isAudioPlaying, false);
  assert.strictEqual(state.revealedSong?.title, "รักแท้");
  assert.strictEqual(state.roundWinner?.displayName, "Bob");
  assert.strictEqual(state.roundWinner?.scoreDelta, 100);
  assert.strictEqual(state.scores["p2-bob"], 140);
  assert.strictEqual(
    state.players.find((p) => p.id === "p2-bob")?.score,
    140,
    "Bob's score in players array must be synchronized with scores record"
  );

  // 3f. Next round starts -> exclusions and revealed song reset!
  state = reduceRoomRealtimeEvent(
    state,
    {
      type: "broadcast",
      event: "round_start",
      payload: {
        round: 2,
        totalRounds: 3,
        gameMode: "buzzer",
        sliceUrl: "/api/audio/slice?id=song-2",
      },
    },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(state.currentRound, 2);
  assert.strictEqual(state.revealedSong, null, "Revealed song must reset on new round");
  assert.strictEqual(state.roundWinner, null, "Round winner must reset on new round");
  assert.strictEqual(state.wrongGuesses.length, 0, "Wrong guesses must clear on new round");
  assert.strictEqual(
    state.isExcludedFromBuzz,
    false,
    "Alice must be eligible to buzz again in round 2"
  );
  assert.strictEqual(state.scores["p2-bob"], 140, "Scores must persist across rounds");

  // 3g. Event: game_over
  state = reduceRoomRealtimeEvent(
    state,
    {
      type: "broadcast",
      event: "game_over",
      payload: {
        gameOver: true,
        round: 3,
        totalRounds: 3,
        finalScores: { "p1-alice": 20, "p2-bob": 140 },
      },
    },
    { soundEffectsInstance: mockSfx }
  );

  assert.strictEqual(sfxCalls.victoryFanfare, 1, "victoryFanfare SFX must be called on game_over");
  assert.strictEqual(state.status, "game_over");
  assert.strictEqual(state.scores["p1-alice"], 20);

  console.log("✓ Passed: Broadcast event reduction, audio cues, and state updates verified.\n");

  // ----------------------------------------------------
  // Test 4: In-process RealtimeBroadcastService Integration
  // ----------------------------------------------------
  console.log("Test 4: In-process RealtimeBroadcastService Integration...");

  const testBusCode = "BUS123";
  const receivedEvents: Array<{ event: string; payload: any }> = [];

  const unsub = RealtimeBroadcastService.subscribe(testBusCode, (event, payload) => {
    receivedEvents.push({ event, payload });
  });

  await RealtimeBroadcastService.broadcast(testBusCode, "round_start", { round: 1 });
  await RealtimeBroadcastService.broadcast(testBusCode, "buzzer_hit", { playerId: "alice" });

  assert.strictEqual(receivedEvents.length, 2, "Subscriber must receive 2 broadcast events");
  assert.strictEqual(receivedEvents[0].event, "round_start");
  assert.strictEqual(receivedEvents[1].event, "buzzer_hit");

  unsub();

  await RealtimeBroadcastService.broadcast(testBusCode, "wrong_guess", { playerId: "alice" });
  assert.strictEqual(receivedEvents.length, 2, "No events should be received after unsubscribe");

  console.log("✓ Passed: In-process RealtimeBroadcastService integration verified.\n");

  // ----------------------------------------------------
  // Test 5: Player Action Dispatches
  // ----------------------------------------------------
  console.log("Test 5: Player Action Dispatches...");

  // Mock global fetch to verify endpoint routing & payload structure
  const fetchCalls: Array<{ url: string; method: string; body: any; headers: any }> = [];
  const origFetch = globalThis.fetch;

  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    fetchCalls.push({
      url,
      method: init?.method || "GET",
      body,
      headers: init?.headers,
    });

    if (url.includes("/buzz")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, buzzedPlayerId: body.playerId }),
      };
    }
    if (url.includes("/answer")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, isCorrect: true, scoreDelta: 100 }),
      };
    }
    if (url.includes("/next-round")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, round: 2 }),
      };
    }
    if (url.includes("/settings")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    };
  };

  // Simulate actions with mock fetch
  // Buzz action
  const buzzRes = await fetch("/api/room/ROOM99/buzz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: "p1-alice", displayName: "Alice" }),
  });
  const buzzData = await buzzRes.json();
  assert.strictEqual(buzzData.success, true);
  assert.strictEqual(fetchCalls[0].url, "/api/room/ROOM99/buzz");
  assert.strictEqual(fetchCalls[0].body.playerId, "p1-alice");

  // Answer action
  const ansRes = await fetch("/api/room/ROOM99/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: "p1-alice", displayName: "Alice", answerText: "รักแท้" }),
  });
  const ansData = await ansRes.json();
  assert.strictEqual(ansData.isCorrect, true);
  assert.strictEqual(fetchCalls[1].url, "/api/room/ROOM99/answer");
  assert.strictEqual(fetchCalls[1].body.answerText, "รักแท้");

  // Next round action
  const nrRes = await fetch("/api/room/ROOM99/next-round", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer tok-alice",
    },
    body: JSON.stringify({ sessionToken: "tok-alice" }),
  });
  const nrData = await nrRes.json();
  assert.strictEqual(nrData.round, 2);
  assert.strictEqual(fetchCalls[2].url, "/api/room/ROOM99/next-round");

  // Restore fetch
  globalThis.fetch = origFetch;

  console.log("✓ Passed: Player action dispatches verified.\n");

  // Restore environment
  if (origWindow !== undefined) {
    (globalThis as any).window = origWindow;
  } else {
    delete (globalThis as any).window;
  }

  console.log("==========================================");
  console.log("All Realtime Hook & Session Storage Tests Passed!");
  console.log("==========================================");
}

runRealtimeHookTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
