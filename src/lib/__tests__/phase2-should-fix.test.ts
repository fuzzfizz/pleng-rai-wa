import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import type { Song, RoomSettings } from "@/types";

const mockSong1: Song = {
  id: "song-1",
  title: "วัดใจ",
  artist: "Silly Fools",
  aliases: ["wat jai"],
  releaseYear: 2004,
  era: "2000s",
  genre: { id: "g1", nameTh: "ร็อก", nameEn: "Rock", slug: "rock" },
  audioUrl: "https://example.com/song1.mp3",
  hookStartSec: 68,
  hookEndSec: 94,
  durationSec: 260,
};

const mockSong2: Song = {
  id: "song-2",
  title: "ซ่อนกลิ่น",
  artist: "Palmy",
  aliases: ["son klin"],
  releaseYear: 2018,
  era: "2010s",
  genre: { id: "g2", nameTh: "ป็อป", nameEn: "Pop", slug: "pop" },
  audioUrl: "https://example.com/song2.mp3",
  hookStartSec: 50,
  hookEndSec: 80,
  durationSec: 240,
};

const defaultSettings: RoomSettings = {
  gameMode: "audio-slice",
  answerInputMode: "autocomplete",
  lyricsType: "intro",
  voiceGender: "female",
  sliceDurationSec: 2.0,
  roundTimeoutSec: 15,
  totalRounds: 5,
  targetScore: 0,
  playerCount: 2,
};

