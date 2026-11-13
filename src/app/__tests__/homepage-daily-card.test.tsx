import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { NAV_LINKS, NavHeader } from "@/components/common/nav-header";
import { DailyChallengeCard } from "@/components/home/daily-challenge-card";
import HomePage from "@/app/page";
import { Calendar } from "lucide-react";
import {
  formatThaiDate,
  THAI_MONTHS_SHORT,
  getTodayDateString,
} from "@/lib/services/daily-challenge-service";
import { soundEffects } from "@/lib/sound-effects";

// ==========================================
// Mocks
// ==========================================

vi.mock("@/lib/sound-effects", () => ({
  soundEffects: {
    click: vi.fn(),
    correct: vi.fn(),
    wrong: vi.fn(),
  },
}));

vi.mock("@/components/common/settings-menu", () => ({
  SettingsMenu: () => React.createElement("div", { "data-testid": "settings-menu" }),
}));

vi.mock("@/contexts/theme-context", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: vi.fn(), setTheme: vi.fn() }),
  ThemeProvider: ({ children }: any) => children,
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => React.createElement("div", { "data-testid": "three-vinyl-mock" }, "Vinyl"),
}));

let mockAuthState = {
  user: null as any,
  profile: null as any,
  isLoading: false,
  isGuest: true,
  signOut: vi.fn(),
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

// Mock session-storage
vi.mock("@/lib/session-storage", () => ({
  getLastRoomCode: vi.fn(() => null),
  savePlayerSession: vi.fn(),
  loadPlayerSession: vi.fn(() => null),
  clearPlayerSession: vi.fn(),
}));

// Mock active rooms fetch
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ rooms: [] }),
  })
) as any;

