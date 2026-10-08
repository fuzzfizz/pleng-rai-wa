import { describe, it, expect } from "vitest";
import { isDirectInputMode } from "../game-view";
import type { GameMode } from "@/types";

describe("Game Mode Input Routing", () => {
  it("routes audio-slice mode to direct input mode", () => {
    expect(isDirectInputMode("audio-slice")).toBe(true);
  });

  it("routes ai-lyrics and translated-lyrics to direct input mode", () => {
    expect(isDirectInputMode("ai-lyrics")).toBe(true);
    expect(isDirectInputMode("translated-lyrics")).toBe(true);
  });

  it("routes buzzer mode exclusively to buzzer duel mode (not direct input)", () => {
    expect(isDirectInputMode("buzzer")).toBe(false);
  });

  it("ensures all supported game modes are categorized correctly", () => {
    const directModes: GameMode[] = ["audio-slice", "ai-lyrics", "translated-lyrics"];
    const buzzerModes: GameMode[] = ["buzzer"];

    directModes.forEach((mode) => {
      expect(isDirectInputMode(mode)).toBe(true);
    });

    buzzerModes.forEach((mode) => {
      expect(isDirectInputMode(mode)).toBe(false);
    });
  });
});
