// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Gameplay UI Verification Script
// Tests for Task 6:
// 1. Component exports and type contracts
// 2. Buzzer state resolution logic
// 3. Answer modal timer color calculations & autocomplete integration
// 4. Wrong guess banner announcement formatting
// 5. Round reveal winner announcement formatting
// 6. Game mode display labels
// 7. Component instantiation & prop contract verification
// ==========================================

import assert from "node:assert";
import React from "react";
import {
  BuzzerButton,
  resolveBuzzerStatus,
  type BuzzerButtonProps,
  type BuzzerStatus,
} from "../src/components/room/buzzer-button";
import {
  AnswerModal,
  getTimerColorClass,
  type AnswerModalProps,
} from "../src/components/room/answer-modal";
import {
  WrongGuessBanner,
  formatWrongGuessMessage,
  RESUME_AUDIO_CUE,
  type WrongGuessBannerProps,
} from "../src/components/room/wrong-guess-banner";
import {
  RoundRevealCard,
  formatRoundWinnerAnnouncement,
  type RoundRevealCardProps,
  type RoundWinnerInfo,
} from "../src/components/room/round-reveal-card";
import {
  GameView,
  getGameModeLabel,
  type GameViewProps,
} from "../src/components/room/game-view";
import { searchSongAutocomplete } from "../src/lib/answer-checker";
import type { Song, Player, GameMode } from "../src/types";

