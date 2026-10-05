"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - TV Party Display Mode
// High-contrast 1080p big-screen layout for living room TVs & projectors:
// live persistent scoreboard, corner QR code, dramatic buzzer spotlights,
// audio wave visualizer, round reveals & celebration podium
// ==========================================

import React, { useState, useEffect, useRef, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Tv,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  LogOut,
  Trophy,
  Zap,
  Disc3,
  Sparkles,
  Users,
  QrCode,
  Radio,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { useRoomRealtime } from "@/hooks/use-room-realtime";
import type { Player, Song } from "@/types";
import { ttsReader } from "@/lib/tts-reader";
import { getDeterministicAvatar } from "./player-card";
import { buildRoomJoinUrl } from "./qr-code-modal";
import { formatWrongGuessMessage, RESUME_AUDIO_CUE } from "./wrong-guess-banner";
import { PodiumView, getSortedPodiumPlayers } from "./podium-view";

export interface TVViewProps {
  roomRealtime: ReturnType<typeof useRoomRealtime>;
  onLeaveRoom?: () => void;
}

export interface LobbyReadyInfo {
  readyCount: number;
  totalCount: number;
  allReady: boolean;
}

/**
 * Calculates ready player count and readiness state for room lobby.
 */
export function getLobbyReadyCount(players: Player[]): LobbyReadyInfo {
  const totalCount = players.length;
  if (totalCount === 0) {
    return { readyCount: 0, totalCount: 0, allReady: false };
  }
  const readyCount = players.filter((p) => p.isReady || p.isHost).length;
  return {
    readyCount,
    totalCount,
    allReady: readyCount === totalCount,
  };
}

/**
 * Calculates remaining buzzer seconds from deadline timestamp.
 */
export function getBuzzerRemainingSeconds(
  deadline?: string | null,
  fallbackDurationSec = 10,
  nowMs = Date.now()
): number {
  if (!deadline) return fallbackDurationSec;
  const deadlineMs = new Date(deadline).getTime();
  if (isNaN(deadlineMs)) return fallbackDurationSec;
  const diffSec = Math.ceil((deadlineMs - nowMs) / 1000);
  return Math.max(0, diffSec);
}

export function TVView({ roomRealtime, onLeaveRoom }: TVViewProps): React.JSX.Element {
  const {
    roomCode,
    status,
    currentRound,
    totalRounds,
    gameMode,
    activeQuestion,
    buzzedPlayer,
    revealedSong,
    roundWinner,
    lastWrongGuess,
    players,
    isHost,
    isMuted,
    isAudioPlaying,
    nextRound,
    toggleMute,
  } = roomRealtime;

  const [origin, setOrigin] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buzzerSecondsLeft, setBuzzerSecondsLeft] = useState(10);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanCode = (roomCode || "").trim().toUpperCase();

  // Populate browser origin on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const joinUrl = useMemo(() => buildRoomJoinUrl(cleanCode, origin), [cleanCode, origin]);

  // Sorted players for live leaderboard
  const sortedLeaderboard = useMemo(() => getSortedPodiumPlayers(players), [players]);

  // Ready stats for lobby
  const { readyCount, totalCount, allReady } = useMemo(
    () => getLobbyReadyCount(players),
    [players]
  );

  // Audio / TTS playback for big TV speakers with unmount cleanup
  useEffect(() => {
    if (gameMode === "ai-lyrics") {
      if (status === "question_active" && activeQuestion?.lyrics && !isMuted) {
        ttsReader.speakLyrics(activeQuestion.lyrics);
      } else {
        ttsReader.stopSpeaking();
      }
      return () => {
        ttsReader.stopSpeaking();
      };
    }

    if (status === "question_active" && activeQuestion?.sliceUrl && audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }

    return () => {
      audioRef.current?.pause();
    };
  }, [status, activeQuestion?.sliceUrl, activeQuestion?.lyrics, isAudioPlaying, gameMode, isMuted]);

  // Audio and TTS mute sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
    if (gameMode === "ai-lyrics" && isMuted) {
      ttsReader.stopSpeaking();
    }
  }, [isMuted, gameMode]);

  // Countdown timer during buzzer phase
  useEffect(() => {
    if (status !== "buzzed") return;

    const tick = () => {
      setBuzzerSecondsLeft(getBuzzerRemainingSeconds(buzzedPlayer?.deadline));
    };
    tick();

    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [status, buzzedPlayer?.deadline]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Formatted spaced room code: e.g. "A B C 1 2 3"
  const spacedRoomCode = cleanCode.split("").join(" ");

  // 12 Visualizer bar heights for animated audio wave
  const visualizerWaveHeights = [35, 70, 50, 95, 60, 100, 85, 90, 55, 80, 45, 65];

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-white flex flex-col p-4 sm:p-6 lg:p-8 select-none overflow-x-hidden selection:bg-pink-500 selection:text-white">
      {/* Hidden audio element for TV speakers */}
      {activeQuestion?.sliceUrl && (
        <audio
          ref={audioRef}
          src={activeQuestion.sliceUrl}
          preload="auto"
          playsInline
          onEnded={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
            }
          }}
        />
      )}

      {/* Ambient background glows */}
      <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] bg-pink-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* 1. Top Bar */}
      <header className="w-full flex items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-800/80 z-20">
        {/* Left: Brand & Room Code */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>เพลงไรวะ?</span>
                <span className="text-xs sm:text-sm font-extrabold text-pink-400 px-2.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30">
                  TV Party Mode
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                {gameMode === "buzzer"
                  ? "โหมด แย่งกดกริ่ง"
                  : gameMode === "ai-lyrics"
                  ? "โหมด AI อ่านเนื้อเพลง"
                  : "โหมด ตัดเสียงเสี้ยววินาที"}
              </p>
            </div>
          </div>

          {/* Room Code Badge */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">ห้อง:</span>
            <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
              {cleanCode}
            </span>
          </div>
        </div>

        {/* Center: Round Indicator */}
        <div className="flex items-center">
          {status === "lobby" ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-sm sm:text-base font-bold">
              <Users className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>สถานะ: รอผู้เล่นเข้าร่วมห้อง</span>
            </div>
          ) : status === "game_over" ? (
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-base sm:text-lg font-black shadow-sm">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>สรุปผลการแข่งขัน</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-slate-900/90 border-2 border-purple-500/50 text-white shadow-lg shadow-purple-500/15">
              <Sparkles className="w-4 h-4 text-pink-400 animate-spin" />
              <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-200">
                ข้อที่ {currentRound || 1} / {totalRounds || 10}
              </span>
            </div>
          )}
        </div>

        {/* Right: Controls (Mute, Fullscreen, Leave) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
            title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-rose-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label="เต็มจอ (Fullscreen)"
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
            title="เต็มจอ (Fullscreen)"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-purple-400" />
            ) : (
              <Maximize2 className="w-5 h-5 text-purple-400" />
            )}
          </button>

          {onLeaveRoom && (
            <button
              type="button"
              onClick={onLeaveRoom}
              aria-label="ออกจากห้อง"
              className="p-3 rounded-2xl bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/60 text-rose-300 transition shadow-sm cursor-pointer"
              title="ออกจากห้อง"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Stage & Scoreboard Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 mt-6 z-10 min-h-0">
        {/* ======================================================== */}
        {/* Main Stage (Left / Center) */}
        {/* ======================================================== */}
        <main className="flex-1 flex flex-col justify-between rounded-3xl bg-slate-900/50 border border-slate-800/80 p-6 sm:p-8 lg:p-10 backdrop-blur-sm relative overflow-hidden min-h-[480px]">
          {/* ---------------------------------------------------- */}
          {/* PHASE: LOBBY */}
          {/* ---------------------------------------------------- */}
          {status === "lobby" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-sm sm:text-base font-bold mb-4">
                <QrCode className="w-4 h-4" />
                <span>สแกนเพื่อร่วมเล่นจากมือถือ</span>
              </div>

              {/* Big High-Contrast QR Code */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-2xl shadow-purple-500/20 border-4 border-purple-500/40 my-3 transition-transform hover:scale-[1.02]">
                <QRCodeCanvas
                  value={joinUrl}
                  size={260}
                  level="M"
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#090d16"
                />
              </div>

              {/* Room URL Hint */}
              <p className="font-mono text-sm sm:text-base text-slate-400 mt-2 truncate max-w-lg">
                {joinUrl}
              </p>

              {/* Room Code Display */}
              <div className="mt-5">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 block mb-1">
                  รหัสห้อง (Room Code)
                </span>
                <div className="inline-block px-8 py-3 rounded-3xl bg-slate-950 border-2 border-slate-800 shadow-inner">
                  <span className="font-mono text-5xl sm:text-6xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400 select-all">
                    {spacedRoomCode}
                  </span>
                </div>
              </div>

              {/* Waiting Count Banner */}
              <div className="mt-6 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-base sm:text-lg font-bold text-slate-200">
                  ผู้เล่นพร้อมแล้ว {readyCount}/{totalCount} คน
                </span>
                {allReady && totalCount > 0 && (
                  <span className="text-emerald-400 text-sm font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ทุกคนพร้อมแล้ว!</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* PHASE: QUESTION ACTIVE */}
          {/* ---------------------------------------------------- */}
          {status === "question_active" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6">
              {/* Optional Wrong Guess Alert Banner at top of stage */}
              {lastWrongGuess && (
                <div className="w-full max-w-2xl mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/95 via-rose-900/90 to-red-950/95 border-2 border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.4)] text-rose-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
                        <AlertCircle className="w-6 h-6 text-rose-400 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-xl font-black text-rose-200">
                          {formatWrongGuessMessage(lastWrongGuess)}
                        </p>
                        <p className="text-sm sm:text-base text-rose-300 font-bold mt-0.5">
                          {RESUME_AUDIO_CUE}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Large Animated Audio Wave Visualizer */}
              <div className="flex items-center justify-center gap-2 sm:gap-3.5 my-8 sm:my-12 h-36 sm:h-48 px-4">
                {visualizerWaveHeights.map((targetHeight, idx) => {
                  const isTall = idx % 2 === 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        height: isAudioPlaying ? `${targetHeight}%` : "20%",
                        animationDuration: `${0.6 + (idx % 4) * 0.2}s`,
                      }}
                      className={`w-3 sm:w-4 md:w-5 rounded-full transition-all duration-300 ${
                        isAudioPlaying
                          ? "bg-gradient-to-t from-pink-500 via-purple-500 to-cyan-300 shadow-[0_0_20px_rgba(236,72,153,0.6)] animate-pulse"
                          : "bg-slate-700/60"
                      }`}
                    />
                  );
                })}
              </div>

              {/* AI Lyrics Mode: Show speech prompt */}
              {gameMode === "ai-lyrics" && activeQuestion?.lyrics && (
                <div className="w-full max-w-2xl mb-6 p-6 rounded-3xl bg-slate-950/90 border border-purple-500/40 shadow-xl">
                  <div className="flex items-center justify-center gap-2 text-purple-300 text-sm font-bold uppercase tracking-wider mb-2">
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>AI กำลังอ่านเนื้อเพลง...</span>
                  </div>
                  <blockquote className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed italic">
                    "{activeQuestion.lyrics}"
                  </blockquote>
                </div>
              )}

              {/* Big Bold Cue Banner */}
              <div className="mt-4 animate-pulse">
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 tracking-tight">
                  🎵 ฟังเพลงแล้วกดกริ่งบนมือถือเพื่อตอบ!
                </h2>
                <p className="text-base sm:text-xl text-slate-300 font-semibold mt-3">
                  ใครกดกริ่งคนแรก จะได้สิทธิ์ตอบคำถามและรับคะแนนทันที!
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* PHASE: BUZZED SPOTLIGHT */}
          {/* ---------------------------------------------------- */}
          {status === "buzzed" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8">
              {/* Spotlight Glow Container */}
              <div className="w-full max-w-3xl p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-amber-500/25 via-rose-600/15 to-transparent border-3 border-amber-400 shadow-[0_0_90px_rgba(245,158,11,0.4)] relative flex flex-col items-center justify-center">
                {/* Flashing Siren / Bell */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-500/25 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-6 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-bounce">
                  <Zap className="w-10 h-10 sm:w-12 sm:h-12 fill-amber-300" />
                </div>

                {/* Buzzed Player Avatar */}
                {buzzedPlayer && (
                  <div className="mb-4">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 border-4 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center justify-center text-4xl sm:text-5xl overflow-hidden mx-auto">
                      <span role="img" aria-label="buzzed avatar">
                        {getDeterministicAvatar({
                          id: buzzedPlayer.id,
                          displayName: buzzedPlayer.displayName,
                        })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Buzzed Headline */}
                <h2 className="text-4xl sm:text-6xl font-black text-amber-300 tracking-tight drop-shadow-[0_0_20px_rgba(245,158,11,0.7)]">
                  🚨 {buzzedPlayer?.displayName || "มีคน"} กดกริ่งคนแรก!
                </h2>

                {/* Countdown Timer Subtitle */}
                <div className="mt-6 flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-950/80 border border-amber-500/40 shadow-inner">
                  <Clock className="w-6 h-6 text-amber-400 animate-spin" />
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                    กำลังพิมพ์ตอบ... (เหลือเวลา{" "}
                    <span className="font-mono font-black text-amber-300 text-3xl sm:text-4xl">
                      {buzzerSecondsLeft}
                    </span>{" "}
                    วินาที)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* PHASE: ROUND REVEAL */}
          {/* ---------------------------------------------------- */}
          {status === "revealing" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8">
              {/* Spinning Disc / Vinyl Record Graphic */}
              <div className="relative mb-6">
                <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-slate-900 border-4 border-slate-700 shadow-2xl flex items-center justify-center relative overflow-hidden animate-[spin_10s_linear_infinite]">
                  {/* Vinyl grooves */}
                  <div className="absolute inset-3 rounded-full border border-slate-800" />
                  <div className="absolute inset-6 rounded-full border border-slate-800" />
                  <div className="absolute inset-9 rounded-full border border-slate-800" />
                  {/* Center sticker */}
                  <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Disc3 className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
                  </div>
                </div>
              </div>

              {/* Revealed Song Title & Artist */}
              <div className="max-w-3xl">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-emerald-400 block mb-1">
                  เฉลยเพลงประจำข้อนี้
                </span>
                <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight drop-shadow-md">
                  {revealedSong?.title || "เฉลยชื่อเพลง"}
                </h2>
                <p className="text-2xl sm:text-3xl font-bold text-purple-300 mt-2">
                  {revealedSong?.artist || "ศิลปิน"}
                </p>

                {/* Metadata Badges (Year, Genre, Era) */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4">
                  {revealedSong?.releaseYear && (
                    <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs sm:text-sm font-bold text-slate-300">
                      ปี {revealedSong.releaseYear}
                    </span>
                  )}
                  {revealedSong?.genre?.nameTh && (
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-xs sm:text-sm font-bold text-purple-300">
                      {revealedSong.genre.nameTh}
                    </span>
                  )}
                  {revealedSong?.era && (
                    <span className="px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-xs sm:text-sm font-bold text-pink-300">
                      ยุค {revealedSong.era}
                    </span>
                  )}
                </div>
              </div>

              {/* Winner Spotlight or No Winner */}
              <div className="mt-8">
                {roundWinner ? (
                  <div className="inline-flex items-center gap-3 px-8 py-4 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/25 to-emerald-500/20 border-2 border-emerald-400 text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                    <Trophy className="w-8 h-8 text-emerald-400" />
                    <span className="text-2xl sm:text-3xl font-black">
                      🎉 {roundWinner.displayName} ตอบถูก! (+{roundWinner.scoreDelta || 100}{" "}
                      คะแนน)
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 text-lg sm:text-xl font-bold">
                    <span>⌛ หมดเวลา! ไม่มีผู้ตอบถูกในข้อนี้</span>
                  </div>
                )}
              </div>

              {/* Host Next Round Cue */}
              <p className="text-sm text-slate-400 mt-6 font-medium">
                {isHost
                  ? "หัวหน้าห้อง: กด 'ข้อถัดไป' บนอุปกรณ์ควบคุมเพื่อเริ่มเล่นต่อ"
                  : "รอหัวหน้าห้องเริ่มข้อถัดไป..."}
              </p>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* PHASE: GAME OVER (PODIUM) */}
          {/* ---------------------------------------------------- */}
          {status === "game_over" && (
            <div className="flex-1 flex flex-col items-center justify-center my-auto py-6">
              <PodiumView
                players={players}
                isHost={isHost}
                onPlayAgain={async () => {
                  await nextRound();
                }}
                onLeaveRoom={onLeaveRoom}
              />
            </div>
          )}
        </main>

        {/* ======================================================== */}
        {/* Right Column: Persistent Live Leaderboard & Corner QR */}
        {/* ======================================================== */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col justify-between gap-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 p-5 sm:p-6 backdrop-blur-sm">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-lg text-white">ตารางคะแนนสด</h3>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                {players.length} คน
              </span>
            </div>

            {/* Leaderboard List */}
            <div className="mt-4 flex flex-col gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {sortedLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  ยังไม่มีผู้เล่นในห้อง
                </div>
              ) : (
                sortedLeaderboard.map((player, idx) => {
                  const rank = idx + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;
                  const isBuzzedNow = buzzedPlayer?.id === player.id;
                  const avatar = getDeterministicAvatar(player);
                  const isImage =
                    avatar.startsWith("http://") ||
                    avatar.startsWith("https://") ||
                    avatar.startsWith("/");

                  let cardStyle = "bg-slate-950/70 border-slate-800/90 text-slate-300";
                  if (isBuzzedNow) {
                    cardStyle =
                      "bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 text-amber-200 animate-pulse";
                  } else if (isTop1) {
                    cardStyle =
                      "bg-amber-500/10 border-amber-400/60 shadow-sm shadow-amber-500/10 text-amber-200";
                  } else if (isTop2) {
                    cardStyle = "bg-slate-800/60 border-slate-400/50 text-slate-100";
                  } else if (isTop3) {
                    cardStyle = "bg-amber-900/15 border-amber-700/50 text-amber-300";
                  }

                  return (
                    <div
                      key={player.id || idx}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Icon / Number */}
                        <div className="w-6 text-center font-mono font-black text-sm shrink-0">
                          {isTop1 ? (
                            <span className="text-base select-none">👑</span>
                          ) : isTop2 ? (
                            <span className="text-base select-none">🥈</span>
                          ) : isTop3 ? (
                            <span className="text-base select-none">🥉</span>
                          ) : (
                            <span className="text-slate-500">#{rank}</span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatar}
                              alt={player.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl select-none">{avatar}</span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="min-w-0 flex flex-col">
                          <span
                            className="font-bold text-sm sm:text-base text-white truncate"
                            title={player.displayName}
                          >
                            {player.displayName}
                          </span>
                          {isBuzzedNow && (
                            <span className="text-[11px] font-extrabold text-amber-400 flex items-center gap-1">
                              <Zap className="w-3 h-3 fill-amber-400" />
                              <span>กำลังตอบคำถาม...</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 pl-2">
                        <span className="inline-block font-mono text-base sm:text-lg font-black text-purple-300">
                          {player.score ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Right: Mini Spectator Join QR Code */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center gap-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <div className="bg-white p-2 rounded-xl shrink-0 shadow-sm">
              <QRCodeCanvas
                value={joinUrl}
                size={80}
                level="L"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#090d16"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-pink-400 uppercase tracking-wider flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" />
                <span>สแกนเข้าเล่น</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                เปิดกล้องมือถือสแกนแล้วร่วมแข่งได้เลย!
              </p>
              <p className="font-mono text-xs font-bold text-amber-300 mt-1">ห้อง {cleanCode}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default TVView;
