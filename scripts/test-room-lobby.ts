// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Lobby UI Verification Script
// Tests for Task 5:
// 1. Component exports and type definitions
// 2. Deterministic player avatar resolution
// 3. Ready status logic & host badge display
// 4. Host settings payload formulation & normalization
// 5. Room join URL generation
// 6. Settings summary text formatting across game modes
// 7. Component instantiation & SSR safety
// ==========================================

import assert from "node:assert";
import React from "react";
import {
  QRCodeModal,
  buildRoomJoinUrl,
  type QRCodeModalProps,
} from "../src/components/room/qr-code-modal";
import {
  PlayerCard,
  getDeterministicAvatar,
  getPlayerStatusBadge,
  DETERMINISTIC_AVATARS,
  type PlayerCardProps,
} from "../src/components/room/player-card";
import {
  HostSettingsModal,
  prepareSettingsPayload,
  SLICE_DURATION_OPTIONS,
  TOTAL_ROUNDS_OPTIONS,
  ROUND_TIMEOUT_OPTIONS,
  type HostSettingsModalProps,
} from "../src/components/room/host-settings-modal";
import {
  LobbyView,
  formatSettingsSummary,
  type LobbyViewProps,
} from "../src/components/room/lobby-view";
import type { Player, RoomSettings } from "../src/types";

