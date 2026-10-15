"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Auth Hook & Context
// Client-side authentication, session state & profile management
// ==========================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ProfileRow, ProfileUpdate } from "@/types/database";
import type { UserProfile } from "@/types";

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isGuest: boolean;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    displayName?: string;
    avatar?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

/**
 * Maps a database ProfileRow to domain UserProfile.
 */
export function mapProfileRowToUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: row.avatar,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const GOOGLE_PROVIDER_DISABLED_MSG =
  "ระบบ Google Sign-in ยังไม่ได้เปิดใช้งานในเซิร์ฟเวอร์ Supabase (กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน หรือเล่นแบบ Guest ได้ทันที)";

/**
 * Translates common Supabase / Auth error messages into friendly Thai.
 */
export function translateAuthError(message: string): string {
  if (!message) return "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์";
  const lower = typeof message === "string" ? message.toLowerCase() : JSON.stringify(message).toLowerCase();

  if (
    lower.includes("unsupported provider") ||
    lower.includes("provider is not enabled") ||
    lower.includes("validation_failed")
  ) {
    return GOOGLE_PROVIDER_DISABLED_MSG;
  }

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("wrong password")
  ) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("unique constraint")
  ) {
    return "อีเมลนี้ลงทะเบียนในระบบแล้ว";
  }
  if (
    lower.includes("password should be at least") ||
    lower.includes("weak password")
  ) {
    return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
  }
  if (lower.includes("email not confirmed")) {
    return "กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ";
  }
  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return "รูปแบบอีเมลไม่ถูกต้อง";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "มีการส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต";
  }
  if (
    lower.includes("access_denied") ||
    lower.includes("access denied") ||
    lower.includes("user cancelled") ||
    lower.includes("popup closed")
  ) {
    return "การเข้าสู่ระบบด้วย Google ถูกยกเลิก";
  }

  return message;
}

/**
 * Safe Google OAuth verification & pre-flight UX.
 * 1. Requests OAuth authorize URL with skipBrowserRedirect: true.
 * 2. Pre-flights GET request to the Supabase OAuth URL to detect disabled provider (HTTP 400).
 * 3. Prevents navigation if unsupported provider error occurs.
 * 4. Navigates safely with window.location.assign if enabled.
 */
