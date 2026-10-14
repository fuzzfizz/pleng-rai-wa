import { describe, it, expect, vi } from "vitest";
import {
  formatTime,
  getInitialHookPosition,
  clampSeekTime,
  getVinylAnimationClass,
} from "@/components/room/round-reveal-card";

describe("Round Reveal Vinyl & Seek Helpers", () => {
  describe("formatTime", () => {
    it("formats 0 seconds as 00:00", () => {
      expect(formatTime(0)).toBe("00:00");
    });

    it("formats 65 seconds as 01:05", () => {
      expect(formatTime(65)).toBe("01:05");
    });

    it("formats 220 seconds as 03:40", () => {
      expect(formatTime(220)).toBe("03:40");
    });

    it("floors fractional seconds properly", () => {
      expect(formatTime(65.8)).toBe("01:05");
      expect(formatTime(0.4)).toBe("00:00");
    });

    it("handles negative numbers, NaN and invalid inputs gracefully", () => {
      expect(formatTime(-10)).toBe("00:00");
      expect(formatTime(NaN)).toBe("00:00");
      expect(formatTime(Number.POSITIVE_INFINITY)).toBe("00:00");
    });
  });

  describe("getInitialHookPosition", () => {
    it("returns hookStartSec if positive number", () => {
      expect(getInitialHookPosition(45)).toBe(45);
      expect(getInitialHookPosition(12.5)).toBe(12.5);
    });

    it("falls back to 0 when hookStartSec is 0, negative, undefined or NaN", () => {
      expect(getInitialHookPosition(0)).toBe(0);
      expect(getInitialHookPosition(-15)).toBe(0);
      expect(getInitialHookPosition(undefined)).toBe(0);
      expect(getInitialHookPosition(null as unknown as number)).toBe(0);
      expect(getInitialHookPosition(NaN)).toBe(0);
    });
  });

  describe("clampSeekTime", () => {
    it("keeps time as is when within valid range", () => {
      expect(clampSeekTime(50, 180)).toBe(50);
      expect(clampSeekTime(0, 180)).toBe(0);
      expect(clampSeekTime(180, 180)).toBe(180);
    });

    it("clamps negative time to 0", () => {
      expect(clampSeekTime(-5, 180)).toBe(0);
      expect(clampSeekTime(NaN, 180)).toBe(0);
    });

    it("clamps time exceeding duration to duration", () => {
      expect(clampSeekTime(250, 200)).toBe(200);
      expect(clampSeekTime(15, 10)).toBe(10);
    });

    it("handles zero or NaN duration safely", () => {
      expect(clampSeekTime(10, 0)).toBe(0);
      expect(clampSeekTime(10, NaN)).toBe(0);
    });
  });

  describe("getVinylAnimationClass", () => {
    it("returns empty string when audio is playing so vinyl spins normally", () => {
      expect(getVinylAnimationClass(true)).toBe("");
    });

    it("returns paused class when audio is paused to freeze vinyl rotation in place", () => {
      expect(getVinylAnimationClass(false)).toBe("[animation-play-state:paused]");
    });
  });

  describe("Item 4: Final Round Suspense Banner & Scoreboard Hiding", () => {
    it("checkIsLastRound correctly identifies final round", async () => {
      const { checkIsLastRound } = await import("@/components/room/round-reveal-card");
      expect(checkIsLastRound(5, 5)).toBe(true);
      expect(checkIsLastRound(6, 5)).toBe(true);
      expect(checkIsLastRound(3, 5)).toBe(false);
      expect(checkIsLastRound(1, 10)).toBe(false);
      expect(checkIsLastRound(undefined, 5)).toBe(false);
      expect(checkIsLastRound(5, undefined)).toBe(false);
      expect(checkIsLastRound(0, 0)).toBe(false);
    });

    it("renders suspense banner and hides mini-scoreboard when isLastRound is true", async () => {
      const { renderToString } = await import("react-dom/server");
      const React = await import("react");
      const {
        RoundRevealCard,
        LAST_ROUND_SUSPENSE_MESSAGE,
        LAST_ROUND_BUTTON_TEXT,
      } = await import("@/components/room/round-reveal-card");

      const players = [
        { id: "p1", displayName: "สมชาย", score: 500, isHost: true, isReady: true, sessionToken: "t1", lastSeenAt: "" },
        { id: "p2", displayName: "สมหญิง", score: 350, isHost: false, isReady: true, sessionToken: "t2", lastSeenAt: "" },
      ];

      // Final round: currentRound = 5, totalRounds = 5
      const htmlFinal = renderToString(
        React.createElement(RoundRevealCard, {
          song: { title: "เพลงสุดท้าย", artist: "ศิลปินเอก" },
          winner: null,
          players,
          isHost: true,
          onNextRound: async () => {},
          currentRound: 5,
          totalRounds: 5,
        })
      );

      // Verify mini-scoreboard is HIDDEN
      expect(htmlFinal).not.toContain("ตารางคะแนนล่าสุด (ใครกำลังนำอยู่)");
      // Verify suspense banner is DISPLAYED
      expect(htmlFinal).toContain(LAST_ROUND_SUSPENSE_MESSAGE);
      expect(htmlFinal).toContain("🏁 จบรอบสุดท้ายแล้ว! ไปลุ้นคะแนนสรุปและผู้ชนะบนแท่นรับรางวัลกัน");
      // Verify host button text is updated to podium button
      expect(htmlFinal).toContain("🏆 สรุปคะแนน &amp; ไปยังแท่นรับรางวัล");
    });

    it("renders mini-scoreboard and standard next round button when isLastRound is false", async () => {
      const { renderToString } = await import("react-dom/server");
      const React = await import("react");
      const {
        RoundRevealCard,
        LAST_ROUND_SUSPENSE_MESSAGE,
      } = await import("@/components/room/round-reveal-card");

      const players = [
        { id: "p1", displayName: "สมชาย", score: 500, isHost: true, isReady: true, sessionToken: "t1", lastSeenAt: "" },
        { id: "p2", displayName: "สมหญิง", score: 350, isHost: false, isReady: true, sessionToken: "t2", lastSeenAt: "" },
      ];

      // Intermediate round: currentRound = 2, totalRounds = 5
      const htmlIntermediate = renderToString(
        React.createElement(RoundRevealCard, {
          song: { title: "เพลงทั่วไป", artist: "ศิลปินทั่วไป" },
          winner: null,
          players,
          isHost: true,
          onNextRound: async () => {},
          currentRound: 2,
          totalRounds: 5,
        })
      );

      // Verify mini-scoreboard IS DISPLAYED
      expect(htmlIntermediate).toContain("ตารางคะแนนล่าสุด (ใครกำลังนำอยู่)");
      // Verify suspense banner is NOT DISPLAYED
      expect(htmlIntermediate).not.toContain(LAST_ROUND_SUSPENSE_MESSAGE);
      // Verify host button is standard next round button
      expect(htmlIntermediate).toContain("ข้อถัดไป (Next Round)");
    });

    it("TVView displays suspense banner and hides live scoreboard on final round revealing", async () => {
      const { renderToString } = await import("react-dom/server");
      const React = await import("react");
      const { TVView, TV_LAST_ROUND_SUSPENSE_MESSAGE } = await import("@/components/room/tv-view");

      const mockRoomRealtime = {
        roomCode: "TEST99",
        status: "revealing",
        currentRound: 5,
        totalRounds: 5,
        gameMode: "buzzer",
        activeQuestion: null,
        buzzedPlayer: null,
        revealedSong: { title: "เพลงตัดสิน", artist: "ศิลปินเอก" },
        roundWinner: { playerId: "p1", displayName: "แชมป์", answerText: "เพลงตัดสิน", scoreDelta: 100 },
        lastWrongGuess: null,
        players: [
          { id: "p1", displayName: "แชมป์", score: 800, isHost: true, isReady: true, sessionToken: "t1", lastSeenAt: "" },
          { id: "p2", displayName: "รองแชมป์", score: 600, isHost: false, isReady: true, sessionToken: "t2", lastSeenAt: "" },
        ],
        isHost: true,
        isMuted: false,
        isAudioPlaying: false,
        excludedPlayerIds: [],
        nextRound: vi.fn(),
        toggleMute: vi.fn(),
        room: { settings: { answerResolutionMode: "first_buzz", answerInputMode: "autocomplete" } },
      };

      const htmlTvFinal = renderToString(
        React.createElement(TVView, { roomRealtime: mockRoomRealtime as any })
      );

      // Verify TV reveal stage does NOT contain live rankings table
      expect(htmlTvFinal).not.toContain("อันดับคะแนนสด");
      // Verify TV reveal stage displays the final round suspense banner
      expect(htmlTvFinal).toContain(TV_LAST_ROUND_SUSPENSE_MESSAGE);
      expect(htmlTvFinal).toContain("🏁 จบรอบสุดท้ายแล้ว! กำลังเตรียมแท่นรับรางวัลและสรุปผู้ชนะ...");
      // Verify right sidebar scoreboard also shows suspense badge
      expect(htmlTvFinal).toContain("ซ่อนคะแนนรอบสุดท้าย");
    });

    it("TVView displays live scoreboard rankings when not the final round", async () => {
      const { renderToString } = await import("react-dom/server");
      const React = await import("react");
      const { TVView, TV_LAST_ROUND_SUSPENSE_MESSAGE } = await import("@/components/room/tv-view");

      const mockRoomRealtime = {
        roomCode: "TEST99",
        status: "revealing",
        currentRound: 2,
        totalRounds: 5,
        gameMode: "buzzer",
        activeQuestion: null,
        buzzedPlayer: null,
        revealedSong: { title: "เพลงทั่วไป", artist: "ศิลปินทั่วไป" },
        roundWinner: { playerId: "p1", displayName: "แชมป์", answerText: "เพลงทั่วไป", scoreDelta: 100 },
        lastWrongGuess: null,
        players: [
          { id: "p1", displayName: "แชมป์", score: 200, isHost: true, isReady: true, sessionToken: "t1", lastSeenAt: "" },
          { id: "p2", displayName: "รองแชมป์", score: 100, isHost: false, isReady: true, sessionToken: "t2", lastSeenAt: "" },
        ],
        isHost: true,
        isMuted: false,
        isAudioPlaying: false,
        excludedPlayerIds: [],
        nextRound: vi.fn(),
        toggleMute: vi.fn(),
        room: { settings: { answerResolutionMode: "first_buzz", answerInputMode: "autocomplete" } },
      };

      const htmlTvIntermediate = renderToString(
        React.createElement(TVView, { roomRealtime: mockRoomRealtime as any })
      );

      // Verify TV reveal stage displays live rankings
      expect(htmlTvIntermediate).toContain("อันดับคะแนนสด");
      // Verify TV reveal stage does NOT show final round suspense banner
      expect(htmlTvIntermediate).not.toContain(TV_LAST_ROUND_SUSPENSE_MESSAGE);
      expect(htmlTvIntermediate).not.toContain("ซ่อนคะแนนรอบสุดท้าย");
    });
  });
});
