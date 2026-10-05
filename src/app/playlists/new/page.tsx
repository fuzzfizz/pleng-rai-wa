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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <NavHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
          <p className="text-sm text-slate-400">กำลังตรวจสอบข้อมูลผู้ใช้...</p>
        </div>
      </div>
    );
  }

  // Guest or unauthenticated state
  if (!user || isGuest) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <NavHeader />
        <main className="flex-1 max-w-lg w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-5 shadow-lg shadow-pink-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            เข้าสู่ระบบเพื่อสร้างเพลย์ลิสต์
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            คุณจำเป็นต้องมีบัญชีเพื่อบันทึกและจัดการเพลย์ลิสต์เพลงที่คุณสร้างขึ้น
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:flex-1 min-h-[44px] px-5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
            </button>
            <Link
              href="/playlists"
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
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
