"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - QR Code & Share Modal
// Displays QR Code canvas, room code & copy utilities
// ==========================================

import React, { useState, useEffect, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { X, Copy, Check, QrCode, Share2, Link2, Sparkles } from "lucide-react";
import { soundEffects } from "@/lib/sound-effects";

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

/**
 * Builds the absolute or relative join URL for a room code.
 * Safe for SSR and browser execution.
 */
export function buildRoomJoinUrl(roomCode: string, origin?: string): string {
  const cleanCode = (roomCode || "").trim().toUpperCase();
  if (origin && origin.trim().length > 0) {
    const base = origin.replace(/\/+$/, "");
    return `${base}/room/${cleanCode}`;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/room/${cleanCode}`;
  }
  return `/room/${cleanCode}`;
}

export function QRCodeModal({ isOpen, onClose, roomCode }: QRCodeModalProps): React.JSX.Element | null {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [origin, setOrigin] = useState("");

  const cleanCode = (roomCode || "").trim().toUpperCase();

  // Populate origin on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const joinUrl = buildRoomJoinUrl(cleanCode, origin);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyLink = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(joinUrl);
      }
      setCopiedLink(true);
      try {
        soundEffects.click();
      } catch {}
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [joinUrl]);

  const handleCopyCode = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(cleanCode);
      }
      setCopiedCode(true);
      try {
        soundEffects.click();
      } catch {}
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [cleanCode]);

  if (!isOpen) {
    return null;
  }

  // Display characters spaced out: "A B C 2 3 4"
  const spacedCode = cleanCode.split("").join(" ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glows */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
          className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 id="qr-modal-title" className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight font-serif">
            สแกนเข้าห้องเล่นเกม
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-6">
          เปิดกล้องมือถือสแกน QR Code หรือแชร์ลิงก์ให้เพื่อนเข้าร่วมได้ทันที
        </p>

        {/* QR Code Canvas Card */}
        <div className="inline-flex flex-col items-center justify-center bg-white p-5 rounded-2xl shadow-md border border-stone-200 dark:border-stone-700 mb-6 transition-transform hover:scale-[1.02]">
          <QRCodeCanvas
            value={joinUrl}
            size={220}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#1c1917"
          />
        </div>

        {/* Prominent Room Code */}
        <div className="mb-6">
          <div className="text-xs text-stone-500 dark:text-stone-400 font-medium mb-1 uppercase tracking-wider">
            รหัสห้อง (Room Code)
          </div>
          <div className="inline-block px-5 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 shadow-inner">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-600 dark:text-amber-400 select-all">
              {spacedCode || "------"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCopyLink}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] rounded-2xl font-semibold text-sm transition-all cursor-pointer ${
              copiedLink
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20 active:scale-[0.98]"
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            <span>{copiedLink ? "คัดลอกลิงก์แล้ว!" : "คัดลอกลิงก์"}</span>
          </button>

          <button
            onClick={handleCopyCode}
            className={`flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] rounded-2xl font-semibold text-sm transition-all cursor-pointer ${
              copiedCode
                ? "bg-emerald-600 text-white border border-emerald-500"
                : "bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 active:scale-[0.98]"
            }`}
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? "คัดลอกแล้ว!" : "คัดลอกรหัส"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRCodeModal;
