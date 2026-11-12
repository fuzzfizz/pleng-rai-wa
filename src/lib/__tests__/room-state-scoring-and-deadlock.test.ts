import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateStore } from "../room-state-store";
import type { Song, RoomSettings } from "@/types";

describe("RoomStateStore - Hint Scoring & Deadlock Prevention", () => {
  const dummySong: Song = {
    id: "song-hint-test",
    title: "รักแท้",
    artist: "NuNew",
    aliases: ["True Love"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 40,
    hookEndSec: 60,
    releaseYear: 2022,
    era: "2020s",
    genre: { id: "pop", slug: "pop", nameTh: "ป็อป", nameEn: "Pop" },
  };

  const baseSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "free-text",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    maxWrongGuesses: 1,
    playerCount: 1,
  };

  const roomCode = "SCORE99";

  beforeEach(() => {
    RoomStateStore.clearAll();
  });

  describe("Hint Progressive Scoring", () => {
    it("awards 100 points when 0 hints are revealed", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแท้", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.scoreDelta).toBe(100);
      expect(res.newScore).toBe(100);
    });

    it("awards 85 points when 1 hint (genre) is revealed (-15 pts)", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);

      const hintRes = RoomStateStore.revealNextHint(roomCode, "p1");
      expect(hintRes.success).toBe(true);
      expect(hintRes.level).toBe(1);
      expect(hintRes.hintType).toBe("genre");
      expect(hintRes.pointsAvailable).toBe(85);

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแท้", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.scoreDelta).toBe(85);
      expect(res.newScore).toBe(85);
    });

    it("awards 65 points when 2 hints (genre + year) are revealed (-15, -20 pts)", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);

      RoomStateStore.revealNextHint(roomCode, "p1");
      const hintRes2 = RoomStateStore.revealNextHint(roomCode, "p1");
      expect(hintRes2.success).toBe(true);
      expect(hintRes2.level).toBe(2);
      expect(hintRes2.hintType).toBe("year");
      expect(hintRes2.pointsAvailable).toBe(65);

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแท้", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.scoreDelta).toBe(65);
      expect(res.newScore).toBe(65);
    });

    it("awards 30 points when 3 hints (genre + year + artist) are revealed (-15, -20, -35 pts)", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);

      RoomStateStore.revealNextHint(roomCode, "p1");
      RoomStateStore.revealNextHint(roomCode, "p1");
      const hintRes3 = RoomStateStore.revealNextHint(roomCode, "p1");
      expect(hintRes3.success).toBe(true);
      expect(hintRes3.level).toBe(3);
      expect(hintRes3.hintType).toBe("artist");
      expect(hintRes3.pointsAvailable).toBe(30);

      // Max hints clamped (dummySong has no album)
      const hintRes4 = RoomStateStore.revealNextHint(roomCode, "p1");
      expect(hintRes4.success).toBe(false);
      expect(hintRes4.level).toBe(3);

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแท้", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.scoreDelta).toBe(30);
      expect(res.newScore).toBe(30);
    });

    it("supports A La Carte specific hint selection and album support with 20-point minimum floor", () => {
      const songWithAlbum: Song = {
        ...dummySong,
        album: "Save My Life",
      };
      RoomStateStore.initRound(roomCode, 1, songWithAlbum, baseSettings);

      // Request Album hint directly: cost 20 -> 80 pts
      const albumHint = RoomStateStore.revealNextHint(roomCode, "p1", "album");
      expect(albumHint.success).toBe(true);
      expect(albumHint.hintType).toBe("album");
      expect(albumHint.hintText).toBe("Save My Life");
      expect(albumHint.pointsAvailable).toBe(80);

      // Request Artist hint: cost 35 -> 80 - 35 = 45 pts
      const artistHint = RoomStateStore.revealNextHint(roomCode, "p1", "artist");
      expect(artistHint.success).toBe(true);
      expect(artistHint.hintType).toBe("artist");
      expect(artistHint.pointsAvailable).toBe(45);

      // Request Year hint: cost 20 -> 45 - 20 = 25 pts
      const yearHint = RoomStateStore.revealNextHint(roomCode, "p1", "year");
      expect(yearHint.success).toBe(true);
      expect(yearHint.pointsAvailable).toBe(25);

      // Request Genre hint: cost 15 -> 25 - 15 = 10, clamped to guaranteed 20 pts floor!
      const genreHint = RoomStateStore.revealNextHint(roomCode, "p1", "genre");
      expect(genreHint.success).toBe(true);
      expect(genreHint.pointsAvailable).toBe(20);

      // Attempting to reveal already opened hint returns success: false
      const duplicateHint = RoomStateStore.revealNextHint(roomCode, "p1", "album");
      expect(duplicateHint.success).toBe(false);
      expect(duplicateHint.error).toBe("hint_already_revealed");

      // Answering correctly awards guaranteed 20 points
      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแท้", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
      });
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.scoreDelta).toBe(20);
      expect(res.newScore).toBe(20);
    });

    it("tracks hints per player independently", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, {
        ...baseSettings,
        playerCount: 2,
      });

      // Player 1 reveals 1 hint
      RoomStateStore.revealNextHint(roomCode, "p1");

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.playerHintLevels?.["p1"]).toBe(1);
      expect(state?.playerHintLevels?.["p2"]).toBeUndefined();

      // Player 2 submits correct answer without requesting hint -> should get 100 points
      const resP2 = RoomStateStore.submitAnswer(roomCode, "p2", "Player 2", "รักแท้", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
        totalPlayers: 2,
      });

      expect(resP2.success).toBe(true);
      expect(resP2.isCorrect).toBe(true);
      expect(resP2.scoreDelta).toBe(100);
      expect(resP2.newScore).toBe(100);
    });
  });

  describe("Deadlock Prevention on Max Wrong Guesses", () => {
    it("transitions to 'revealing' with no winner when single player answers wrong (even if totalPlayers option is undefined)", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, {
        ...baseSettings,
        playerCount: 1,
        maxWrongGuesses: 1,
      });

      // Player 1 submits wrong answer WITHOUT totalPlayers in options
      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบผิด", {
        gameMode: "audio-slice",
        roomSettings: {
          ...baseSettings,
          playerCount: 1,
          maxWrongGuesses: 1,
        },
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.roundStatus).toBe("revealing");
      expect(state?.winnerPlayerId).toBeNull();
      expect(state?.roundWinnerPlayerId).toBeNull();
      expect(state?.excludedPlayerIds).toContain("p1");
    });

    it("transitions to 'revealing' with no winner in multi-player room when all players are excluded", () => {
      const multiSettings: RoomSettings = {
        ...baseSettings,
        playerCount: 2,
        maxWrongGuesses: 1,
      };

      RoomStateStore.initRound(roomCode, 1, dummySong, multiSettings);

      // Player 1 answers wrong
      const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "ผิด 1", {
        gameMode: "audio-slice",
        roomSettings: multiSettings,
        totalPlayers: 2,
      });
      expect(res1.success).toBe(true);
      expect(res1.roundState?.roundStatus).toBe("question_active");

      // Player 2 answers wrong -> all excluded
      const res2 = RoomStateStore.submitAnswer(roomCode, "p2", "Player 2", "ผิด 2", {
        gameMode: "audio-slice",
        roomSettings: multiSettings,
        totalPlayers: 2,
      });
      expect(res2.success).toBe(true);
      expect(res2.roundState?.roundStatus).toBe("revealing");
      expect(res2.roundState?.winnerPlayerId).toBeNull();
      expect(res2.fullSong?.id).toBe("song-hint-test");
    });

    it("transitions to 'revealing' in buzzer mode when buzzer holder is excluded and totalPlayers reaches excluded count", () => {
      const buzzerSettings: RoomSettings = {
        ...baseSettings,
        gameMode: "buzzer",
        playerCount: 1,
      };

      RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);

      RoomStateStore.buzz(roomCode, "p1", "Player 1");

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "ผิดในบัสเซอร์", {
        gameMode: "buzzer",
        roomSettings: buzzerSettings,
        // options.totalPlayers omitted to test fallback
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.roundStatus).toBe("revealing");
      expect(state?.winnerPlayerId).toBeNull();
    });
  });

  describe("Party Mode Score Preservation Policy (No Wrong Guess Deductions)", () => {
    it("preserves player score (scoreDelta: 0) on wrong answer in race mode", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, {
        ...baseSettings,
        playerCount: 2,
        maxWrongGuesses: 2,
      });

      // Give player initial score of 100
      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      state.scores["p1"] = 100;

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบที่ผิด", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
        totalPlayers: 2,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
      expect(res.scoreDelta).toBe(0);
      expect(res.newScore).toBe(100);
      expect(state.scores["p1"]).toBe(100);
    });

    it("preserves player score (scoreDelta: 0) on wrong answer in wait_all mode", () => {
      const waitAllSettings: RoomSettings = {
        ...baseSettings,
        answerResolutionMode: "wait_all",
        playerCount: 2,
        maxWrongGuesses: 2,
      };

      RoomStateStore.initRound(roomCode, 1, dummySong, waitAllSettings);
      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      state.scores["p1"] = 100;

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบที่ผิด", {
        gameMode: "audio-slice",
        roomSettings: waitAllSettings,
        totalPlayers: 2,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
      expect(res.scoreDelta).toBe(0);
      expect(res.newScore).toBe(100);
      expect(state.scores["p1"]).toBe(100);
    });

    it("preserves player score (scoreDelta: 0) on wrong answer in buzzer mode", () => {
      const buzzerSettings: RoomSettings = {
        ...baseSettings,
        gameMode: "buzzer",
        playerCount: 2,
      };

      RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);
      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      state.scores["p1"] = 100;

      RoomStateStore.buzz(roomCode, "p1", "Player 1");

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบที่ผิด", {
        gameMode: "buzzer",
        roomSettings: buzzerSettings,
        totalPlayers: 2,
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
      expect(res.scoreDelta).toBe(0);
      expect(res.newScore).toBe(100);
      expect(state.scores["p1"]).toBe(100);
    });

    it("preserves player score (scoreDelta: 0) on timeoutBuzzer", () => {
      const buzzerSettings: RoomSettings = {
        ...baseSettings,
        gameMode: "buzzer",
        playerCount: 2,
      };

      RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);
      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      state.scores["p1"] = 100;

      RoomStateStore.buzz(roomCode, "p1", "Player 1");

      const res = RoomStateStore.timeoutBuzzer(roomCode, "p1");

      expect(res.success).toBe(true);
      expect(res.scoreDelta).toBe(0);
      expect(res.newScore).toBe(100);
      expect(state.scores["p1"]).toBe(100);
    });

    it("preserves player score (scoreDelta: 0) when buzzer deadline expires in submitAnswer", () => {
      const buzzerSettings: RoomSettings = {
        ...baseSettings,
        gameMode: "buzzer",
        playerCount: 2,
      };

      RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);
      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      state.scores["p1"] = 100;

      RoomStateStore.buzz(roomCode, "p1", "Player 1");
      state.buzzDeadline = new Date(Date.now() - 2000).toISOString();

      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบ", {
        gameMode: "buzzer",
        roomSettings: buzzerSettings,
        totalPlayers: 2,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toBe("buzzer_timeout");
      expect(res.scoreDelta).toBe(0);
      expect(res.newScore).toBe(100);
      expect(state.scores["p1"]).toBe(100);
    });
  });
});
