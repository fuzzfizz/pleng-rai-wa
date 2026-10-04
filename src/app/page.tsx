"use client";

import { useState } from "react";
import Link from "next/link";
import { Music, Users, Play, Sparkles, Volume2, Bell, Bot, ArrowRight, Shield } from "lucide-react";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950 bg-radial-glow overflow-hidden">
      {/* Decorative ambient background lights */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">เพลงไรวะ?</h1>
            <p className="text-xs text-slate-400">Pleng-Rai-Wa Music Quiz</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-full border border-slate-800 hover:border-slate-700 bg-slate-900/60"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Portal</span>
          </Link>
        </div>
      </header>

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
              onClick={() => alert("ระบบสร้างห้องกำลังเชื่อมต่อใน Phase 4")}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-base shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Users className="w-5 h-5" />
              <span>สร้างห้องเล่นกับเพื่อน</span>
            </button>

            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-xs text-slate-500">หรือ</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="กรอกรหัสห้อง (เช่น ABC123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-center tracking-widest font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors uppercase"
              />
              <button
                onClick={() => {
                  if (!roomCode) return alert("กรุณากรอกรหัสห้อง");
                  alert(`กำลังเข้าร่วมห้อง: ${roomCode}`);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white px-5 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => alert("โหมดฝึกซ้อมเดี่ยวพร้อมเล่นใน Phase 3")}
              className="mt-2 w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>เล่นคนเดียวซ้อมมือก่อน</span>
            </button>
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
    </main>
  );
}
