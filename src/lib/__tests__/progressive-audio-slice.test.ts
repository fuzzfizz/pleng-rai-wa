// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Progressive Audio Slice Unit Tests
// Tests step definitions, point calculations, RoomStateStore step advancement & scoring
// ==========================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  PROGRESSIVE_SLICE_STEPS,
  getProgressiveStep,
  calculatePointsForSliceStep,
  getNextSliceStep,
} from "@/lib/audio-slice-utils";
import { RoomStateStore, calculateHintDeduction } from "@/lib/room-state-store";
import { DEFAULT_ROOM_SETTINGS } from "@/lib/services/room-service";
import type { Song, RoomSettings } from "@/types";

const MOCK_SONG: Song = {
  id: "song-progressive-001",
  title: "คุกกี้เสี่ยงทาย",
  artist: "BNK48",
  aliases: ["Koisuru Fortune Cookie", "คุ๊กกี้เสี่ยงทาย"],
  releaseYear: 2017,
  genreId: "t-pop",
  era: "2010s",
  audioUrl: "https://example.com/audio/fortune-cookie.mp3",
  hookStartSec: 45,
  hookEndSec: 65,
  durationSec: 240,
  lyricsIntro: "แอบมองเธออยู่นะจ๊ะแต่เธอไม่รู้บ้างเลย",
  lyricsChorus: "เจ็บนิดเดียว เจ็บเหมือนมดกัดนิดเดียว",
  metadata: { album: "River" },
};

