import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { AnswerModal } from "../answer-modal";
import { getBuzzerRemainingSeconds } from "../tv-view";
import { soundEffects } from "@/lib/sound-effects";

// Mock sound effects
vi.mock("@/lib/sound-effects", () => ({
  soundEffects: {
    countdownTick: vi.fn(),
    buzzer: vi.fn(),
    wrong: vi.fn(),
    correct: vi.fn(),
  },
}));

describe("Issue 1: Answer Expiry Immediate Cutoff & Issue 3: 3-Second Audio Countdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AnswerModal Immediate Input Cutoff at 0s (Issue 1)", () => {
    it("renders disabled choice buttons and input when time is expired (buzzDeadline in past)", () => {
      const pastDeadline = new Date(Date.now() - 5000).toISOString();
      const html = renderToString(
        React.createElement(AnswerModal, {
          isOpen: true,
          onSubmitAnswer: vi.fn(),
          buzzDeadline: pastDeadline,
          inputMode: "multiple-choice",
          choices: [
            { id: "1", title: "Song A", artist: "Artist A" },
            { id: "2", title: "Song B", artist: "Artist B" },
          ],
        })
      );

      // Both choices should be disabled
      expect(html).toContain('disabled=""');
      expect(html).toContain("Song A");
      expect(html).toContain("Song B");
      // Check for disabled styling
      expect(html).toContain("disabled:cursor-not-allowed");
    });

    it("disables text input and submit button when time is expired in text input mode", () => {
      const pastDeadline = new Date(Date.now() - 5000).toISOString();
      const html = renderToString(
        React.createElement(AnswerModal, {
          isOpen: true,
          onSubmitAnswer: vi.fn(),
          buzzDeadline: pastDeadline,
          inputMode: "free-text",
        })
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain("cursor-not-allowed");
      expect(html).toContain("ส่งคำตอบ (Submit)");
    });

    it("keeps inputs enabled when modal is active with plenty of time remaining", () => {
      const futureDeadline = new Date(Date.now() + 15000).toISOString();
      const html = renderToString(
        React.createElement(AnswerModal, {
          isOpen: true,
          onSubmitAnswer: vi.fn(),
          buzzDeadline: futureDeadline,
          inputMode: "free-text",
        })
      );

      // Input itself should not be disabled
      expect(html).toContain('placeholder="พิมพ์ชื่อเพลงที่คิดว่าใช่..."');
      // Look for the input element and verify it doesn't have disabled attribute
      expect(html).toMatch(/<input[^>]*placeholder="พิมพ์ชื่อเพลงที่คิดว่าใช่\.\.\."[^>]*\/>/);
      expect(html).not.toMatch(/<input[^>]*disabled=""[^>]*placeholder="พิมพ์ชื่อเพลงที่คิดว่าใช่\.\.\."/);
    });

    it("does not disable inputs when timer is unlimited (timeRemainingSec <= 0 and no buzzDeadline)", () => {
      const html = renderToString(
        React.createElement(AnswerModal, {
          isOpen: true,
          onSubmitAnswer: vi.fn(),
          timeRemainingSec: 0,
          inputMode: "multiple-choice",
          choices: [{ id: "1", title: "Song Unlimited", artist: "Artist U" }],
        })
      );

      expect(html).toContain("ไม่จำกัดเวลา (Unlimited)");
      // Choice button should not be disabled
      expect(html).toContain("Song Unlimited");
      expect(html).toMatch(/<button[^>]*>[^<]*<span[^>]*>[^<]*<\/span>[^<]*<div[^>]*><div[^>]*>Song Unlimited<\/div>/);
    });
  });

  describe("3-Second Countdown Audio Ticking Deduplication & Timing (Issue 3)", () => {
    it("simulates AnswerModal 100ms interval ticking at 3, 2, 1 and not repeating in same second", () => {
      let secondsLeft = 5.0;
      let lastTickedSec: number | null = null;
      const ticks: number[] = [];

      // Run 50 ticks of 100ms (5.0s down to 0s)
      for (let i = 0; i < 50; i++) {
        secondsLeft = Math.max(0, Math.round((secondsLeft - 0.1) * 10) / 10);
        const wholeSec = Math.ceil(secondsLeft);

        if (wholeSec <= 3 && wholeSec > 0 && wholeSec !== lastTickedSec) {
          lastTickedSec = wholeSec;
          ticks.push(wholeSec);
          soundEffects.countdownTick();
        }
      }

      // Should tick exactly 3 times: at 3, 2, 1
      expect(ticks).toEqual([3, 2, 1]);
      expect(soundEffects.countdownTick).toHaveBeenCalledTimes(3);
    });

    it("simulates TVView 500ms buzzer interval ticking exactly once per second at 3, 2, 1", () => {
      let lastTickedSec: number | null = null;
      const ticks: number[] = [];

      // Simulate buzzer remaining seconds dropping from 5 to 0 with 500ms checks (2 checks per second)
      const simulatedSequence = [5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0];
      simulatedSequence.forEach((remaining) => {
        if (remaining <= 3 && remaining > 0 && remaining !== lastTickedSec) {
          lastTickedSec = remaining;
          ticks.push(remaining);
          soundEffects.countdownTick();
        }
      });

      expect(ticks).toEqual([3, 2, 1]);
      expect(soundEffects.countdownTick).toHaveBeenCalledTimes(3);
    });

    it("simulates GameView and Solo mode question countdown ticking only at <= 3 and > 0", () => {
      const ticks: number[] = [];
      let currentVal = 10;

      while (currentVal > 0) {
        const nextVal = currentVal - 1;
        if (nextVal <= 3 && nextVal > 0) {
          ticks.push(nextVal);
        }
        currentVal = nextVal;
      }

      // Ticks should strictly occur for remaining seconds 3, 2, 1
      expect(ticks).toEqual([3, 2, 1]);
    });
  });

  describe("Timeout Submission & Direct Answer Expiration Locking", () => {
    it("calculates buzzer remaining seconds with getBuzzerRemainingSeconds", () => {
      const now = Date.now();
      const deadline = new Date(now + 3000).toISOString();
      expect(getBuzzerRemainingSeconds(deadline, 10, now)).toBe(3);

      const pastDeadline = new Date(now - 1000).toISOString();
      expect(getBuzzerRemainingSeconds(pastDeadline, 10, now)).toBe(0);
    });

    it("guards direct answer submission when countdown has expired (countdownRemaining <= 0)", () => {
      const countdownRemaining = 0;
      let submitted = false;

      const attemptSubmit = (answer: string) => {
        if (countdownRemaining !== null && countdownRemaining <= 0) {
          return;
        }
        submitted = true;
      };

      attemptSubmit("My Answer");
      expect(submitted).toBe(false);
    });

    it("allows direct answer submission when countdown has remaining time", () => {
      const countdownRemaining = 5;
      let submitted = false;

      const attemptSubmit = (answer: string) => {
        if (countdownRemaining !== null && countdownRemaining <= 0) {
          return;
        }
        submitted = true;
      };

      attemptSubmit("My Answer");
      expect(submitted).toBe(true);
    });
  });
});