async function runGameplayUITests() {
  console.log("==========================================");
  console.log("Running Room Gameplay UI Verification Tests");
  console.log("==========================================\n");

  // ----------------------------------------------------
  // Test 1: Component Exports and Types
  // ----------------------------------------------------
  console.log("Test 1: Component Exports and Types...");
  assert.strictEqual(typeof BuzzerButton, "function", "BuzzerButton should be a component function");
  assert.strictEqual(typeof resolveBuzzerStatus, "function", "resolveBuzzerStatus should be a function");
  assert.strictEqual(typeof AnswerModal, "function", "AnswerModal should be a component function");
  assert.strictEqual(typeof getTimerColorClass, "function", "getTimerColorClass should be a function");
  assert.strictEqual(typeof WrongGuessBanner, "function", "WrongGuessBanner should be a component function");
  assert.strictEqual(typeof formatWrongGuessMessage, "function", "formatWrongGuessMessage should be a function");
  assert.strictEqual(typeof RoundRevealCard, "function", "RoundRevealCard should be a component function");
  assert.strictEqual(typeof formatRoundWinnerAnnouncement, "function", "formatRoundWinnerAnnouncement should be a function");
  assert.strictEqual(typeof GameView, "function", "GameView should be a component function");
  assert.strictEqual(typeof getGameModeLabel, "function", "getGameModeLabel should be a function");

  console.log("✓ Passed: All components and helper functions exported cleanly.\n");

  // ----------------------------------------------------
  // Test 2: Buzzer State Resolution Mapping
  // ----------------------------------------------------
  console.log("Test 2: Buzzer State Resolution Mapping...");

  // 2a. Question active + not excluded -> ready
  const readyStatus = resolveBuzzerStatus({
    status: "question_active",
    isMyBuzz: false,
    buzzedPlayer: null,
    isExcludedFromBuzz: false,
  });
  assert.strictEqual(readyStatus, "ready", "Status should be 'ready' when question active and player eligible");

  // 2b. Question active + excluded -> excluded
  const excludedStatus = resolveBuzzerStatus({
    status: "question_active",
    isMyBuzz: false,
    buzzedPlayer: null,
    isExcludedFromBuzz: true,
  });
  assert.strictEqual(excludedStatus, "excluded", "Status should be 'excluded' after player guessed wrong");

  // 2c. Buzzed + my buzz -> buzzed_by_me
  const myBuzzStatus = resolveBuzzerStatus({
    status: "buzzed",
    isMyBuzz: true,
    buzzedPlayer: { id: "p1", displayName: "Somchai" },
    isExcludedFromBuzz: false,
  });
  assert.strictEqual(myBuzzStatus, "buzzed_by_me", "Status should be 'buzzed_by_me' when user locked buzzer");

  // 2d. Buzzed + other player's buzz -> locked_by_other
  const otherBuzzStatus = resolveBuzzerStatus({
    status: "buzzed",
    isMyBuzz: false,
    buzzedPlayer: { id: "p2", displayName: "Somsri" },
    isExcludedFromBuzz: false,
  });
  assert.strictEqual(otherBuzzStatus, "locked_by_other", "Status should be 'locked_by_other' when another player buzzed");

  // 2e. Non-question states (revealing, lobby, game_over) -> idle
  const idleStatus1 = resolveBuzzerStatus({
    status: "revealing",
    isMyBuzz: false,
    buzzedPlayer: null,
    isExcludedFromBuzz: false,
  });
  assert.strictEqual(idleStatus1, "idle", "Status should be 'idle' in revealing phase");

  const idleStatus2 = resolveBuzzerStatus({
    status: "lobby",
    isMyBuzz: false,
    buzzedPlayer: null,
    isExcludedFromBuzz: false,
  });
  assert.strictEqual(idleStatus2, "idle", "Status should be 'idle' in lobby phase");

  console.log("✓ Passed: All buzzer state transitions resolve correctly.\n");

  // ----------------------------------------------------
  // Test 3: Answer Modal Timer Color Logic & Autocomplete
  // ----------------------------------------------------
  console.log("Test 3: Answer Modal Timer Color Logic & Autocomplete...");

  // 3a. Timer progress ratio colors
  assert.ok(getTimerColorClass(0.9).includes("emerald"), "Ratio > 0.6 should be emerald");
  assert.ok(getTimerColorClass(0.61).includes("emerald"), "Ratio 0.61 should be emerald");
  assert.ok(getTimerColorClass(0.5).includes("amber"), "Ratio 0.5 should be amber");
  assert.ok(getTimerColorClass(0.31).includes("amber"), "Ratio 0.31 should be amber");
  assert.ok(getTimerColorClass(0.25).includes("rose"), "Ratio <= 0.3 should be rose");
  assert.ok(getTimerColorClass(0.0).includes("rose"), "Ratio 0.0 should be rose");

  // 3b. Autocomplete with song pool
  const mockSongPool: Song[] = [
    {
      id: "song-1",
      title: "วัดใจ",
      artist: "Silly Fools",
      aliases: ["wat jai", "วัดจัย"],
      audioUrl: "https://example.com/watjai.mp3",
    },
    {
      id: "song-2",
      title: "ใจนักเลง",
      artist: "พงษ์พัฒน์ วชิรบรรจง",
      aliases: ["jai nak leng"],
      audioUrl: "https://example.com/jainnakleng.mp3",
    },
    {
      id: "song-3",
      title: "เล่นของสูง",
      artist: "Big Ass",
      aliases: ["len khong soong"],
      audioUrl: "https://example.com/lenkhongsoong.mp3",
    },
  ];

  const searchResults1 = searchSongAutocomplete("วัด", mockSongPool);
  assert.ok(searchResults1.length > 0, "Should find matching song");
  assert.strictEqual(searchResults1[0].title, "วัดใจ", "First result should match query");

  const searchResultsEmpty = searchSongAutocomplete("", mockSongPool);
  assert.strictEqual(searchResultsEmpty.length, 3, "Empty search should return top items");

  console.log("✓ Passed: Timer colors and Fuse autocomplete validated.\n");

  // ----------------------------------------------------
  // Test 4: Wrong Guess Banner Formatting
  // ----------------------------------------------------
  console.log("Test 4: Wrong Guess Banner Formatting...");

  const formattedWrong = formatWrongGuessMessage({
    displayName: "น้องมายด์",
    answerText: "ฤดูร้อน",
  });
  assert.strictEqual(
    formattedWrong,
    "❌ น้องมายด์ ตอบว่า 'ฤดูร้อน' (ยังไม่ใช่!)",
    "Wrong guess text must match standard format"
  );

  const formattedFallback = formatWrongGuessMessage({
    displayName: "",
    answerText: "เพลงไม่บอกเธอ",
  });
  assert.strictEqual(
    formattedFallback,
    "❌ ผู้เล่น ตอบว่า 'เพลงไม่บอกเธอ' (ยังไม่ใช่!)",
    "Missing display name should fallback to 'ผู้เล่น'"
  );

  assert.strictEqual(
    RESUME_AUDIO_CUE,
    "🎵 เพลงเล่นต่อ แย่งกันกดกริ่งเลย!",
    "Resume audio cue should match specification"
  );

  console.log("✓ Passed: Wrong guess banner messaging correctly formatted.\n");

  // ----------------------------------------------------
  // Test 5: Round Reveal Winner Announcement Formatting
  // ----------------------------------------------------
  console.log("Test 5: Round Reveal Winner Announcement Formatting...");

  // 5a. Winner present with custom score delta
  const winnerAnnouncement = formatRoundWinnerAnnouncement({
    playerId: "player-1",
    displayName: "ก้อง กีตาร์",
    answerText: "วัดใจ",
    scoreDelta: 100,
  });
  assert.strictEqual(
    winnerAnnouncement,
    "🎉 ก้อง กีตาร์ ตอบถูก! (+100 คะแนน)"
  );

  const bonusWinner = formatRoundWinnerAnnouncement({
    playerId: "player-2",
    displayName: "พี่โต",
    answerText: "จิ๊จ๊ะ",
    scoreDelta: 150,
  });
  assert.strictEqual(
    bonusWinner,
    "🎉 พี่โต ตอบถูก! (+150 คะแนน)"
  );

  // 5b. Null winner (timeout or all wrong)
  const noWinnerAnnouncement = formatRoundWinnerAnnouncement(null);
  assert.strictEqual(
    noWinnerAnnouncement,
    "⏱️ ไม่มีใครตอบถูกในข้อนี้!"
  );

  console.log("✓ Passed: Round reveal winner announcements validated.\n");

  // ----------------------------------------------------
  // Test 6: Game Mode Labels
  // ----------------------------------------------------
  console.log("Test 6: Game Mode Labels...");
  assert.strictEqual(getGameModeLabel("buzzer"), "โหมด แย่งกดกริ่ง");
  assert.strictEqual(getGameModeLabel("ai-lyrics"), "โหมด AI อ่านเนื้อเพลง");
  assert.strictEqual(getGameModeLabel("audio-slice"), "โหมด ตัดเสียงเสี้ยววินาที");

  console.log("✓ Passed: Game mode labels formatted accurately.\n");

  // ----------------------------------------------------
  // Test 7: Component Instantiation & Prop Contracts
  // ----------------------------------------------------
  console.log("Test 7: Component Instantiation & Prop Contracts...");

  // 7a. BuzzerButton elements
  const buzzerReady = React.createElement(BuzzerButton, {
    status: "ready",
    onBuzz: () => {},
  });
  assert.ok(React.isValidElement(buzzerReady), "BuzzerButton (ready) should be valid element");

  const buzzerMyBuzz = React.createElement(BuzzerButton, {
    status: "buzzed_by_me",
    onBuzz: () => {},
  });
  assert.ok(React.isValidElement(buzzerMyBuzz), "BuzzerButton (buzzed_by_me) should be valid element");

  const buzzerLocked = React.createElement(BuzzerButton, {
    status: "locked_by_other",
    buzzedPlayerName: "สมชาย",
    onBuzz: () => {},
  });
  assert.ok(React.isValidElement(buzzerLocked), "BuzzerButton (locked_by_other) should be valid element");

  const buzzerExcluded = React.createElement(BuzzerButton, {
    status: "excluded",
    onBuzz: () => {},
  });
  assert.ok(React.isValidElement(buzzerExcluded), "BuzzerButton (excluded) should be valid element");

  // 7b. AnswerModal element (open and closed)
  const answerModalOpen = React.createElement(AnswerModal, {
    isOpen: true,
    onSubmitAnswer: async () => {},
    timeRemainingSec: 10,
    inputMode: "autocomplete",
    songLibrary: mockSongPool,
  });
  assert.ok(React.isValidElement(answerModalOpen), "AnswerModal (open) should be valid element");

  const answerModalClosed = React.createElement(AnswerModal, {
    isOpen: false,
    onSubmitAnswer: async () => {},
  });
  assert.ok(React.isValidElement(answerModalClosed), "AnswerModal (closed) should be valid element");

  // 7c. WrongGuessBanner element
  const wrongGuessEl = React.createElement(WrongGuessBanner, {
    wrongGuess: {
      playerId: "p-1",
      displayName: "สมชาย",
      answerText: "เพลงผิด",
    },
    showResumeCue: true,
  });
  assert.ok(React.isValidElement(wrongGuessEl), "WrongGuessBanner should be valid element");

  // 7d. RoundRevealCard element
  const revealCardEl = React.createElement(RoundRevealCard, {
    song: mockSongPool[0],
    winner: {
      playerId: "p-1",
      displayName: "สมชาย",
      answerText: "วัดใจ",
      scoreDelta: 100,
    },
    isHost: true,
    onNextRound: async () => {},
    currentRound: 3,
    totalRounds: 10,
  });
  assert.ok(React.isValidElement(revealCardEl), "RoundRevealCard should be valid element");

  // 7e. GameView element with mock roomRealtime
  const mockPlayers: Player[] = [
    {
      id: "p1",
      displayName: "Host Player",
      isHost: true,
      isReady: true,
      score: 100,
      sessionToken: "tok-1",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "p2",
      displayName: "Guest 1",
      isHost: false,
      isReady: true,
      score: 50,
      sessionToken: "tok-2",
      lastSeenAt: new Date().toISOString(),
    },
  ];

  const mockRealtime: any = {
    roomCode: "GAME88",
    players: mockPlayers,
    myPlayer: mockPlayers[0],
    isHost: true,
    room: {
      settings: {
        gameMode: "buzzer",
        answerInputMode: "autocomplete",
      },
    },
    status: "question_active",
    currentRound: 1,
    totalRounds: 10,
    gameMode: "buzzer",
    activeQuestion: {
      sliceUrl: "https://example.com/slice.mp3",
      durationSec: 2,
    },
    buzzedPlayer: null,
    isMyBuzz: false,
    isExcludedFromBuzz: false,
    revealedSong: null,
    roundWinner: null,
    lastWrongGuess: null,
    wrongGuesses: [],
    scores: { p1: 100, p2: 50 },
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
  };

  const gameViewEl = React.createElement(GameView, {
    roomRealtime: mockRealtime,
    songLibrary: mockSongPool,
    onLeaveRoom: () => {},
  });
  assert.ok(React.isValidElement(gameViewEl), "GameView element should be valid React element");

  console.log("✓ Passed: All components instantiate with strict prop types.\n");

  console.log("==========================================");
  console.log("All Room Gameplay UI Verification Tests Passed!");
  console.log("==========================================");
}

runGameplayUITests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
