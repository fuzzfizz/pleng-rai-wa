"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Profile Modal
// User profile management, preset avatar picker, account info & sign out
// ==========================================

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Calendar,
  LogOut,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { soundEffects } from "@/lib/sound-effects";
import { AvatarPicker, PRESET_AVATARS as CURATED_AVATARS } from "@/components/common/avatar-picker";

export interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PRESET_AVATARS: string[] = CURATED_AVATARS.map((a) => a.emoji);

export function ProfileModal({
  isOpen,
  onClose,
}: ProfileModalProps): React.JSX.Element | null {
  const { user, profile, updateProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🦊");
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync draft states with profile whenever modal opens or profile changes
  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.displayName || "");
      setSelectedAvatar(profile.avatar || "🦊");
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowSignOutConfirm(false);
    }
  }, [isOpen, profile]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving && !isSigningOut) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSaving, isSigningOut]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMessage("กรุณากรอกชื่อที่แสดง");
      return;
    }
    if (cleanName.length > 30) {
      setErrorMessage("ชื่อที่แสดงต้องมีความยาวไม่เกิน 30 ตัวอักษร");
      return;
    }

    try {
      soundEffects.click();
    } catch {}

    setIsSaving(true);

    try {
      const res = await updateProfile({
        displayName: cleanName,
        avatar: selectedAvatar,
      });

      if (!res.success) {
        setErrorMessage(res.error || "ไม่สามารถบันทึกข้อมูลได้");
        return;
      }

      try {
        soundEffects.correct();
      } catch {}

      setSuccessMessage("บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      soundEffects.click();
    } catch {}

    setIsSigningOut(true);
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Format joined date nicely
  const joinedDateFormatted = (() => {
    const rawDate = profile?.createdAt || user?.created_at;
    if (!rawDate) return "ไม่ระบุ";
    try {
      const d = new Date(rawDate);
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "ไม่ระบุ";
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => {
        if (!isSaving && !isSigningOut) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-left my-auto flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-52 h-24 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-pink-500/20">
              {selectedAvatar}
            </div>
            <div>
              <h2
                id="profile-modal-title"
                className="text-lg font-bold text-white tracking-tight"
              >
                โปรไฟล์ของฉัน
              </h2>
              <p className="text-xs text-slate-400">
                ปรับแต่งชื่อเล่นและรูปตัวแทนสำหรับเล่นเกม
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isSigningOut}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 my-4 space-y-5">
          {/* Status Messages */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} id="profile-edit-form" className="space-y-5">
            {/* Display Name Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ชื่อที่แสดง (Display Name)
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {displayName.length}/30
                </span>
              </div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="เช่น ดีเจปาร์ตี้, เซียน 90s"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  disabled={isSaving}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Avatar Picker (10 Curated Avatars) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                เลือกรูปตัวแทน (Preset Avatar)
              </label>
              <AvatarPicker
                value={selectedAvatar}
                onChange={(emoji) => setSelectedAvatar(emoji)}
                disabled={isSaving}
              />
            </div>
          </form>

          {/* Account Information Card */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 text-xs">
            <h3 className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>ข้อมูลบัญชี</span>
            </h3>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>อีเมล</span>
              </span>
              <span className="text-slate-200 font-mono truncate max-w-[200px]">
                {user?.email || "ไม่ระบุ"}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>วันที่เริ่มใช้งาน</span>
              </span>
              <span className="text-slate-200 font-mono">
                {joinedDateFormatted}
              </span>
            </div>
          </div>

          {/* Sign Out Section */}
          <div className="pt-2 border-t border-slate-800/80">
            {showSignOutConfirm ? (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col gap-2.5 animate-in fade-in">
                <p className="text-xs text-rose-300 font-medium">
                  คุณต้องการออกจากระบบหรือไม่?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSigningOut ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    <span>ยืนยันออกจากระบบ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignOutConfirm(false)}
                    disabled={isSigningOut}
                    className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ (Sign Out)</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isSigningOut}
            className="py-2.5 px-4 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            form="profile-edit-form"
            disabled={isSaving || isSigningOut}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-pink-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>บันทึกการเปลี่ยนแปลง</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
