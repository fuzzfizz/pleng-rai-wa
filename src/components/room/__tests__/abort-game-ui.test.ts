import { describe, it, expect, vi } from "vitest";
import {
  shouldShowReturnToLobbyButton,
  getAbortModalTexts,
  executeResetToLobby,
} from "../game-view";
import {
  createInitialRoomRealtimeState,
  reduceRoomRealtimeEvent,
} from "@/hooks/use-room-realtime";

describe("Abort Game & Return to Lobby UI Logic", () => {
  describe("shouldShowReturnToLobbyButton", () => {
    it("returns true only for host players", () => {
      expect(shouldShowReturnToLobbyButton(true)).toBe(true);
    });

    it("returns false for regular players and undefined/null", () => {
      expect(shouldShowReturnToLobbyButton(false)).toBe(false);
      expect(shouldShowReturnToLobbyButton(undefined as any)).toBe(false);
      expect(shouldShowReturnToLobbyButton(null as any)).toBe(false);
    });
  });

  describe("getAbortModalTexts", () => {
    it("returns accurate Thai modal copy matching requirements", () => {
      const texts = getAbortModalTexts();
      expect(texts.title).toBe("ยกเลิกเกมและกลับสู่ล็อบบี้?");
      expect(texts.description).toContain(
        "คุณต้องการยกเลิกเกมรอบนี้และพาทุกคนกลับไปที่หน้า Lobby หรือไม่?"
      );
      expect(texts.description).toContain("(คะแนนในรอบปัจจุบันจะถูกรีเซ็ต)");
      expect(texts.cancelLabel).toBe("เล่นต่อ");
      expect(texts.confirmLabel).toBe("ยืนยันกลับล็อบบี้");
    });
  });

  describe("executeResetToLobby", () => {
    it("successfully delegates to resetToLobby function", async () => {
      const mockResetFn = vi.fn().mockResolvedValue({ success: true });
      const result = await executeResetToLobby(mockResetFn);

      expect(mockResetFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("returns error object when reset handler is not provided", async () => {
      const result = await executeResetToLobby(undefined);
      expect(result.success).toBe(false);
      expect(result.error).toBe("no_reset_handler");
    });
  });

  describe("useRoomRealtime Reducer - room_state transition to lobby", () => {
    it("cleans up active round state and transitions status to lobby cleanly", () => {
      const state = createInitialRoomRealtimeState("ROOM99", {
        id: "p1",
        displayName: "Host Player",
        isHost: true,
        score: 150,
      });

      // Simulate being in an active question with buzz & wrong guesses
      state.status = "question_active";
      state.currentRound = 4;
      state.totalRounds = 10;
      state.activeQuestion = {
        sliceUrl: "https://example.com/slice.mp3",
        durationSec: 2.0,
      };
      state.buzzedPlayer = {
        id: "p2",
        displayName: "Player 2",
        buzzedAt: new Date().toISOString(),
      };
      state.isMyBuzz = false;
      state.isExcludedFromBuzz = true;
      state.wrongGuesses = [
        {
          playerId: "p1",
          displayName: "Host Player",
          answerText: "ผิด",
        },
      ];
      state.lastWrongGuess = {
        playerId: "p1",
        displayName: "Host Player",
        answerText: "ผิด",
      };
      state.isAudioPlaying = true;
      state.revealedHints = { level: 2 };
      state.playerHintLevels = { p1: 2 };
      state.scores = { p1: 150, p2: 100 };
      state.players = [
        {
          id: "p1",
          displayName: "Host Player",
          isHost: true,
          isReady: true,
          score: 150,
          sessionToken: "p1",
          lastSeenAt: new Date().toISOString(),
        },
        {
          id: "p2",
          displayName: "Player 2",
          isHost: false,
          isReady: true,
          score: 100,
          sessionToken: "p2",
          lastSeenAt: new Date().toISOString(),
        },
      ];
      state.room = {
        id: "room-id",
        room_code: "ROOM99",
        host_player_id: "p1",
        status: "question_active",
        settings: {} as any,
        current_song_id: "song-1",
        played_song_ids: ["song-1"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Dispatch room_state event with status: "lobby"
      const nextState = reduceRoomRealtimeEvent(
        state,
        {
          type: "broadcast",
          event: "room_state",
          payload: {
            status: "lobby",
            round: 0,
            scores: {},
          },
        },
        { playSounds: false }
      );

      // Verify all gameplay artifacts are cleared
      expect(nextState.status).toBe("lobby");
      expect(nextState.currentRound).toBe(0);
      expect(nextState.activeQuestion).toBeNull();
      expect(nextState.buzzedPlayer).toBeNull();
      expect(nextState.isMyBuzz).toBe(false);
      expect(nextState.isExcludedFromBuzz).toBe(false);
      expect(nextState.wrongGuesses).toEqual([]);
      expect(nextState.lastWrongGuess).toBeNull();
      expect(nextState.revealedSong).toBeNull();
      expect(nextState.roundWinner).toBeNull();
      expect(nextState.isAudioPlaying).toBe(false);
      expect(nextState.revealedHints).toEqual({ level: 0 });
      expect(nextState.playerHintLevels).toEqual({});

      // Verify scores are reset
      expect(nextState.scores).toEqual({ p1: 0, p2: 0 });
      expect(nextState.myPlayer?.score).toBe(0);

      // Verify room object is reset to lobby
      expect(nextState.room?.status).toBe("lobby");
      expect(nextState.room?.played_song_ids).toEqual([]);
      expect(nextState.room?.current_song_id).toBeNull();
    });
  });
});
