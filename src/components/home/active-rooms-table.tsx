"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Active Rooms Table Component
// Real-time directory of active multiplayer rooms on home landing page
// With password unlock prompt, direct join, and warm cafe styling
// ==========================================

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Users,
  Lock,
  Radio,
  Volume2,
  Bell,
  Bot,
  RefreshCw,
  ArrowRight,
  Disc3,
  X,
  KeyRound,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { savePlayerSession } from "@/lib/session-storage";
import { useAuth } from "@/hooks/use-auth";

export interface ActiveRoomItem {
  roomCode: string;
  status: string;
  hostDisplayName: string;
  hostAvatar: string;
  gameMode: string;
  totalRounds: number;
  currentRound: number;
  playerCount?: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ActiveRoomsTable() {
  const router = useRouter();
  const { profile } = useAuth();

  const [rooms, setRooms] = useState<ActiveRoomItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Password / Quick Join Modal State
  const [joiningRoom, setJoiningRoom] = useState<ActiveRoomItem | null>(null);
  const [joinNickname, setJoinNickname] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Pre-fill nickname from auth or storage
  useEffect(() => {
    if (profile?.displayName) {
      setJoinNickname(profile.displayName);
    } else if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("pleng_nickname") || "";
        if (saved) setJoinNickname(saved);
      } catch {}
    }
  }, [profile?.displayName]);

  // Fetch active rooms from API
  const fetchActiveRooms = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await fetch("/api/room/list", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.rooms)) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.warn("[ActiveRoomsTable] Failed to fetch active rooms:", err);
    } finally {
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, []);

  // Polling every 7 seconds
  useEffect(() => {
    fetchActiveRooms();
    const interval = setInterval(() => {
      fetchActiveRooms();
    }, 7000);
    return () => clearInterval(interval);
  }, [fetchActiveRooms]);

  // Handle clicking "Join" on a room row
  const handleOpenJoin = (room: ActiveRoomItem) => {
    setJoiningRoom(room);
    setJoinPassword("");
    setJoinError(null);
  };

  // Execute Join API call
  const handleConfirmJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joiningRoom) return;

    const nickname = joinNickname.trim();
    if (!nickname) {
      setJoinError("กรุณากรอกชื่อเล่นของคุณ");
      return;
    }
    if (nickname.length > 25) {
      setJoinError("ชื่อเล่นต้องไม่เกิน 25 ตัวอักษร");
      return;
    }

    if (joiningRoom.isLocked && !joinPassword.trim()) {
      setJoinError("ห้องนี้มีรหัสผ่าน กรุณากรอกรหัสผ่านเพื่อเข้าร่วม");
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: joiningRoom.roomCode,
          displayName: nickname,
          password: joinPassword.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setJoinError(data.error || "ไม่สามารถเข้าร่วมห้องได้");
        return;
      }

      // Persist session in storage
      savePlayerSession(joiningRoom.roomCode, {
        playerId: data.playerId,
        sessionToken: data.sessionToken,
        displayName: nickname,
        isHost: data.isHost,
      });

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("pleng_nickname", nickname);
        } catch {}
      }

      // Navigate to room page
      router.push(`/room/${joiningRoom.roomCode}`);
    } catch {
      setJoinError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    } finally {
      setIsJoining(false);
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case "audio-slice":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25">
            <Volume2 className="w-3 h-3 text-amber-500" />
            <span>Audio Slice</span>
          </span>
        );
      case "buzzer":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/25">
            <Bell className="w-3 h-3 text-orange-500" />
            <span>แย่งกดกริ่ง</span>
          </span>
        );
      case "ai-lyrics":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/25">
            <Bot className="w-3 h-3 text-rose-500" />
            <span>AI อ่านเนื้อเพลง</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
            <span>{mode}</span>
          </span>
        );
    }
  };

  return (
    <section className="w-full max-w-5xl lg:max-w-6xl my-6 z-10 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
              <span>ห้องที่กำลังเปิดเล่นอยู่ (Active Rooms)</span>
              {rooms.length > 0 && (
                <span className="text-xs bg-amber-500 text-stone-950 font-bold px-2.5 py-0.5 rounded-full font-mono">
                  {rooms.length} ห้อง
                </span>
              )}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              กดปุ่มเข้าร่วมห้องเพื่อเข้าไปเล่นกับเพื่อนได้ทันที
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchActiveRooms(true)}
          disabled={isRefreshing}
          className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
          <span>รีเฟรช</span>
        </button>
      </div>

      {/* Rooms Table Card */}
      <div className="bg-white/80 dark:bg-stone-900/70 border border-stone-200/90 dark:border-stone-800/90 rounded-3xl overflow-hidden shadow-sm backdrop-blur-sm">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">กำลังค้นหาห้องที่เปิดอยู่...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mb-1">
              <Disc3 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
              ยังไม่มีห้องที่เปิดอยู่ในขณะนี้
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm">
              เป็นคนแรกที่เปิดห้อง! กดปุ่ม &ldquo;สร้างห้องเล่นกับเพื่อน&rdquo; ด้านบน แล้วส่งรหัสให้เพื่อนเข้ามาร่วมแจมได้เลย
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View (Optimized for phones - zero horizontal overflow) */}
            <div className="sm:hidden divide-y divide-stone-100 dark:divide-stone-800/80">
              {rooms.map((room) => {
                const isLobby = room.status === "lobby";
                return (
                  <div
                    key={room.roomCode}
                    className="p-4 flex flex-col gap-3 hover:bg-amber-500/5 transition-colors"
                  >
                    {/* Top row: Room Code & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black tracking-wider text-stone-900 dark:text-white">
                          {room.roomCode}
                        </span>
                        {room.isLocked && (
                          <span
                            title="ห้องนี้มีรหัสผ่าน"
                            className="text-amber-600 dark:text-amber-400 bg-amber-500/15 p-1 rounded-md"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      {isLobby ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>รอผู้เล่น (Lobby)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>กำลังเล่นอยู่</span>
                        </span>
                      )}
                    </div>

                    {/* Middle row: Host & Player Count Highlight */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg select-none shrink-0">{room.hostAvatar}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-stone-800 dark:text-stone-200 truncate">
                            {room.hostDisplayName}
                          </div>
                          <div className="text-[10px] text-stone-400 dark:text-stone-500">
                            หัวหน้าห้อง
                          </div>
                        </div>
                      </div>

                      {/* Player Count Pill on Mobile */}
                      <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{room.playerCount || 1} คน</span>
                      </span>
                    </div>

                    {/* Bottom row: Mode badge & Join CTA */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100/60 dark:border-stone-800/40">
                      <div>{getModeBadge(room.gameMode)}</div>
                      <button
                        type="button"
                        onClick={() => handleOpenJoin(room)}
                        className="min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>เข้าเล่น</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs font-semibold bg-stone-50/50 dark:bg-stone-950/30">
                    <th className="py-3 px-4 sm:px-5">รหัสห้อง</th>
                    <th className="py-3 px-3 sm:px-4">หัวหน้าห้อง</th>
                    <th className="py-3 px-3 sm:px-4">ผู้เล่น</th>
                    <th className="py-3 px-3 sm:px-4">โหมดการเล่น</th>
                    <th className="py-3 px-3 sm:px-4">สถานะ</th>
                    <th className="py-3 px-4 sm:px-5 text-right">เข้าร่วม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                  {rooms.map((room) => {
                    const isLobby = room.status === "lobby";
                    return (
                      <tr
                        key={room.roomCode}
                        className="hover:bg-amber-500/5 transition-colors group"
                      >
                        {/* Room Code & Lock */}
                        <td className="py-3.5 px-4 sm:px-5 font-mono font-black text-stone-900 dark:text-stone-100">
                          <div className="flex items-center gap-2">
                            <span className="tracking-wider text-sm sm:text-base font-black">
                              {room.roomCode}
                            </span>
                            {room.isLocked && (
                              <span
                                title="ห้องนี้มีรหัสผ่าน"
                                className="text-amber-600 dark:text-amber-400 bg-amber-500/15 p-1 rounded-md"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Host Name & Avatar */}
                        <td className="py-3.5 px-3 sm:px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base select-none">{room.hostAvatar}</span>
                            <span className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[120px] sm:max-w-[160px]">
                              {room.hostDisplayName}
                            </span>
                          </div>
                        </td>

                        {/* Player Count */}
                        <td className="py-3.5 px-3 sm:px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{room.playerCount || 1} คน</span>
                          </span>
                        </td>

                        {/* Game Mode */}
                        <td className="py-3.5 px-3 sm:px-4">
                          {getModeBadge(room.gameMode)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 sm:px-4">
                          {isLobby ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>รอผู้เล่น (Lobby)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>กำลังเล่นอยู่</span>
                            </span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="py-3.5 px-4 sm:px-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenJoin(room)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>เข้าเล่น</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* JOIN ROOM MODAL (With Password prompt if locked)         */}
      {/* ======================================================== */}
      {isMounted && joiningRoom && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => {
                if (!isJoining) setJoiningRoom(null);
              }}
              className="absolute top-5 right-5 text-stone-500 hover:text-stone-900 dark:hover:text-white p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2.5 shadow-sm">
                {joiningRoom.isLocked ? (
                  <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <h3 className="text-xl font-black text-stone-900 dark:text-white">
                เข้าร่วมห้อง <span className="font-mono text-amber-600 dark:text-amber-400">{joiningRoom.roomCode}</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                หัวหน้าห้อง: {joiningRoom.hostAvatar} {joiningRoom.hostDisplayName}
              </p>
            </div>

            <form onSubmit={handleConfirmJoin} className="space-y-4">
              {/* Nickname Input */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  ชื่อเล่นของคุณ (1-25 ตัวอักษร)
                </label>
                <input
                  type="text"
                  autoFocus={!joiningRoom.isLocked}
                  placeholder="เช่น สายร้องเพลง, ดีเจจำเป็น"
                  value={joinNickname}
                  onChange={(e) => {
                    setJoinNickname(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  maxLength={25}
                  disabled={isJoining}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-4 py-3 min-h-[44px] text-base sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Password Input (If Room is Locked) */}
              {joiningRoom.isLocked && (
                <div>
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>รหัสผ่านห้อง (ห้องนี้ตั้งรหัสป้องกันไว้)</span>
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="กรอกรหัสผ่านห้อง..."
                    value={joinPassword}
                    onChange={(e) => {
                      setJoinPassword(e.target.value);
                      if (joinError) setJoinError(null);
                    }}
                    disabled={isJoining}
                    className="w-full bg-amber-50/50 dark:bg-stone-950 border border-amber-300 dark:border-amber-800/80 focus:border-amber-500 rounded-2xl px-4 py-3 min-h-[44px] text-base sm:text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
                  />
                </div>
              )}

              {joinError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoiningRoom(null)}
                  disabled={isJoining}
                  className="flex-1 py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isJoining || joinNickname.trim().length === 0}
                  className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังเข้าร่วม...</span>
                    </>
                  ) : (
                    <>
                      <span>เข้าห้องเลย</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
