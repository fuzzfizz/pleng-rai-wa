import assert from "node:assert";
import { generateRoomCode, isValidRoomCode, SAFE_CHARS } from "../src/lib/room-code";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "../src/lib/services/room-service";

console.log("==========================================");
console.log("Running Room Code & Room Service Verification");
console.log("==========================================\n");

// Test 1: Length and Character Set
console.log("Test 1: Code format and character set...");
for (let i = 0; i < 500; i++) {
  const code = generateRoomCode();
  assert.strictEqual(code.length, 6, `Code ${code} must be 6 characters long`);
  assert.match(code, /^[A-Z0-9]{6}$/, `Code ${code} must match ^[A-Z0-9]{6}$`);
  assert.doesNotMatch(code, /[01IOL]/, `Code ${code} must not contain 0, 1, I, O, L`);
  for (const ch of code) {
    assert.ok(SAFE_CHARS.includes(ch), `Character ${ch} must be in SAFE_CHARS`);
  }
}
console.log("✓ Passed: 500 generated codes are valid and exclude ambiguous chars.");

// Test 2: Randomness & Uniqueness
console.log("\nTest 2: Randomness distribution...");
const sampleSet = new Set<string>();
for (let i = 0; i < 100; i++) {
  sampleSet.add(generateRoomCode());
}
assert.ok(sampleSet.size >= 95, `Expected high entropy across 100 codes, got ${sampleSet.size}`);
console.log(`✓ Passed: 100 codes generated ${sampleSet.size} unique values.`);

// Test 3: Validation function
console.log("\nTest 3: isValidRoomCode validation...");
assert.strictEqual(isValidRoomCode("ABC234"), true, "Valid 6-char code should be true");
assert.strictEqual(isValidRoomCode("abc234"), true, "Lowercase valid 6-char code should be true");
assert.strictEqual(isValidRoomCode("  ABC234  "), true, "Padded valid code should be true");
assert.strictEqual(isValidRoomCode("ABC"), false, "Too short code should be false");
assert.strictEqual(isValidRoomCode("TOOLONG123"), false, "Too long code should be false");
assert.strictEqual(isValidRoomCode(""), false, "Empty string should be false");
assert.strictEqual(isValidRoomCode("AB@#12"), false, "Special characters should be false");
// @ts-expect-error testing invalid type
assert.strictEqual(isValidRoomCode(null), false, "Null should be false");
// @ts-expect-error testing invalid type
assert.strictEqual(isValidRoomCode(undefined), false, "Undefined should be false");
// @ts-expect-error testing invalid type
assert.strictEqual(isValidRoomCode(123456), false, "Number should be false");
console.log("✓ Passed: All validation scenarios behave as expected.");

// Test 4: RoomService interface integrity
console.log("\nTest 4: RoomService interface check...");
assert.strictEqual(typeof RoomService.createRoom, "function");
assert.strictEqual(typeof RoomService.getRoomByCode, "function");
assert.strictEqual(typeof RoomService.updateRoomSettings, "function");
assert.strictEqual(typeof RoomService.updateRoomStatus, "function");
assert.strictEqual(typeof RoomService.transferHost, "function");

assert.strictEqual(DEFAULT_ROOM_SETTINGS.gameMode, "buzzer");
assert.strictEqual(DEFAULT_ROOM_SETTINGS.answerInputMode, "autocomplete");
assert.strictEqual(DEFAULT_ROOM_SETTINGS.sliceDurationSec, 2.0);
assert.strictEqual(DEFAULT_ROOM_SETTINGS.roundTimeoutSec, 15);
assert.strictEqual(DEFAULT_ROOM_SETTINGS.totalRounds, 10);
assert.strictEqual(DEFAULT_ROOM_SETTINGS.targetScore, 0);
console.log("✓ Passed: RoomService methods and DEFAULT_ROOM_SETTINGS are present.");

console.log("\n==========================================");
console.log("All Task 1 tests passed successfully!");
console.log("==========================================");
