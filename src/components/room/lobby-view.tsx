"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Lobby View Component
// Room lobby screen for host & players: roster, ready check, TV mode & game start
// ==========================================

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Player, RoomSettings } from "@/types";
import {
  Music,
  Users,
  Copy,
  Check,
  QrCode,
  Settings,
  Tv,
  ExternalLink,
  Volume2,
  VolumeX,
  Play,
  LogOut,
  Sparkles,
  Sliders,
  Loader2,
  Info,
} from "lucide-react";
import { soundEffects, isMuted, setMuted } from "@/lib/sound-effects";
import { QRCodeModal } from "./qr-code-modal";
import { PlayerCard } from "./player-card";
import { HostSettingsModal } from "./host-settings-modal";

export interface LobbyViewProps {
  roomCode: string;
  players: Player[];
  myPlayer: Player | null;
  isHost: boolean;
  settings: RoomSettings;
  onStartGame: () => Promise<void>;
  onToggleReady: () => Promise<void>;
  onUpdateSettings: (settings: Partial<RoomSettings>) => Promise<boolean | void>;
  onTransferHost: (newHostPlayerId: string) => Promise<boolean | void>;
  onLeaveRoom?: () => void;
}

/**
 * Formats room settings into a clean, human-readable summary line.
 * e.g. "โหมด: แย่งกดกริ่ง • 10 ข้อ • 2.0 วินาที • ค้นหาชื่อเพลง"
 */
export function formatSettingsSummary(settings: RoomSettings): string {
  const modeLabel =
    settings.gameMode === "buzzer"
      ? "โหมด: แย่งกดกริ่ง"
      : settings.gameMode === "ai-lyrics"
      ? "โหมด: AI อ่านเนื้อเพลง"
      : "โหมด: ตัดเสียงเสี้ยววินาที";

  const roundsLabel =
    settings.totalRounds > 0 ? `${settings.totalRounds} ข้อ` : "ไม่จำกัดข้อ";

  const detailLabel =
    settings.gameMode === "ai-lyrics"
      ? settings.lyricsType === "intro"
        ? "ท่อนเปิด"
        : "ท่อนฮุก"
      : `${Number(settings.sliceDurationSec || 2.0).toFixed(1)} วินาที`;

  const inputLabel =
    settings.answerInputMode === "autocomplete"
      ? "ค้นหาชื่อเพลง"
      : settings.answerInputMode === "multiple-choice"
      ? "ตัวเลือก (ปรนัย)"
      : "พิมพ์เอง";

  return `${modeLabel} • ${roundsLabel} • ${detailLabel} • ${inputLabel}`;
}

