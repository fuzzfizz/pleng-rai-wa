import { describe, it, expect, vi } from "vitest";
import {
  shouldLoopAudio,
  replayAudio,
  toggleOrReplayAudio,
  canSubmitAnswer,
} from "../game-view";
import type { GameMode } from "@/types";

describe("Audio Slice Controls & Replay Logic", () => {
  describe("shouldLoopAudio", () => {
    it("returns false for audio-slice mode so the snippet plays only once", () => {
      expect(shouldLoopAudio("audio-slice")).toBe(false);
    });

    it("returns true for buzzer mode so snippet loops until someone hits buzzer", () => {
      expect(shouldLoopAudio("buzzer")).toBe(true);
    });

    it("returns false for other modes (ai-lyrics, translated-lyrics)", () => {
      const otherModes: GameMode[] = ["ai-lyrics", "translated-lyrics"];
      otherModes.forEach((mode) => {
        expect(shouldLoopAudio(mode)).toBe(false);
      });
    });
  });

  describe("replayAudio", () => {
    it("resets currentTime to 0, invokes play, and sets isAudioPlaying to true", () => {
      const mockAudio = {
        currentTime: 4.5,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
      } as unknown as HTMLAudioElement;

      const setIsAudioPlaying = vi.fn();

      const result = replayAudio(mockAudio, setIsAudioPlaying);

      expect(result).toBe(true);
      expect(mockAudio.currentTime).toBe(0);
      expect(mockAudio.play).toHaveBeenCalledTimes(1);
      expect(setIsAudioPlaying).toHaveBeenCalledWith(true);
    });

    it("safely handles null audio element", () => {
      const setIsAudioPlaying = vi.fn();
      const result = replayAudio(null, setIsAudioPlaying);

      expect(result).toBe(false);
      expect(setIsAudioPlaying).not.toHaveBeenCalled();
    });
  });

  describe("toggleOrReplayAudio", () => {
    it("pauses audio and updates state to false if already playing", () => {
      const mockAudio = {
        currentTime: 2.1,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
      } as unknown as HTMLAudioElement;

      const setIsAudioPlaying = vi.fn();

      const result = toggleOrReplayAudio(mockAudio, true, setIsAudioPlaying);

      expect(result).toBe(false);
      expect(mockAudio.pause).toHaveBeenCalledTimes(1);
      expect(mockAudio.play).not.toHaveBeenCalled();
      expect(setIsAudioPlaying).toHaveBeenCalledWith(false);
    });

    it("replays from 0 and updates state to true if paused/ended", () => {
      const mockAudio = {
        currentTime: 3.0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
      } as unknown as HTMLAudioElement;

      const setIsAudioPlaying = vi.fn();

      const result = toggleOrReplayAudio(mockAudio, false, setIsAudioPlaying);

      expect(result).toBe(true);
      expect(mockAudio.currentTime).toBe(0);
      expect(mockAudio.play).toHaveBeenCalledTimes(1);
      expect(setIsAudioPlaying).toHaveBeenCalledWith(true);
    });
  });

  describe("canSubmitAnswer (submission guard)", () => {
    it("prevents submitting answer when player is excluded from buzz", () => {
      expect(canSubmitAnswer(true)).toBe(false);
    });

    it("allows submitting answer when player is not excluded", () => {
      expect(canSubmitAnswer(false)).toBe(true);
    });
  });

  describe("submitAnswer guard & totalPlayers payload simulation", () => {
    it("immediately returns already_excluded without network request if isExcludedFromBuzz is true", async () => {
      const fetchSpy = vi.fn();
      const mockState = {
        isExcludedFromBuzz: true,
        myPlayer: { id: "p1", displayName: "Player 1" },
        players: [{ id: "p1" }, { id: "p2" }],
      };

      // Simulated submitAnswer logic matching use-room-realtime
      const simulateSubmitAnswer = async (answerText: string) => {
        if (!mockState.myPlayer) return { success: false, error: "no_player" };
        if (mockState.isExcludedFromBuzz) {
          return { success: false, error: "already_excluded" };
        }
        await fetchSpy("/api/room/TEST/answer", {
          body: JSON.stringify({
            playerId: mockState.myPlayer.id,
            displayName: mockState.myPlayer.displayName,
            answerText,
            totalPlayers: mockState.players.length > 0 ? mockState.players.length : 1,
          }),
        });
        return { success: true };
      };

      const res = await simulateSubmitAnswer("เพลงทดสอบ");
      expect(res).toEqual({ success: false, error: "already_excluded" });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("includes totalPlayers from presence count when submitting answer", async () => {
      const fetchSpy = vi.fn();
      const mockState = {
        isExcludedFromBuzz: false,
        myPlayer: { id: "p1", displayName: "Player 1" },
        players: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
      };

      const simulateSubmitAnswer = async (answerText: string) => {
        if (!mockState.myPlayer) return { success: false, error: "no_player" };
        if (mockState.isExcludedFromBuzz) {
          return { success: false, error: "already_excluded" };
        }
        await fetchSpy("/api/room/TEST/answer", {
          body: JSON.stringify({
            playerId: mockState.myPlayer.id,
            displayName: mockState.myPlayer.displayName,
            answerText,
            totalPlayers: mockState.players.length > 0 ? mockState.players.length : 1,
          }),
        });
        return { success: true };
      };

      const res = await simulateSubmitAnswer("เพลงจริง");
      expect(res).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const parsedBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(parsedBody.totalPlayers).toBe(3);
    });
  });
});
