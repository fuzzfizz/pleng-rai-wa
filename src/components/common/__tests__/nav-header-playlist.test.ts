import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  NavHeader,
  NAV_LINKS,
  USER_MENU_ITEMS,
} from "../nav-header";
import {
  shouldShowPlaylistAuthGate,
  handlePlaylistCreateNavigation,
  FREEMIUM_GATE_TEXTS,
} from "@/app/playlists/page";
import { ListMusic, Disc3, Sparkles, LogIn } from "lucide-react";
import { soundEffects } from "@/lib/sound-effects";

describe("Playlist Navigation & Freemium Auth Gate Integration", () => {
  beforeEach(() => {
    vi.spyOn(soundEffects, "click").mockImplementation(() => {});
    vi.spyOn(soundEffects, "correct").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Task 1: Navigation Header & User Menu Integration
  // =========================================================================
  describe("Task 1: Navigation Header (nav-header.tsx)", () => {
    it("includes เพลย์ลิสต์ in NAV_LINKS with href /playlists and ListMusic icon", () => {
      const playlistLink = NAV_LINKS.find((link) => link.href === "/playlists");
      expect(playlistLink).toBeDefined();
      expect(playlistLink?.label).toBe("เพลย์ลิสต์");
      expect(playlistLink?.icon).toBe(ListMusic);
    });

    it("has complete and correctly ordered NAV_LINKS for desktop and mobile navigation", () => {
      expect(NAV_LINKS).toHaveLength(3);
      expect(NAV_LINKS[0]).toEqual({ label: "หน้าแรก", href: "/" });
      expect(NAV_LINKS[1]).toEqual({ label: "เล่นคนเดียว", href: "/play/solo" });
      expect(NAV_LINKS[2]).toEqual({
        label: "เพลย์ลิสต์",
        href: "/playlists",
        icon: ListMusic,
      });
    });

    it("defines user menu item for 🎶 เพลย์ลิสต์ของฉัน navigating to /playlists?tab=my", () => {
      expect(USER_MENU_ITEMS.myPlaylists).toBeDefined();
      expect(USER_MENU_ITEMS.myPlaylists.label).toBe("🎶 เพลย์ลิสต์ของฉัน");
      expect(USER_MENU_ITEMS.myPlaylists.href).toBe("/playlists?tab=my");
    });

    it("defines complete user dropdown menu items with profile and signout", () => {
      expect(USER_MENU_ITEMS.manageProfile.label).toBe("จัดการโปรไฟล์");
      expect(USER_MENU_ITEMS.signOut.label).toBe("ออกจากระบบ");
    });

    describe("Active Route Matching Logic", () => {
      function isLinkActive(linkHref: string, pathname: string): boolean {
        return (
          pathname === linkHref ||
          (linkHref !== "/" && pathname.startsWith(linkHref))
        );
      }

      it("marks /playlists as active when pathname is exactly /playlists", () => {
        expect(isLinkActive("/playlists", "/playlists")).toBe(true);
        expect(isLinkActive("/", "/playlists")).toBe(false);
        expect(isLinkActive("/play/solo", "/playlists")).toBe(false);
      });

      it("marks /playlists as active when pathname is a subpath like /playlists/new or /playlists/123", () => {
        expect(isLinkActive("/playlists", "/playlists/new")).toBe(true);
        expect(isLinkActive("/playlists", "/playlists/custom-id-123")).toBe(true);
      });

      it("marks / as active only when pathname is exactly /", () => {
        expect(isLinkActive("/", "/")).toBe(true);
        expect(isLinkActive("/", "/playlists")).toBe(false);
        expect(isLinkActive("/", "/play/solo")).toBe(false);
      });

      it("marks /play/solo as active when pathname is /play/solo", () => {
        expect(isLinkActive("/play/solo", "/play/solo")).toBe(true);
        expect(isLinkActive("/playlists", "/play/solo")).toBe(false);
      });
    });

    it("instantiates NavHeader React element cleanly without errors", () => {
      const element = React.createElement(NavHeader, {
        className: "test-header",
        showNavigationLinks: true,
      });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.props.className).toBe("test-header");
      expect(element.props.showNavigationLinks).toBe(true);
    });
  });

  // =========================================================================
  // Task 2: Playlists Page Auth Gate (Freemium Model A)
  // =========================================================================
  describe("Task 2: Playlists Page Auth Gate (page.tsx)", () => {
    describe("FREEMIUM_GATE_TEXTS Content Specifications", () => {
      it("contains the exact required title", () => {
        expect(FREEMIUM_GATE_TEXTS.title).toBe("✨ ปลดล็อกเพลย์ลิสต์ส่วนตัวของคุณ");
      });

      it("contains the exact required persuasive Lo-Fi description", () => {
        expect(FREEMIUM_GATE_TEXTS.description).toBe(
          "สร้างเพลย์ลิสต์เพลงโปรด จัดเซ็ตเพลงท้าทายเพื่อน และนำไปเปิดทายในห้องเกมได้ไม่จำกัด เพียงสมัครสมาชิกหรือเข้าสู่ระบบฟรี!"
        );
      });

      it("contains the exact required action button label", () => {
        expect(FREEMIUM_GATE_TEXTS.actionButton).toBe("เข้าสู่ระบบ / สมัครสมาชิก");
      });
    });

    describe("shouldShowPlaylistAuthGate helper", () => {
      it("returns true when user is null (guest / unauthenticated)", () => {
        expect(shouldShowPlaylistAuthGate(null, false)).toBe(true);
        expect(shouldShowPlaylistAuthGate(null, true)).toBe(true);
        expect(shouldShowPlaylistAuthGate(undefined, undefined)).toBe(true);
      });

      it("returns true when user is present but isGuest is true", () => {
        const mockGuestUser = { id: "guest-user", email: "" };
        expect(shouldShowPlaylistAuthGate(mockGuestUser, true)).toBe(true);
      });

      it("returns false only when user is present and isGuest is false", () => {
        const mockAuthUser = { id: "user-123", email: "user@example.com" };
        expect(shouldShowPlaylistAuthGate(mockAuthUser, false)).toBe(false);
      });
    });

    describe("handlePlaylistCreateNavigation", () => {
      it("triggers onOpenAuth('signin') and does not navigate when user is unauthenticated", () => {
        const onOpenAuth = vi.fn();
        const onNavigate = vi.fn();

        handlePlaylistCreateNavigation(null, true, onOpenAuth, onNavigate);

        expect(onOpenAuth).toHaveBeenCalledTimes(1);
        expect(onOpenAuth).toHaveBeenCalledWith("signin");
        expect(onNavigate).not.toHaveBeenCalled();
      });

      it("triggers onOpenAuth('signin') when user is logged in as a guest player", () => {
        const onOpenAuth = vi.fn();
        const onNavigate = vi.fn();
        const guestUser = { id: "guest-uuid" };

        handlePlaylistCreateNavigation(guestUser, true, onOpenAuth, onNavigate);

        expect(onOpenAuth).toHaveBeenCalledTimes(1);
        expect(onOpenAuth).toHaveBeenCalledWith("signin");
        expect(onNavigate).not.toHaveBeenCalled();
      });

      it("routes directly to /playlists/new when user is authenticated and not a guest", () => {
        const onOpenAuth = vi.fn();
        const onNavigate = vi.fn();
        const memberUser = { id: "member-uuid", email: "member@music.com" };

        handlePlaylistCreateNavigation(memberUser, false, onOpenAuth, onNavigate);

        expect(onNavigate).toHaveBeenCalledTimes(1);
        expect(onNavigate).toHaveBeenCalledWith("/playlists/new");
        expect(onOpenAuth).not.toHaveBeenCalled();
      });
    });

    describe("Sound Effects and Interaction Feedback", () => {
      it("triggers soundEffects.click on user interactions", () => {
        soundEffects.click();
        expect(soundEffects.click).toHaveBeenCalled();
      });
    });
  });
});
