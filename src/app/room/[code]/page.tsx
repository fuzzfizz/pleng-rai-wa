"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Page Route
// Integrates Player View, TV View, Nickname Registration,
// Session Restoration & Realtime Orchestration
// ==========================================

import React, { use, useState, useEffect, useCallback, useMemo, Suspense } from "react";
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
import type { Player, RoomSettings } from "@/types";

/**
 * Fallback room settings if room metadata hasn't arrived from server yet.
 */
export const DEFAULT_CLIENT_ROOM_SETTINGS: RoomSettings = {
  gameMode: "buzzer",
  answerInputMode: "autocomplete",
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
 * Loading skeleton displayed while hydrating session or params.
 */
export function RoomLoadingSkeleton({ code }: { code?: string }): React.JSX.Element {
  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-pink-500 selection:text-white">
      <div className="flex flex-col items-center text-center gap-4 animate-pulse">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
          <Music className="w-8 h-8 text-pink-400 animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">กำลังเชื่อมต่อห้องแข่งขัน...</h2>
          {code && (
            <p className="font-mono text-sm text-slate-400 mt-1">รหัสห้อง: {code.toUpperCase()}</p>
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
    <div className="min-h-screen w-full bg-slate-950 bg-radial-glow flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">รหัสห้องไม่ถูกต้อง</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          รหัสห้อง <span className="font-mono font-bold text-rose-300">"{code}"</span> ไม่ถูกต้อง รหัสห้องต้องเป็นตัวอักษรหรือตัวเลข 6 หลัก (เช่น ABC123)
        </p>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors cursor-pointer"
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

  // Guest Nickname Entry State
  const [nickname, setNickname] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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
    };
  }, [storedSession]);

  // Realtime hook initialization
  const roomRealtime = useRoomRealtime(cleanCode, initialPlayer);

  // Leave room action
  const handleLeave = useCallback(() => {
    clearPlayerSession(cleanCode);
    router.push("/");
  }, [cleanCode, router]);

  // Guest join submission handler
  const handleGuestJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const validation = validateNickname(nickname);
    if (!validation.valid) {
      setJoinError(validation.error || "กรุณากรอกชื่อเล่น");
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: cleanCode,
          displayName: nickname.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setJoinError(data.error || "ไม่สามารถเข้าร่วมห้องได้");
        return;
      }

      const newSession: PlayerSession = {
        roomCode: cleanCode,
        playerId: data.playerId,
        sessionToken: data.sessionToken,
        displayName: nickname.trim(),
        isHost: Boolean(data.isHost),
        savedAt: new Date().toISOString(),
      };

      savePlayerSession(cleanCode, newSession);
      setStoredSession(newSession);
    } catch (err: any) {
      setJoinError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsJoining(false);
    }
  };

  // 1. Invalid Room Code
  if (!isCodeValid) {
    return <InvalidRoomCodeCard code={rawCode} />;
  }

  // 2. Loading Skeleton while checking session
  if (!isHydrated) {
    return <RoomLoadingSkeleton code={cleanCode} />;
  }

  // 3. TV Party Mode: Spectator big-screen display
  if (viewMode === "tv") {
    return <TVView roomRealtime={roomRealtime} onLeaveRoom={handleLeave} />;
  }

  // 4. Guest Nickname Entry Modal/Card (if no session exists for player mode)
  if (!storedSession && !roomRealtime.myPlayer) {
    const previewAvatar = getDeterministicAvatar({ displayName: nickname || "ผู้เล่น" });

    return (
      <main className="min-h-screen w-full bg-slate-950 bg-radial-glow flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Lights */}
        <div className="absolute top-10 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="flex items-center gap-2 mb-6 z-10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">เพลงไรวะ?</h1>
            <p className="text-xs text-slate-400">Pleng-Rai-Wa Music Quiz</p>
          </div>
        </div>

        {/* Nickname Entry Card */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold mb-3">
              <Users className="w-3.5 h-3.5" />
              <span>เข้าร่วมห้อง [{cleanCode}]</span>
            </div>
            <h2 className="text-2xl font-black text-white">ยินดีต้อนรับสู่ห้องเพลง!</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              ตั้งชื่อเล่นของคุณเพื่อเริ่มเล่นและประลองความเซียนกับเพื่อน
            </p>
          </div>

          {/* Live Cheerful Avatar Preview */}
          <div className="flex flex-col items-center justify-center mb-5">
            <div className="w-20 h-20 rounded-3xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-4xl shadow-inner select-none transition-transform hover:scale-105">
              <span>{previewAvatar}</span>
            </div>
            <span className="text-xs text-slate-500 mt-1.5">อวาตาร์ประจำชื่อของคุณ</span>
          </div>

          <form onSubmit={handleGuestJoin} className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-xs font-semibold text-slate-300 mb-1.5">
                ชื่อเล่นของคุณ (1-25 ตัวอักษร)
              </label>
              <div className="relative">
                <input
                  id="nickname"
                  type="text"
                  autoFocus
                  placeholder="เช่น ดีเจป๊อป, บอสเพลงฮิต"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  maxLength={25}
                  disabled={isJoining}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                />
                <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-mono">
                  {nickname.length}/25
                </span>
              </div>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{joinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining || nickname.trim().length === 0}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-base shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← กลับหน้าหลัก
              </Link>
              <Link
                href={`/room/${cleanCode}?view=tv`}
                className="text-xs text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1"
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
          await roomRealtime.refetchState();
        }}
        onLeaveRoom={handleLeave}
      />
    );
  }

  // question_active, buzzed, revealing
  return <GameView roomRealtime={roomRealtime} onLeaveRoom={handleLeave} />;
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
