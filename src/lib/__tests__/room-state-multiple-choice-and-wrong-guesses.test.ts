import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateStore } from "../room-state-store";
import type { Song, RoomSettings } from "@/types";

describe("RoomStateStore - Multiple Choice, Max Wrong Guesses, and Skip", () => {
  const dummySong: Song = {
    id: "song-123",
    title: "รักแรก",
    artist: "NONT TANONT",
    aliases: ["First Love"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
  };

  const defaultSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "multiple-choice",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    maxWrongGuesses: 2,
  };

  const roomCode = "TEST99";

  beforeEach(() => {
    RoomStateStore.initRound(roomCode, 1, dummySong, defaultSettings, {
      choices: [
        { id: "choice_0", title: "รักแรก", artist: "NONT TANONT" },
        { id: "choice_1", title: "โต๊ะริม", artist: "NONT TANONT" },
        { id: "choice_2", title: "พิง", artist: "NONT TANONT" },
        { id: "choice_3", title: "วันนั้นฝนก็ตกแบบนี้แหละ", artist: "MEAN" },
      ],
    });
  });

  it("allows guessing again when player wrong guesses are below maxWrongGuesses", () => {
    // Attempt 1: wrong guess
    const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "โต๊ะริม", {
      gameMode: "audio-slice",
      roomSettings: defaultSettings,
      totalPlayers: 2,
    });

    expect(res1.success).toBe(true);
    expect(res1.isCorrect).toBe(false);
    const state1 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state1?.excludedPlayerIds.includes("p1")).toBe(false);
    expect(state1?.playerWrongCounts["p1"]).toBe(1);

    // Attempt 2: wrong guess (reaches maxWrongGuesses = 2)
    const res2 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "พิง", {
      gameMode: "audio-slice",
      roomSettings: defaultSettings,
      totalPlayers: 2,
    });

    expect(res2.success).toBe(true);
    expect(res2.isCorrect).toBe(false);
    const state2 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state2?.excludedPlayerIds.includes("p1")).toBe(true);
    expect(state2?.playerWrongCounts["p1"]).toBe(2);

    // Attempt 3: rejected because excluded
    const res3 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "รักแรก", {
      gameMode: "audio-slice",
      roomSettings: defaultSettings,
      totalPlayers: 2,
    });
    expect(res3.success).toBe(false);
    expect(res3.reason).toBe("already_guessed_wrong");
  });

  it("never excludes players when maxWrongGuesses is 0 (unlimited)", () => {
    const unlimitedSettings: RoomSettings = {
      ...defaultSettings,
      maxWrongGuesses: 0,
    };
    RoomStateStore.initRound(roomCode, 1, dummySong, unlimitedSettings);

    for (let i = 0; i < 5; i++) {
      const res = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", `ผิดครั้งที่ ${i}`, {
        gameMode: "audio-slice",
        roomSettings: unlimitedSettings,
        totalPlayers: 2,
      });
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
    }

    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state?.excludedPlayerIds.includes("p1")).toBe(false);
    expect(state?.playerWrongCounts["p1"]).toBe(5);
  });

  it("supports Option 1C multi-attempt in buzzer mode: buzzer releases on wrong answer, excludes only after maxWrongGuesses exhausted", () => {
    const buzzerSettings: RoomSettings = {
      ...defaultSettings,
      gameMode: "buzzer",
      maxWrongGuesses: 2,
    };
    RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);

    // Attempt 1: Player 1 buzzes and answers wrong
    const buzzRes1 = RoomStateStore.buzz(roomCode, "p1", "Player 1");
    expect(buzzRes1.success).toBe(true);

    const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบผิด 1", {
      gameMode: "buzzer",
      roomSettings: buzzerSettings,
      totalPlayers: 2,
    });

    expect(res1.isCorrect).toBe(false);
    expect(res1.canRetry).toBe(true);
    expect(res1.remainingAttempts).toBe(1);

    const state1 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state1?.buzzedPlayerId).toBeNull(); // Buzzer unlocked
    expect(state1?.excludedPlayerIds.includes("p1")).toBe(false); // Not excluded yet
    expect(state1?.roundStatus).toBe("question_active");

    // Attempt 2: Player 1 buzzes again and answers wrong (reaches maxWrongGuesses = 2)
    const buzzRes2 = RoomStateStore.buzz(roomCode, "p1", "Player 1");
    expect(buzzRes2.success).toBe(true);

    const res2 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "คำตอบผิด 2", {
      gameMode: "buzzer",
      roomSettings: buzzerSettings,
      totalPlayers: 2,
    });

    expect(res2.isCorrect).toBe(false);
    expect(res2.canRetry).toBe(false);
    expect(res2.remainingAttempts).toBe(0);

    const state2 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state2?.buzzedPlayerId).toBeNull();
    expect(state2?.excludedPlayerIds.includes("p1")).toBe(true); // Excluded now

    // Attempt 3: Player 1 tries to buzz again -> rejected
    const buzzRes3 = RoomStateStore.buzz(roomCode, "p1", "Player 1");
    expect(buzzRes3.success).toBe(false);
    expect(buzzRes3.reason).toBe("already_guessed_wrong");
  });

  it("reveals round when all players exhaust their attempts in buzzer mode", () => {
    const buzzerSettings: RoomSettings = {
      ...defaultSettings,
      gameMode: "buzzer",
      maxWrongGuesses: 1,
    };
    RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);

    // Player 1 buzzes and answers wrong -> excluded
    RoomStateStore.buzz(roomCode, "p1", "Player 1");
    const res1 = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "ผิด 1", {
      gameMode: "buzzer",
      roomSettings: buzzerSettings,
      totalPlayers: 2,
    });
    expect(res1.canRetry).toBe(false);
    const state1 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state1?.roundStatus).toBe("question_active"); // Player 2 still available

    // Player 2 buzzes and answers wrong -> all excluded -> reveals
    RoomStateStore.buzz(roomCode, "p2", "Player 2");
    const res2 = RoomStateStore.submitAnswer(roomCode, "p2", "Player 2", "ผิด 2", {
      gameMode: "buzzer",
      roomSettings: buzzerSettings,
      totalPlayers: 2,
    });
    expect(res2.canRetry).toBe(false);
    const state2 = RoomStateStore.getRoomRoundState(roomCode);
    expect(state2?.roundStatus).toBe("revealing");
    expect(state2?.winnerPlayerId).toBeNull();
  });

  it("handles timeoutBuzzer with multi-attempts correctly", () => {
    const buzzerSettings: RoomSettings = {
      ...defaultSettings,
      gameMode: "buzzer",
      maxWrongGuesses: 2,
    };
    RoomStateStore.initRound(roomCode, 1, dummySong, buzzerSettings);

    RoomStateStore.buzz(roomCode, "p1", "Player 1");
    const timeoutRes = RoomStateStore.timeoutBuzzer(roomCode, "p1", {
      roomSettings: buzzerSettings,
      totalPlayers: 2,
    });

    expect(timeoutRes.success).toBe(true);
    expect(timeoutRes.canRetry).toBe(true);
    expect(timeoutRes.remainingAttempts).toBe(1);

    const state = RoomStateStore.getRoomRoundState(roomCode);
    expect(state?.buzzedPlayerId).toBeNull();
    expect(state?.excludedPlayerIds.includes("p1")).toBe(false);
    expect(state?.roundStatus).toBe("question_active");

    // Player 1 can buzz again after timeout
    const reBuzz = RoomStateStore.buzz(roomCode, "p1", "Player 1");
    expect(reBuzz.success).toBe(true);
  });

  it("skips round and transitions to revealing with winner null when skipRound is called", () => {
    const skipRes = RoomStateStore.skipRound(roomCode);
    expect(skipRes.success).toBe(true);
    expect(skipRes.roundState?.roundStatus).toBe("revealing");
    expect(skipRes.roundState?.winnerPlayerId).toBeNull();
    expect(skipRes.roundState?.roundWinnerPlayerId).toBeNull();
    expect(skipRes.fullSong?.id).toBe("song-123");
  });
});
