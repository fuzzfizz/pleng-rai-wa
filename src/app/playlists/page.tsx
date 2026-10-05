"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Playlist Catalog Page
// Displays public curated playlists & user-created playlists with tabs,
// search/filter, and instant creation navigation
// ==========================================

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ListMusic,
  Plus,
  Globe,
  User,
  Music2,
  Sparkles,
  Loader2,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { NavHeader } from "@/components/common/nav-header";
import { AuthModal } from "@/components/auth/auth-modal";
import { PlaylistCard } from "@/components/playlist/playlist-card";
import { PlaylistService } from "@/lib/services/playlist-service";
import { useAuth } from "@/hooks/use-auth";
import type { Playlist } from "@/types";
import { soundEffects } from "@/lib/sound-effects";

function PlaylistsPageContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading, isGuest } = useAuth();

  const initialTab = searchParams.get("tab") === "my" ? "my" : "public";
  const [activeTab, setActiveTab] = useState<"public" | "my">(initialTab);

  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [errorPublic, setErrorPublic] = useState<string | null>(null);
  const [errorUser, setErrorUser] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Fetch Public Playlists
  const loadPublicPlaylists = async () => {
    setIsLoadingPublic(true);
    setErrorPublic(null);
    try {
      const data = await PlaylistService.getPublicPlaylists();
      setPublicPlaylists(data);
    } catch (err: any) {
      console.error("Error loading public playlists:", err);
      setErrorPublic(err?.message || "ไม่สามารถโหลดเพลย์ลิสต์สาธารณะได้");
    } finally {
      setIsLoadingPublic(false);
    }
  };

  // Fetch User Playlists
  const loadUserPlaylists = async (userId: string) => {
    setIsLoadingUser(true);
    setErrorUser(null);
    try {
      const data = await PlaylistService.getUserPlaylists(userId);
      setUserPlaylists(data);
    } catch (err: any) {
      console.error("Error loading user playlists:", err);
      setErrorUser(err?.message || "ไม่สามารถโหลดเพลย์ลิสต์ของคุณได้");
    } finally {
      setIsLoadingUser(false);
    }
  };

  useEffect(() => {
    loadPublicPlaylists();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserPlaylists(user.id);
    } else {
      setUserPlaylists([]);
    }
  }, [user?.id]);

  const handleCreateClick = () => {
    try {
      soundEffects.click();
    } catch {}

    if (!user || isGuest) {
      setIsAuthModalOpen(true);
    } else {
      router.push("/playlists/new");
    }
  };

  const handleDeletePlaylist = async (playlist: Playlist) => {
    if (!user) return;
    setDeleteError(null);
    try {
      await PlaylistService.deletePlaylist(playlist.id, user.id);
      setUserPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
      setPublicPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
      try {
        soundEffects.correct();
      } catch {}
    } catch (err: any) {
      console.error("Error deleting playlist:", err);
      setDeleteError(err?.message || "เกิดข้อผิดพลาดในการลบเพลย์ลิสต์");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <NavHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-violet-600/20 text-pink-400 border border-pink-500/30">
                <ListMusic className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                คลังเพลย์ลิสต์เพลง
              </h1>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
              เลือกเพลย์ลิสต์เพลงที่เปิดให้เล่นสาธารณะ หรือจัดเพลงโปรดของคุณเองเพื่อนำไปทายกับเพื่อนในห้อง
            </p>
          </div>

          {/* New Playlist Action */}
          <button
            type="button"
            onClick={handleCreateClick}
            className="min-h-[44px] px-5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างเพลย์ลิสต์ใหม่</span>
          </button>
        </div>

        {/* Delete Error Banner */}
        {deleteError && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{deleteError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteError(null)}
              className="text-xs text-rose-400 hover:text-white underline cursor-pointer shrink-0"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto sm:inline-flex">
          <button
            type="button"
            onClick={() => {
              try {
                soundEffects.click();
              } catch {}
              setActiveTab("public");
            }}
            className={`flex-1 sm:flex-initial min-h-[44px] px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "public"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>เพลย์ลิสต์สาธารณะ</span>
            {!isLoadingPublic && (
              <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400">
                {publicPlaylists.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                soundEffects.click();
              } catch {}
              setActiveTab("my");
            }}
            className={`flex-1 sm:flex-initial min-h-[44px] px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "my"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-4 h-4 text-pink-400" />
            <span>เพลย์ลิสต์ของฉัน</span>
            {user && !isLoadingUser && (
              <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400">
                {userPlaylists.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content: Public Playlists */}
        {activeTab === "public" && (
          <div>
            {isLoadingPublic ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                <p className="text-sm">กำลังโหลดเพลย์ลิสต์สาธารณะ...</p>
              </div>
            ) : errorPublic ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{errorPublic}</span>
              </div>
            ) : publicPlaylists.length === 0 ? (
              <div className="py-16 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 p-8">
                <Music2 className="w-12 h-12 mx-auto mb-3 text-slate-600 stroke-[1.5]" />
                <h3 className="text-base font-bold text-slate-300">
                  ยังไม่มีเพลย์ลิสต์สาธารณะ
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  มาร่วมเป็นคนแรกที่สร้างเพลย์ลิสต์สาธารณะแบ่งปันให้ทุกคนได้เล่นกันเถอะ!
                </p>
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="mt-4 min-h-[44px] px-4 rounded-xl bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-white border border-pink-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างเพลย์ลิสต์แรกเลย</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {publicPlaylists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    currentUserId={user?.id}
                    onDelete={handleDeletePlaylist}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: My Playlists */}
        {activeTab === "my" && (
          <div>
            {!user || isGuest ? (
              /* Guest Prompt Card */
              <div className="max-w-md mx-auto py-12 px-6 rounded-3xl bg-slate-900/90 border border-slate-800 text-center shadow-xl backdrop-blur-md">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                  <LogIn className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  เข้าสู่ระบบเพื่อจัดการเพลย์ลิสต์
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  สร้างและปรับแต่งเพลย์ลิสต์เพลงเฉพาะตัว จัดลำดับเพลงเพื่อเล่นเดี่ยวหรือนำไปทายกับเพื่อนในห้องแข่งขัน
                </p>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      soundEffects.click();
                    } catch {}
                    setIsAuthModalOpen(true);
                  }}
                  className="mt-5 w-full min-h-[44px] px-4 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
                </button>
              </div>
            ) : isLoadingUser ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                <p className="text-sm">กำลังโหลดเพลย์ลิสต์ของคุณ...</p>
              </div>
            ) : errorUser ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{errorUser}</span>
              </div>
            ) : userPlaylists.length === 0 ? (
              <div className="py-16 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 p-8">
                <Music2 className="w-12 h-12 mx-auto mb-3 text-slate-600 stroke-[1.5]" />
                <h3 className="text-base font-bold text-slate-300">
                  คุณยังไม่มีเพลย์ลิสต์ส่วนตัว
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  เริ่มสร้างเพลย์ลิสต์แรกของคุณได้ง่ายๆ เลือกเพลงที่ชอบอย่างน้อย 5 เพลงเพื่อใช้เล่นเกม
                </p>
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="mt-4 min-h-[44px] px-5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-pink-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างเพลย์ลิสต์แรกของคุณ</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {userPlaylists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    currentUserId={user?.id}
                    onDelete={handleDeletePlaylist}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Auth Modal for Guest Users */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          if (user?.id) {
            loadUserPlaylists(user.id);
          }
        }}
      />
    </div>
  );
}

export default function PlaylistsPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
          <NavHeader />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
          </div>
        </div>
      }
    >
      <PlaylistsPageContent />
    </Suspense>
  );
}
