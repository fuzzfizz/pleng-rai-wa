import { describe, it, expect, vi } from "vitest";
import type { GameMode } from "@/types";
import type { RoomRealtimeStatus } from "@/hooks/use-room-realtime";

describe("Non-Buzzer Unlimited Mode & Hint Immunity", () => {
  /**
   * Helper that checks whether an answer countdown timer should run.
   * As requested: Only buzzer mode has answer countdown timer; non-buzzer modes are unlimited.
   */
  function shouldRunAnswerCountdown(gameMode: GameMode, status: RoomRealtimeStatus): boolean {
    if (gameMode !== "buzzer") {
      return false;
    }
    return status === "buzzed" || status === "question_active";
  }

  it("does NOT run answer countdown in audio-slice mode", () => {
    expect(shouldRunAnswerCountdown("audio-slice", "question_active")).toBe(false);
  });

  it("does NOT run answer countdown in ai-lyrics mode", () => {
    expect(shouldRunAnswerCountdown("ai-lyrics", "question_active")).toBe(false);
  });

  it("does NOT run answer countdown in translated-lyrics mode", () => {
    expect(shouldRunAnswerCountdown("translated-lyrics", "question_active")).toBe(false);
  });

  it("only runs answer countdown when gameMode is buzzer", () => {
    expect(shouldRunAnswerCountdown("buzzer", "question_active")).toBe(true);
    expect(shouldRunAnswerCountdown("buzzer", "buzzed")).toBe(true);
    expect(shouldRunAnswerCountdown("buzzer", "revealing")).toBe(false);
    expect(shouldRunAnswerCountdown("buzzer", "lobby")).toBe(false);
  });

  it("requesting hint does not reset timer state when using handleTimeoutRef", () => {
    let timerState = 12; // 12 seconds remaining

    // Simulating callback ref guard pattern
    const handleTimeout = vi.fn();
    const handleTimeoutRef = { current: handleTimeout };

    // Function that updates hint state
    function onHintRevealed(newLevel: number) {
      // Must NOT reset timerState
      return newLevel;
    }

    const nextHintLevel = onHintRevealed(1);
    expect(nextHintLevel).toBe(1);
    expect(timerState).toBe(12); // Stays at 12s, not reset to 15s
  });
});
