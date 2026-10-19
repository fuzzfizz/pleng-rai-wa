import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateStore } from "../room-state-store";
import { formatWrongGuessMessage } from "@/components/room/wrong-guess-banner";
import { formatRoundWinnerAnnouncement } from "@/components/room/round-reveal-card";
import type { Song, RoomSettings } from "@/types";

describe("Items 4, 5, 6 - Timer Sync, Wrong Guess Banner & Hint Score Sync", () => {
  const dummySong: Song = {
    id: "song-test-1",
    title: "วาฬเกยตื้น",
    artist: "GUNGUN",
    aliases: ["Whale"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
    releaseYear: 2019,
    era: "2010s",
    genre: { id: "indie", slug: "indie", nameTh: "อินดี้", nameEn: "Indie" },
  };

  const baseSettings: RoomSettings = {
    gameMode: "buzzer",
    answerInputMode: "free-text",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
    maxWrongGuesses: 1,
    playerCount: 2,
  };

  const roomCode = "SYNC123";

  beforeEach(() => {
    RoomStateStore.clearAll();
  });

  // ==========================================
  // Item 5: Wrong Guess Banner Message & Timeout
  // ==========================================
  describe("Item 5: Wrong Guess Banner Message Formatting", () => {
    it("formats timeout message for current player when displayName is 'คุณ'", () => {
      const msg = formatWrongGuessMessage({
        displayName: "คุณ",
        answerText: "(หมดเวลา)",
        reason: "buzzer_timeout",
      });
      expect(msg).toBe("⏰ คุณตอบไม่ทัน (หมดเวลา)!");
    });

    it("formats timeout message for current player when currentPlayerId matches", () => {
      const msg = formatWrongGuessMessage(
        {
          playerId: "my-id",
          displayName: "นายเอก",
          answerText: "(หมดเวลา)",
          reason: "buzzer_timeout",
        },
        "my-id"
      );
      expect(msg).toBe("⏰ คุณตอบไม่ทัน (หมดเวลา)!");
    });

    it("formats timeout message for other players with their display name", () => {
      const msg = formatWrongGuessMessage(
        {
          playerId: "other-id",
          displayName: "สมรักษ์",
          answerText: "(หมดเวลา)",
          reason: "buzzer_timeout",
        },
        "my-id"
      );
      expect(msg).toBe("⏰ สมรักษ์ ตอบไม่ทัน (หมดเวลา)!");
    });

    it("detects timeout via answerText 'หมดเวลา' without parentheses", () => {
      const msg = formatWrongGuessMessage({
        displayName: "ปลาวาฬ",
        answerText: "หมดเวลา",
      });
      expect(msg).toBe("⏰ ปลาวาฬ ตอบไม่ทัน (หมดเวลา)!");
    });

    it("formats normal wrong guesses correctly without clock emoji", () => {
      const msg = formatWrongGuessMessage({
        displayName: "ปลาทอง",
        answerText: "เพลงรัก",
      });
      expect(msg).toBe("❌ ปลาทอง ตอบว่า 'เพลงรัก' (ยังไม่ใช่!)");
    });
  });

  // ==========================================
  // Item 6: Answer timer accuracy & Grace Period
  // ==========================================
  describe("Item 6: Answer timer accuracy & Grace Period", () => {
    it("sets buzzDeadline aligned with roundTimeoutSec from room settings", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, {
        ...baseSettings,
        roundTimeoutSec: 15,
      });

      const buzzResult = RoomStateStore.hitBuzzer(roomCode, "p1", "Player 1");
      expect(buzzResult.success).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.buzzDeadline).toBeDefined();

      const deadlineMs = new Date(state!.buzzDeadline!).getTime();
      const buzzedAtMs = new Date(state!.buzzedAt!).getTime();
      // Should be roughly 15000 ms difference (±200ms)
      expect(deadlineMs - buzzedAtMs).toBeGreaterThanOrEqual(14800);
      expect(deadlineMs - buzzedAtMs).toBeLessThanOrEqual(15200);
    });

    it("defaults buzzDeadline to 10s if roundTimeoutSec is 0 or unset", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, {
        ...baseSettings,
        roundTimeoutSec: 0,
      });

      RoomStateStore.hitBuzzer(roomCode, "p1", "Player 1");
      const state = RoomStateStore.getRoomRoundState(roomCode);

      const deadlineMs = new Date(state!.buzzDeadline!).getTime();
      const buzzedAtMs = new Date(state!.buzzedAt!).getTime();
      expect(deadlineMs - buzzedAtMs).toBeGreaterThanOrEqual(9800);
      expect(deadlineMs - buzzedAtMs).toBeLessThanOrEqual(10200);
    });

    it("allows submitting within the 1.2s network grace period past buzzDeadline", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);
      RoomStateStore.hitBuzzer(roomCode, "p1", "Player 1");

      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      // Set deadline to 500ms in the past (expired by 500ms, but within 1200ms grace period)
      state.buzzDeadline = new Date(Date.now() - 500).toISOString();

      const result = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "วาฬเกยตื้น");
      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(result.reason).not.toBe("buzzer_timeout");
    });

    it("rejects answer with buzzer_timeout when submitting beyond 1.2s past buzzDeadline", () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);
      RoomStateStore.hitBuzzer(roomCode, "p1", "Player 1");

      const state = RoomStateStore.getRoomRoundState(roomCode)!;
      // Set deadline to 1500ms in the past (exceeds 1200ms grace period)
      state.buzzDeadline = new Date(Date.now() - 1500).toISOString();

      const result = RoomStateStore.submitAnswer(roomCode, "p1", "Player 1", "วาฬเกยตื้น");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("buzzer_timeout");
      expect(result.scoreDelta).toBe(0);
    });
  });

  // ==========================================
  // Item 4: Hint State Sync & Score Calculation
  // ==========================================
  describe("Item 4: Hint State Sync in ensureRoundState & Winner Reveal Score", () => {
    it("syncs playerHintLevels, revealedHintLevel, and revealedHints into existing active round", async () => {
      RoomStateStore.initRound(roomCode, 1, dummySong, baseSettings);

      const mockRoom: any = {
        code: roomCode,
        status: "question_active",
        current_song_id: dummySong.id,
        current_round: 1,
        settings: {
          round_state: {
            currentSong: dummySong,
            currentRound: 1,
            roundStatus: "question_active",
            playerHintLevels: { p1: 2, p2: 1 },
            revealedHintLevel: 2,
            revealedHints: { genre: "อินดี้", year: "2019" },
            scores: { p1: 50, p2: 75 },
          },
        },
      };

      const synced = await RoomStateStore.ensureRoundState(roomCode, mockRoom);
      expect(synced).toBeDefined();
      expect(synced!.playerHintLevels?.p1).toBe(2);
      expect(synced!.playerHintLevels?.p2).toBe(1);
      expect(synced!.revealedHintLevel).toBe(2);
      expect(synced!.revealedHints?.genre).toBe("อินดี้");
      expect(synced!.revealedHints?.year).toBe("2019");
    });

    it("formats winner announcement preserving reduced scoreDelta from hint deductions", () => {
      const winnerWithHint = {
        playerId: "p1",
        displayName: "สายฟ้า",
        answerText: "วาฬเกยตื้น",
        scoreDelta: 50, // 2 hints used -> 50 points
      };

      const announcement = formatRoundWinnerAnnouncement(winnerWithHint);
      expect(announcement).toBe("🎉 สายฟ้า ตอบถูก! (+50 คะแนน)");

      const winnerSingleFromMulti = [
        {
          playerId: "p2",
          displayName: "สายหมอก",
          scoreDelta: 75, // 1 hint used -> 75 points
        },
      ];
      const singleMultiAnnouncement = formatRoundWinnerAnnouncement(null, winnerSingleFromMulti);
      expect(singleMultiAnnouncement).toBe("🎉 สายหมอก ตอบถูก! (+75 คะแนน)");
    });
  });
});
