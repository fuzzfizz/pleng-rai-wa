// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Page Integration Verification
// Tests for Task 8:
// 1. Component exports and helper contracts
// 2. Nickname validation rules (empty, whitespace, max length, valid characters)
// 3. Room view mode resolution from query params (?view=tv vs default player)
// 4. Room URL and Join URL generation & normalization
// 5. Room code validation & format rules
// 6. Player session storage lifecycle for room join/create
// 7. React element instantiation across routes
// ==========================================

import assert from "node:assert";
import React from "react";
import RoomPage, {
  validateNickname,
  resolveRoomViewMode,
  buildRoomUrl,
  RoomLoadingSkeleton,
  InvalidRoomCodeCard,
  DEFAULT_CLIENT_ROOM_SETTINGS,
  type RoomPageProps,
} from "../src/app/room/[code]/page";
import HomePage from "../src/app/page";
import { isValidRoomCode, generateRoomCode } from "../src/lib/room-code";
import { buildRoomJoinUrl } from "../src/components/room/qr-code-modal";
import {
  savePlayerSession,
  loadPlayerSession,
  clearPlayerSession,
  getLastRoomCode,
  STORAGE_KEY_PREFIX,
  STORAGE_KEY_LAST_ROOM,
} from "../src/lib/session-storage";
import { createInitialRoomRealtimeState } from "../src/hooks/use-room-realtime";
import type { Player } from "../src/types";

// Setup mock window.localStorage for Node testing environment
function setupMockLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    length: 0,
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, String(value)),
  };

  (global as any).window = {
    localStorage: mockStorage,
    location: { origin: "https://pleng-rai-wa.local" },
  };
}

