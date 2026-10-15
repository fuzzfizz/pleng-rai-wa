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
import { ActiveRoomsTable } from "@/components/home/active-rooms-table";
import {
  getAutoFilledProfileData,
  validateNickname,
  resolveRoomViewMode,
  buildRoomUrl,
  shouldAutoJoinRoom,
} from "@/app/room/[code]/page";
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

        // Right side container gap includes mobile gap-1.5 and sm:gap-2.5
        expect(html).toContain("gap-1.5 sm:gap-2.5 lg:gap-3.5");

        // Brand logo has shrink-0 and title is hidden on mobile (< sm)
        expect(html).toContain("shrink-0");
        expect(html).toContain("hidden sm:block");
        expect(html).toContain("whitespace-nowrap");
        expect(html).toContain("เพลงไรวะ?");
      });

      it("renders compact circular avatar on mobile to save space and avoid crowding navbar", () => {
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

        // Display name is hidden on mobile screens (< sm) to save ~80px horizontal space
        expect(html).toContain("hidden sm:inline font-semibold text-stone-800 dark:text-stone-200 max-w-[140px] lg:max-w-[200px] truncate");
        // Button contains title with display name for accessibility and tooltip
        expect(html).toContain('title="ดีเจเพลงอินดี้สุดเท่"');
        expect(html).toContain("ดีเจเพลงอินดี้สุดเท่");
        expect(html).toContain("🎧");
        // Button has touch target classes
        expect(html).toContain("min-h-[44px] min-w-[44px]");
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

    describe("shouldAutoJoinRoom Auto-Join Decision", () => {
      const baseParams = {
        isHydrated: true,
        isAuthLoading: false,
        isCodeValid: true,
        hasStoredSession: false,
        hasRealtimePlayer: false,
        isAuthenticated: true,
        hasDisplayName: true,
      };

      it("returns true when user is authenticated with displayName and no existing session", () => {
        expect(shouldAutoJoinRoom(baseParams)).toBe(true);
      });

      it("returns false if user is guest (not authenticated)", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, isAuthenticated: false })).toBe(false);
      });

      it("returns false if user has no displayName in profile", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, hasDisplayName: false })).toBe(false);
      });

      it("returns false while auth is still loading", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, isAuthLoading: true })).toBe(false);
      });

      it("returns false if not yet hydrated", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, isHydrated: false })).toBe(false);
      });

      it("returns false if room code is invalid", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, isCodeValid: false })).toBe(false);
      });

      it("returns false if player already has a stored session", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, hasStoredSession: true })).toBe(false);
      });

      it("returns false if player is already active in realtime state", () => {
        expect(shouldAutoJoinRoom({ ...baseParams, hasRealtimePlayer: true })).toBe(false);
      });
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
        html.includes("w-9 h-9 sm:w-11 sm:h-11 lg:w-13 lg:h-13 rounded-full") ||
        html.includes("w-11 h-11 lg:w-13 lg:h-13 rounded-full");
      expect(hasSettingsMenu).toBe(true);

      // Verify old standalone mute button is NOT in the lobby view
      expect(html).not.toContain("เปิดเสียงเอฟเฟกต์");
      expect(html).not.toContain("ปิดเสียงเอฟเฟกต์");
    });
  });

  // =========================================================================
  // Task 4: ActiveRoomsTable Direct Room Join & Profile Integration
  // =========================================================================
  describe("ActiveRoomsTable Direct Room Join & Profile Integration", () => {
    it("renders ActiveRoomsTable without errors", () => {
      vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
        user: { id: "u-1" } as any,
        profile: { id: "u-1", displayName: "028 อธิษฐ์", avatar: "🦊" } as any,
        isLoading: false,
        isGuest: false,
        refreshProfile: vi.fn(),
        signInWithGoogle: vi.fn(),
        signUpWithEmail: vi.fn(),
        signInWithEmail: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
      });

      const html = renderToString(React.createElement(ActiveRoomsTable));
      expect(html).toContain("ห้องที่กำลังเปิดเล่นอยู่");
    });
  });
});
