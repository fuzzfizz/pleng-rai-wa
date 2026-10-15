import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Mock next/navigation for server-side render tests
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock theme context for SettingsMenu and ThemeToggle components
vi.mock("@/contexts/theme-context", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { NavHeader } from "../nav-header";
import { LobbyView } from "@/components/room/lobby-view";
import { getAutoFilledProfileData, validateNickname, resolveRoomViewMode, buildRoomUrl } from "@/app/room/[code]/page";
import { getRoomCodePlaceholder } from "@/app/page";
import * as useAuthHook from "@/hooks/use-auth";
import type { Player, RoomSettings } from "@/types";

describe("Mobile Nav & Room UX Polish (Issues 1, 2, 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Task 1: Issue 1 - Mobile Responsiveness Polish
  // =========================================================================
  describe("Issue 1: Mobile Responsiveness Polish", () => {
    describe("NavHeader Responsive Elements", () => {
      it("renders guest login button with responsive mobile/desktop text classes", () => {
        vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
          user: null,
          profile: null,
          isLoading: false,
          isGuest: true,
          refreshProfile: vi.fn(),
          signInWithGoogle: vi.fn(),
          signUpWithEmail: vi.fn(),
          signInWithEmail: vi.fn(),
          signOut: vi.fn(),
          updateProfile: vi.fn(),
        });

        const html = renderToString(React.createElement(NavHeader));

        // Responsive text labels: shortened text on < sm, full text on sm+
        expect(html).toContain('class="hidden sm:inline">เข้าสู่ระบบ / สมัครสมาชิก</span>');
        expect(html).toContain('class="sm:hidden">เข้าสู่ระบบ</span>');

        // Right side container gap includes mobile gap-1.5
        expect(html).toContain("gap-1.5 sm:gap-3 lg:gap-3.5");
      });

      it("renders user profile pill with mobile max-width to avoid crowding settings menu", () => {
        vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
          user: { id: "u-123", email: "test@example.com" } as any,
          profile: {
            id: "u-123",
            displayName: "ดีเจเพลงอินดี้สุดเท่",
            avatar: "🎧",
          } as any,
          isLoading: false,
          isGuest: false,
          refreshProfile: vi.fn(),
          signInWithGoogle: vi.fn(),
          signUpWithEmail: vi.fn(),
          signInWithEmail: vi.fn(),
          signOut: vi.fn(),
          updateProfile: vi.fn(),
        });

        const html = renderToString(React.createElement(NavHeader));

        // Display name has constrained max-width on mobile
        expect(html).toContain("max-w-[70px] xs:max-w-[100px] sm:max-w-[140px]");
        expect(html).toContain("ดีเจเพลงอินดี้สุดเท่");
        expect(html).toContain("🎧");
      });
    });

    describe("HomePage Responsive Room Code Input", () => {
      it("returns shorter placeholder on mobile to fit 320px-375px screens", () => {
        expect(getRoomCodePlaceholder(true)).toBe("รหัสห้อง 6 หลัก");
      });

      it("returns full placeholder on tablet/desktop screens", () => {
        expect(getRoomCodePlaceholder(false)).toBe("กรอกรหัสห้อง (เช่น ABC123)");
      });
    });
  });

  // =========================================================================
  // Task 2: Issue 2 - Profile Auto-fill on Room Entry
  // =========================================================================
  describe("Issue 2: Profile Auto-fill on Room Entry", () => {
    it("pre-fills nickname from profile.displayName and custom avatar", () => {
      const profile = {
        displayName: "เซียนเพลงร็อค",
        avatar: "🎸",
      };

      const result = getAutoFilledProfileData(profile, "", false);

      expect(result).not.toBeNull();
      expect(result?.nickname).toBe("เซียนเพลงร็อค");
      expect(result?.avatar).toBe("🎸");
    });

    it("falls back to default 🦊 avatar if profile has displayName but no avatar", () => {
      const profile = {
        displayName: "ผู้ฟังนิรนาม",
        avatar: null,
      };

      const result = getAutoFilledProfileData(profile, "", false);

      expect(result).not.toBeNull();
      expect(result?.nickname).toBe("ผู้ฟังนิรนาม");
      expect(result?.avatar).toBe("🦊");
    });

    it("preserves user nickname override when hasUserEdited is true", () => {
      const profile = {
        displayName: "เซียนเพลงร็อค",
        avatar: "🎸",
      };

      const result = getAutoFilledProfileData(profile, "ชื่อเล่นชั่วคราว", true);

      expect(result).not.toBeNull();
      expect(result?.nickname).toBe("ชื่อเล่นชั่วคราว");
      expect(result?.avatar).toBe("🎸");
    });

    it("returns null when profile is undefined or displayName is missing", () => {
      expect(getAutoFilledProfileData(null, "", false)).toBeNull();
      expect(getAutoFilledProfileData(undefined, "", false)).toBeNull();
      expect(getAutoFilledProfileData({ displayName: null }, "", false)).toBeNull();
      expect(getAutoFilledProfileData({ displayName: "" }, "", false)).toBeNull();
    });

    it("validates player nicknames properly", () => {
      expect(validateNickname("ดีเจนุ้ย").valid).toBe(true);
      expect(validateNickname("").valid).toBe(false);
      expect(validateNickname("   ").valid).toBe(false);
      expect(validateNickname("a".repeat(26)).valid).toBe(false);
      expect(validateNickname("a".repeat(25)).valid).toBe(true);
    });

    it("resolves room view mode and builds room URLs", () => {
      expect(resolveRoomViewMode("tv")).toBe("tv");
      expect(resolveRoomViewMode("TV")).toBe("tv");
      expect(resolveRoomViewMode(null)).toBe("player");
      expect(resolveRoomViewMode("")).toBe("player");

      expect(buildRoomUrl("abc123")).toBe("/room/ABC123");
      expect(buildRoomUrl("abc123", { view: "tv" })).toBe("/room/ABC123?view=tv");
    });
  });

  // =========================================================================
  // Task 3: Issue 3 - Lobby Settings Menu
  // =========================================================================
  describe("Issue 3: Lobby Settings Menu", () => {
    const mockPlayers: Player[] = [
      {
        id: "p-host",
        displayName: "หัวหน้าห้อง",
        avatarUrl: "👑",
        score: 0,
        isHost: true,
        isReady: true,
        sessionToken: "tok-host",
        lastSeenAt: new Date().toISOString(),
      },
      {
        id: "p-guest",
        displayName: "เพื่อนร่วมห้อง",
        avatarUrl: "🦊",
        score: 0,
        isHost: false,
        isReady: false,
        sessionToken: "tok-guest",
        lastSeenAt: new Date().toISOString(),
      },
    ];

    const mockSettings: RoomSettings = {
      gameMode: "buzzer",
      answerInputMode: "autocomplete",
      answerResolutionMode: "race",
      lyricsType: "intro",
      voiceGender: "female",
      sliceDurationSec: 2.0,
      roundTimeoutSec: 15,
      totalRounds: 10,
      targetScore: 0,
    };

    it("renders SettingsMenu in LobbyView header instead of old standalone mute button", () => {
      const html = renderToString(
        React.createElement(LobbyView, {
          roomCode: "TEST99",
          players: mockPlayers,
          myPlayer: mockPlayers[0],
          isHost: true,
          settings: mockSettings,
          onStartGame: vi.fn(),
          onToggleReady: vi.fn(),
          onUpdateSettings: vi.fn(),
          onTransferHost: vi.fn(),
          onLeaveRoom: vi.fn(),
        })
      );

      // Verify TV Party Mode button is present
      expect(html).toContain("จอทีวี (TV Mode)");
      expect(html).toContain("/room/TEST99?view=tv");

      // Verify SettingsMenu is rendered in lobby view header
      // (SettingsMenu renders either its SSR placeholder div or trigger button)
      const hasSettingsMenu =
        html.includes("ตั้งค่าระบบ") ||
        html.includes("w-11 h-11 lg:w-13 lg:h-13 rounded-full");
      expect(hasSettingsMenu).toBe(true);

      // Verify old standalone mute button is NOT in the lobby view
      expect(html).not.toContain("เปิดเสียงเอฟเฟกต์");
      expect(html).not.toContain("ปิดเสียงเอฟเฟกต์");
    });
  });
});