describe("Progressive Audio Slice - Constants & Utilities", () => {
  it("defines exactly 5 progressive slice steps with correct durations and points", () => {
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

  describe("getProgressiveStep", () => {
    it("returns correct config for valid step numbers (1 to 5)", () => {
      expect(getProgressiveStep(1).durationSec).toBe(0.1);
      expect(getProgressiveStep(1).points).toBe(100);

      expect(getProgressiveStep(2).durationSec).toBe(0.5);
      expect(getProgressiveStep(2).points).toBe(80);

      expect(getProgressiveStep(3).durationSec).toBe(1.0);
      expect(getProgressiveStep(3).points).toBe(60);

      expect(getProgressiveStep(4).durationSec).toBe(2.0);
      expect(getProgressiveStep(4).points).toBe(40);

      expect(getProgressiveStep(5).durationSec).toBe(4.0);
      expect(getProgressiveStep(5).points).toBe(20);
    });

    it("clamps step <= 0 to step 1", () => {
      expect(getProgressiveStep(0).step).toBe(1);
      expect(getProgressiveStep(-3).step).toBe(1);
      expect(getProgressiveStep(0).durationSec).toBe(0.1);
    });

    it("clamps step > 5 to step 5", () => {
      expect(getProgressiveStep(6).step).toBe(5);
      expect(getProgressiveStep(10).step).toBe(5);
      expect(getProgressiveStep(6).durationSec).toBe(4.0);
      expect(getProgressiveStep(6).points).toBe(20);
    });

    it("handles non-integer and NaN gracefully", () => {
      expect(getProgressiveStep(NaN).step).toBe(1);
      expect(getProgressiveStep(2.2).step).toBe(2);
      expect(getProgressiveStep(2.7).step).toBe(3);
    });
  });

  describe("getNextSliceStep", () => {
    it("returns next sequential step until max step", () => {
      expect(getNextSliceStep(1)?.step).toBe(2);
      expect(getNextSliceStep(2)?.step).toBe(3);
      expect(getNextSliceStep(3)?.step).toBe(4);
      expect(getNextSliceStep(4)?.step).toBe(5);
    });

    it("returns null when already at max step (step 5)", () => {
      expect(getNextSliceStep(5)).toBeNull();
      expect(getNextSliceStep(6)).toBeNull();
      expect(getNextSliceStep(99)).toBeNull();
    });

    it("handles values < 1 by returning step 2", () => {
      expect(getNextSliceStep(0)?.step).toBe(2);
      expect(getNextSliceStep(-1)?.step).toBe(2);
    });
  });

  describe("calculatePointsForSliceStep", () => {
    it("returns base points when no hint deductions are applied", () => {
      expect(calculatePointsForSliceStep(1)).toBe(100);
      expect(calculatePointsForSliceStep(2)).toBe(80);
      expect(calculatePointsForSliceStep(3)).toBe(60);
      expect(calculatePointsForSliceStep(4)).toBe(40);
      expect(calculatePointsForSliceStep(5)).toBe(20);
    });

    it("deducts hint costs from base points while honoring the minimum floor of 20", () => {
      // Step 1: 100 - 15 (genre) = 85
      expect(calculatePointsForSliceStep(1, 15)).toBe(85);

      // Step 2: 80 - 20 (year) = 60
      expect(calculatePointsForSliceStep(2, 20)).toBe(60);

      // Step 3: 60 - 35 (artist) = 25
      expect(calculatePointsForSliceStep(3, 35)).toBe(25);

      // Step 4: 40 - 35 (artist) = 5 -> clamped to 20 floor
      expect(calculatePointsForSliceStep(4, 35)).toBe(20);

      // Step 5: 20 - 15 = 5 -> clamped to 20 floor
      expect(calculatePointsForSliceStep(5, 15)).toBe(20);

      // Extreme deduction
      expect(calculatePointsForSliceStep(1, 999)).toBe(20);
    });

    it("ignores negative or undefined hint deduction", () => {
      expect(calculatePointsForSliceStep(1, undefined)).toBe(100);
      expect(calculatePointsForSliceStep(1, -10)).toBe(100);
    });
  });
});

describe("Progressive Audio Slice - RoomStateStore Integration", () => {
  const ROOM_CODE = "PROG_TEST";
  const PLAYER_1 = "player-alpha";
  const PLAYER_2 = "player-beta";

  beforeEach(() => {
    RoomStateStore.clearAll();
  });

  it("DEFAULT_ROOM_SETTINGS specifies sliceType: progressive", () => {
    expect(DEFAULT_ROOM_SETTINGS.sliceType).toBe("progressive");
    expect(DEFAULT_ROOM_SETTINGS.gameMode).toBe("audio-slice");
  });

  it("initRound initializes playerSliceSteps as empty object and roomSliceStep as 1", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
    };

    const state = RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);
    expect(state.playerSliceSteps).toEqual({});
    expect(state.roomSliceStep).toBe(1);
  });

  it("advancePlayerSliceStep advances player step incrementally up to 5 and clamps", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
    };
    RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);

    // Initial state: player is implicitly at step 1
    // 1st advance -> step 2 (0.5s, 80 pts)
    const adv1 = RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    expect(adv1).toEqual({
      success: true,
      step: 2,
      durationSec: 0.5,
      points: 80,
    });
    expect(RoomStateStore.getRoomRoundState(ROOM_CODE)?.playerSliceSteps?.[PLAYER_1]).toBe(2);

    // 2nd advance -> step 3 (1.0s, 60 pts)
    const adv2 = RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    expect(adv2).toEqual({
      success: true,
      step: 3,
      durationSec: 1.0,
      points: 60,
    });

    // 3rd advance -> step 4 (2.0s, 40 pts)
    const adv3 = RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    expect(adv3).toEqual({
      success: true,
      step: 4,
      durationSec: 2.0,
      points: 40,
    });

    // 4th advance -> step 5 (4.0s, 20 pts)
    const adv4 = RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    expect(adv4).toEqual({
      success: true,
      step: 5,
      durationSec: 4.0,
      points: 20,
    });

    // 5th advance -> already at step 5, cannot advance further
    const adv5 = RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    expect(adv5).toEqual({
      success: false,
      step: 5,
      durationSec: 4.0,
      points: 20,
    });
  });

  it("returns safe failure fallback when advancePlayerSliceStep is called for non-existent room", () => {
    const res = RoomStateStore.advancePlayerSliceStep("NON_EXISTENT", PLAYER_1);
    expect(res).toEqual({
      success: false,
      step: 1,
      durationSec: 0.1,
      points: 100,
    });
  });

  it("tracks steps independently per player in multiplayer rooms", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
    };
    RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);

    // Player 1 advances twice (to step 3)
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1); // -> 2
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1); // -> 3

    // Player 2 advances once (to step 2)
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_2); // -> 2

    const state = RoomStateStore.getRoomRoundState(ROOM_CODE);
    expect(state?.playerSliceSteps?.[PLAYER_1]).toBe(3);
    expect(state?.playerSliceSteps?.[PLAYER_2]).toBe(2);
    expect(state?.roomSliceStep).toBe(3); // tracks highest step
  });

  it("scales awarded score based on player progressive step when answering correctly", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
      answerResolutionMode: "race",
    };

    // Scenario A: Player answers at step 1 (0.1s) -> 100 points
    RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);
    const subStep1 = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย"
    );
    expect(subStep1.success).toBe(true);
    expect(subStep1.isCorrect).toBe(true);
    expect(subStep1.scoreDelta).toBe(100);
    expect(subStep1.newScore).toBe(100);

    // Scenario B: Player advances to step 2 (0.5s) -> 80 points
    RoomStateStore.initRound(ROOM_CODE, 2, MOCK_SONG, settings);
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1); // advance to step 2
    const subStep2 = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย"
    );
    expect(subStep2.scoreDelta).toBe(80);

    // Scenario C: Player advances to step 3 (1.0s) -> 60 points
    RoomStateStore.initRound(ROOM_CODE, 3, MOCK_SONG, settings);
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1); // step 2
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1); // step 3
    const subStep3 = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย"
    );
    expect(subStep3.scoreDelta).toBe(60);

    // Scenario D: Player advances to step 5 (4.0s) -> 20 points
    RoomStateStore.initRound(ROOM_CODE, 4, MOCK_SONG, settings);
    for (let i = 0; i < 4; i++) {
      RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    }
    const subStep5 = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย"
    );
    expect(subStep5.scoreDelta).toBe(20);
  });

  it("scales awarded score with hints in progressive slice mode", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
      answerResolutionMode: "race",
    };
    RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);

    // Player advances to step 2 (base points 80)
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);

    // Reveal genre hint (-15 pts)
    RoomStateStore.revealNextHint(ROOM_CODE, PLAYER_1, "genre");

    const submitRes = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย"
    );

    expect(submitRes.success).toBe(true);
    expect(submitRes.isCorrect).toBe(true);
    // Base 80 - 15 (genre) = 65 points
    expect(submitRes.scoreDelta).toBe(65);
  });

  it("supports wait_all resolution mode in progressive slice mode", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
      answerResolutionMode: "wait_all",
    };
    RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);

    // Player 1 at step 3 (60 pts)
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1);

    // Player 2 at step 1 (100 pts)
    const subP1 = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย",
      { totalPlayers: 2 }
    );
    expect(subP1.isCorrect).toBe(true);
    expect(subP1.scoreDelta).toBe(60);

    const subP2 = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_2,
      "Player 2",
      "คุกกี้เสี่ยงทาย",
      { totalPlayers: 2 }
    );
    expect(subP2.isCorrect).toBe(true);
    expect(subP2.scoreDelta).toBe(100);
  });

  it("preserves backwards compatibility when sliceType is 'fixed'", () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "fixed",
      sliceDurationSec: 5.0,
      answerResolutionMode: "race",
    };
    RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);

    // Even if playerSliceSteps had an entry, fixed mode always uses 100 base points
    const submitRes = RoomStateStore.submitAnswer(
      ROOM_CODE,
      PLAYER_1,
      "Player 1",
      "คุกกี้เสี่ยงทาย"
    );

    expect(submitRes.success).toBe(true);
    expect(submitRes.isCorrect).toBe(true);
    expect(submitRes.scoreDelta).toBe(100);
  });

  it("serializes and rehydrates playerSliceSteps and roomSliceStep accurately", async () => {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "audio-slice",
      sliceType: "progressive",
    };
    const state = RoomStateStore.initRound(ROOM_CODE, 1, MOCK_SONG, settings);
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_1); // step 2
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_2); // step 2
    RoomStateStore.advancePlayerSliceStep(ROOM_CODE, PLAYER_2); // step 3

    const serialized = RoomStateStore.serializeRoundState(state);
    expect(serialized.playerSliceSteps).toEqual({
      [PLAYER_1]: 2,
      [PLAYER_2]: 3,
    });
    expect(serialized.roomSliceStep).toBe(3);

    // Clear in-memory state and rehydrate via ensureRoundState
    RoomStateStore.clearAll();
    const fakeDbRoom = {
      code: ROOM_CODE,
      status: "question_active",
      settings: {
        ...settings,
        round_state: serialized,
      },
      current_song_id: MOCK_SONG.id,
      songs: MOCK_SONG,
    };

    const rehydrated = await RoomStateStore.ensureRoundState(ROOM_CODE, fakeDbRoom, MOCK_SONG);
    expect(rehydrated).toBeDefined();
    expect(rehydrated?.playerSliceSteps).toEqual({
      [PLAYER_1]: 2,
      [PLAYER_2]: 3,
    });
    expect(rehydrated?.roomSliceStep).toBe(3);
  });
});
