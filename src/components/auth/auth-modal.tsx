"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Auth Modal
// Email/Password Sign-In, Sign-Up & Google OAuth Login
// ==========================================

import React, { useState, useEffect } from "react";
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { soundEffects } from "@/lib/sound-effects";

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "signin" | "signup";
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialTab = "signin",
  onSuccess,
}: AuthModalProps): React.JSX.Element | null {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Sync tab with initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMessage(null);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setIsSubmitting(false);
      setIsGoogleLoading(false);
    }
  }, [isOpen, initialTab]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !isGoogleLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSubmitting, isGoogleLoading]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("กรุณากรอกอีเมล");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setErrorMessage("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    if (!password) {
      setErrorMessage("กรุณากรอกรหัสผ่าน");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (tab === "signup") {
      const cleanName = displayName.trim();
      if (!cleanName) {
        setErrorMessage("กรุณากรอกชื่อที่แสดง (Display Name)");
        return;
      }
      if (cleanName.length > 30) {
        setErrorMessage("ชื่อที่แสดงต้องไม่เกิน 30 ตัวอักษร");
        return;
      }
    }

    try {
      soundEffects.click();
    } catch {}

    setIsSubmitting(true);

    try {
      if (tab === "signin") {
        const res = await signInWithEmail(cleanEmail, password);
        if (!res.success) {
          setErrorMessage(res.error || "เข้าสู่ระบบไม่สำเร็จ");
          return;
        }
      } else {
        const res = await signUpWithEmail(cleanEmail, password, displayName.trim());
        if (!res.success) {
          setErrorMessage(res.error || "สมัครสมาชิกไม่สำเร็จ");
          return;
        }
      }

      // Success
      try {
        soundEffects.correct();
      } catch {}

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      soundEffects.click();
    } catch {}

    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setErrorMessage(res.error || "ไม่สามารถเชื่อมต่อ Google ได้");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ Google");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => {
        if (!isSubmitting && !isGoogleLoading) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-left my-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-52 h-24 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              {tab === "signin" ? (
                <LogIn className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-lg font-bold text-white tracking-tight"
              >
                {tab === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </h2>
              <p className="text-xs text-slate-400">
                {tab === "signin"
                  ? "ยินดีต้อนรับกลับสู่วงการเพลงไรวะ"
                  : "สร้างบัญชีเพื่อบันทึกสถิติและเพลย์ลิสต์ของคุณ"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isGoogleLoading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 my-5">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              tab === "signin"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            เข้าสู่ระบบ (Sign In)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("signup");
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              tab === "signup"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            สมัครสมาชิก (Sign Up)
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ชื่อที่แสดง (Display Name)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="เช่น ดีเจปาร์ตี้, เซียน 90s"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              อีเมล (Email)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="yourname@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || isGoogleLoading}
                className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || isGoogleLoading}
                className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isGoogleLoading}
            className="mt-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              <>
                {tab === "signin" ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {tab === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชีใหม่"}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-xs text-slate-500">หรือ</span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || isGoogleLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white text-xs font-medium transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
        >
          {isGoogleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.2C.7 9.6 0 12.3 0 15.2s.7 5.6 1.9 8l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.8 7.5 23.5 12 23.5z"
              />
            </svg>
          )}
          <span>เข้าสู่ระบบด้วย Google</span>
        </button>

        {/* Footer Toggle */}
        <p className="mt-4 text-center text-xs text-slate-400">
          {tab === "signin" ? (
            <>
              ยังไม่มีบัญชี?{" "}
              <button
                type="button"
                onClick={() => {
                  setTab("signup");
                  setErrorMessage(null);
                }}
                className="text-pink-400 hover:text-pink-300 font-medium cursor-pointer underline underline-offset-2"
              >
                สมัครสมาชิกที่นี่
              </button>
            </>
          ) : (
            <>
              มีบัญชีอยู่แล้ว?{" "}
              <button
                type="button"
                onClick={() => {
                  setTab("signin");
                  setErrorMessage(null);
                }}
                className="text-pink-400 hover:text-pink-300 font-medium cursor-pointer underline underline-offset-2"
              >
                เข้าสู่ระบบที่นี่
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
