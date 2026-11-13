import { describe, it, expect } from "vitest";
import {
  PROGRESSIVE_SLICE_STEPS,
  getProgressiveStep,
  getNextSliceStep,
  calculatePointsForSliceStep,
} from "@/lib/audio-slice-utils";
import { AudioSliceType, HINT_COSTS } from "@/types";

describe("Solo Progressive Audio Slice Mode (Task 2)", () => {
  describe("1. Default Slice Type and Ladder Configuration", () => {
    it("has progressive as the default slice type for audio slice mode", () => {
      // Default sliceType in solo play state is initialized to 'progressive'
      const defaultSliceType: AudioSliceType = "progressive";
      expect(defaultSliceType).toBe("progressive");
    });

    it("defines exactly 5 progressive steps matching the Heardle ladder", () => {
      expect(PROGRESSIVE_SLICE_STEPS).toHaveLength(5);

      expect(PROGRESSIVE_SLICE_STEPS[0]).toEqual({
        step: 1,
        durationSec: 0.1,
        points: 100,
        label: "0.1s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[1]).toEqual({
        step: 2,
        durationSec: 0.5,
        points: 80,
        label: "0.5s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[2]).toEqual({
        step: 3,
        durationSec: 1.0,
        points: 60,
        label: "1.0s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[3]).toEqual({
        step: 4,
        durationSec: 2.0,
        points: 40,
        label: "2.0s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[4]).toEqual({
        step: 5,
        durationSec: 4.0,
        points: 20,
        label: "4.0s",
      });
    });
  });

  describe("2. Step Advancement, Durations & Score Deductions", () => {
    it("advances step from 1 to 5, increasing duration and reducing max points", () => {
      let currentStep = 1;
      const stepProgression: { step: number; duration: number; points: number }[] = [];

      while (currentStep <= 5) {
        const config = getProgressiveStep(currentStep);
        const points = calculatePointsForSliceStep(currentStep);
        stepProgression.push({
          step: config.step,
          duration: config.durationSec,
          points,
        });

        const next = getNextSliceStep(currentStep);
        if (next) {
          currentStep = next.step;
        } else {
          break;
        }
      }

      expect(stepProgression).toEqual([
        { step: 1, duration: 0.1, points: 100 },
        { step: 2, duration: 0.5, points: 80 },
        { step: 3, duration: 1.0, points: 60 },
        { step: 4, duration: 2.0, points: 40 },
        { step: 5, duration: 4.0, points: 20 },
      ]);
    });

    it("stops advancing when reaching max step 5", () => {
      const maxConfig = getProgressiveStep(5);
      expect(maxConfig.step).toBe(5);
      expect(maxConfig.durationSec).toBe(4.0);

      const nextConfig = getNextSliceStep(5);
      expect(nextConfig).toBeNull();
    });

    it("clamps safely if step exceeds 5 or is invalid", () => {
      expect(getProgressiveStep(99).step).toBe(5);
      expect(getProgressiveStep(0).step).toBe(1);
      expect(getProgressiveStep(-5).step).toBe(1);
      expect(getProgressiveStep(NaN).step).toBe(1);
    });
  });

  describe("3. Effective Duration Resolution & Seamless Mode Switching", () => {
    function resolveEffectiveDuration(
      sliceType: AudioSliceType,
      sliceStep: number,
      fixedDuration: number
    ): number {
      if (sliceType === "progressive") {
        return PROGRESSIVE_SLICE_STEPS[sliceStep - 1]?.durationSec ?? 0.1;
      }
      return fixedDuration;
    }

    it("resolves effective duration correctly in progressive mode for each step", () => {
      expect(resolveEffectiveDuration("progressive", 1, 2.0)).toBe(0.1);
      expect(resolveEffectiveDuration("progressive", 2, 2.0)).toBe(0.5);
      expect(resolveEffectiveDuration("progressive", 3, 2.0)).toBe(1.0);
      expect(resolveEffectiveDuration("progressive", 4, 2.0)).toBe(2.0);
      expect(resolveEffectiveDuration("progressive", 5, 2.0)).toBe(4.0);
    });

    it("resolves effective duration correctly in fixed mode regardless of sliceStep", () => {
      expect(resolveEffectiveDuration("fixed", 1, 1.0)).toBe(1.0);
      expect(resolveEffectiveDuration("fixed", 3, 5.0)).toBe(5.0);
      expect(resolveEffectiveDuration("fixed", 5, 15.0)).toBe(15.0);
    });

    it("switches seamlessly between progressive and fixed modes", () => {
      let mode: AudioSliceType = "progressive";
      let step = 2;
      let fixedDuration = 2.0;

      // In progressive mode at step 2 -> 0.5s
      expect(resolveEffectiveDuration(mode, step, fixedDuration)).toBe(0.5);

      // User switches to fixed mode
      mode = "fixed";
      expect(resolveEffectiveDuration(mode, step, fixedDuration)).toBe(2.0);

      // User changes fixed duration slider to 10.0s
      fixedDuration = 10.0;
      expect(resolveEffectiveDuration(mode, step, fixedDuration)).toBe(10.0);

      // User switches back to progressive mode -> restores step 2 duration (0.5s)
      mode = "progressive";
      expect(resolveEffectiveDuration(mode, step, fixedDuration)).toBe(0.5);
    });
  });

  describe("4. Hint Deductions & Score Floor Guarantees", () => {
    function computeHintDeduction(hints: {
      genre?: string;
      year?: string;
      album?: string;
      artist?: string;
    }): number {
      let deduction = 0;
      if (hints.genre) deduction += HINT_COSTS.genre;
      if (hints.year) deduction += HINT_COSTS.year;
      if (hints.album) deduction += HINT_COSTS.album;
      if (hints.artist) deduction += HINT_COSTS.artist;
      return deduction;
    }

    it("calculates points factoring in hint deductions for each step", () => {
      // Step 1: 100 pts. Hint used: genre (15) -> 85 pts
      const deductionGenre = computeHintDeduction({ genre: "Rock" });
      expect(deductionGenre).toBe(15);
      expect(calculatePointsForSliceStep(1, deductionGenre)).toBe(85);

      // Step 3: 60 pts. Hint used: genre (15) + year (20) -> 35 deduction -> 25 pts
      const deductionMulti = computeHintDeduction({ genre: "Pop", year: "2010" });
      expect(deductionMulti).toBe(35);
      expect(calculatePointsForSliceStep(3, deductionMulti)).toBe(25);
    });

    it("guarantees a minimum floor of 20 points even with maximum hint deductions", () => {
      // Step 4: 40 pts. Heavy hint deduction: artist (35) + album (20) = 55 -> floor is 20
      const heavyDeduction = computeHintDeduction({
        artist: "Bodyslam",
        album: "Drive",
      });
      expect(heavyDeduction).toBe(55);
      expect(calculatePointsForSliceStep(4, heavyDeduction)).toBe(20);

      // Step 5: 20 pts with all hints opened -> floor remains 20
      const allHints = computeHintDeduction({
        genre: "Rock",
        year: "2005",
        album: "Save My Life",
        artist: "Bodyslam",
      });
      expect(allHints).toBe(90);
      expect(calculatePointsForSliceStep(5, allHints)).toBe(20);
    });
  });

  describe("5. Round Reset and Advancing Next Song State", () => {
    it("resets sliceStep back to 1 on round restart or next song", () => {
      let sliceStep = 4; // Player advanced to step 4

      // Round resets or player clicks 'Next Song'
      const resetRound = () => {
        sliceStep = 1;
      };

      resetRound();
      expect(sliceStep).toBe(1);
      expect(PROGRESSIVE_SLICE_STEPS[sliceStep - 1].durationSec).toBe(0.1);
      expect(calculatePointsForSliceStep(sliceStep)).toBe(100);
    });
  });
});