export async function performGoogleSignIn(
  client = supabase,
  win: Window | typeof window | undefined = typeof window !== "undefined" ? window : undefined
): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectTo =
      win && win.location ? `${win.location.origin}/` : undefined;

    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      const errorDetail =
        (error as any)?.msg ||
        (error as any)?.error_description ||
        error.message ||
        (error as any)?.error_code ||
        "";
      return { success: false, error: translateAuthError(errorDetail || error.message) };
    }

    if (!data?.url) {
      return {
        success: false,
        error: translateAuthError("ไม่พบลิงก์ยืนยันตัวตนจาก Google"),
      };
    }

    // Pre-flight verification:
    // If Google provider is disabled on Supabase, it returns HTTP 400 Bad Request with JSON:
    // {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
    try {
      const preflightRes = await fetch(data.url, { method: "GET" });
      let bodyText = "";
      try {
        bodyText = await preflightRes.text();
      } catch {
        // Body stream unavailable
      }

      const lowerBody = (bodyText || "").toLowerCase();
      const isUnsupported =
        preflightRes.status === 400 ||
        lowerBody.includes("unsupported provider") ||
        lowerBody.includes("provider is not enabled") ||
        lowerBody.includes("validation_failed");

      if (isUnsupported) {
        let errorMsg = bodyText || "Unsupported provider: provider is not enabled";
        try {
          const parsed = JSON.parse(bodyText);
          if (parsed && typeof parsed === "object") {
            errorMsg =
              parsed.msg ||
              parsed.error_description ||
              parsed.message ||
              parsed.error_code ||
              errorMsg;
          }
        } catch {
          // Body is not JSON
        }
        return {
          success: false,
          error: translateAuthError(errorMsg),
        };
      }
    } catch (fetchErr: any) {
      // In a real browser environment, a 302 redirect to accounts.google.com might trigger a CORS error on fetch.
      // If the error message explicitly indicates unsupported provider, return the translated error.
      const errMsg = fetchErr?.message || "";
      if (
        errMsg.toLowerCase().includes("unsupported provider") ||
        errMsg.toLowerCase().includes("provider is not enabled")
      ) {
        return {
          success: false,
          error: translateAuthError(errMsg),
        };
      }
      // Otherwise (e.g. redirect/CORS to Google sign-in page), the provider is enabled and safe to navigate.
    }

    // Provider is enabled - safely navigate to Google OAuth endpoint
    if (win && win.location) {
      if (typeof win.location.assign === "function") {
        win.location.assign(data.url);
      } else {
        win.location.href = data.url;
      }
    }

    return { success: true };
  } catch (err: any) {
    const errorDetail =
      err?.msg ||
      err?.error_description ||
      err?.error_code ||
      err?.message ||
      "";
    return {
      success: false,
      error: translateAuthError(errorDetail || "เกิดข้อผิดพลาดในการเชื่อมต่อ Google"),
    };
  }
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user profile from Supabase
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Could not load profile:", error.message);
        return;
      }

      if (data) {
        setProfile(mapProfileRowToUserProfile(data));
      } else {
        // Fallback: If profile row was not created automatically by trigger
        const authUserRes = await supabase.auth.getUser();
        const authUser = authUserRes.data?.user;
        const meta = authUser?.user_metadata;
        const defaultName =
          meta?.display_name ||
          meta?.full_name ||
          meta?.name ||
          authUser?.email?.split("@")[0] ||
          "นักฟังเพลง";
        const defaultAvatar = "🦊";

        const { data: created, error: insertError } = await supabase
          .from("profiles")
          .upsert({
            id: userId,
            display_name: defaultName,
            avatar: defaultAvatar,
          })
          .select()
          .single();

        if (!insertError && created) {
          setProfile(mapProfileRowToUserProfile(created));
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }, []);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    let isMounted = true;

    // Check existing session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          loadProfile(currentUser.id).finally(() => {
            if (isMounted) setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error checking session:", err);
        if (isMounted) setIsLoading(false);
      });

    // Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Sign in with email and password
  const signInWithEmail = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return { success: false, error: translateAuthError(error.message) };
        }

        if (data?.user) {
          setUser(data.user);
          await loadProfile(data.user.id);
        }

        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: translateAuthError(err?.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"),
        };
      }
    },
    [loadProfile]
  );

  // Sign up with email, password, and display name
  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      displayName: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const trimmedName = displayName.trim();
        if (!trimmedName || trimmedName.length > 30) {
          return {
            success: false,
            error: "ชื่อที่แสดงต้องมีความยาวระหว่าง 1 ถึง 30 ตัวอักษร",
          };
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: trimmedName,
              full_name: trimmedName,
            },
          },
        });

        if (error) {
          return { success: false, error: translateAuthError(error.message) };
        }

        if (data?.user) {
          setUser(data.user);
          // Ensure profile row is upserted
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              display_name: trimmedName,
              avatar: "🦊",
            });
            await loadProfile(data.user.id);
          } catch (upsertErr) {
            console.warn("Could not upsert profile after sign up:", upsertErr);
          }
        }

        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: translateAuthError(err?.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก"),
        };
      }
    },
    [loadProfile]
  );

  // Sign in with Google OAuth
  const signInWithGoogle = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return performGoogleSignIn(supabase, typeof window !== "undefined" ? window : undefined);
  }, []);

  // Sign out
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setUser(null);
      setProfile(null);
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(
    async (data: {
      displayName?: string;
      avatar?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "ไม่ได้เข้าสู่ระบบ" };
      }

      const updates: Partial<ProfileUpdate> = {};

      if (data.displayName !== undefined) {
        const trimmed = data.displayName.trim();
        if (!trimmed || trimmed.length > 30) {
          return {
            success: false,
            error: "ชื่อที่แสดงต้องมีความยาวระหว่าง 1 ถึง 30 ตัวอักษร",
          };
        }
        updates.display_name = trimmed;
      }

      if (data.avatar !== undefined) {
        updates.avatar = data.avatar;
      }

      try {
        const { data: updatedData, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        if (updatedData) {
          setProfile(mapProfileRowToUserProfile(updatedData));
        } else {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  ...(updates.display_name ? { displayName: updates.display_name } : {}),
                  ...(updates.avatar ? { avatar: updates.avatar } : {}),
                }
              : null
          );
        }

        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "ไม่สามารถอัปเดตโปรไฟล์ได้",
        };
      }
    },
    [user]
  );

  // Refresh profile manually
  const refreshProfile = useCallback(async (): Promise<void> => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const isGuest = !user && !isLoading;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isLoading,
      isGuest,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [
      user,
      profile,
      isLoading,
      isGuest,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      updateProfile,
      refreshProfile,
    ]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export const DEFAULT_AUTH_VALUE: AuthContextValue = {
  user: null,
  profile: null,
  isLoading: false,
  isGuest: true,
  signInWithEmail: async () => ({
    success: false,
    error: "AuthProvider not found in component tree",
  }),
  signUpWithEmail: async () => ({
    success: false,
    error: "AuthProvider not found in component tree",
  }),
  signInWithGoogle: async () => ({
    success: false,
    error: "AuthProvider not found in component tree",
  }),
  signOut: async () => {},
  updateProfile: async () => ({
    success: false,
    error: "AuthProvider not found in component tree",
  }),
  refreshProfile: async () => {},
};

/**
 * useAuth hook for components to access authentication state and methods.
 * If called outside AuthProvider or outside React render tree, provides fallback safe state.
 */
export function useAuth(): AuthContextValue {
  try {
    const context = useContext(AuthContext);
    if (context) {
      return context;
    }
  } catch {
    // If called outside of React render tree (e.g. testing or non-component environment)
    return DEFAULT_AUTH_VALUE;
  }

  return DEFAULT_AUTH_VALUE;
}
