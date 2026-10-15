import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  translateAuthError,
  performGoogleSignIn,
  GOOGLE_PROVIDER_DISABLED_MSG,
} from "../use-auth";
import { AuthModal } from "@/components/auth/auth-modal";
import * as useAuthHook from "@/hooks/use-auth";

describe("Task 2: Google OAuth Safe Verification & Pre-flight UX", () => {
  let mockAssign: ReturnType<typeof vi.fn>;
  let originalWindow: typeof window;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockAssign = vi.fn();
    originalWindow = globalThis.window;
    originalFetch = globalThis.fetch;

    // Setup mock browser window with location
    (globalThis as any).window = {
      location: {
        origin: "http://localhost:3000",
        assign: mockAssign,
        href: "",
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = originalWindow;
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. translateAuthError tests
  // =========================================================================
  describe("translateAuthError", () => {
    it("translates 'Unsupported provider: provider is not enabled' to clear Thai guidance", () => {
      const errorMsg = "Unsupported provider: provider is not enabled";
      const translated = translateAuthError(errorMsg);
      expect(translated).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
      expect(translated).toContain("ระบบ Google Sign-in ยังไม่ได้เปิดใช้งานในเซิร์ฟเวอร์ Supabase");
      expect(translated).toContain("เล่นแบบ Guest ได้ทันที");
    });

    it("translates raw Supabase JSON error with validation_failed and unsupported provider", () => {
      const rawJson = JSON.stringify({
        code: 400,
        error_code: "validation_failed",
        msg: "Unsupported provider: provider is not enabled",
      });
      const translated = translateAuthError(rawJson);
      expect(translated).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("translates validation_failed error string", () => {
      const translated = translateAuthError("validation_failed");
      expect(translated).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("translates provider is not enabled error string", () => {
      const translated = translateAuthError("provider is not enabled");
      expect(translated).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("translates access_denied / popup closed OAuth errors", () => {
      expect(translateAuthError("access_denied")).toBe("การเข้าสู่ระบบด้วย Google ถูกยกเลิก");
      expect(translateAuthError("User cancelled login")).toBe("การเข้าสู่ระบบด้วย Google ถูกยกเลิก");
      expect(translateAuthError("Popup closed by user")).toBe("การเข้าสู่ระบบด้วย Google ถูกยกเลิก");
    });

    it("translates standard auth errors into Thai", () => {
      expect(translateAuthError("Invalid login credentials")).toBe("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      expect(translateAuthError("User already registered")).toBe("อีเมลนี้ลงทะเบียนในระบบแล้ว");
      expect(translateAuthError("Password should be at least 6 characters")).toBe("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      expect(translateAuthError("Email not confirmed")).toBe("กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ");
      expect(translateAuthError("invalid email")).toBe("รูปแบบอีเมลไม่ถูกต้อง");
      expect(translateAuthError("Too many requests")).toBe("มีการส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
      expect(translateAuthError("Failed to fetch")).toBe("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
    });

    it("returns default message for empty or undefined input", () => {
      expect(translateAuthError("")).toBe("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์");
      expect(translateAuthError(null as any)).toBe("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์");
    });

    it("passes through unknown custom messages unmodified", () => {
      const custom = "Some unexpected server glitch #999";
      expect(translateAuthError(custom)).toBe(custom);
    });
  });

  // =========================================================================
  // 2. performGoogleSignIn Options & Parameters
  // =========================================================================
  describe("performGoogleSignIn options & parameters", () => {
    it("passes skipBrowserRedirect: true and redirectTo to supabase.auth.signInWithOAuth", async () => {
      const mockSignInWithOAuth = vi.fn().mockResolvedValue({
        data: { url: "https://auth.supabase.co/auth/v1/authorize?provider=google&client_id=123" },
        error: null,
      });

      const mockClient = {
        auth: {
          signInWithOAuth: mockSignInWithOAuth,
        },
      } as any;

      // Mock fetch indicating success
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(""),
      } as any);

      const res = await performGoogleSignIn(mockClient);

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/",
          skipBrowserRedirect: true,
        },
      });
      expect(res.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Disabled Provider Verification (Pre-flight HTTP 400)
  // =========================================================================
  describe("Disabled Google Provider (HTTP 400 Pre-flight)", () => {
    it("prevents browser navigation and returns friendly Thai error when HTTP 400 is returned", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google";
      const mockSignInWithOAuth = vi.fn().mockResolvedValue({
        data: { url: oauthUrl },
        error: null,
      });

      const mockClient = {
        auth: {
          signInWithOAuth: mockSignInWithOAuth,
        },
      } as any;

      const disabledBody = JSON.stringify({
        code: 400,
        error_code: "validation_failed",
        msg: "Unsupported provider: provider is not enabled",
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        text: vi.fn().mockResolvedValue(disabledBody),
      } as any);

      const res = await performGoogleSignIn(mockClient);

      // Pre-flight must have been called with the OAuth URL
      expect(globalThis.fetch).toHaveBeenCalledWith(oauthUrl, { method: "GET" });

      // Crucial: Must NEVER navigate away to the raw JSON error page!
      expect(mockAssign).not.toHaveBeenCalled();

      // Must return clean failure with the exact Thai error guidance
      expect(res.success).toBe(false);
      expect(res.error).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("prevents navigation if preflight body contains 'Unsupported provider' even with non-standard text", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        text: vi.fn().mockResolvedValue("Unsupported provider: provider is not enabled"),
      } as any);

      const res = await performGoogleSignIn(mockClient);

      expect(mockAssign).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
      expect(res.error).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("prevents navigation if preflight body contains 'validation_failed'", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error_code: "validation_failed" })),
      } as any);

      const res = await performGoogleSignIn(mockClient);

      expect(mockAssign).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
      expect(res.error).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("handles direct error returned from signInWithOAuth without navigating", async () => {
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: "Unsupported provider: provider is not enabled",
              msg: "Unsupported provider: provider is not enabled",
            },
          }),
        },
      } as any;

      globalThis.fetch = vi.fn();

      const res = await performGoogleSignIn(mockClient);

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mockAssign).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
      expect(res.error).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });
  });

  // =========================================================================
  // 4. Enabled Provider Verification (Pre-flight HTTP 200 / 302)
  // =========================================================================
  describe("Enabled Google Provider (Pre-flight HTTP 200/302 Success)", () => {
    it("safely navigates using window.location.assign when pre-flight returns status 200", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google&client_id=xyz";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(""),
      } as any);

      const res = await performGoogleSignIn(mockClient);

      expect(globalThis.fetch).toHaveBeenCalledWith(oauthUrl, { method: "GET" });
      expect(mockAssign).toHaveBeenCalledWith(oauthUrl);
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("safely navigates using window.location.assign when pre-flight returns status 302", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google&client_id=xyz";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 302,
        ok: true,
        text: vi.fn().mockResolvedValue(""),
      } as any);

      const res = await performGoogleSignIn(mockClient);

      expect(mockAssign).toHaveBeenCalledWith(oauthUrl);
      expect(res.success).toBe(true);
    });

    it("safely navigates when pre-flight encounters CORS redirect exception in browser", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google&client_id=xyz";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      // In real browser, 302 redirecting to accounts.google.com might throw TypeError: Failed to fetch (CORS)
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const res = await performGoogleSignIn(mockClient);

      expect(mockAssign).toHaveBeenCalledWith(oauthUrl);
      expect(res.success).toBe(true);
    });

    it("safely falls back to win.location.href if win.location.assign is not a function", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google&client_id=xyz";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      const customWin = {
        location: {
          origin: "http://localhost:3000",
          href: "",
          // assign is undefined
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue(""),
      } as any);

      const res = await performGoogleSignIn(mockClient, customWin as any);

      expect(customWin.location.href).toBe(oauthUrl);
      expect(res.success).toBe(true);
    });

    it("prevents navigation and translates error if fetch throws an error containing unsupported provider", async () => {
      const oauthUrl = "https://example.supabase.co/auth/v1/authorize?provider=google&client_id=xyz";
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: { url: oauthUrl },
            error: null,
          }),
        },
      } as any;

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Unsupported provider: provider is not enabled"));

      const res = await performGoogleSignIn(mockClient);

      expect(mockAssign).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
      expect(res.error).toBe(GOOGLE_PROVIDER_DISABLED_MSG);
    });

    it("returns error if missing data.url from supabase response", async () => {
      const mockClient = {
        auth: {
          signInWithOAuth: vi.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
        },
      } as any;

      const res = await performGoogleSignIn(mockClient);

      expect(mockAssign).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
      expect(res.error).toBe("ไม่พบลิงก์ยืนยันตัวตนจาก Google");
    });
  });

  // =========================================================================
  // 5. AuthModal UX & Clean Error Display Integration
  // =========================================================================
  describe("AuthModal Error Display Integration", () => {
    it("displays the disabled provider error cleanly in the amber alert container without breaking the UI", () => {
      // Mock useAuth returning failed Google sign-in
      vi.spyOn(useAuthHook, "useAuth").mockReturnValue({
        ...useAuthHook.DEFAULT_AUTH_VALUE,
        signInWithGoogle: vi.fn().mockResolvedValue({
          success: false,
          error: GOOGLE_PROVIDER_DISABLED_MSG,
        }),
      });

      const html = renderToString(
        React.createElement(AuthModal, {
          isOpen: true,
          onClose: vi.fn(),
          initialTab: "signin",
          initialErrorMessage: GOOGLE_PROVIDER_DISABLED_MSG,
        })
      );

      // Verify modal is open and has title
      expect(html).toContain("เข้าสู่ระบบ");
      expect(html).toContain("เข้าสู่ระบบด้วย Google");

      // Verify the amber alert styling and guidance text are present
      expect(html).toContain("bg-amber-500/10");
      expect(html).toContain("สมัครด้วยอีเมล");
      expect(html).toContain("เข้าสู่ระบบด้วยอีเมล");
      expect(html).toContain("ระบบ Google Sign-in ยังไม่ได้เปิดใช้งานในเซิร์ฟเวอร์ Supabase");
    });
  });
});

