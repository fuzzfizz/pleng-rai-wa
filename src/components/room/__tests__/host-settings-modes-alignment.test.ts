import { describe, it, expect } from "vitest";
import { formatSettingsSummary } from "../lobby-view";
import { prepareSettingsPayload } from "../host-settings-modal";
import type { RoomSettings } from "@/types";

describe("Host Settings & Lobby Modes Alignment", () => {
  const baseSettings: RoomSettings = {
    gameMode: "audio-slice",
    roundTimeoutSec: 15,
    totalRounds: 10,
    sliceDurationSec: 2,
    lyricsType: "chorus",
    voiceGender: "female",
    answerInputMode: "autocomplete",
    answerResolutionMode: "race",
    maxWrongGuesses: 1,
    targetScore: 100,
    playlistId: undefined,
    genreId: undefined,
  };

  describe("formatSettingsSummary", () => {
    it("formats audio-slice with race resolution as unlimited time", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        gameMode: "audio-slice",
        answerResolutionMode: "race",
      });

      expect(summary).toContain("โหมด: ตัดเสียงเสี้ยววินาที");
      expect(summary).toContain("ไม่จำกัดเวลา (แย่งกันตอบ)");
      expect(summary).not.toContain("15 วินาที");
    });

    it("formats audio-slice with wait_all resolution as unlimited time waiting for all", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        gameMode: "audio-slice",
        answerResolutionMode: "wait_all",
      });

      expect(summary).toContain("โหมด: ตัดเสียงเสี้ยววินาที");
      expect(summary).toContain("ไม่จำกัดเวลา (รอตอบครบทุกคน)");
    });

    it("formats ai-lyrics mode as unlimited time", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        gameMode: "ai-lyrics",
        lyricsType: "chorus",
        answerResolutionMode: "race",
      });

      expect(summary).toContain("โหมด: AI อ่านเนื้อเพลง");
      expect(summary).toContain("ท่อนฮุก");
      expect(summary).toContain("ไม่จำกัดเวลา (แย่งกันตอบ)");
    });

    it("formats translated-lyrics mode as unlimited time", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        gameMode: "translated-lyrics",
        lyricsType: "intro",
        answerResolutionMode: "wait_all",
      });

      expect(summary).toContain("โหมด: แปลไทย-อังกฤษ");
      expect(summary).toContain("ท่อนเปิด");
      expect(summary).toContain("ไม่จำกัดเวลา (รอตอบครบทุกคน)");
    });

    it("formats buzzer mode with explicit round timeout seconds", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        gameMode: "buzzer",
        roundTimeoutSec: 20,
      });

      expect(summary).toContain("โหมด: แย่งกดกริ่ง");
      expect(summary).toContain("20 วินาที");
      expect(summary).not.toContain("ไม่จำกัดเวลา");
    });

    it("formats multiple-choice mode with explicit countdown round timeout seconds", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        gameMode: "audio-slice",
        answerInputMode: "multiple-choice",
        roundTimeoutSec: 15,
      });

      expect(summary).toContain("โหมด: ตัดเสียงเสี้ยววินาที");
      expect(summary).toContain("ตัวเลือก (ปรนัย)");
      expect(summary).toContain("15 วินาที");
      expect(summary).not.toContain("ไม่จำกัดเวลา");
    });
  });

  describe("prepareSettingsPayload - Resolution & Timing normalization", () => {
    it("preserves race answerResolutionMode", () => {
      const payload = prepareSettingsPayload({
        answerResolutionMode: "race",
      });
      expect(payload.answerResolutionMode).toBe("race");
    });

    it("preserves wait_all answerResolutionMode", () => {
      const payload = prepareSettingsPayload({
        answerResolutionMode: "wait_all",
      });
      expect(payload.answerResolutionMode).toBe("wait_all");
    });

    it("normalizes unknown answerResolutionMode to race", () => {
      const payload = prepareSettingsPayload({
        answerResolutionMode: "unknown_mode" as any,
      });
      expect(payload.answerResolutionMode).toBe("race");
    });

    it("preserves buzzer roundTimeoutSec", () => {
      const payload = prepareSettingsPayload({
        gameMode: "buzzer",
        roundTimeoutSec: 30,
      });
      expect(payload.roundTimeoutSec).toBe(30);
    });

    it("enforces maxWrongGuesses to 1 when buzzer mode is set with 0", () => {
      const payload = prepareSettingsPayload({
        gameMode: "buzzer",
        maxWrongGuesses: 0,
      });
      expect(payload.maxWrongGuesses).toBe(1);
    });

    it("enforces roundTimeoutSec to 15 when multiple-choice mode is set with 0 or undefined", () => {
      const payload1 = prepareSettingsPayload({
        answerInputMode: "multiple-choice",
        roundTimeoutSec: 0,
      });
      expect(payload1.roundTimeoutSec).toBe(15);

      const payload2 = prepareSettingsPayload({
        answerInputMode: "multiple-choice",
      });
      expect(payload2.roundTimeoutSec).toBe(15);
    });
  });
});
