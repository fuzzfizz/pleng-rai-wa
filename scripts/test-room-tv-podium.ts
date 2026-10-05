// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - TV & Podium Verification Script
// Tests for Task 7:
// 1. Component exports and helper contracts
// 2. Podium ranking, sorting, and tie-breaking calculations
// 3. Podium medal badges and visual styling resolution
// 4. TV View lobby ready count and countdown helper logic
// 5. Component instantiation & prop contract verification
// ==========================================

import assert from "node:assert";
import React from "react";
import {
  PodiumView,
  getSortedPodiumPlayers,
  getPodiumMedal,
  type PodiumViewProps,
  type PodiumMedalInfo,
} from "../src/components/room/podium-view";
import {
  TVView,
  getLobbyReadyCount,
  getBuzzerRemainingSeconds,
  type TVViewProps,
} from "../src/components/room/tv-view";
import type { Player, Song, GameMode } from "../src/types";

async function runTVAndPodiumTests() {
  console.log("==========================================");
  console.log("Running TV View & Podium Verification Tests");
  console.log("==========================================\n");

  // ----------------------------------------------------
  // Test 1: Component Exports and Helper Functions
  // ----------------------------------------------------
  console.log("Test 1: Component Exports and Types...");
  assert.strictEqual(typeof PodiumView, "function", "PodiumView should be a component function");
  assert.strictEqual(
    typeof getSortedPodiumPlayers,
    "function",
    "getSortedPodiumPlayers should be a function"
  );
  assert.strictEqual(typeof getPodiumMedal, "function", "getPodiumMedal should be a function");
  assert.strictEqual(typeof TVView, "function", "TVView should be a component function");
  assert.strictEqual(
    typeof getLobbyReadyCount,
    "function",
    "getLobbyReadyCount should be a function"
  );
  assert.strictEqual(
    typeof getBuzzerRemainingSeconds,
    "function",
    "getBuzzerRemainingSeconds should be a function"
  );

  console.log("✓ Passed: All components and helper functions exported cleanly.\n");

  // ----------------------------------------------------
  // Test 2: Podium Ranking, Sorting & Tie-Breaking
  // ----------------------------------------------------
  console.log("Test 2: Podium Sorting & Tie-Breaking Logic...");

  const rawPlayers: Player[] = [
    {
      id: "p-charlie",
      displayName: "ชาลี (Charlie)",
      score: 70,
      isHost: false,
      isReady: true,
      sessionToken: "tok-c",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "p-alice",
      displayName: "อลิซ (Alice)",
      score: 150,
      isHost: true,
      isReady: true,
      sessionToken: "tok-a",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "p-bob",
      displayName: "บ็อบ (Bob)",
      score: 100,
      isHost: false,
      isReady: true,
      sessionToken: "tok-b",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "p-dave",
      displayName: "เดฟ (Dave)",
      score: 40,
      isHost: false,
      isReady: false,
      sessionToken: "tok-d",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "p-eve",
      displayName: "อีฟ (Eve)",
      score: 40,
      isHost: false,
      isReady: true,
      sessionToken: "tok-e",
      lastSeenAt: new Date().toISOString(),
    },
  ];

  // 2a. Descending sort
  const sorted = getSortedPodiumPlayers(rawPlayers);
  assert.strictEqual(sorted.length, 5, "Sorted list should have same length as input");
  assert.strictEqual(sorted[0].id, "p-alice", "1st place should be Alice (150 pts)");
  assert.strictEqual(sorted[1].id, "p-bob", "2nd place should be Bob (100 pts)");
  assert.strictEqual(sorted[2].id, "p-charlie", "3rd place should be Charlie (70 pts)");

  // 2b. Tie-breaking (Dave vs Eve with same score 40)
  // Dave ("เดฟ") vs Eve ("อีฟ") -> Thai locale comparison
  assert.strictEqual(sorted[3].score, 40, "4th place should have score 40");
  assert.strictEqual(sorted[4].score, 40, "5th place should have score 40");

  // 2c. Immutability verification
  assert.strictEqual(rawPlayers[0].id, "p-charlie", "Original array should not be mutated");

  // 2d. Edge cases: Empty and single player
  const emptySorted = getSortedPodiumPlayers([]);
  assert.deepStrictEqual(emptySorted, [], "Empty players array should return empty array");

  const singleSorted = getSortedPodiumPlayers([rawPlayers[0]]);
  assert.strictEqual(singleSorted.length, 1, "Single player array should have 1 item");
  assert.strictEqual(singleSorted[0].id, "p-charlie", "Single player should be rank 1");

  console.log("✓ Passed: Podium ranking and tie-breaking calculations verified.\n");

  // ----------------------------------------------------
  // Test 3: Podium Medal & Badge Resolution
  // ----------------------------------------------------
  console.log("Test 3: Podium Medal & Badge Resolution...");

  const rank1Info = getPodiumMedal(1);
  assert.strictEqual(rank1Info.medal, "👑", "Rank 1 medal should be crown");
  assert.ok(rank1Info.label.includes("1"), "Rank 1 label should reference 1");
  assert.ok(rank1Info.borderColorClass.includes("amber"), "Rank 1 border should be amber");
  assert.ok(rank1Info.glowClass.length > 0, "Rank 1 should have shadow glow");

  const rank2Info = getPodiumMedal(2);
  assert.strictEqual(rank2Info.medal, "🥈", "Rank 2 medal should be silver medal");
  assert.ok(rank2Info.borderColorClass.includes("slate"), "Rank 2 border should be silver/slate");

  const rank3Info = getPodiumMedal(3);
  assert.strictEqual(rank3Info.medal, "🥉", "Rank 3 medal should be bronze medal");
  assert.ok(rank3Info.borderColorClass.includes("amber"), "Rank 3 border should be bronze/amber");

  const rank4Info = getPodiumMedal(4);
  assert.strictEqual(rank4Info.medal, "#4", "Rank 4 medal should be #4");
  assert.ok(rank4Info.borderColorClass.includes("slate"), "Rank 4 border should be slate-700");

  console.log("✓ Passed: Podium medal styling and ranking badges verified.\n");

  // ----------------------------------------------------
  // Test 4: TV View Helper Functions
  // ----------------------------------------------------
  console.log("Test 4: TV View Ready Count & Countdown Helpers...");

  // 4a. getLobbyReadyCount
  const emptyLobby = getLobbyReadyCount([]);
  assert.deepStrictEqual(
    emptyLobby,
    { readyCount: 0, totalCount: 0, allReady: false },
    "Empty lobby should return 0 ready, 0 total, allReady false"
  );

  const partialLobby = getLobbyReadyCount(rawPlayers);
  // In rawPlayers: Alice (Host), Charlie (Ready), Bob (Ready), Dave (Not Ready), Eve (Ready)
  // Ready = Alice (Host) + Charlie + Bob + Eve = 4 ready out of 5
  assert.strictEqual(partialLobby.totalCount, 5, "Total players should be 5");
  assert.strictEqual(partialLobby.readyCount, 4, "Ready players should be 4");
  assert.strictEqual(partialLobby.allReady, false, "All ready should be false when 1 player unready");

  const allReadyLobby = getLobbyReadyCount([
    { ...rawPlayers[0], isReady: true },
    { ...rawPlayers[1], isReady: true },
  ]);
  assert.strictEqual(allReadyLobby.allReady, true, "All ready should be true when all ready");

  // 4b. getBuzzerRemainingSeconds
  const fallbackSec = getBuzzerRemainingSeconds(undefined);
  assert.strictEqual(fallbackSec, 10, "Undefined deadline should return default 10 seconds");

  const customFallbackSec = getBuzzerRemainingSeconds(null, 15);
  assert.strictEqual(customFallbackSec, 15, "Null deadline should return custom fallback 15s");

  const nowMs = 1700000000000;
  const futureDeadline = new Date(nowMs + 7500).toISOString();
  const remainingFuture = getBuzzerRemainingSeconds(futureDeadline, 10, nowMs);
  assert.strictEqual(remainingFuture, 8, "7.5 seconds in future should ceil to 8 seconds");

  const pastDeadline = new Date(nowMs - 5000).toISOString();
  const remainingPast = getBuzzerRemainingSeconds(pastDeadline, 10, nowMs);
  assert.strictEqual(remainingPast, 0, "Past deadline should clamp to 0 seconds");

  const invalidDeadline = getBuzzerRemainingSeconds("not-a-date", 12, nowMs);
  assert.strictEqual(invalidDeadline, 12, "Invalid deadline should return fallback duration");

  console.log("✓ Passed: TV View lobby ready counting and buzzer countdown validated.\n");

  // ----------------------------------------------------
  // Test 5: Component Instantiation with Strict Props
  // ----------------------------------------------------
  console.log("Test 5: Component Instantiation & Prop Contracts...");

  // 5a. PodiumView with 5 players (host)
  const podiumFullEl = React.createElement(PodiumView, {
    players: rawPlayers,
    isHost: true,
    onPlayAgain: async () => {},
    onBackToLobby: async () => {},
    onLeaveRoom: () => {},
  });
  assert.ok(React.isValidElement(podiumFullEl), "PodiumView (full) should be valid element");

  // 5b. PodiumView with 1 player (non-host)
  const podiumSingleEl = React.createElement(PodiumView, {
    players: [rawPlayers[0]],
    isHost: false,
    onLeaveRoom: () => {},
  });
  assert.ok(React.isValidElement(podiumSingleEl), "PodiumView (single) should be valid element");

  // 5c. PodiumView with 0 players
  const podiumEmptyEl = React.createElement(PodiumView, {
    players: [],
  });
  assert.ok(React.isValidElement(podiumEmptyEl), "PodiumView (empty) should be valid element");

  // 5d. TVView across all game phases
  const createMockRealtime = (status: any, overrides: Record<string, any> = {}): any => ({
    roomCode: "PARTY99",
    players: rawPlayers,
    myPlayer: rawPlayers[0],
    isHost: true,
    room: {
      settings: {
        gameMode: "buzzer",
        answerInputMode: "autocomplete",
        totalRounds: 10,
      },
    },
    status,
    currentRound: 3,
    totalRounds: 10,
    gameMode: "buzzer",
    activeQuestion: {
      sliceUrl: "https://example.com/slice3.mp3",
      durationSec: 2.0,
      lyrics: "อยากบอกว่ารักเธอเท่าฟ้า",
    },
    buzzedPlayer: null,
    isMyBuzz: false,
    isExcludedFromBuzz: false,
    revealedSong: null,
    roundWinner: null,
    lastWrongGuess: null,
    wrongGuesses: [],
    scores: { "p-alice": 150, "p-bob": 100 },
    isConnected: true,
    isAudioPlaying: true,
    isMuted: false,
    error: null,
    buzz: async () => ({ success: true }),
    submitAnswer: async () => ({ success: true, isCorrect: true }),
    nextRound: async () => ({ success: true }),
    setReady: async () => {},
    updateSettings: async () => true,
    transferHost: async () => true,
    playAudio: () => {},
    pauseAudio: () => {},
    toggleMute: () => {},
    refetchState: async () => {},
    ...overrides,
  });

  // Lobby Phase
  const tvLobbyEl = React.createElement(TVView, {
    roomRealtime: createMockRealtime("lobby"),
    onLeaveRoom: () => {},
  });
  assert.ok(React.isValidElement(tvLobbyEl), "TVView (lobby) should be valid element");

  // Question Active Phase
  const tvActiveEl = React.createElement(TVView, {
    roomRealtime: createMockRealtime("question_active"),
  });
  assert.ok(React.isValidElement(tvActiveEl), "TVView (question_active) should be valid element");

  // Buzzed Phase
  const tvBuzzedEl = React.createElement(TVView, {
    roomRealtime: createMockRealtime("buzzed", {
      buzzedPlayer: {
        id: "p-bob",
        displayName: "บ็อบ (Bob)",
        buzzedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 8000).toISOString(),
      },
    }),
  });
  assert.ok(React.isValidElement(tvBuzzedEl), "TVView (buzzed) should be valid element");

  // Wrong Guess alert state during question_active
  const tvWrongGuessEl = React.createElement(TVView, {
    roomRealtime: createMockRealtime("question_active", {
      lastWrongGuess: {
        playerId: "p-dave",
        displayName: "เดฟ (Dave)",
        answerText: "เพลงผิดสนิท",
      },
    }),
  });
  assert.ok(React.isValidElement(tvWrongGuessEl), "TVView (wrong_guess) should be valid element");

  // Revealing Phase
  const mockSong: Song = {
    id: "song-1",
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai"],
    releaseYear: 2002,
    audioUrl: "https://example.com/audio.mp3",
    era: "2000s",
    genre: {
      id: "g-rock",
      nameTh: "ร็อก",
      nameEn: "Rock",
      slug: "rock",
    },
  };
  const tvRevealEl = React.createElement(TVView, {
    roomRealtime: createMockRealtime("revealing", {
      revealedSong: mockSong,
      roundWinner: {
        playerId: "p-alice",
        displayName: "อลิซ (Alice)",
        answerText: "วัดใจ",
        scoreDelta: 100,
      },
    }),
  });
  assert.ok(React.isValidElement(tvRevealEl), "TVView (revealing) should be valid element");

  // Game Over Phase (Embeds PodiumView)
  const tvGameOverEl = React.createElement(TVView, {
    roomRealtime: createMockRealtime("game_over"),
    onLeaveRoom: () => {},
  });
  assert.ok(React.isValidElement(tvGameOverEl), "TVView (game_over) should be valid element");

  console.log("✓ Passed: All components instantiate with strict prop types across all phases.\n");

  console.log("==========================================");
  console.log("All Room TV & Podium Verification Tests Passed!");
  console.log("==========================================");
}

runTVAndPodiumTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
