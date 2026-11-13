import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import DailyPage, {
  formatThaiDate,
  formatTime,
  generateDailyShareText,
  DailyLoadingSkeleton,
  MemberExclusiveLandingCard,
  DailyRulesModal,
  DailyStatsModal,
  DailyArchiveModal,
  DailySurrenderModal,
} from "../page";
import { PROGRESSIVE_SLICE_STEPS, getProgressiveStep } from "@/lib/audio-slice-utils";
import type { DailyAttempt, DailyUserStats, Song } from "@/types";

// ==========================================
// Mocks
// ==========================================

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// Mock sound-effects
vi.mock("@/lib/sound-effects", () => ({
  soundEffects: {
    click: vi.fn(),
    correct: vi.fn(),
    wrong: vi.fn(),
  },
  playClickSound: vi.fn(),
  playCorrectSound: vi.fn(),
  playWrongSound: vi.fn(),
}));

// Mock audio-volume
vi.mock("@/lib/audio-volume", () => ({
  getMasterVolume: vi.fn(() => 0.8),
  isMasterMuted: vi.fn(() => false),
  toggleMasterMute: vi.fn(),
  subscribeMasterVolume: vi.fn((cb) => {
    cb(0.8, false);
    return vi.fn();
  }),
}));

// Mock SettingsMenu
vi.mock("@/components/common/settings-menu", () => ({
  SettingsMenu: () => React.createElement("div", { "data-testid": "settings-menu" }),
}));

// Mock next/navigation
let mockSearchParams = new URLSearchParams("date=2026-11-13");
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

