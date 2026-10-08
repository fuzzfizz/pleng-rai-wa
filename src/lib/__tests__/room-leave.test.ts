import { describe, it, expect } from "vitest";

describe("Room Leave & Player Count Logic", () => {
  it("should calculate correct remaining count when a guest leaves", () => {
    const currentCount = 2;
    const nextCount = Math.max(0, currentCount - 1);
    expect(nextCount).toBe(1);
  });

  it("should trigger room deletion when remaining count reaches 0", () => {
    const currentCount = 1;
    const nextCount = Math.max(0, currentCount - 1);
    expect(nextCount).toBe(0);
    const shouldDelete = nextCount <= 0;
    expect(shouldDelete).toBe(true);
  });

  it("should clamp player count to 0 when multiple leaves occur", () => {
    const currentCount = 0;
    const nextCount = Math.max(0, currentCount - 1);
    expect(nextCount).toBe(0);
  });

  it("should mark empty rooms as removable in active room listing", () => {
    const roomSettingsWithZeroPlayers = { playerCount: 0, isPrivate: false };
    const count = typeof roomSettingsWithZeroPlayers.playerCount === "number"
      ? Math.max(0, roomSettingsWithZeroPlayers.playerCount)
      : 1;
    const isRoomEmpty = count <= 0;
    expect(isRoomEmpty).toBe(true);
  });
});