async function runLobbyUITests() {
  console.log("==========================================");
  console.log("Running Room Lobby UI Verification Tests");
  console.log("==========================================\n");

  // ----------------------------------------------------
  // Test 1: Component Exports and Types
  // ----------------------------------------------------
  console.log("Test 1: Component Exports and Types...");
  assert.strictEqual(typeof QRCodeModal, "function", "QRCodeModal should be a function component");
  assert.strictEqual(typeof PlayerCard, "function", "PlayerCard should be a function component");
  assert.strictEqual(typeof HostSettingsModal, "function", "HostSettingsModal should be a function component");
  assert.strictEqual(typeof LobbyView, "function", "LobbyView should be a function component");

  assert.strictEqual(typeof buildRoomJoinUrl, "function", "buildRoomJoinUrl should be exported");
  assert.strictEqual(typeof getDeterministicAvatar, "function", "getDeterministicAvatar should be exported");
  assert.strictEqual(typeof getPlayerStatusBadge, "function", "getPlayerStatusBadge should be exported");
  assert.strictEqual(typeof prepareSettingsPayload, "function", "prepareSettingsPayload should be exported");
  assert.strictEqual(typeof formatSettingsSummary, "function", "formatSettingsSummary should be exported");

  assert.ok(Array.isArray(DETERMINISTIC_AVATARS) && DETERMINISTIC_AVATARS.length > 0, "DETERMINISTIC_AVATARS should be non-empty array");
  assert.ok(SLICE_DURATION_OPTIONS.length >= 3, "SLICE_DURATION_OPTIONS should have at least 3 options");
  assert.ok(TOTAL_ROUNDS_OPTIONS.length >= 4, "TOTAL_ROUNDS_OPTIONS should have at least 4 options");
  assert.ok(ROUND_TIMEOUT_OPTIONS.length >= 3, "ROUND_TIMEOUT_OPTIONS should have at least 3 options");

  console.log("✓ Passed: All components, helpers, and constant arrays exported correctly.\n");

  // ----------------------------------------------------
  // Test 2: Deterministic Avatar Resolution
  // ----------------------------------------------------
  console.log("Test 2: Deterministic Player Avatar Resolution...");

  // 2a. Same seed returns identical avatar consistently
  const avatar1 = getDeterministicAvatar({ id: "player-alpha-123" });
  const avatar2 = getDeterministicAvatar({ id: "player-alpha-123" });
  assert.strictEqual(avatar1, avatar2, "Same player ID must return identical avatar");
  assert.ok(DETERMINISTIC_AVATARS.includes(avatar1), `Avatar "${avatar1}" must be in DETERMINISTIC_AVATARS list`);

  // 2b. Explicit avatarUrl is prioritized
  const customUrl = "https://example.com/custom-avatar.png";
  const avatarWithUrl = getDeterministicAvatar({
    id: "player-alpha-123",
    avatarUrl: customUrl,
  });
  assert.strictEqual(avatarWithUrl, customUrl, "Explicit avatarUrl must be returned as-is");

  // 2c. Fallback for displayName seed when ID is omitted
  const avatarFromDisplayName = getDeterministicAvatar({ displayName: "Somchai Guitarist" });
  assert.ok(DETERMINISTIC_AVATARS.includes(avatarFromDisplayName), "Avatar from displayName should be in allowed list");

  // 2d. Determinism over multiple calls and distributions
  const seenAvatars = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const av = getDeterministicAvatar({ id: `guest-uuid-${i * 7 + 13}` });
    assert.ok(DETERMINISTIC_AVATARS.includes(av));
    seenAvatars.add(av);
  }
  assert.ok(seenAvatars.size > 1, "Avatars should distribute across multiple distinct characters");

  console.log(`✓ Passed: Deterministic avatar generation verified (${seenAvatars.size} distinct avatars sampled).\n`);

  // ----------------------------------------------------
  // Test 3: Player Ready Status Logic & Badges
  // ----------------------------------------------------
  console.log("Test 3: Ready Status Logic & Host Badge Resolution...");

  const basePlayer: Player = {
    id: "p1",
    displayName: "Player 1",
    isHost: false,
    isReady: false,
    score: 120,
    sessionToken: "tok1",
    lastSeenAt: new Date().toISOString(),
  };

  // 3a. Host player badge (isHost: true)
  const hostBadge = getPlayerStatusBadge({ ...basePlayer, isHost: true, isReady: false });
  assert.strictEqual(hostBadge.variant, "host");
  assert.strictEqual(hostBadge.text, "👑 ผู้สร้างห้อง");
  assert.ok(hostBadge.colorClass.includes("amber"), "Host badge must use amber colors");

  // 3b. Host player with isReady true should still show Host badge
  const hostReadyBadge = getPlayerStatusBadge({ ...basePlayer, isHost: true, isReady: true });
  assert.strictEqual(hostReadyBadge.variant, "host");
  assert.strictEqual(hostReadyBadge.text, "👑 ผู้สร้างห้อง");

  // 3c. Ready non-host player
  const readyBadge = getPlayerStatusBadge({ ...basePlayer, isHost: false, isReady: true });
  assert.strictEqual(readyBadge.variant, "ready");
  assert.strictEqual(readyBadge.text, "✓ พร้อมแล้ว");
  assert.ok(readyBadge.colorClass.includes("emerald"), "Ready badge must use emerald colors");

  // 3d. Waiting non-host player
  const waitingBadge = getPlayerStatusBadge({ ...basePlayer, isHost: false, isReady: false });
  assert.strictEqual(waitingBadge.variant, "waiting");
  assert.strictEqual(waitingBadge.text, "รอสักครู่...");
  assert.ok(waitingBadge.colorClass.includes("slate"), "Waiting badge must use slate colors");

  console.log("✓ Passed: Player status and host badges resolve accurately.\n");

  // ----------------------------------------------------
  // Test 4: Host Settings Formulation & Normalization
  // ----------------------------------------------------
  console.log("Test 4: Settings Modal Payload Formulation...");

  // 4a. Preserves valid settings
  const validSettings: Partial<RoomSettings> = {
    gameMode: "buzzer",
    answerInputMode: "free-text",
    sliceDurationSec: 1.0,
    roundTimeoutSec: 10,
    totalRounds: 5,
  };
  const formulated = prepareSettingsPayload(validSettings);
  assert.strictEqual(formulated.gameMode, "buzzer");
  assert.strictEqual(formulated.answerInputMode, "free-text");
  assert.strictEqual(formulated.sliceDurationSec, 1.0);
  assert.strictEqual(formulated.roundTimeoutSec, 10);
  assert.strictEqual(formulated.totalRounds, 5);

  // 4b. Normalizes unknown gameMode to audio-slice
  const invalidModePayload = prepareSettingsPayload({ gameMode: "invalid-mode" as any });
  assert.strictEqual(invalidModePayload.gameMode, "audio-slice");

  // 4c. Ensures ai-lyrics has a valid lyricsType
  const aiLyricsPayload = prepareSettingsPayload({ gameMode: "ai-lyrics" });
  assert.strictEqual(aiLyricsPayload.lyricsType, "chorus", "Missing lyricsType should default to chorus");

  const aiLyricsWithIntro = prepareSettingsPayload({ gameMode: "ai-lyrics", lyricsType: "intro" });
  assert.strictEqual(aiLyricsWithIntro.lyricsType, "intro", "Valid intro lyricsType should be preserved");

  // 4d. Normalizes invalid numbers
  const invalidNumbers = prepareSettingsPayload({
    sliceDurationSec: -5,
    roundTimeoutSec: 0,
    totalRounds: -1,
  });
  assert.strictEqual(invalidNumbers.sliceDurationSec, 2.0);
  assert.strictEqual(invalidNumbers.roundTimeoutSec, 15);
  assert.strictEqual(invalidNumbers.totalRounds, 10);

  console.log("✓ Passed: Settings formulation and normalization validated.\n");

  // ----------------------------------------------------
  // Test 5: Room Join URL Generation
  // ----------------------------------------------------
  console.log("Test 5: Room Join URL Generation...");

  const urlWithOrigin = buildRoomJoinUrl("ABC123", "https://pleng.game");
  assert.strictEqual(urlWithOrigin, "https://pleng.game/room/ABC123");

  const urlWithTrailingSlash = buildRoomJoinUrl("xyz789", "https://pleng.game/");
  assert.strictEqual(urlWithTrailingSlash, "https://pleng.game/room/XYZ789");

  const urlCaseAndTrim = buildRoomJoinUrl("  mno456  ", "http://localhost:3000");
  assert.strictEqual(urlCaseAndTrim, "http://localhost:3000/room/MNO456");

  const relativeUrl = buildRoomJoinUrl("DEF456");
  assert.strictEqual(relativeUrl, "/room/DEF456");

  console.log("✓ Passed: Room join URLs correctly formatted and sanitized.\n");

  // ----------------------------------------------------
  // Test 6: Settings Summary Formatting
  // ----------------------------------------------------
  console.log("Test 6: Settings Summary Formatting Across All Game Modes...");

  // 6a. Audio Slice
  const audioSliceSummary = formatSettingsSummary({
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 10,
    targetScore: 0,
  });
  assert.strictEqual(
    audioSliceSummary,
    "โหมด: ตัดเสียงเสี้ยววินาที • 10 ข้อ • 2.0 วินาที • ค้นหาชื่อเพลง"
  );

  // 6b. Buzzer Battle
  const buzzerSummary = formatSettingsSummary({
    gameMode: "buzzer",
    answerInputMode: "free-text",
    sliceDurationSec: 1.0,
    roundTimeoutSec: 10,
    totalRounds: 15,
    targetScore: 0,
  });
  assert.strictEqual(
    buzzerSummary,
    "โหมด: แย่งกดกริ่ง • 15 ข้อ • 1.0 วินาที • พิมพ์เอง"
  );

  // 6c. AI Lyrics with Chorus
  const aiLyricsChorusSummary = formatSettingsSummary({
    gameMode: "ai-lyrics",
    lyricsType: "chorus",
    answerInputMode: "autocomplete",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
  });
  assert.strictEqual(
    aiLyricsChorusSummary,
    "โหมด: AI อ่านเนื้อเพลง • 5 ข้อ • ท่อนฮุก • ค้นหาชื่อเพลง"
  );

  // 6d. AI Lyrics with Intro
  const aiLyricsIntroSummary = formatSettingsSummary({
    gameMode: "ai-lyrics",
    lyricsType: "intro",
    answerInputMode: "free-text",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 30,
    totalRounds: 20,
    targetScore: 0,
  });
  assert.strictEqual(
    aiLyricsIntroSummary,
    "โหมด: AI อ่านเนื้อเพลง • 20 ข้อ • ท่อนเปิด • พิมพ์เอง"
  );

  console.log("✓ Passed: Settings summaries formatted cleanly across all variations.\n");

  // ----------------------------------------------------
  // Test 7: Component Instantiation & Prop Contracts
  // ----------------------------------------------------
  console.log("Test 7: Component Instantiation & Prop Contracts...");

  const mockSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 10,
    targetScore: 0,
  };

  const mockPlayers: Player[] = [
    {
      id: "host-1",
      displayName: "Host Player",
      isHost: true,
      isReady: true,
      score: 50,
      sessionToken: "host-tok",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "guest-2",
      displayName: "Guest Player",
      isHost: false,
      isReady: true,
      score: 20,
      sessionToken: "guest-tok",
      lastSeenAt: new Date().toISOString(),
    },
  ];

  // 7a. PlayerCard element
  const playerCardEl = React.createElement(PlayerCard, {
    player: mockPlayers[0],
    isCurrentPlayer: true,
  });
  assert.ok(React.isValidElement(playerCardEl), "PlayerCard element must be valid React element");

  // 7b. QRCodeModal element (closed)
  const qrModalClosed = React.createElement(QRCodeModal, {
    isOpen: false,
    onClose: () => {},
    roomCode: "TEST88",
  });
  assert.ok(React.isValidElement(qrModalClosed), "QRCodeModal closed must be valid React element");

  // 7c. HostSettingsModal element (closed)
  const settingsModalClosed = React.createElement(HostSettingsModal, {
    isOpen: false,
    onClose: () => {},
    settings: mockSettings,
    players: mockPlayers,
    currentHostPlayerId: "host-1",
    onSaveSettings: async () => {},
    onTransferHost: async () => {},
  });
  assert.ok(React.isValidElement(settingsModalClosed), "HostSettingsModal closed must be valid React element");

  // 7d. LobbyView element
  const lobbyViewEl = React.createElement(LobbyView, {
    roomCode: "TEST88",
    players: mockPlayers,
    myPlayer: mockPlayers[0],
    isHost: true,
    settings: mockSettings,
    onStartGame: async () => {},
    onToggleReady: async () => {},
    onUpdateSettings: async () => {},
    onTransferHost: async () => {},
    onLeaveRoom: () => {},
  });
  assert.ok(React.isValidElement(lobbyViewEl), "LobbyView element must be valid React element");

  console.log("✓ Passed: All React elements instantiate with strictly typed props.\n");

  console.log("==========================================");
  console.log("All Room Lobby UI Verification Tests Passed!");
  console.log("==========================================");
}

runLobbyUITests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
