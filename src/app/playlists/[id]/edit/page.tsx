"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Edit Playlist Page
// Edit existing playlist with ownership verification and song reordering
// ==========================================

import React, { use, useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  AlertCircle,
  FileQuestion,
} from "lucide-react";
import { NavHeader } from "@/components/common/nav-header";
import { PlaylistEditor } from "@/components/playlist/playlist-editor";
import { PlaylistService } from "@/lib/services/playlist-service";
import { useAuth } from "@/hooks/use-auth";
import type { Playlist, Song } from "@/types";

export interface EditPlaylistPageProps {
  params: Promise<{ id: string }>;
}

function EditPlaylistContent({
  playlistId,
}: {
  playlistId: string;
}): React.JSX.Element {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, isGuest } = useAuth();

  const [playlistData, setPlaylistData] = useState<{
    playlist: Playlist;
    songs: Song[];
  } | null>(null);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initialPlaylist = useMemo(() => {
    if (!playlistData) return null;
    return { ...playlistData.playlist, songs: playlistData.songs };
  }, [playlistData]);

  useEffect(() => {
    if (!playlistId) return;

    setIsLoadingPlaylist(true);
    setLoadError(null);

    PlaylistService.getPlaylistById(playlistId)
      .then((res) => {
        if (!res) {
          setLoadError("ไม่พบเพลย์ลิสต์นี้ในระบบ");
        } else {
          setPlaylistData(res);
        }
      })
      .catch((err: any) => {
        console.error("Error loading playlist for edit:", err);
        setLoadError(err?.message || "เกิดข้อผิดพลาดในการโหลดเพลย์ลิสต์");
      })
      .finally(() => {
        setIsLoadingPlaylist(false);
      });
  }, [playlistId]);

  // Loading state (auth or playlist data)
  if (isAuthLoading || isLoadingPlaylist) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm text-stone-500 dark:text-stone-400">กำลังโหลดข้อมูลเพลย์ลิสต์...</p>
      </div>
    );
  }

  // Error or Not Found state
  if (loadError || !playlistData) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-stone-200/60 dark:bg-stone-800 border border-stone-300/60 dark:border-stone-700 flex items-center justify-center text-stone-500">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          {loadError || "ไม่พบเพลย์ลิสต์"}
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
          เพลย์ลิสต์นี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์ในการเข้าถึง
        </p>
        <Link
          href="/playlists"
          className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-2xl bg-stone-200/70 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors border border-stone-300/60 dark:border-stone-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปหน้ารวมเพลย์ลิสต์</span>
        </Link>
      </div>
    );
  }

  // Ownership verification
  const isOwner = user && user.id === playlistData.playlist.userId;
  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          ไม่มีสิทธิ์แก้ไขเพลย์ลิสต์นี้
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
          เฉพาะผู้สร้างเพลย์ลิสต์นี้เท่านั้นที่สามารถแก้ไขข้อมูลได้
        </p>
        <Link
          href="/playlists"
          className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-2xl bg-stone-200/70 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors border border-stone-300/60 dark:border-stone-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปหน้ารวมเพลย์ลิสต์</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
      <PlaylistEditor
        initialPlaylist={initialPlaylist}
        userId={user.id}
        onSaveSuccess={() => router.push("/playlists?tab=my")}
        onCancel={() => router.push("/playlists?tab=my")}
      />
    </div>
  );
}

export default function EditPlaylistPage({
  params,
}: EditPlaylistPageProps): React.JSX.Element {
  // Support both React 19 async params Promise and pre-resolved params
  const resolvedParams: { id?: string } =
    params && typeof (params as any).then === "function"
      ? use(params)
      : (params as any);

  const playlistId = resolvedParams?.id || "";

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col pb-safe">
      <NavHeader />
      <Suspense
        fallback={
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm text-stone-500 dark:text-stone-400">กำลังโหลด...</p>
          </div>
        }
      >
        <EditPlaylistContent playlistId={playlistId} />
      </Suspense>
    </div>
  );
}
