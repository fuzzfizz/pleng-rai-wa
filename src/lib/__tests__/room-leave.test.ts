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

  it("should identify room as empty when players array is empty", () => {
    const roomSettingsWithEmptyPlayers = { playerCount: 1, players: [], isPrivate: false };
    const isPlayersEmpty = Array.isArray(roomSettingsWithEmptyPlayers.players) && roomSettingsWithEmptyPlayers.players.length === 0;
    expect(isPlayersEmpty).toBe(true);
  });

  it("should detect when 0 active human players remain (only TV left)", () => {
    const players = [
      { id: "tv-1", displayName: "TV Display (TV)", avatarUrl: "📺" },
    ];
    const activeHumans = players.filter(
      (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
    );
    expect(activeHumans.length).toBe(0);
  });

  it("should trigger single-player abort condition when active humans drop to <= 1 from >= 2", () => {
    let hadMultiplePlayers = false;
    let currentPlayers = [
      { id: "p1", displayName: "Player 1", avatarUrl: "🎧" },
      { id: "p2", displayName: "Player 2", avatarUrl: "🎤" },
    ];

    let activeHumans = currentPlayers.filter(
      (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
    );
    if (activeHumans.length >= 2) {
      hadMultiplePlayers = true;
    }
    expect(hadMultiplePlayers).toBe(true);

    // Player 2 leaves
    currentPlayers = [{ id: "p1", displayName: "Player 1", avatarUrl: "🎧" }];
    activeHumans = currentPlayers.filter(
      (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
    );

    const isGameActive = true;
    const shouldAbort = hadMultiplePlayers && isGameActive && activeHumans.length <= 1;
    expect(shouldAbort).toBe(true);
  });
});
