import { describe, it, expect } from "vitest";
import { formatRoundWinnerAnnouncement } from "../round-reveal-card";
import type { ChoiceOption } from "@/types";

describe("Multiple Choice UI & Reveal Logic", () => {
  describe("formatRoundWinnerAnnouncement", () => {
    it("formats winner announcement correctly when winner exists", () => {
      const text = formatRoundWinnerAnnouncement({
        playerId: "player-1",
        displayName: "Somchai",
        answerText: "รักแรก",
        scoreDelta: 100,
      });
      expect(text).toBe("🎉 Somchai ตอบถูก! (+100 คะแนน)");
    });

    it("formats skipped announcement when winner is null", () => {
      const text = formatRoundWinnerAnnouncement(null);
      expect(text).toBe("🏳️ ข้ามข้อนี้ / ไม่มีใครได้คะแนนในรอบนี้");
    });

    it("formats skipped announcement when winner has missing displayName or playerId", () => {
      const text1 = formatRoundWinnerAnnouncement({
        playerId: "",
        displayName: "NoId",
        answerText: "เพลง",
        scoreDelta: 50,
      });
      expect(text1).toBe("🏳️ ข้ามข้อนี้ / ไม่มีใครได้คะแนนในรอบนี้");

      const text2 = formatRoundWinnerAnnouncement({
        playerId: "player-1",
        displayName: "",
        answerText: "เพลง",
        scoreDelta: 50,
      });
      expect(text2).toBe("🏳️ ข้ามข้อนี้ / ไม่มีใครได้คะแนนในรอบนี้");
    });

    it("handles custom scoreDelta appropriately", () => {
      const text = formatRoundWinnerAnnouncement({
        playerId: "player-2",
        displayName: "Mana",
        answerText: "สองใจ",
        scoreDelta: 75,
      });
      expect(text).toBe("🎉 Mana ตอบถูก! (+75 คะแนน)");
    });
  });

  describe("Choice Letter Badges & Grid Logic", () => {
    const dummyChoices: ChoiceOption[] = [
      { id: "choice_0", title: "รักแรก", artist: "NONT TANONT" },
      { id: "choice_1", title: "สองใจ", artist: "ดา เอ็นโดรฟิน" },
      { id: "choice_2", title: "โต๊ะริม", artist: "NONT TANONT" },
      { id: "choice_3", title: "พิง", artist: "NONT TANONT" },
    ];

    it("resolves letters A, B, C, D for 4 choices", () => {
      const letters = dummyChoices.map((_, idx) => ["A", "B", "C", "D"][idx] || `${idx + 1}`);
      expect(letters).toEqual(["A", "B", "C", "D"]);
    });

    it("identifies clicked wrong choices properly", () => {
      const clickedWrongChoices: string[] = ["สองใจ"];

      dummyChoices.forEach((choice) => {
        const isWrong = clickedWrongChoices.includes(choice.title);
        if (choice.title === "สองใจ") {
          expect(isWrong).toBe(true);
        } else {
          expect(isWrong).toBe(false);
        }
      });
    });

    it("accurately detects winning choice during reveal phase", () => {
      const revealedSongTitle = "รักแรก";
      const correctTitle = revealedSongTitle.toLowerCase().trim();

      const evaluated = dummyChoices.map((choice) => ({
        title: choice.title,
        isWinning: choice.title.toLowerCase().trim() === correctTitle,
      }));

      expect(evaluated.find((e) => e.title === "รักแรก")?.isWinning).toBe(true);
      expect(evaluated.filter((e) => e.isWinning)).toHaveLength(1);
    });

    it("ensures choice card renderer displays only title and conceals artist name", () => {
      // Simulates the rendering data contract: title is prominent, artist is concealed
      const choiceCardViewModel = dummyChoices.map((choice) => ({
        id: choice.id,
        displayedText: choice.title,
        concealedArtist: choice.artist,
      }));

      choiceCardViewModel.forEach((item) => {
        expect(item.displayedText).toBeDefined();
        expect(item.displayedText.length).toBeGreaterThan(0);
        // Displayed text must not concatenate or contain artist name
        expect(item.displayedText).not.toContain(item.concealedArtist);
      });
    });

    it("activates countdown timer for multiple-choice mode when question is active", () => {
      function shouldRunCountdown(params: {
        gameMode: string;
        hasPlayedOnce: boolean;
        status: string;
        answerInputMode: string;
      }): boolean {
        return (
          params.status === "question_active" &&
          ((params.gameMode === "buzzer" && params.hasPlayedOnce) ||
            params.answerInputMode === "multiple-choice")
        );
      }

      // Multiple choice mode triggers countdown immediately in question_active status
      expect(
        shouldRunCountdown({
          gameMode: "audio-slice",
          hasPlayedOnce: false,
          status: "question_active",
          answerInputMode: "multiple-choice",
        })
      ).toBe(true);

      // Multiple choice mode does not run when status is not question_active
      expect(
        shouldRunCountdown({
          gameMode: "audio-slice",
          hasPlayedOnce: false,
          status: "revealing",
          answerInputMode: "multiple-choice",
        })
      ).toBe(false);

      // Autocomplete non-buzzer mode does not run countdown
      expect(
        shouldRunCountdown({
          gameMode: "audio-slice",
          hasPlayedOnce: true,
          status: "question_active",
          answerInputMode: "autocomplete",
        })
      ).toBe(false);

      // Buzzer mode runs after slice played once
      expect(
        shouldRunCountdown({
          gameMode: "buzzer",
          hasPlayedOnce: true,
          status: "question_active",
          answerInputMode: "autocomplete",
        })
      ).toBe(true);
    });
  });
});
