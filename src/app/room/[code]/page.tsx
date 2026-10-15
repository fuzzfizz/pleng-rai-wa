"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Page Route
// Integrates Player View, TV View, Nickname Registration,
// Session Restoration & Realtime Orchestration
// ==========================================

import React, { use, useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Music,
  Users,
  Tv,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { isValidRoomCode } from "@/lib/room-code";
import {
  loadPlayerSession,
  savePlayerSession,
  clearPlayerSession,
  type PlayerSession,
} from "@/lib/session-storage";
import { useRoomRealtime } from "@/hooks/use-room-realtime";
import { LobbyView } from "@/components/room/lobby-view";
import { GameView } from "@/components/room/game-view";
import { TVView } from "@/components/room/tv-view";
import { PodiumView } from "@/components/room/podium-view";
import { getDeterministicAvatar } from "@/components/room/player-card";
import { AvatarPicker, PRESET_AVATARS } from "@/components/common/avatar-picker";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";
import { loadPublicSongLibrary } from "@/lib/services/song-library-cache";
import type { Player, RoomSettings, Song } from "@/types";

/**
 * Fallback room settings if room metadata hasn't arrived from server yet.
 */
export const DEFAULT_CLIENT_ROOM_SETTINGS: RoomSettings = {
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

/**
 * Validates a player nickname. Must be between 1 and 25 non-whitespace characters.
 */
export function validateNickname(nickname: unknown): { valid: boolean; error?: string } {
  if (!nickname || typeof nickname !== "string") {
    return { valid: false, error: "กรุณากรอกชื่อเล่น" };
  }
  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "กรุณากรอกชื่อเล่น" };
  }
  if (trimmed.length > 25) {
    return { valid: false, error: "ชื่อเล่นต้องมีความยาวไม่เกิน 25 ตัวอักษร" };
  }
  return { valid: true };
}

/**
 * Resolves initial nickname and avatar from user profile if available,
 * respecting user manual override if the user already started editing.
 */
export function getAutoFilledProfileData(
  profile: { displayName?: string | null; avatar?: string | null } | null | undefined,
  currentNickname: string,
  hasUserEdited: boolean
): { nickname: string; avatar: string } | null {
  if (!profile?.displayName) return null;
  return {
    nickname: hasUserEdited ? currentNickname : profile.displayName,
    avatar: profile.avatar || "🦊",
  };
}

/**
 * Resolves room view mode from query search parameter.
 * Returns "tv" if ?view=tv (case-insensitive), otherwise "player".
 */
export function resolveRoomViewMode(viewParam: string | null | undefined): "tv" | "player" {
  if (viewParam && viewParam.trim().toLowerCase() === "tv") {
    return "tv";
  }
  return "player";
}

/**
 * Builds standard room route URL for internal navigation or sharing.
 */
export function buildRoomUrl(roomCode: string, options?: { view?: "tv" }): string {
  const cleanCode = (roomCode || "").trim().toUpperCase();
  if (options?.view === "tv") {
    return `/room/${cleanCode}?view=tv`;
  }
  return `/room/${cleanCode}`;
}

export interface RoomPageProps {
  params: Promise<{ code: string }>;
}

/**
 * Determines whether a visiting user should be automatically joined into the room
 * using their registered account profile without showing the nickname entry form.
 */
export function shouldAutoJoinRoom(params: {
  isHydrated: boolean;
  isAuthLoading: boolean;
  isCodeValid: boolean;
  hasStoredSession: boolean;
  hasRealtimePlayer: boolean;
  isAuthenticated: boolean;
  hasDisplayName: boolean;
}): boolean {
  return (
    params.isHydrated &&
    !params.isAuthLoading &&
    params.isCodeValid &&
    !params.hasStoredSession &&
    !params.hasRealtimePlayer &&
    params.isAuthenticated &&
    params.hasDisplayName
  );
}

/**
 * Loading skeleton displayed while hydrating session or params.
 */