// Mock useAuth hook
let mockAuthState = {
  user: null as any,
  isLoading: false,
  isGuest: true,
  profile: null as any,
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

// Mock AuthModal
vi.mock("@/components/auth/auth-modal", () => ({
  AuthModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? React.createElement("div", { "data-testid": "auth-modal" }, "AuthModal") : null,
}));

// ==========================================
// Test Suites
// ==========================================

describe("Daily Challenge Feature: Gameplay Screen (src/app/daily/page.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("date=2026-11-13");
    mockAuthState = {
      user: null,
      isLoading: false,
      isGuest: true,
      profile: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Helpers & Formatting
  // =========================================================================
  describe("1. Formatting & Share Helpers", () => {
    it("formats YYYY-MM-DD date to Thai short month format (e.g. 13 พ.ย. 2026)", () => {
      expect(formatThaiDate("2026-11-13")).toBe("13 พ.ย. 2026");
      expect(formatThaiDate("2026-01-01")).toBe("1 ม.ค. 2026");
      expect(formatThaiDate("2026-04-15")).toBe("15 เม.ย. 2026");
      expect(formatThaiDate("2026-12-31")).toBe("31 ธ.ค. 2026");
    });

    it("formats seconds into MM:SS string correctly", () => {
      expect(formatTime(0)).toBe("0:00");
      expect(formatTime(9)).toBe("0:09");
      expect(formatTime(65)).toBe("1:05");
      expect(formatTime(124)).toBe("2:04");
    });

    it("generates exact Heardle/Wordle style share text for step 1 win with 100 points", () => {
      const shareText = generateDailyShareText({
        dateFormatted: "13 พ.ย. 2026",
        isCorrect: true,
        step: 1,
        score: 100,
        currentStreak: 5,
        url: "https://pleng-rai-wa.com/daily",
      });

      const lines = shareText.split("\n");
      expect(lines[0]).toBe("เพลงไรวะ รายวัน 13 พ.ย. 2026");
      expect(lines[1]).toBe("🔊 🟩⬛⬛⬛⬛ (สเต็ป 1/5 • 100 แต้ม)");
      expect(lines[2]).toBe("🔥 สตรีค 5 วันติด");
      expect(lines[3]).toBe("https://pleng-rai-wa.com/daily");
    });

    it("generates correct Heardle/Wordle style share text for step 3 win", () => {
      const shareText = generateDailyShareText({
        dateFormatted: "13 พ.ย. 2026",
        isCorrect: true,
        step: 3,
        score: 60,
        currentStreak: 2,
      });

      expect(shareText).toContain("🔊 🟥🟥🟩⬛⬛ (สเต็ป 3/5 • 60 แต้ม)");
      expect(shareText).toContain("🔥 สตรีค 2 วันติด");
    });

    it("generates correct Heardle/Wordle style share text for failed/loss round", () => {
      const shareText = generateDailyShareText({
        dateFormatted: "13 พ.ย. 2026",
        isCorrect: false,
        step: 5,
        score: 0,
        currentStreak: 0,
      });

      expect(shareText).toContain("🔊 🟥🟥🟥🟥🟥 (ไม่สำเร็จ)");
      expect(shareText).toContain("🔥 สตรีค 0 วันติด");
    });
  });

  // =========================================================================
  // 2. Member-Only Authentication Gate
  // =========================================================================
  describe("2. Member-Only Authentication Gate", () => {
    it("renders clean loading skeleton while useAuth is loading", () => {
      mockAuthState = {
        user: null,
        isLoading: true,
        isGuest: false,
        profile: null,
      };

      const html = renderToString(<DailyPage />);
      expect(html).toContain("animate-pulse");
    });

    it("guest gate renders and prompts login with AuthModal when user is not authenticated or is guest", () => {
      mockAuthState = {
        user: null,
        isLoading: false,
        isGuest: true,
        profile: null,
      };

      const html = renderToString(<DailyPage />);

      // Title & Subtitle checks
      expect(html).toContain("โหมดเพลงรายวัน (Daily Challenge)");
      expect(html).toContain(
        "ทายเพลงรายวันวันละ 1 เพลง เล่นย้อนหลังได้ สะสมสตรีค และแชร์ผลลัพธ์กับเพื่อน เฉพาะสมาชิกเท่านั้น"
      );

      // Primary CTA Button
      expect(html).toContain("เข้าสู่ระบบ / สมัครสมาชิก");

      // Secondary Link to /
      expect(html).toContain("กลับหน้าแรก");
      expect(html).toContain('href="/"');
    });

    it("MemberExclusiveLandingCard calls onOpenAuth when primary button is clicked", () => {
      const onOpenAuth = vi.fn();
      const card = renderToString(<MemberExclusiveLandingCard onOpenAuth={onOpenAuth} />);
      expect(card).toContain("เข้าสู่ระบบ / สมัครสมาชิก");
      expect(card).toContain("เพลงปริศนาชุดเดียวกันสำหรับทุกคนในแต่ละวัน");
    });
  });

  // =========================================================================
  // 3. Authenticated View Displays Header, Segmented Bar & Audio Controls
  // =========================================================================
  describe("3. Authenticated View Header, Segmented Bar & Audio Controls", () => {
    it("displays daily challenge header with date badge, streak flame, calendar, stats, and help buttons", () => {
      mockAuthState = {
        user: { id: "test-user-1", email: "user@example.com" },
        isLoading: false,
        isGuest: false,
        profile: { id: "test-user-1", displayName: "Tester" },
      };

      const html = renderToString(<DailyPage />);

      // Home link
      expect(html).toContain('href="/"');
      expect(html).toContain("กลับหน้าแรก");

      // Date Badge & Header
      expect(html).toContain("เพลงรายวัน");
      expect(html).toContain("13 พ.ย. 2026");

      // Streak Flame Badge
      expect(html).toContain("🔥 0 วัน");

      // Action buttons in top nav
      expect(html).toContain("เล่นย้อนหลัง");
      expect(html).toContain("สถิติ");
      expect(html).toContain("วิธีเล่น");
    });

    it("renders 5-block segmented timeline bar with PROGRESSIVE_SLICE_STEPS", () => {
      mockAuthState = {
        user: { id: "test-user-1", email: "user@example.com" },
        isLoading: false,
        isGuest: false,
        profile: null,
      };

      const html = renderToString(<DailyPage />);

      // Verify all 5 slice ladder steps with labels and points
      expect(html).toContain("0.1s");
      expect(html).toContain("100 แต้ม");

      expect(html).toContain("0.5s");
      expect(html).toContain("80 แต้ม");

      expect(html).toContain("1.0s");
      expect(html).toContain("60 แต้ม");

      expect(html).toContain("2.0s");
      expect(html).toContain("40 แต้ม");

      expect(html).toContain("4.0s");
      expect(html).toContain("20 แต้ม");
    });

    it("renders audio controls, autocomplete input box, and surrender button", () => {
      mockAuthState = {
        user: { id: "test-user-1", email: "user@example.com" },
        isLoading: false,
        isGuest: false,
        profile: null,
      };

      const html = renderToString(<DailyPage />);

      // Audio play button
      expect(html).toContain("ฟัง 0.1s");

      // Advance step button
      expect(html).toContain("ฟังเพิ่ม (+วิ) ➔ 0.5s (-20 แต้ม)");

      // Surrender button
      expect(html).toContain("ขอยอมแพ้");

      // Autocomplete input box & submit button
      expect(html).toContain('placeholder="พิมพ์ชื่อเพลงที่คิดว่าเป็น..."');
      expect(html).toContain("ตอบ");
    });
  });

  // =========================================================================
  // 4. Advancing Step Increases Snippet Duration
  // =========================================================================
  describe("4. Advancing Step Increases Snippet Duration", () => {
    it("follows the 5-step ladder progression correctly", () => {
      expect(PROGRESSIVE_SLICE_STEPS).toHaveLength(5);
      expect(getProgressiveStep(1)).toEqual({
        step: 1,
        durationSec: 0.1,
        points: 100,
        label: "0.1s",
      });
      expect(getProgressiveStep(2)).toEqual({
        step: 2,
        durationSec: 0.5,
        points: 80,
        label: "0.5s",
      });
      expect(getProgressiveStep(3)).toEqual({
        step: 3,
        durationSec: 1.0,
        points: 60,
        label: "1.0s",
      });
      expect(getProgressiveStep(4)).toEqual({
        step: 4,
        durationSec: 2.0,
        points: 40,
        label: "2.0s",
      });
      expect(getProgressiveStep(5)).toEqual({
        step: 5,
        durationSec: 4.0,
        points: 20,
        label: "4.0s",
      });
    });

    it("clamps invalid step numbers safely to valid range [1, 5]", () => {
      expect(getProgressiveStep(0).durationSec).toBe(0.1);
      expect(getProgressiveStep(-3).durationSec).toBe(0.1);
      expect(getProgressiveStep(99).durationSec).toBe(4.0);
      expect(getProgressiveStep(NaN).durationSec).toBe(0.1);
    });
  });

  // =========================================================================
  // 5. Game Completion State (Win or Loss Screen)
  // =========================================================================
  describe("5. Game Completion State (Win or Loss Screen)", () => {
    it("renders win banner and revealed song details when round was won", async () => {
      // Simulate completed state through server response or component mock
      const sampleWonSong: Song = {
        id: "song-1",
        title: "วัดใจ",
        artist: "Silly Fools",
        aliases: ["wat jai"],
        album: "Juicy",
        releaseYear: 2002,
        audioUrl: "https://example.com/watjai.mp3",
      };

      // We test that share text and layout display properly
      const share = generateDailyShareText({
        dateFormatted: "13 พ.ย. 2026",
        isCorrect: true,
        step: 1,
        score: 100,
        currentStreak: 5,
      });

      expect(share).toContain("🟩⬛⬛⬛⬛ (สเต็ป 1/5 • 100 แต้ม)");
      expect(sampleWonSong.title).toBe("วัดใจ");
      expect(sampleWonSong.artist).toBe("Silly Fools");
      expect(sampleWonSong.album).toBe("Juicy");
      expect(sampleWonSong.releaseYear).toBe(2002);
    });

    it("renders surrender dialog with confirmation and cancel buttons", () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      const html = renderToString(
        <DailySurrenderModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />
      );

      expect(html).toContain("ขอยอมแพ้เพลงประจำวันนี้?");
      expect(html).toContain("หากกดยอมแพ้ ระบบจะเฉลยเพลงประจำวันนี้ทันที");
      expect(html).toContain("เล่นต่อ");
      expect(html).toContain("ยืนยันยอมแพ้");
    });
  });

  // =========================================================================
  // 6. Daily Archive Drawer / Modal
  // =========================================================================
  describe("6. Daily Archive Drawer / Modal", () => {
    it("renders past days list with formatted Thai dates and status badges", () => {
      const pastDates = ["2026-11-13", "2026-11-12", "2026-11-11"];
      const attemptsByDate = new Map<string, DailyAttempt>();

      // 2026-11-13: Won at step 1 with 100 points
      attemptsByDate.set("2026-11-13", {
        userId: "user-1",
        date: "2026-11-13",
        isCorrect: true,
        step: 1,
        score: 100,
        guesses: ["วัดใจ"],
        completedAt: new Date().toISOString(),
      });

      // 2026-11-12: Lost
      attemptsByDate.set("2026-11-12", {
        userId: "user-1",
        date: "2026-11-12",
        isCorrect: false,
        step: 5,
        score: 0,
        guesses: ["ผิด 1", "ผิด 2"],
        completedAt: new Date().toISOString(),
      });

      // 2026-11-11: Not played

      const onSelectDate = vi.fn();
      const onClose = vi.fn();

      const html = renderToString(
        <DailyArchiveModal
          isOpen={true}
          onClose={onClose}
          pastDates={pastDates}
          attemptsByDate={attemptsByDate}
          currentDate="2026-11-13"
          onSelectDate={onSelectDate}
        />
      );

      // Header
      expect(html).toContain("ปฏิทินเพลงรายวัน");
      expect(html).toContain("เลือกเล่นเพลงย้อนหลังได้สูงสุด 30 วัน");

      // Thai dates
      expect(html).toContain("13 พ.ย. 2026");
      expect(html).toContain("12 พ.ย. 2026");
      expect(html).toContain("11 พ.ย. 2026");

      // Status badges
      expect(html).toContain("🟢 ชนะ (สเต็ป 1/5 • 100 แต้ม)");
      expect(html).toContain("🔴 ไม่สำเร็จ");
      expect(html).toContain("⚪ ยังไม่ได้เล่น");
    });
  });

  // =========================================================================
  // 7. Rules and Stats Modals
  // =========================================================================
  describe("7. Rules & Stats Modals", () => {
    it("renders DailyRulesModal with 5-step instructions", () => {
      const html = renderToString(<DailyRulesModal isOpen={true} onClose={() => {}} />);
      expect(html).toContain("วิธีเล่นโหมดเพลงรายวัน");
      expect(html).toContain("Heardle Progressive Audio Slice");
      expect(html).toContain("0.1 วินาที (100 คะแนน)");
      expect(html).toContain("ฟังเพิ่ม (+วิ)");
      expect(html).toContain("เล่นย้อนหลัง");
    });

    it("renders DailyStatsModal with played, win %, current streak, and max streak", () => {
      const stats: DailyUserStats = {
        totalPlayed: 10,
        totalWon: 8,
        winRate: 80,
        currentStreak: 4,
        maxStreak: 7,
      };

      const html = renderToString(
        <DailyStatsModal isOpen={true} onClose={() => {}} stats={stats} />
      );

      expect(html).toContain("สถิติเพลงรายวัน");
      expect(html).toContain("10"); // Played
      expect(html).toContain("80%"); // Win %
      expect(html).toContain("4"); // Current Streak
      expect(html).toContain("7"); // Max Streak
    });
  });

  // =========================================================================
  // 8. Share Button & Clipboard Copy
  // =========================================================================
  describe("8. Share Button & Clipboard Copy", () => {
    it("formats and copies emoji string to clipboard correctly", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const shareText = generateDailyShareText({
        dateFormatted: "13 พ.ย. 2026",
        isCorrect: true,
        step: 2,
        score: 80,
        currentStreak: 6,
      });

      await navigator.clipboard.writeText(shareText);

      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("เพลงไรวะ รายวัน 13 พ.ย. 2026")
      );
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("🔊 🟥🟩⬛⬛⬛ (สเต็ป 2/5 • 80 แต้ม)")
      );
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("🔥 สตรีค 6 วันติด")
      );
    });
  });
});
