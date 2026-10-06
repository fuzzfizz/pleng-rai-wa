"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Home Landing Page
// Room creation modal, 6-character code join, solo practice link,
// recent room rejoin shortcut, and game mode showcase
// ==========================================

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Music,
  Users,
  Play,
  Sparkles,
  Volume2,
  Bell,
  Bot,
  ArrowRight,
  Shield,
  X,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { isValidRoomCode } from "@/lib/room-code";
import {
  savePlayerSession,
  getLastRoomCode,
} from "@/lib/session-storage";
import { validateNickname } from "@/app/room/[code]/page";
import { getDeterministicAvatar } from "@/components/room/player-card";
import { NavHeader } from "@/components/common/nav-header";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const router = useRouter();
  const { profile } = useAuth();

  // Join Room State
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  // Create Room Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [hostNickname, setHostNickname] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Recent visited room shortcut
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const last = getLastRoomCode();
    if (last && isValidRoomCode(last)) {
      setLastRoomCode(last);
    }
  }, []);

  // Pre-fill host nickname if authenticated
  useEffect(() => {
    if (profile?.displayName && !hostNickname) {
      setHostNickname(profile.displayName);
    }
  }, [profile?.displayName, hostNickname]);

  // Handle Joining an existing room
  const handleJoinRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanCode = (roomCode || "").trim().toUpperCase();
    if (!cleanCode) {
      setJoinError("กรุณากรอกรหัสห้อง 6 ตัวอักษร");
      return;
    }

    if (!isValidRoomCode(cleanCode)) {
      setJoinError("รหัสห้องต้องเป็นตัวอักษรหรือตัวเลข 6 หลัก (เช่น ABC123)");
      return;
    }

    setJoinError(null);
    router.push(`/room/${cleanCode}`);
  };

  // Handle Creating a new multiplayer room
  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const validation = validateNickname(hostNickname);
    if (!validation.valid) {
      setCreateError(validation.error || "กรุณากรอกชื่อเล่น");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostDisplayName: hostNickname.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setCreateError(data.error || "เกิดข้อผิดพลาดในการสร้างห้อง");
        return;
      }

      // Persist host player session in localStorage
      savePlayerSession(data.roomCode, {
        playerId: data.playerId,
        sessionToken: data.sessionToken,
        displayName: hostNickname.trim(),
        isHost: true,
      });

      setIsCreateModalOpen(false);
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setCreateError(err?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsCreating(false);
    }
  };

  const hostAvatarPreview =
    profile?.avatar ||
    getDeterministicAvatar({
      displayName: hostNickname || "หัวหน้าห้อง",
    });

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950 bg-radial-glow overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Decorative ambient background lights */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <NavHeader className="max-w-5xl z-10 py-2" />

      {/* Hero Section */}
      <section className="w-full max-w-3xl flex flex-col items-center text-center my-auto py-12 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-400 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>เว็บเกมทายเพลงออนไลน์ เล่นฟรีกับเพื่อนได้ทุกที่</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4 leading-tight">
          ฟังแป๊บเดียว... <br />
          <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 text-gradient">
            จะรู้ไหมว่า "เพลงไรวะ?"
          </span>
        </h2>

        <p className="text-base sm:text-lg text-slate-400 max-w-xl mb-8">
          ประลองความเซียนเพลงไทย ทายเสี้ยววินาที แย่งกดกริ่ง หรือฟังเสียง AI อ่านเนื้อเพลงแบบไร้อารมณ์ เล่นชิวๆ บนมือถือและคอมพิวเตอร์
        </p>

        {/* Action Box */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                if (!hostNickname && profile?.displayName) {
                  setHostNickname(profile.displayName);
                }
                setIsCreateModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-base shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Users className="w-5 h-5" />
              <span>สร้างห้องเล่นกับเพื่อน</span>
            </button>

            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-xs text-slate-500">หรือเข้าร่วมห้อง</span>
            </div>

            <form onSubmit={handleJoinRoom} className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="กรอกรหัสห้อง (เช่น ABC123)"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    if (joinError) setJoinError(null);
                  }}
                  maxLength={6}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 min-h-[44px] text-base sm:text-sm text-center tracking-widest font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 transition-colors uppercase"
                />
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-700 text-white px-5 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                  title="เข้าร่วมห้อง"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {joinError && (
                <p className="text-xs text-rose-400 text-center font-medium mt-1 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{joinError}</span>
                </p>
              )}
            </form>

            {/* Quick rejoin shortcut if last room exists */}
            {lastRoomCode && (
              <div className="pt-1">
                <Link
                  href={`/room/${lastRoomCode}`}
                  className="w-full py-2 px-3 rounded-xl bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/15 text-purple-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>กลับเข้าห้องล่าสุด: <strong className="font-mono">{lastRoomCode}</strong></span>
                </Link>
              </div>
            )}

            <Link
              href="/play/solo"
              className="mt-1 w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 rounded-xl hover:bg-slate-800/50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>เล่นคนเดียวซ้อมมือก่อน</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 3 Game Modes Grid */}
      <section className="w-full max-w-5xl z-10 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode 1 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-pink-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-3">
              <Volume2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">โหมด Audio Slice</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ฟังเสียงเพลงสั้นเพียง 1, 2 หรือ 5 วินาที แล้วทายชื่อเพลง ท้าทายหูทิพย์ขั้นสุด
            </p>
          </div>

          {/* Mode 2 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-purple-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">โหมดกดกริ่งแย่งตอบ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              เพลงจะเล่นไปเรื่อยๆ ใครมั่นใจให้กดกริ่งหยุดเพลงทันที คนกดเร็วสุดได้สิทธิ์ตอบก่อน!
            </p>
          </div>

          {/* Mode 3 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">โหมด AI อ่านเนื้อเพลง ⭐</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ให้เสียง AI อ่านเนื้อเพลงท่อนเปิดหรือท่อนฮุกแบบเรียบนิ่ง ไร้ทำนอง ชวนขำและจำยากมาก
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-5xl flex items-center justify-between text-xs text-slate-600 py-4 border-t border-slate-900 z-10">
        <p>© 2026 เพลงไรวะ? (Pleng-Rai-Wa) • 100% Free Public Music Game</p>
        <div className="flex gap-4">
          <Link href="/admin" className="hover:text-slate-400 transition-colors">
            เครื่องมือเพิ่มเพลง
          </Link>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* CREATE ROOM MODAL                                        */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                if (!isCreating) setIsCreateModalOpen(false);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-500/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white">สร้างห้องเล่นกับเพื่อน</h3>
              <p className="text-xs text-slate-400 mt-1">
                ตั้งชื่อเล่นของคุณเพื่อรับบทเป็นหัวหน้าห้อง (Host)
              </p>
            </div>

            {/* Live Host Avatar Preview */}
            <div className="flex flex-col items-center justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl shadow-inner select-none transition-transform hover:scale-105">
                <span>{hostAvatarPreview}</span>
              </div>
              <span className="text-xs text-slate-500 mt-1">อวาตาร์ประจำตัวคุณ</span>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label
                  htmlFor="hostNickname"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  ชื่อเล่นของคุณ (1-25 ตัวอักษร)
                </label>
                <div className="relative">
                  <input
                    id="hostNickname"
                    type="text"
                    autoFocus
                    placeholder="เช่น ดีเจนุ้ย, แชมป์เพลงฮิต"
                    value={hostNickname}
                    onChange={(e) => {
                      setHostNickname(e.target.value);
                      if (createError) setCreateError(null);
                    }}
                    maxLength={25}
                    disabled={isCreating}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-2xl px-4 py-3 min-h-[44px] text-base sm:text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-slate-500 font-mono">
                    {hostNickname.length}/25
                  </span>
                </div>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating || hostNickname.trim().length === 0}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังสร้างห้อง...</span>
                    </>
                  ) : (
                    <>
                      <span>สร้างห้องเลย!</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