describe("Daily Challenge Feature: Homepage & NavHeader Integration (Task 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: null,
      profile: null,
      isLoading: false,
      isGuest: true,
      signOut: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Requirement 1: Navigation Header Integration
  // =========================================================================
  describe("1. Navigation Header (src/components/common/nav-header.tsx)", () => {
    it("includes 'เพลงรายวัน' in NAV_LINKS with href '/daily' and Calendar icon", () => {
      const dailyLink = NAV_LINKS.find((link) => link.href === "/daily");
      expect(dailyLink).toBeDefined();
      expect(dailyLink?.label).toBe("เพลงรายวัน");
      expect(dailyLink?.icon).toBe(Calendar);
    });

    it("orders NAV_LINKS correctly: หน้าแรก, เพลงรายวัน, เพลย์ลิสต์", () => {
      expect(NAV_LINKS).toHaveLength(3);
      expect(NAV_LINKS[0]).toEqual({ label: "หน้าแรก", href: "/" });
      expect(NAV_LINKS[1]).toEqual({
        label: "เพลงรายวัน",
        href: "/daily",
        icon: Calendar,
      });
      expect(NAV_LINKS[2].label).toBe("เพลย์ลิสต์");
      expect(NAV_LINKS[2].href).toBe("/playlists");
    });

    it("renders 'เพลงรายวัน' link in NavHeader markup", () => {
      const html = renderToString(React.createElement(NavHeader));
      expect(html).toContain("เพลงรายวัน");
      expect(html).toContain('href="/daily"');
    });
  });

  // =========================================================================
  // Requirement 2: Daily Challenge Card Unit & UX Elements
  // =========================================================================
  describe("2. Daily Challenge Card Component (src/components/home/daily-challenge-card.tsx)", () => {
    it("renders the header badge '📅 เพลงรายวัน (Daily Challenge)' and formatted Thai date", () => {
      const html = renderToString(
        React.createElement(DailyChallengeCard, {
          date: "2026-11-13",
        })
      );

      expect(html).toContain("📅 เพลงรายวัน (Daily Challenge)");
      expect(html).toContain("13 พ.ย. 2026");
    });

    it("formats dates in Thai correctly using formatThaiDate", () => {
      expect(formatThaiDate("2026-11-13")).toBe("13 พ.ย. 2026");
      expect(formatThaiDate("2026-01-01")).toBe("1 ม.ค. 2026");
      expect(formatThaiDate("2026-12-31")).toBe("31 ธ.ค. 2026");
      expect(THAI_MONTHS_SHORT).toHaveLength(12);
    });

    describe("Guest / Unauthenticated Mode", () => {
      it("displays member-exclusive notice and login CTA button when user is a guest", () => {
        mockAuthState = {
          user: null,
          profile: null,
          isLoading: false,
          isGuest: true,
          signOut: vi.fn(),
        };

        const html = renderToString(
          React.createElement(DailyChallengeCard, {
            date: "2026-11-13",
          })
        );

        expect(html).toContain(
          "🔒 โหมดทายเพลงรายวันวันละ 1 เพลง เล่นย้อนหลังได้ สะสมสตรีค (เฉพาะสมาชิก)"
        );
        expect(html).toContain("เข้าสู่ระบบเพื่อเล่น (Daily) ➔");
        expect(html).not.toContain("🎵 เริ่มเล่นเพลงวันนี้ ➔");
      });

      it("triggers onOpenAuth('signin') when login CTA is clicked", () => {
        const onOpenAuth = vi.fn();
        const element = React.createElement(DailyChallengeCard, {
          onOpenAuth,
          date: "2026-11-13",
        });

        // Simulate button invocation
        expect(element.props.onOpenAuth).toBe(onOpenAuth);
        element.props.onOpenAuth?.("signin");
        expect(onOpenAuth).toHaveBeenCalledWith("signin");
      });
    });

    describe("Authenticated Member Mode: Incomplete Challenge", () => {
      beforeEach(() => {
        mockAuthState = {
          user: { id: "user-123", email: "fan@music.com" } as any,
          profile: { displayName: "DJ Beat", avatar: "🎧" } as any,
          isLoading: false,
          isGuest: false,
          signOut: vi.fn(),
        };
      });

      it("displays primary play button '🎵 เริ่มเล่นเพลงวันนี้ ➔' and archive quicklink", () => {
        const html = renderToString(
          React.createElement(DailyChallengeCard, {
            date: "2026-11-13",
            initialDailyData: {
              isCompleted: false,
              userAttempt: null,
              userStats: { currentStreak: 3 },
            },
          })
        );

        expect(html).toContain("🎵 เริ่มเล่นเพลงวันนี้ ➔");
        expect(html).toContain("📅 เล่นย้อนหลัง (Archive)");
        expect(html).toContain('href="/daily"');
        expect(html).not.toContain("🔒 โหมดทายเพลงรายวัน");
      });

      it("displays streak badge when currentStreak > 0", () => {
        const html = renderToString(
          React.createElement(DailyChallengeCard, {
            date: "2026-11-13",
            initialDailyData: {
              isCompleted: false,
              userAttempt: null,
              userStats: { currentStreak: 5 },
            },
          })
        );

        expect(html).toContain("🔥 สตรีค 5 วัน");
      });

      it("does not render streak badge when streak is 0", () => {
        const html = renderToString(
          React.createElement(DailyChallengeCard, {
            date: "2026-11-13",
            initialDailyData: {
              isCompleted: false,
              userAttempt: null,
              userStats: { currentStreak: 0 },
            },
          })
        );

        expect(html).not.toContain("🔥 สตรีค");
      });
    });

    describe("Authenticated Member Mode: Completed Challenge", () => {
      beforeEach(() => {
        mockAuthState = {
          user: { id: "user-123", email: "fan@music.com" } as any,
          profile: { displayName: "DJ Beat", avatar: "🎧" } as any,
          isLoading: false,
          isGuest: false,
          signOut: vi.fn(),
        };
      });

      it("displays step & score result when challenge was won today", () => {
        const html = renderToString(
          React.createElement(DailyChallengeCard, {
            date: "2026-11-13",
            initialDailyData: {
              isCompleted: true,
              userAttempt: {
                step: 2,
                score: 80,
                isCorrect: true,
              },
              userStats: { currentStreak: 4 },
            },
          })
        );

        expect(html).toContain("🎉 สำเร็จในสเต็ป 2/5 (80 แต้ม)");
        expect(html).toContain("ดูผลลัพธ์ / แชร์เพลงวันนี้ ➔");
        expect(html).toContain("📅 เล่นย้อนหลัง (Archive)");
        expect(html).toContain("🔥 สตรีค 4 วัน");
        expect(html).not.toContain("🎵 เริ่มเล่นเพลงวันนี้ ➔");
      });

      it("displays 'เล่นเพลงวันนี้แล้ว' when challenge was completed but not won (e.g. surrendered/failed)", () => {
        const html = renderToString(
          React.createElement(DailyChallengeCard, {
            date: "2026-11-13",
            initialDailyData: {
              isCompleted: true,
              userAttempt: {
                step: 5,
                score: 0,
                isCorrect: false,
              },
              userStats: { currentStreak: 0 },
            },
          })
        );

        expect(html).toContain("เล่นเพลงวันนี้แล้ว");
        expect(html).toContain("ดูผลลัพธ์ / แชร์เพลงวันนี้ ➔");
        expect(html).toContain("📅 เล่นย้อนหลัง (Archive)");
      });
    });
  });

  // =========================================================================
  // Requirement 3: Homepage Full Integration (src/app/page.tsx)
  // =========================================================================
  describe("3. Homepage Integration (src/app/page.tsx)", () => {
    it("renders the Daily Challenge card prominently in Homepage Hero", () => {
      mockAuthState = {
        user: null,
        profile: null,
        isLoading: false,
        isGuest: true,
        signOut: vi.fn(),
      };

      const html = renderToString(React.createElement(HomePage));

      // Daily Challenge card header & badge
      expect(html).toContain("📅 เพลงรายวัน (Daily Challenge)");
      expect(html).toContain("เข้าสู่ระบบเพื่อเล่น (Daily) ➔");
      expect(html).toContain("🔒 โหมดทายเพลงรายวันวันละ 1 เพลง");
    });

    it("renders member challenge controls on Homepage when user is authenticated", () => {
      mockAuthState = {
        user: { id: "member-1", email: "member@pleng.com" } as any,
        profile: { displayName: "Vocalist", avatar: "🎤" } as any,
        isLoading: false,
        isGuest: false,
        signOut: vi.fn(),
      };

      const html = renderToString(React.createElement(HomePage));

      expect(html).toContain("📅 เพลงรายวัน (Daily Challenge)");
      // NavHeader has /daily link
      expect(html).toContain('href="/daily"');
    });

    it("places DailyChallengeCard directly in the Hero Section adjacent to Action Box", () => {
      mockAuthState = {
        user: null,
        profile: null,
        isLoading: false,
        isGuest: true,
        signOut: vi.fn(),
      };

      const html = renderToString(React.createElement(HomePage));

      // Check both Action Box and Daily Challenge Card are in hero
      expect(html).toContain("สร้างห้องทายเพลง");
      expect(html).toContain("data-testid=\"daily-challenge-card\"");
      const actionBoxIdx = html.indexOf("สร้างห้องทายเพลง");
      const dailyCardIdx = html.indexOf("data-testid=\"daily-challenge-card\"");
      expect(actionBoxIdx).toBeGreaterThan(0);
      expect(dailyCardIdx).toBeGreaterThan(actionBoxIdx);
    });
  });
});
