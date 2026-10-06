"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - New Playlist Page
// Create a new custom playlist with song catalog selector and 5s audio preview
// ==========================================

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, ArrowLeft, ShieldAlert } from "lucide-react";
import { NavHeader } from "@/components/common/nav-header";
import { AuthModal } from "@/components/auth/auth-modal";
import { PlaylistEditor } from "@/components/playlist/playlist-editor";
import { useAuth } from "@/hooks/use-auth";
import type { Playlist } from "@/types";

export default function NewPlaylistPage(): React.JSX.Element {
  const router = useRouter();
  const { user, isLoading, isGuest } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleSaveSuccess = (saved: Playlist) => {
    router.push("/playlists?tab=my");
  };

  const handleCancel = () => {
    router.push("/playlists");
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        <NavHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm text-stone-500 dark:text-stone-400">กำลังตรวจสอบข้อมูลผู้ใช้...</p>
        </div>
      </div>
    );
  }

  // Guest or unauthenticated state
  if (!user || isGuest) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col pb-safe">
        <NavHeader />
        <main className="flex-1 max-w-lg w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-5 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            เข้าสู่ระบบเพื่อสร้างเพลย์ลิสต์
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-2 leading-relaxed">
            คุณจำเป็นต้องมีบัญชีเพื่อบันทึกและจัดการเพลย์ลิสต์เพลงที่คุณสร้างขึ้น
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:flex-1 min-h-[44px] px-5 rounded-2xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-stone-50 dark:text-stone-900 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-stone-900/10 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
            </button>
            <Link
              href="/playlists"
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-2xl bg-stone-200/70 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-stone-300/60 dark:border-stone-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับหน้าเพลย์ลิสต์</span>
            </Link>
          </div>

          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col pb-safe">
      <NavHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <PlaylistEditor
          userId={user.id}
          onSaveSuccess={handleSaveSuccess}
          onCancel={handleCancel}
        />
      </main>
    </div>
  );
}
