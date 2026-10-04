import { describe, it } from "node:test";
import assert from "node:assert";
import { generateRoomCode, isValidRoomCode } from "../room-code";

describe("Room Code Utilities", () => {
  it("should generate a 6-character uppercase alphanumeric code", () => {
    const code = generateRoomCode();
    assert.strictEqual(code.length, 6);
    assert.match(code, /^[A-Z0-9]{6}$/);
  });

  it("should exclude ambiguous characters 0, O, 1, I, L", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      assert.doesNotMatch(code, /[01IOL]/);
    }
  });

  it("should validate valid and invalid room codes", () => {
    assert.strictEqual(isValidRoomCode("ABC234"), true);
    assert.strictEqual(isValidRoomCode("abc234"), true); // case-insensitive check
    assert.strictEqual(isValidRoomCode("ABC"), false);
    assert.strictEqual(isValidRoomCode("TOOLONG123"), false);
    assert.strictEqual(isValidRoomCode(""), false);
  });
});