export function RoomLoadingSkeleton({ code, message }: { code?: string; message?: string }): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] dark:bg-[#0c0a09] flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-stone-950">
      <div className="flex flex-col items-center text-center gap-4 animate-pulse">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
          <Music className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">{message || "กำลังเชื่อมต่อห้องแข่งขัน..."}</h2>
          {code && (
            <p className="font-mono text-sm text-stone-500 dark:text-stone-400 mt-1">รหัสห้อง: {code.toUpperCase()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * View displayed when an invalid room code is provided in the URL.
 */
export function InvalidRoomCodeCard({ code }: { code: string }): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] dark:bg-[#0c0a09] bg-radial-glow flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 dark:bg-stone-900/95 border border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100 mb-2">รหัสห้องไม่ถูกต้อง</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
          รหัสห้อง <span className="font-mono font-bold text-rose-500">"{code}"</span> ไม่ถูกต้อง รหัสห้องต้องเป็นตัวอักษรหรือตัวเลข 6 หลัก (เช่น ABC123)
        </p>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 font-bold text-sm transition-colors cursor-pointer"
        >
          <span>กลับสู่หน้าหลัก (Home)</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Inner room component that extracts search params and manages view state.
 */
function RoomPageContent({ rawCode }: { rawCode: string }): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const viewMode = resolveRoomViewMode(viewParam);

  const cleanCode = (rawCode || "").trim().toUpperCase();
  const isCodeValid = isValidRoomCode(cleanCode);

  const [isHydrated, setIsHydrated] = useState(false);
  const [storedSession, setStoredSession] = useState<PlayerSession | null>(null);

  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<string>(PRESET_AVATARS[0].emoji);

  // Guest Nickname Entry State
  const [nickname, setNickname] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const hasUserEditedNickname = useRef(false);
  const autoJoinAttemptedRef = useRef(false);

  // Song catalog for autocomplete search
  const [songLibrary, setSongLibrary] = useState<Song[]>([]);

  useEffect(() => {
    let isMounted = true;
    loadPublicSongLibrary()
      .then((songs) => {
        if (isMounted && Array.isArray(songs) && songs.length > 0) {
          setSongLibrary(songs);
        }
      })
      .catch((err) => console.warn("[RoomPage] Failed to fetch song library for autocomplete:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-fill nickname and avatar from user profile or sessionStorage (Issue 2)
  useEffect(() => {
    if (profile?.displayName && !hasUserEditedNickname.current) {
      setNickname(profile.displayName);
    }
    if (profile?.avatar) {
      setSelectedAvatar(profile.avatar);
    } else if (typeof window !== "undefined") {
      const savedAvatar = window.sessionStorage.getItem("pleng_avatar");
      if (savedAvatar) {
        setSelectedAvatar(savedAvatar);
      }
    }
  }, [profile?.displayName, profile?.avatar]);

  // Sync storedSession avatar if profile has an avatar and session is mismatched
  useEffect(() => {
    if (profile?.avatar && storedSession && storedSession.avatar !== profile.avatar) {
      const updated = { ...storedSession, avatar: profile.avatar };
      setStoredSession(updated);
      savePlayerSession(cleanCode, updated);
    }
  }, [profile?.avatar, storedSession, cleanCode]);

  // Initialize and check localStorage session on mount
  useEffect(() => {
    if (!isCodeValid) {
      setIsHydrated(true);
      return;
    }
    const session = loadPlayerSession(cleanCode);
    if (session) {
      setStoredSession(session);
    }
    setIsHydrated(true);
  }, [cleanCode, isCodeValid]);

  // Map PlayerSession (playerId) to Partial<Player> (id) for useRoomRealtime
  const initialPlayer: Partial<Player> | undefined = useMemo(() => {
    if (!storedSession) return undefined;
    return {
      id: storedSession.playerId,
      displayName: storedSession.displayName,
      isHost: Boolean(storedSession.isHost),
      sessionToken: storedSession.sessionToken,
      avatarUrl: storedSession.avatar,
    };
  }, [storedSession]);

  // Realtime hook initialization
  const roomRealtime = useRoomRealtime(cleanCode, initialPlayer);

  // Ref to prevent duplicate leave requests
  const hasLeftRef = useRef(false);

  // Keep a ref of storedSession so sendLeaveSignal always accesses the latest value
  // without triggering re-runs of effects or unmount cleanups during initial hydration.
  const storedSessionRef = useRef<PlayerSession | null>(storedSession);
  useEffect(() => {
    storedSessionRef.current = storedSession;
    if (storedSession?.playerId) {
      hasLeftRef.current = false;
    }
  }, [storedSession]);

  // Keep latest refs of players and isHost so sendLeaveSignal has current room context
  const realtimePlayersRef = useRef<Player[]>(roomRealtime.players);
  useEffect(() => {
    realtimePlayersRef.current = roomRealtime.players;
  }, [roomRealtime.players]);

  const isHostRef = useRef(roomRealtime.isHost);
  useEffect(() => {
    isHostRef.current = roomRealtime.isHost;
  }, [roomRealtime.isHost]);

  // Update stored session if client is promoted to host via host migration (Requirement 6)
  useEffect(() => {
    if (roomRealtime.isHost && storedSession && !storedSession.isHost) {
      const updated = { ...storedSession, isHost: true };
      setStoredSession(updated);
      savePlayerSession(cleanCode, updated);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(`pleng_host_${cleanCode}`, "true");
        } catch {}
      }
    }
  }, [roomRealtime.isHost, storedSession, cleanCode]);

  // Reliable leave signal dispatcher using sendBeacon or keepalive fetch (Requirement 7)
  const sendLeaveSignal = useCallback(() => {
    if (hasLeftRef.current) return;
    const session = storedSessionRef.current;
    if (!session?.playerId) return;

    hasLeftRef.current = true;

    const currentPlayers = realtimePlayersRef.current || [];
    const remainingPlayers = currentPlayers.filter((p) => p.id !== session.playerId);

    const candidateHost =
      remainingPlayers.find(
        (p) => p.avatarUrl !== "📺" && !p.displayName?.includes("(TV)")
      ) || remainingPlayers[0];

    const isHostLeaving = Boolean(session.isHost || isHostRef.current);

    const payload = JSON.stringify({
      playerId: session.playerId,
      isHost: isHostLeaving,
      remainingPlayers,
      candidateHost: candidateHost
        ? {
            id: candidateHost.id,
            displayName: candidateHost.displayName,
            avatarUrl: candidateHost.avatarUrl,
          }
        : undefined,
    });

    let beaconSent = false;
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: "application/json" });
        beaconSent = navigator.sendBeacon(`/api/room/${cleanCode}/leave`, blob);
      } catch {
        beaconSent = false;
      }
    }

    if (!beaconSent && typeof window !== "undefined") {
      try {
        fetch(`/api/room/${cleanCode}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch {}
    }

    clearPlayerSession(cleanCode);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(`pleng_host_${cleanCode}`);
        window.sessionStorage.removeItem(`pleng_session_${cleanCode}`);
      } catch {}
    }
  }, [cleanCode]);

  // Leave room action (triggers real-time leave & room dissolution if host)
  const handleLeave = useCallback(() => {
    sendLeaveSignal();
    router.push("/");
  }, [sendLeaveSignal, router]);

  // Listen for browser back navigation (popstate), tab close (pagehide), and component unmount
  useEffect(() => {
    const handlePopState = () => {
      sendLeaveSignal();
    };
    const handlePageHide = () => {
      sendLeaveSignal();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", handlePageHide);
      // Trigger leave signal when component unmounts (client-side route change or back)
      sendLeaveSignal();
    };
  }, [sendLeaveSignal]);

  // Core join execution helper (used by both auto-join and manual guest join)
  const performJoin = useCallback(
    async (joinName: string, joinAvatar: string, isAuto: boolean = false): Promise<boolean> => {
      const validation = validateNickname(joinName);
      if (!validation.valid) {
        setJoinError(validation.error || "กรุณากรอกชื่อเล่น");
        return false;
      }

      if (isAuto) {
        setIsAutoJoining(true);
      } else {
        setIsJoining(true);
      }
      setJoinError(null);

      try {
        const res = await fetch("/api/room/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: cleanCode,
            displayName: joinName.trim(),
            avatar: joinAvatar,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setJoinError(data.error || "ไม่สามารถเข้าร่วมห้องได้");
          return false;
        }

        const newSession: PlayerSession = {
          roomCode: cleanCode,
          playerId: data.playerId,
          sessionToken: data.sessionToken,
          displayName: joinName.trim(),
          avatar: joinAvatar,
          isHost: Boolean(data.isHost),
          savedAt: new Date().toISOString(),
        };

        savePlayerSession(cleanCode, newSession);
        storedSessionRef.current = newSession;
        hasLeftRef.current = false;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("pleng_avatar", joinAvatar);
          } catch {}
        }
        setStoredSession(newSession);
        return true;
      } catch (err: any) {
        setJoinError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
        return false;
      } finally {
        if (isAuto) {
          setIsAutoJoining(false);
        } else {
          setIsJoining(false);
        }
      }
    },
    [cleanCode]
  );

  // Auto-join effect for authenticated users with profile displayName
  useEffect(() => {
    const canAutoJoin = shouldAutoJoinRoom({
      isHydrated,
      isAuthLoading,
      isCodeValid,
      hasStoredSession: Boolean(storedSession),
      hasRealtimePlayer: Boolean(roomRealtime.myPlayer),
      isAuthenticated: Boolean(user || profile?.displayName),
      hasDisplayName: Boolean(profile?.displayName?.trim()),
    });

    if (canAutoJoin && !autoJoinAttemptedRef.current) {
      autoJoinAttemptedRef.current = true;
      const avatarToUse = profile?.avatar || "🦊";
      performJoin(profile!.displayName!, avatarToUse, true);
    }
  }, [
    isHydrated,
    isAuthLoading,
    isCodeValid,
    storedSession,
    roomRealtime.myPlayer,
    user,
    profile?.displayName,
    profile?.avatar,
    performJoin,
  ]);

  // Guest join submission handler
  const handleGuestJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await performJoin(nickname, selectedAvatar, false);
  };

  // 1. Invalid Room Code
  if (!isCodeValid) {
    return <InvalidRoomCodeCard code={rawCode} />;
  }

  // 2. Loading Skeleton while checking session or waiting for initial auth resolution
  if (!isHydrated || (isAuthLoading && !storedSession)) {
    return <RoomLoadingSkeleton code={cleanCode} />;
  }

  // 2.1 Auto-joining skeleton for authenticated users
  if (isAutoJoining) {
    return (
      <RoomLoadingSkeleton
        code={cleanCode}
        message={`กำลังเข้าร่วมห้องในชื่อ "${profile?.displayName || "คุณ"}"...`}
      />
    );
  }

  // 3. TV Party Mode: Spectator big-screen display
  if (viewMode === "tv") {
    return <TVView roomRealtime={roomRealtime} onLeaveRoom={handleLeave} />;
  }

  // 4. Guest Nickname Entry Modal/Card (if no session exists for player mode)
  if (!storedSession && !roomRealtime.myPlayer) {
    const previewAvatar =
      selectedAvatar ||
      getDeterministicAvatar({ displayName: nickname || "ผู้เล่น" });

    return (
      <main className="min-h-screen w-full bg-[#FAF7F2] dark:bg-[#0c0a09] bg-radial-glow flex flex-col items-center justify-center p-4 relative overflow-hidden text-stone-900 dark:text-stone-100">
        {/* Ambient Lights */}
        <div className="absolute top-10 left-1/3 w-96 h-96 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-orange-500/10 dark:bg-orange-700/08 rounded-full blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="flex items-center gap-2 mb-6 z-10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Music className="w-5 h-5 text-stone-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans">เพลงไรวะ?</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">Pleng-Rai-Wa Music Quiz</p>
          </div>
        </div>

        {/* Nickname Entry Card */}
        <div className="w-full max-w-md bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-xl z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold mb-3">
              <Users className="w-3.5 h-3.5" />
              <span>เข้าร่วมห้อง [{cleanCode}]</span>
            </div>
            <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">ยินดีต้อนรับสู่ห้องเพลง!</h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
              ตั้งชื่อเล่นของคุณเพื่อเริ่มเล่นและประลองความเซียนกับเพื่อน
            </p>
          </div>

          {/* Profile Auto-fill Helper Notice (Issue 2) */}
          {profile?.displayName && (
            <div className="mb-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 flex items-start sm:items-center gap-2.5 shadow-sm">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
              <div className="leading-relaxed">
                <span>กำลังเข้าร่วมในชื่อโปรไฟล์: </span>
                <strong className="font-bold text-amber-700 dark:text-amber-300">{profile.displayName}</strong>{" "}
                <span className="text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs">
                  (คุณสามารถเปลี่ยนชื่อเล่นสำหรับห้องนี้ได้)
                </span>
              </div>
            </div>
          )}

          {/* Live Cheerful Avatar Preview */}
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="w-20 h-20 rounded-3xl bg-stone-100 dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 flex items-center justify-center text-4xl shadow-inner select-none transition-transform hover:scale-105">
              <span>{previewAvatar}</span>
            </div>
            <span className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">อวาตาร์ประจำตัวคุณ</span>
          </div>

          {/* Curated 10 Avatars Picker */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              เลือกรูปตัวแทน (Preset Avatar)
            </label>
            <AvatarPicker
              value={selectedAvatar}
              onChange={(avatar) => setSelectedAvatar(avatar)}
              disabled={isJoining}
            />
          </div>

          <form onSubmit={handleGuestJoin} className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                ชื่อเล่นของคุณ (1-25 ตัวอักษร)
              </label>
              <div className="relative">
                <input
                  id="nickname"
                  type="text"
                  autoFocus={!profile?.displayName}
                  placeholder="เช่น ดีเจป๊อป, บอสเพลงฮิต"
                  value={nickname}
                  onChange={(e) => {
                    hasUserEditedNickname.current = true;
                    setNickname(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  maxLength={25}
                  disabled={isJoining}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 focus:border-amber-500 dark:focus:border-amber-500 rounded-2xl px-4 py-3 min-h-[44px] text-base sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none transition-colors"
                />
                <span className="absolute right-3.5 top-3.5 text-xs text-stone-400 dark:text-stone-500 font-mono">
                  {nickname.length}/25
                </span>
              </div>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{joinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining || nickname.trim().length === 0}
              className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังเข้าร่วมห้อง...</span>
                </>
              ) : (
                <>
                  <span>เข้าร่วมห้อง (Join)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="/"
                className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              >
                ← กลับหน้าหลัก
              </Link>
              <Link
                href={`/room/${cleanCode}?view=tv`}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>เปิดโหมดจอทีวี (TV View)</span>
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // 5. Active Player View Orchestration based on roomRealtime status
  const currentStatus = roomRealtime.status;
  const currentSettings: RoomSettings =
    roomRealtime.room?.settings || DEFAULT_CLIENT_ROOM_SETTINGS;

  if (currentStatus === "lobby") {
    return (
      <LobbyView
        roomCode={cleanCode}
        players={roomRealtime.players}
        myPlayer={roomRealtime.myPlayer}
        isHost={roomRealtime.isHost}
        settings={currentSettings}
        onStartGame={async () => {
          await roomRealtime.nextRound();
        }}
        onToggleReady={async () => {
          await roomRealtime.setReady(!roomRealtime.myPlayer?.isReady);
        }}
        onUpdateSettings={async (settings: Partial<RoomSettings>) => {
          return await roomRealtime.updateSettings(settings);
        }}
        onTransferHost={async (newHostPlayerId: string) => {
          return await roomRealtime.transferHost(newHostPlayerId);
        }}
        onLeaveRoom={handleLeave}
      />
    );
  }

  if (currentStatus === "game_over") {
    return (
      <PodiumView
        players={roomRealtime.players}
        isHost={roomRealtime.isHost}
        onPlayAgain={async () => {
          await roomRealtime.nextRound();
        }}
        onBackToLobby={async () => {
          await roomRealtime.resetToLobby();
        }}
        onLeaveRoom={handleLeave}
      />
    );
  }

  // question_active, buzzed, revealing
  return (
    <GameView
      roomRealtime={roomRealtime}
      songLibrary={songLibrary}
      onLeaveRoom={handleLeave}
      onSkipRound={roomRealtime.skipRound}
    />
  );
}

/**
 * Main Room Page route export wrapped in React Suspense boundary.
 */
export default function RoomPage({ params }: RoomPageProps): React.JSX.Element {
  // Support both React 19 async params Promise and pre-resolved params
  const resolvedParams: { code?: string } =
    params && typeof (params as any).then === "function" ? use(params) : (params as any);
  const rawCode = resolvedParams?.code || "";

  return (
    <Suspense fallback={<RoomLoadingSkeleton code={rawCode} />}>
      <RoomPageContent rawCode={rawCode} />
    </Suspense>
  );
}