describe("Phase 2 should fix.md Core Fixes", () => {
  const ROOM_CODE = "TESTFIX";

  beforeEach(() => {
    RoomStateStore.resetRoom(ROOM_CODE);
  });

  describe("Item 5: Song Integrity & Serverless Rehydration", () => {
    it("serializes currentSong directly into roundState and rehydrates accurately", async () => {
      // Initialize round with mockSong1
      const roundState = RoomStateStore.initRound(
        ROOM_CODE,
        1,
        mockSong1,
        defaultSettings,
        { totalRounds: 5 }
      );

      // Serialize
      const serialized = RoomStateStore.serializeRoundState(roundState);
      expect(serialized.currentSong).toBeDefined();
      expect(serialized.currentSong.title).toBe("วัดใจ");
      expect(serialized.currentSong.artist).toBe("Silly Fools");

      // Clear memory to simulate serverless cold start / fresh container
      RoomStateStore.resetRoom(ROOM_CODE);
      expect(RoomStateStore.getRoomRoundState(ROOM_CODE)).toBeUndefined();

      // Rehydrate via ensureRoundState with dbRoundState containing serialized currentSong
      const rehydrated = await RoomStateStore.ensureRoundState(ROOM_CODE, {
        code: ROOM_CODE,
        status: "question_active",
        current_round: 1,
        round_state: serialized,
      });

      expect(rehydrated).toBeDefined();
      expect(rehydrated?.currentSong).toBeDefined();
      expect(rehydrated?.currentSong?.title).toBe("วัดใจ");
      expect(rehydrated?.currentSong?.artist).toBe("Silly Fools");
      expect(rehydrated?.currentRound).toBe(1);
    });
  });

  describe("Item 3: Per-Player Isolated Hints and Scoring", () => {
    it("isolates hints per player and scores answers accordingly without cross-player penalties", () => {
      RoomStateStore.initRound(
        ROOM_CODE,
        1,
        mockSong1,
        defaultSettings,
        { totalRounds: 5 }
      );

      // Player A requests hint (level 1: genre)
      const hintA1 = RoomStateStore.revealNextHint(ROOM_CODE, "player-A");
      expect(hintA1.success).toBe(true);
      expect(hintA1.level).toBe(1);
      expect(hintA1.hintType).toBe("genre");
      expect(hintA1.hintText).toBe("ร็อก");

      // Player A requests second hint (level 2: year)
      const hintA2 = RoomStateStore.revealNextHint(ROOM_CODE, "player-A");
      expect(hintA2.success).toBe(true);
      expect(hintA2.level).toBe(2);

      // Player B requests no hints! (level 0)
      // Player C requests 1 hint (level 1)
      const hintC1 = RoomStateStore.revealNextHint(ROOM_CODE, "player-C");
      expect(hintC1.level).toBe(1);

      const state = RoomStateStore.getRoomRoundState(ROOM_CODE)!;
      expect(state.playerHintLevels?.["player-A"]).toBe(2);
      expect(state.playerHintLevels?.["player-C"]).toBe(1);
      expect(state.playerHintLevels?.["player-B"]).toBeUndefined();

      expect(state.playerHints?.["player-A"]?.genre).toBe("ร็อก");
      expect(state.playerHints?.["player-A"]?.year).toBeDefined();
      expect(state.playerHints?.["player-C"]?.genre).toBe("ร็อก");
      expect(state.playerHints?.["player-B"]).toBeUndefined();

      // Test Player B scoring (0 hints -> 100 pts)
      const resB = RoomStateStore.submitAnswer(
        ROOM_CODE,
        "player-B",
        "Bob",
        "วัดใจ"
      );
      expect(resB.isCorrect).toBe(true);
      expect(resB.scoreDelta).toBe(100);

      // Reset round to test Player A scoring (2 hints -> 50 pts)
      RoomStateStore.initRound(
        ROOM_CODE,
        2,
        mockSong1,
        defaultSettings,
        { totalRounds: 5 }
      );
      RoomStateStore.revealNextHint(ROOM_CODE, "player-A");
      RoomStateStore.revealNextHint(ROOM_CODE, "player-A");

      const resA = RoomStateStore.submitAnswer(
        ROOM_CODE,
        "player-A",
        "Alice",
        "วัดใจ"
      );
      expect(resA.isCorrect).toBe(true);
      expect(resA.scoreDelta).toBe(50);
    });
  });

  describe("Item 4 & Item 6: Neutral Surrender and Deadlock Prevention", () => {
    it("surrenders player with 0 penalty, does not add (ยอมแพ้) to wrong guesses, and reveals round when all players surrender", () => {
      RoomStateStore.initRound(
        ROOM_CODE,
        1,
        mockSong1,
        defaultSettings,
        { totalRounds: 5 }
      );

      const state = RoomStateStore.getRoomRoundState(ROOM_CODE)!;
      state.scores = { "p-alice": 100, "p-bob": 50 };

      // Alice surrenders
      const surrender1 = RoomStateStore.surrenderPlayer(
        ROOM_CODE,
        "p-alice",
        "Alice",
        { totalPlayers: 2 }
      );

      expect(surrender1.success).toBe(true);
      expect(surrender1.allExcluded).toBe(false);
      expect(state.roundStatus).toBe("question_active");
      expect(state.excludedPlayerIds).toContain("p-alice");
      // Score NOT penalized
      expect(state.scores["p-alice"]).toBe(100);
      // No "(ยอมแพ้)" in wrong guesses
      expect(state.wrongGuesses.some((g) => g.answerText === "(ยอมแพ้)")).toBe(false);

      // Bob surrenders (now all 2 players are excluded)
      const surrender2 = RoomStateStore.surrenderPlayer(
        ROOM_CODE,
        "p-bob",
        "Bob",
        { totalPlayers: 2 }
      );

      expect(surrender2.success).toBe(true);
      expect(surrender2.allExcluded).toBe(true);
      // Room auto-transitions to revealing with no winner
      expect(state.roundStatus).toBe("revealing");
      expect(state.winnerPlayerId).toBeNull();
      expect(state.scores["p-bob"]).toBe(50);
    });

    it("releases buzzer when buzzed player surrenders", () => {
      RoomStateStore.initRound(
        ROOM_CODE,
        1,
        mockSong1,
        defaultSettings,
        { totalRounds: 2 }
      );

      // Alice buzzes
      RoomStateStore.buzz(ROOM_CODE, "p-alice", "Alice");
      const state = RoomStateStore.getRoomRoundState(ROOM_CODE)!;
      expect(state.roundStatus).toBe("buzzed");
      expect(state.buzzedPlayerId).toBe("p-alice");

      // Alice decides to surrender
      const surrenderRes = RoomStateStore.surrenderPlayer(
        ROOM_CODE,
        "p-alice",
        "Alice",
        { totalPlayers: 2 }
      );

      expect(surrenderRes.success).toBe(true);
      expect(state.buzzedPlayerId).toBeNull();
      // Since 1 of 2 players surrendered, roundStatus returns to question_active for remaining player
      expect(state.roundStatus).toBe("question_active");
      expect(state.excludedPlayerIds).toContain("p-alice");
    });
  });

  describe("Item 7: Completed Rounds & Play Again Reset", () => {
    it("resets room round state cleanly on resetRoom / playAgain", () => {
      RoomStateStore.initRound(
        ROOM_CODE,
        5,
        mockSong2,
        defaultSettings,
        { totalRounds: 5 }
      );

      const state = RoomStateStore.getRoomRoundState(ROOM_CODE)!;
      expect(state.currentRound).toBe(5);

      // Simulate game over
      RoomStateStore.setGameOver(ROOM_CODE);
      expect(state.roundStatus).toBe("game_over");

      // Host triggers play again -> resets room
      RoomStateStore.resetRoom(ROOM_CODE);
      expect(RoomStateStore.getRoomRoundState(ROOM_CODE)).toBeUndefined();

      // Fresh round 1 starts
      const newRound = RoomStateStore.initRound(
        ROOM_CODE,
        1,
        mockSong1,
        defaultSettings,
        { totalRounds: 5 }
      );
      expect(newRound.currentRound).toBe(1);
      expect(newRound.roundStatus).toBe("question_active");
      expect(newRound.excludedPlayerIds).toEqual([]);
    });
  });
});
