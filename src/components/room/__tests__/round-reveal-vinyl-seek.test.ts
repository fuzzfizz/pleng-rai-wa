import { describe, it, expect } from "vitest";
import {
  formatTime,
  getInitialHookPosition,
  clampSeekTime,
  getVinylAnimationClass,
} from "@/components/room/round-reveal-card";

describe("Round Reveal Vinyl & Seek Helpers", () => {
  describe("formatTime", () => {
    it("formats 0 seconds as 00:00", () => {
      expect(formatTime(0)).toBe("00:00");
    });

    it("formats 65 seconds as 01:05", () => {
      expect(formatTime(65)).toBe("01:05");
    });

    it("formats 220 seconds as 03:40", () => {
      expect(formatTime(220)).toBe("03:40");
    });

    it("floors fractional seconds properly", () => {
      expect(formatTime(65.8)).toBe("01:05");
      expect(formatTime(0.4)).toBe("00:00");
    });

    it("handles negative numbers, NaN and invalid inputs gracefully", () => {
      expect(formatTime(-10)).toBe("00:00");
      expect(formatTime(NaN)).toBe("00:00");
      expect(formatTime(Number.POSITIVE_INFINITY)).toBe("00:00");
    });
  });

  describe("getInitialHookPosition", () => {
    it("returns hookStartSec if positive number", () => {
      expect(getInitialHookPosition(45)).toBe(45);
      expect(getInitialHookPosition(12.5)).toBe(12.5);
    });

    it("falls back to 0 when hookStartSec is 0, negative, undefined or NaN", () => {
      expect(getInitialHookPosition(0)).toBe(0);
      expect(getInitialHookPosition(-15)).toBe(0);
      expect(getInitialHookPosition(undefined)).toBe(0);
      expect(getInitialHookPosition(null as unknown as number)).toBe(0);
      expect(getInitialHookPosition(NaN)).toBe(0);
    });
  });

  describe("clampSeekTime", () => {
    it("keeps time as is when within valid range", () => {
      expect(clampSeekTime(50, 180)).toBe(50);
      expect(clampSeekTime(0, 180)).toBe(0);
      expect(clampSeekTime(180, 180)).toBe(180);
    });

    it("clamps negative time to 0", () => {
      expect(clampSeekTime(-5, 180)).toBe(0);
      expect(clampSeekTime(NaN, 180)).toBe(0);
    });

    it("clamps time exceeding duration to duration", () => {
      expect(clampSeekTime(250, 200)).toBe(200);
      expect(clampSeekTime(15, 10)).toBe(10);
    });

    it("handles zero or NaN duration safely", () => {
      expect(clampSeekTime(10, 0)).toBe(0);
      expect(clampSeekTime(10, NaN)).toBe(0);
    });
  });

  describe("getVinylAnimationClass", () => {
    it("returns empty string when audio is playing so vinyl spins normally", () => {
      expect(getVinylAnimationClass(true)).toBe("");
    });

    it("returns paused class when audio is paused to freeze vinyl rotation in place", () => {
      expect(getVinylAnimationClass(false)).toBe("[animation-play-state:paused]");
    });
  });
});