export function LobbyView({
  roomCode,
  players,
  myPlayer,
  isHost,
  settings,
  onStartGame,
  onToggleReady,
  onUpdateSettings,
  onTransferHost,
  onLeaveRoom,
}: LobbyViewProps): React.JSX.Element {
  const router = useRouter();
  const [isQrModalOpen, setQrModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);

  const cleanCode = (roomCode || "").trim().toUpperCase();

  // Initialize SFX state on mount
  useEffect(() => {
    try {
      setSfxMuted(isMuted());
    } catch {}
  }, []);

  const handleToggleSfx = useCallback(() => {
    try {
      const nextMuted = !sfxMuted;
      setMuted(nextMuted);
      setSfxMuted(nextMuted);
      if (!nextMuted) {
        soundEffects.click();
      }
    } catch {}
  }, [sfxMuted]);

  const handleCopyCode = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(cleanCode);
      }
      setIsCopiedCode(true);
      try {
        soundEffects.click();
      } catch {}
      setTimeout(() => setIsCopiedCode(false), 2000);
    } catch {
      setIsCopiedCode(true);
      setTimeout(() => setIsCopiedCode(false), 2000);
    }
  }, [cleanCode]);

  const handleLeave = () => {
    try {
      soundEffects.click();
    } catch {}
    if (onLeaveRoom) {
      onLeaveRoom();
    } else {
      router.push("/");
    }
  };

  const handleStartGameClick = async () => {
    if (isStarting) return;
    try {
      setIsStarting(true);
      try {
        soundEffects.countdownTick();
      } catch {}
      await onStartGame();
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setIsStarting(false);
    }
  };

  const handleToggleReadyClick = async () => {
    if (isTogglingReady) return;
    try {
      setIsTogglingReady(true);
      try {
        soundEffects.click();
      } catch {}
      await onToggleReady();
    } catch (err) {
      console.error("Failed to toggle ready:", err);
    } finally {
      setIsTogglingReady(false);
    }
  };

  // Ready stats calculation
  const totalPlayers = players.length;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const readyNonHostCount = nonHostPlayers.filter((p) => p.isReady).length;
  const allNonHostReady =
    nonHostPlayers.length > 0 && readyNonHostCount === nonHostPlayers.length;
  const hasOtherPlayers = nonHostPlayers.length > 0;

  const settingsSummary = formatSettingsSummary(settings);

  return (
    <div className="relative min-h-screen min-h-[100dvh] flex flex-col justify-between p-4 sm:p-8 bg-[#FAF7F2] dark:bg-[#0c0a09] bg-radial-glow overflow-x-hidden selection:bg-amber-500 selection:text-stone-950 pt-safe pb-safe transition-colors duration-200">
      {/* Decorative ambient background lights */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-16 right-1/4 w-80 h-80 bg-orange-500/10 dark:bg-orange-700/08 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Top Navigation Bar */}
      <header className="w-full max-w-5xl lg:max-w-6xl mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 text-xs sm:text-sm lg:text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white px-3 py-2 lg:px-4 lg:py-2.5 min-h-[44px] rounded-full border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white/80 dark:bg-stone-900/70 transition-colors cursor-pointer"
            title="ออกจากห้องกลับหน้าหลัก"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากห้อง</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Music className="w-4 h-4 text-stone-950" />
            </div>
            <span className="font-bold text-sm text-stone-900 dark:text-white tracking-tight">เพลงไรวะ?</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* TV Party Mode button */}
          <Link
            href={`/room/${cleanCode}?view=tv`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs lg:text-sm text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white px-3 py-2 lg:px-4 lg:py-2.5 min-h-[44px] rounded-full border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 transition-all shadow-sm shadow-amber-500/10"
            title="เปิดจอใหญ่สำหรับปาร์ตี้ / ต่อทีวี"
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">จอทีวี (TV Mode)</span>
            <ExternalLink className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          </Link>

          {/* Sound FX Toggle */}
          <button
            onClick={handleToggleSfx}
            className={`p-2 lg:px-3 lg:py-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border text-xs lg:text-sm transition-colors cursor-pointer ${
              sfxMuted
                ? "bg-white/80 dark:bg-stone-900/80 border-stone-200 dark:border-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 shadow-sm"
            }`}
            title={sfxMuted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
            aria-label={sfxMuted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}
          >
            {sfxMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="w-full max-w-5xl lg:max-w-6xl mx-auto flex-1 flex flex-col items-center justify-start py-6 lg:py-10 z-10 space-y-6 lg:space-y-8">
        {/* Hero Card: Room Code & Action Controls */}
        <div className="w-full max-w-2xl lg:max-w-4xl bg-white/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl backdrop-blur-xl text-center relative overflow-hidden">
          {/* Background subtle glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-80 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ห้องปาร์ตี้ดนตรีสด</span>
          </div>

          <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-2">
            รหัสห้อง (Room Code)
          </h2>

          {/* Large Code Badge with Copy Action */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              onClick={handleCopyCode}
              title="คลิกเพื่อคัดลอกรหัสห้อง"
              className="inline-flex items-center gap-3 px-6 py-3 lg:px-10 lg:py-5 rounded-2xl bg-stone-50 dark:bg-stone-950/90 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-inner"
            >
              <span className="font-mono text-3xl sm:text-5xl lg:text-6xl font-black tracking-widest text-stone-900 dark:text-stone-100 select-all">
                {cleanCode || "------"}
              </span>
              <button
                type="button"
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-200/60 dark:bg-stone-800/80 group-hover:bg-amber-500/20 text-stone-600 dark:text-stone-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors"
                aria-label="คัดลอกรหัสห้อง"
              >
                {isCopiedCode ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons Row: QR Code & Host Settings */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                try {
                  soundEffects.click();
                } catch {}
                setQrModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 lg:px-6 lg:py-3.5 min-h-[44px] lg:min-h-[50px] rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700/80 text-xs sm:text-sm lg:text-base font-semibold transition-all active:scale-[0.98] cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>QR Code ชวนเพื่อน</span>
            </button>

            {isHost && (
              <button
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                  setSettingsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 lg:px-6 lg:py-3.5 min-h-[44px] lg:min-h-[50px] rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700/80 text-xs sm:text-sm lg:text-base font-semibold transition-all active:scale-[0.98] cursor-pointer"
              >
                <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>ตั้งค่าห้อง (Host)</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Settings Summary Pill */}
        <div className="w-full max-w-2xl lg:max-w-4xl flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 rounded-full bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 text-xs lg:text-sm text-stone-700 dark:text-stone-300 shadow-sm text-center">
            <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">{settingsSummary}</span>
          </div>
        </div>

        {/* 4. Players Roster Grid */}
        <section className="w-full space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-stone-900 dark:text-white text-base sm:text-lg lg:text-xl">
                ผู้เล่นในห้อง ({totalPlayers} คน)
              </h3>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs lg:text-sm px-3 py-1 lg:px-4 lg:py-1.5 rounded-full border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 text-stone-600 dark:text-stone-400">
              {allNonHostReady ? (
                <span className="text-emerald-500 font-medium">✓ ทุกคนพร้อมแล้ว!</span>
              ) : (
                <span>
                  พร้อมแล้ว {readyNonHostCount}/{nonHostPlayers.length || 1} คน
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 lg:gap-5">
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === myPlayer?.id}
              />
            ))}
          </div>
        </section>
      </main>

      {/* 5. Bottom Action Bar */}
      <footer className="w-full max-w-2xl lg:max-w-4xl mx-auto z-10 pt-4 pb-2 pb-safe">
        <div className="bg-white/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-xl flex flex-col items-center gap-3">
          {isHost ? (
            // Host Controls
            <>
              <button
                onClick={handleStartGameClick}
                disabled={!hasOtherPlayers || isStarting}
                className="w-full min-h-[44px] py-4 lg:py-5 px-8 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-lg lg:text-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังเข้าสู่เกม...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>เริ่มเกม (Start Game)</span>
                  </>
                )}
              </button>

              {!hasOtherPlayers ? (
                <div className="flex items-center gap-1.5 text-xs lg:text-sm text-amber-700 dark:text-amber-300 text-center">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    ต้องการผู้เล่นอย่างน้อย 2 คนเพื่อเริ่มเกม (แชร์รหัสห้องหรือ QR Code ให้เพื่อน)
                  </span>
                </div>
              ) : allNonHostReady ? (
                <div className="text-xs lg:text-sm text-emerald-600 dark:text-emerald-400 font-medium text-center">
                  ✓ ผู้เล่นทุกคนพร้อมแล้ว! Host สามารถกดเริ่มเกมได้ทันที
                </div>
              ) : (
                <div className="text-xs lg:text-sm text-stone-500 text-center">
                  รอผู้เล่นคนอื่นกดพร้อม ({readyNonHostCount}/{nonHostPlayers.length}) หรือ Host
                  สามารถกดเริ่มได้เลย
                </div>
              )}
            </>
          ) : (
            // Non-Host Controls
            <>
              <button
                onClick={handleToggleReadyClick}
                disabled={isTogglingReady}
                className={`w-full min-h-[44px] py-4 lg:py-5 px-8 rounded-2xl font-bold text-lg lg:text-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
                  myPlayer?.isReady
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                    : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20"
                }`}
              >
                {isTogglingReady ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : myPlayer?.isReady ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>✓ พร้อมแล้ว (กดเพื่อยกเลิก)</span>
                  </>
                ) : (
                  <>
                    <span>ฉันพร้อมแล้ว</span>
                  </>
                )}
              </button>

              <div className="text-xs lg:text-sm text-stone-500 text-center">
                รอ Host กดเริ่มเกม...
              </div>
            </>
          )}
        </div>
      </footer>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setQrModalOpen(false)}
        roomCode={cleanCode}
      />

      <HostSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        players={players}
        currentHostPlayerId={myPlayer?.id || players.find((p) => p.isHost)?.id || ""}
        onSaveSettings={onUpdateSettings}
        onTransferHost={onTransferHost}
      />
    </div>
  );
}

export default LobbyView;