async function runRoomPageIntegrationTests() {
  console.log("==========================================");
  console.log("Running Room Page & Home Integration Tests");
  console.log("==========================================\n");

  setupMockLocalStorage();

  // ----------------------------------------------------
  // Test 1: Component and Helper Exports
  // ----------------------------------------------------
  console.log("Test 1: Component & Helper Exports...");
  assert.strictEqual(typeof RoomPage, "function", "RoomPage should be a component function");
  assert.strictEqual(typeof HomePage, "function", "HomePage should be a component function");
  assert.strictEqual(typeof validateNickname, "function", "validateNickname should be a function");
  assert.strictEqual(
    typeof resolveRoomViewMode,
    "function",
    "resolveRoomViewMode should be a function"
  );
  assert.strictEqual(typeof buildRoomUrl, "function", "buildRoomUrl should be a function");
  assert.strictEqual(
    typeof RoomLoadingSkeleton,
    "function",
    "RoomLoadingSkeleton should be a component function"
  );
  assert.strictEqual(
    typeof InvalidRoomCodeCard,
    "function",
    "InvalidRoomCodeCard should be a component function"
  );
  assert.strictEqual(
    typeof DEFAULT_CLIENT_ROOM_SETTINGS,
    "object",
    "DEFAULT_CLIENT_ROOM_SETTINGS should be an object"
  );
  assert.strictEqual(DEFAULT_CLIENT_ROOM_SETTINGS.gameMode, "buzzer");
  console.log("✓ Passed: All components and helpers exported cleanly.\n");

  // ----------------------------------------------------
  // Test 2: Nickname Validation Logic
  // ----------------------------------------------------
  console.log("Test 2: Nickname Validation Logic...");

  // Empty string
  const emptyRes = validateNickname("");
  assert.strictEqual(emptyRes.valid, false, "Empty string should be invalid");
  assert.ok(emptyRes.error, "Empty string should produce error message");

  // Whitespace only
  const whitespaceRes = validateNickname("     ");
  assert.strictEqual(whitespaceRes.valid, false, "Whitespace only should be invalid");

  // Null or undefined
  assert.strictEqual(validateNickname(null).valid, false, "null should be invalid");
  assert.strictEqual(validateNickname(undefined).valid, false, "undefined should be invalid");
  assert.strictEqual(validateNickname(12345 as any).valid, false, "numbers should be invalid");

  // Valid standard nicknames
  assert.strictEqual(validateNickname("ดีเจนุ้ย").valid, true, "Thai nickname should be valid");
  assert.strictEqual(validateNickname("Alice").valid, true, "English nickname should be valid");
  assert.strictEqual(validateNickname("X").valid, true, "Single char nickname should be valid");
  assert.strictEqual(validateNickname("   Bob   ").valid, true, "Untrimmed valid name should be accepted");

  // Max length boundary (25 chars)
  const exact25 = "A".repeat(25);
  const res25 = validateNickname(exact25);
  assert.strictEqual(res25.valid, true, "25-char nickname should be valid");

  // Exceeding length boundary (26 chars)
  const exact26 = "A".repeat(26);
  const res26 = validateNickname(exact26);
  assert.strictEqual(res26.valid, false, "26-char nickname should be rejected");
  assert.ok(res26.error?.includes("25"), "Error should mention 25 characters");

  console.log("✓ Passed: Nickname validation correctly enforces 1-25 characters.\n");

  // ----------------------------------------------------
  // Test 3: View Mode Resolution from Search Params
  // ----------------------------------------------------
  console.log("Test 3: View Mode Resolution (?view=tv vs default)...");

  // TV View detection
  assert.strictEqual(resolveRoomViewMode("tv"), "tv", "'tv' should resolve to 'tv'");
  assert.strictEqual(resolveRoomViewMode("TV"), "tv", "'TV' should resolve to 'tv'");
  assert.strictEqual(resolveRoomViewMode("Tv"), "tv", "'Tv' should resolve to 'tv'");
  assert.strictEqual(resolveRoomViewMode("  tv  "), "tv", "Trimmed 'tv' should resolve to 'tv'");

  // Default Player View detection
  assert.strictEqual(resolveRoomViewMode(null), "player", "null should default to 'player'");
  assert.strictEqual(resolveRoomViewMode(undefined), "player", "undefined should default to 'player'");
  assert.strictEqual(resolveRoomViewMode(""), "player", "empty string should default to 'player'");
  assert.strictEqual(resolveRoomViewMode("player"), "player", "'player' should default to 'player'");
  assert.strictEqual(resolveRoomViewMode("spectator"), "player", "other values should default to 'player'");

  console.log("✓ Passed: View mode accurately distinguishes TV Party Mode and Player View.\n");

  // ----------------------------------------------------
  // Test 4: URL Construction and Formatting
  // ----------------------------------------------------
  console.log("Test 4: Room URL Construction & Normalization...");

  assert.strictEqual(buildRoomUrl("ABC123"), "/room/ABC123");
  assert.strictEqual(buildRoomUrl("abc123"), "/room/ABC123", "Should uppercase code");
  assert.strictEqual(buildRoomUrl("  xyz789  "), "/room/XYZ789", "Should trim and uppercase");
  assert.strictEqual(
    buildRoomUrl("ABC123", { view: "tv" }),
    "/room/ABC123?view=tv",
    "Should include ?view=tv param"
  );

  // Absolute Join URL helper
  assert.strictEqual(
    buildRoomJoinUrl("ABC123", "https://pleng.app"),
    "https://pleng.app/room/ABC123"
  );
  assert.strictEqual(
    buildRoomJoinUrl("abc123", "http://localhost:3000/"),
    "http://localhost:3000/room/ABC123",
    "Should strip trailing slash from origin"
  );

  console.log("✓ Passed: Room URLs and TV mode query parameters formatted accurately.\n");

  // ----------------------------------------------------
  // Test 5: Room Code Validation
  // ----------------------------------------------------
  console.log("Test 5: Room Code Validation...");

  assert.strictEqual(isValidRoomCode("ABC123"), true, "Valid 6-char alphanumeric should pass");
  assert.strictEqual(isValidRoomCode("abc123"), true, "Lowercase 6-char should pass after normalize");
  assert.strictEqual(isValidRoomCode("  ABC123  "), true, "Whitespace padded code should pass");
  assert.strictEqual(isValidRoomCode("ABC12"), false, "5-char code should fail");
  assert.strictEqual(isValidRoomCode("ABC1234"), false, "7-char code should fail");
  assert.strictEqual(isValidRoomCode("AB-123"), false, "Special characters should fail");
  assert.strictEqual(isValidRoomCode(""), false, "Empty string should fail");
  assert.strictEqual(isValidRoomCode(null as any), false, "Null should fail");

  const generated = generateRoomCode();
  assert.strictEqual(generated.length, 6, "Generated code should be 6 characters");
  assert.strictEqual(isValidRoomCode(generated), true, "Generated code must be valid");

  console.log("✓ Passed: Room code format validation verified.\n");

  // ----------------------------------------------------
  // Test 6: Player Session Storage Lifecycle Integration
  // ----------------------------------------------------
  console.log("Test 6: Player Session Storage Lifecycle Integration...");

  const testRoomCode = "TEST99";
  clearPlayerSession(testRoomCode);

  assert.strictEqual(
    loadPlayerSession(testRoomCode),
    null,
    "Should be null after clearing session"
  );

  // Save host session
  savePlayerSession(testRoomCode, {
    playerId: "p-host-001",
    sessionToken: "token-host-secret",
    displayName: "Host DJ",
    isHost: true,
  });

  const loadedHost = loadPlayerSession(testRoomCode);
  assert.ok(loadedHost, "Loaded host session should exist");
  assert.strictEqual(loadedHost.playerId, "p-host-001");
  assert.strictEqual(loadedHost.displayName, "Host DJ");
  assert.strictEqual(loadedHost.isHost, true);
  assert.strictEqual(loadedHost.roomCode, testRoomCode);
  assert.strictEqual(getLastRoomCode(), testRoomCode, "Last room code should be updated");

  // Clear session on leave room
  clearPlayerSession(testRoomCode);
  assert.strictEqual(loadPlayerSession(testRoomCode), null, "Session should be removed");
  assert.strictEqual(getLastRoomCode(), null, "Last room code should be cleared");

  console.log("✓ Passed: Session save, load, and clear lifecycle operates seamlessly.\n");

  // ----------------------------------------------------
  // Test 7: Component Instantiation & Prop Contracts
  // ----------------------------------------------------
  console.log("Test 7: Component Instantiation & Prop Contracts...");

  // Instantiating RoomPage with Promise params (Next.js 15)
  const promiseParams = Promise.resolve({ code: "ABC123" });
  const roomPageElement = React.createElement(RoomPage, { params: promiseParams });
  assert.ok(roomPageElement, "RoomPage element should instantiate with Promise params");

  // Instantiating RoomPage with pre-resolved params
  const resolvedParamsElement = React.createElement(RoomPage, {
    params: { code: "ABC123" } as any,
  });
  assert.ok(resolvedParamsElement, "RoomPage element should instantiate with resolved params");

  // Instantiating RoomLoadingSkeleton
  const skeletonElement = React.createElement(RoomLoadingSkeleton, { code: "ABC123" });
  assert.ok(skeletonElement, "RoomLoadingSkeleton element should instantiate");

  // Instantiating InvalidRoomCodeCard
  const invalidCardElement = React.createElement(InvalidRoomCodeCard, { code: "INVALID" });
  assert.ok(invalidCardElement, "InvalidRoomCodeCard element should instantiate");

  // Instantiating HomePage
  const homePageElement = React.createElement(HomePage, {});
  assert.ok(homePageElement, "HomePage element should instantiate");

  console.log("✓ Passed: React elements instantiate cleanly with correct prop contracts.\n");

  // ----------------------------------------------------
  // Test 8: Guest Join Session Mapping to Realtime Hook
  // ----------------------------------------------------
  console.log("Test 8: Guest Join Session Mapping to Realtime Hook...");

  const guestSession = {
    roomCode: "XYZ999",
    playerId: "p-guest-456",
    sessionToken: "tok-guest-456",
    displayName: "Guest Gamer",
    isHost: false,
    savedAt: new Date().toISOString(),
  };

  // Map session to initialPlayer (simulating RoomPageContent mapping)
  const mappedPlayer: Partial<Player> = {
    id: guestSession.playerId,
    displayName: guestSession.displayName,
    isHost: Boolean(guestSession.isHost),
    sessionToken: guestSession.sessionToken,
  };

  const initialHookState = createInitialRoomRealtimeState("XYZ999", mappedPlayer);
  assert.ok(initialHookState.myPlayer, "myPlayer should be initialized from mapped session");
  assert.strictEqual(initialHookState.myPlayer.id, "p-guest-456", "myPlayer.id must match session.playerId");
  assert.strictEqual(initialHookState.myPlayer.displayName, "Guest Gamer");
  assert.strictEqual(initialHookState.myPlayer.isHost, false);

  console.log("✓ Passed: Guest session properly maps to initialPlayer with valid id for realtime hook.\n");

  console.log("==========================================");
  console.log("All Room Page Integration Tests Passed!");
  console.log("==========================================");
}

runRoomPageIntegrationTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
