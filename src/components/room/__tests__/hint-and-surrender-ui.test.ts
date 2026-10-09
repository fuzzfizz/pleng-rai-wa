import { describe, it, expect, vi } from "vitest";
import {
  calculatePointsAvailable,
  resolvePlayerHintLevel,
  shouldShowHintButton,
  shouldShowSurrenderButton,
  getSurrenderButtonConfig,
  executeSurrender,
} from "../game-view";
import {
  createInitialRoomRealtimeState,
  reduceRoomRealtimeEvent,
} from "@/hooks/use-room-realtime";

describe("Hint and Surrender UI & State Logic", () => {
  describe("Points calculation per hint level", () => {
    it("returns 100 points for level 0 (no hints)", () => {
      expect(calculatePointsAvailable(0)).toBe(100);
    });

    it("returns 75 points for level 1 (genre revealed)", () => {
      expect(calculatePointsAvailable(1)).toBe(75);
    });

    it("returns 50 points for level 2 (year revealed)", () => {
      expect(calculatePointsAvailable(2)).toBe(50);
    });

    it("returns 25 points for level 3 (artist revealed)", () => {
      expect(calculatePointsAvailable(3)).toBe(25);
    });

    it("clamps negative levels to 100 and levels > 3 to 25", () => {
      expect(calculatePointsAvailable(-1)).toBe(100);
      expect(calculatePointsAvailable(4)).toBe(25);
    });
  });

  describe("resolvePlayerHintLevel", () => {
    it("returns the player's personal hint level when available in playerHintLevels", () => {
      const playerHintLevels = { "p-alice": 2, "p-bob": 1 };
      expect(resolvePlayerHintLevel("p-alice", playerHintLevels, 0)).toBe(2);
      expect(resolvePlayerHintLevel("p-bob", playerHintLevels, 0)).toBe(1);
    });

    it("falls back to room revealedHints level if player has no recorded level", () => {
      const playerHintLevels = { "p-alice": 2 };
      expect(resolvePlayerHintLevel("p-charlie", playerHintLevels, 1)).toBe(1);
    });

    it("defaults to 0 if neither player nor room has hint level", () => {
      expect(resolvePlayerHintLevel("p-david", undefined, undefined)).toBe(0);
    });
  });

  describe("Hint button visibility (shouldShowHintButton)", () => {
    it("allows non-host to view hint button when level < 3 in question_active status", () => {
      expect(shouldShowHintButton(0, "question_active")).toBe(true);
      expect(shouldShowHintButton(1, "question_active")).toBe(true);
      expect(shouldShowHintButton(2, "question_active")).toBe(true);
    });

    it("hides hint button when player has reached max hints (level >= 3)", () => {
      expect(shouldShowHintButton(3, "question_active")).toBe(false);
      expect(shouldShowHintButton(4, "question_active")).toBe(false);
    });

    it("hides hint button when game status is not question_active", () => {
      expect(shouldShowHintButton(0, "lobby")).toBe(false);
      expect(shouldShowHintButton(0, "buzzed")).toBe(false);
      expect(shouldShowHintButton(0, "revealing")).toBe(false);
      expect(shouldShowHintButton(0, "game_over")).toBe(false);
    });
  });

  describe("Surrender button config & visibility", () => {
    it("shows surrender button when status is question_active or buzzed", () => {
      expect(shouldShowSurrenderButton("question_active")).toBe(true);
      expect(shouldShowSurrenderButton("buzzed")).toBe(true);
      expect(shouldShowSurrenderButton("lobby")).toBe(false);
      expect(shouldShowSurrenderButton("revealing")).toBe(false);
    });

    it("configures host to skip round for the whole room", () => {
      const config = getSurrenderButtonConfig(true);
      expect(config.label).toBe("ข้ามข้อนี้ (ข้ามทั้งห้อง)");
      expect(config.actionType).toBe("skip_room");
    });

    it("configures non-host to surrender individually", () => {
      const config = getSurrenderButtonConfig(false);
      expect(config.label).toBe("ยอมแพ้ข้อนี้");
      expect(config.actionType).toBe("surrender_player");
    });
  });

  describe("executeSurrender handler", () => {
    it("invokes onSkipRound or skipRound when host triggers surrender", async () => {
      const onSkipRoundSpy = vi.fn().mockResolvedValue(true);
      const surrenderSpy = vi.fn().mockResolvedValue({ success: true });
      const skipRoundSpy = vi.fn().mockResolvedValue(true);

      const res = await executeSurrender({
        isHost: true,
        onSkipRound: onSkipRoundSpy,
        surrender: surrenderSpy,
        skipRound: skipRoundSpy,
      });

      expect(res).toEqual({ success: true });
      expect(onSkipRoundSpy).toHaveBeenCalledTimes(1);
      expect(surrenderSpy).not.toHaveBeenCalled();
    });

    it("invokes surrender callback when non-host triggers surrender", async () => {
      const onSkipRoundSpy = vi.fn().mockResolvedValue(true);
      const surrenderSpy = vi.fn().mockResolvedValue({ success: true });

      const res = await executeSurrender({
        isHost: false,
        onSkipRound: onSkipRoundSpy,
        surrender: surrenderSpy,
      });

      expect(res).toEqual({ success: true });
      expect(surrenderSpy).toHaveBeenCalledTimes(1);
      expect(onSkipRoundSpy).not.toHaveBeenCalled();
    });
  });

  describe("use-room-realtime playerHintLevels state updates", () => {
    it("updates playerHintLevels when hint_revealed broadcast is received", () => {
      const initialState = createInitialRoomRealtimeState("ROOM01", {
        id: "player-1",
        displayName: "Alice",
      });

      const stateWithHint1 = reduceRoomRealtimeEvent(initialState, {
        type: "broadcast",
        event: "hint_revealed",
        payload: {
          playerId: "player-1",
          level: 1,
          hintType: "genre",
          hintText: "Rock",
        },
      });

      expect(stateWithHint1.playerHintLevels?.["player-1"]).toBe(1);
      expect(stateWithHint1.revealedHints.genre).toBe("Rock");
      expect(stateWithHint1.revealedHints.level).toBe(1);

      // Another player asks for a hint at level 2
      const stateWithHint2 = reduceRoomRealtimeEvent(stateWithHint1, {
        type: "broadcast",
        event: "hint_revealed",
        payload: {
          playerId: "player-2",
          level: 2,
          hintType: "year",
          hintText: "2015",
        },
      });

      expect(stateWithHint2.playerHintLevels?.["player-1"]).toBe(1);
      expect(stateWithHint2.playerHintLevels?.["player-2"]).toBe(2);
      expect(stateWithHint2.revealedHints.year).toBe("2015");
      expect(stateWithHint2.revealedHints.level).toBe(2);
    });

    it("resets playerHintLevels on round_start", () => {
      const stateWithHints = {
        ...createInitialRoomRealtimeState("ROOM01", { id: "p1" }),
        playerHintLevels: { p1: 2, p2: 1 },
      };

      const nextRoundState = reduceRoomRealtimeEvent(stateWithHints, {
        type: "broadcast",
        event: "round_start",
        payload: {
          round: 2,
          totalRounds: 5,
        },
      });

      expect(nextRoundState.playerHintLevels).toEqual({});
      expect(nextRoundState.revealedHints).toEqual({ level: 0 });
    });
  });
});
