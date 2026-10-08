"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Song Edit Modal
// Modal for editing song metadata with AI Re-enrichment
// ==========================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  Loader2,
  Play,
  Pause,
  Square,
  Plus,
  Check,
  AlertCircle,
  Disc3,
  Volume2,
  Clock,
  FileText,
  Tag,
  Search,
  Scissors,
  ExternalLink,
} from "lucide-react";
import type { Song, Genre, ExtractedSongMetadata } from "@/types";

export interface SongEditModalProps {
  song: Song;
  genres: Genre[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedSong: Song) => void;
  apiKey?: string;
}

export function SongEditModal({
  song,
  genres,
  isOpen,
  onClose,
  onSaved,
  apiKey,
}: SongEditModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Form State
  const [title, setTitle] = useState(song?.title || "");
  const [artist, setArtist] = useState(song?.artist || "");
  const [releaseYear, setReleaseYear] = useState<number | undefined>(song?.releaseYear);
  const [era, setEra] = useState<string | undefined>(song?.era);
  const [genreId, setGenreId] = useState<string | undefined>(song?.genreId);
  const [aliases, setAliases] = useState<string[]>(song?.aliases || []);
  const [aliasInput, setAliasInput] = useState("");
  const [hookStartSec, setHookStartSec] = useState<number | undefined>(song?.hookStartSec);
  const [hookEndSec, setHookEndSec] = useState<number | undefined>(song?.hookEndSec);
  const [lyricsIntro, setLyricsIntro] = useState<string | undefined>(song?.lyricsIntro);
  const [lyricsChorus, setLyricsChorus] = useState<string | undefined>(song?.lyricsChorus);
  const [audioUrl, setAudioUrl] = useState<string>(song?.audioUrl || "");

  // AI & Action State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiUpdatedFields, setAiUpdatedFields] = useState<Set<string>>(new Set());

  // Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lyrics Splitter & Helper State
  const [isSplitterOpen, setIsSplitterOpen] = useState(false);
  const [fullLyricsInput, setFullLyricsInput] = useState("");
  const [lyricsNotice, setLyricsNotice] = useState<string | null>(null);

  // Audio Preview State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const [isPlayingHook, setIsPlayingHook] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const isPlayingHookRef = useRef(false);
  const hookEndSecRef = useRef<number | undefined>(hookEndSec);

  useEffect(() => {
    hookEndSecRef.current = hookEndSec;
  }, [hookEndSec]);

  // Mount check for client portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Stop audio helper
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isPlayingHookRef.current = false;
    setIsPlayingFull(false);
    setIsPlayingHook(false);
  }, []);

  // Reset/sync form state when song or isOpen changes
  useEffect(() => {
    if (song && isOpen) {
      setTitle(song.title || "");
      setArtist(song.artist || "");
      setReleaseYear(song.releaseYear ?? undefined);
      setEra(song.era ?? undefined);
      setGenreId(song.genreId ?? undefined);
      setAliases(song.aliases ? [...song.aliases] : []);
      setAliasInput("");
      setHookStartSec(song.hookStartSec ?? undefined);
      setHookEndSec(song.hookEndSec ?? undefined);
      setLyricsIntro(song.lyricsIntro ?? "");
      setLyricsChorus(song.lyricsChorus ?? "");
      setAudioUrl(song.audioUrl || "");
      setAiUpdatedFields(new Set());
      setAiError(null);
      setAiSuccess(false);
      setSaveError(null);
      setLyricsNotice(null);
      setIsSplitterOpen(false);
      setFullLyricsInput("");
    }
  }, [song, isOpen]);

  // Cleanup audio when closing or unmounting
  useEffect(() => {
    if (!isOpen) {
      stopAudio();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen, stopAudio]);

  // Reset audio when audioUrl changes
  useEffect(() => {
    stopAudio();
    if (audioRef.current) {
      audioRef.current = null;
    }
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, [audioUrl, stopAudio]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving && !isAiLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSaving, isAiLoading]);

  // Helper to format seconds to M:SS
  const formatSec = (seconds?: number) => {
    if (seconds === undefined || isNaN(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Audio Preview Controls
  const getOrCreateAudio = () => {
    const trimmed = audioUrl.trim();
    if (!trimmed) return null;

    if (!audioRef.current || audioRef.current.src !== trimmed) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(trimmed);
      audio.ontimeupdate = () => {
        setAudioCurrentTime(audio.currentTime);
        if (
          isPlayingHookRef.current &&
          hookEndSecRef.current !== undefined &&
          hookEndSecRef.current > 0 &&
          audio.currentTime >= hookEndSecRef.current
        ) {
          audio.pause();
          isPlayingHookRef.current = false;
          setIsPlayingHook(false);
        }
      };
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration || 0);
      };
      audio.onended = () => {
        isPlayingHookRef.current = false;
        setIsPlayingFull(false);
        setIsPlayingHook(false);
      };
      audio.onerror = () => {
        isPlayingHookRef.current = false;
        setIsPlayingFull(false);
        setIsPlayingHook(false);
      };
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  const togglePlayFull = () => {
    const audio = getOrCreateAudio();
    if (!audio) return;

    if (isPlayingFull) {
      audio.pause();
      setIsPlayingFull(false);
    } else {
      if (isPlayingHook) {
        audio.pause();
        isPlayingHookRef.current = false;
        setIsPlayingHook(false);
      }
      audio
        .play()
        .then(() => {
          setIsPlayingFull(true);
        })
        .catch((err) => {
          console.error("Audio playback failed:", err);
          setIsPlayingFull(false);
        });
    }
  };

  const togglePlayHook = () => {
    const audio = getOrCreateAudio();
    if (!audio) return;

    if (isPlayingHook) {
      audio.pause();
      isPlayingHookRef.current = false;
      setIsPlayingHook(false);
    } else {
      if (isPlayingFull) {
        audio.pause();
        setIsPlayingFull(false);
      }
      const start = hookStartSec !== undefined && hookStartSec > 0 ? hookStartSec : 0;
      audio.currentTime = start;
      isPlayingHookRef.current = true;
      setIsPlayingHook(true);
      audio
        .play()
        .then(() => {})
        .catch((err) => {
          console.error("Hook playback failed:", err);
          isPlayingHookRef.current = false;
          setIsPlayingHook(false);
        });
    }
  };

  // Aliases handler
  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (!trimmed) return;
    if (!aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
    }
    setAliasInput("");
  };

  const handleRemoveAlias = (indexToRemove: number) => {
    setAliases(aliases.filter((_, idx) => idx !== indexToRemove));
  };

  // AI Re-enrichment
  const handleAiReExtract = async () => {
    const query = `${title || song.title} ${artist || song.artist}`.trim();
    if (!query) {
      setAiError("กรุณาระบุชื่อเพลงหรือศิลปินเพื่อให้ AI ค้นหา");
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiSuccess(false);

    try {
      const res = await fetch("/api/admin/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          apiKey: apiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.metadata) {
        setAiError(data.error || "ไม่สามารถสกัดข้อมูลจาก AI ได้");
        return;
      }

      const metadata: ExtractedSongMetadata = data.metadata;
      if (metadata.songFound === false) {
        setAiError(metadata.notFoundReason || "ไม่พบข้อมูลเพลงนี้ในฐานข้อมูล AI");
        return;
      }

      const updated = new Set<string>();

      if (metadata.title) {
        setTitle(metadata.title);
        updated.add("title");
      }
      if (metadata.artist) {
        setArtist(metadata.artist);
        updated.add("artist");
      }
      if (Array.isArray(metadata.aliases) && metadata.aliases.length > 0) {
        setAliases((prev) => Array.from(new Set([...prev, ...metadata.aliases])));
        updated.add("aliases");
      }
      if (metadata.releaseYear) {
        setReleaseYear(metadata.releaseYear);
        updated.add("releaseYear");
      }
      if (metadata.era) {
        setEra(metadata.era);
        updated.add("era");
      }
      if (metadata.genreSlug) {
        const matched = genres.find(
          (g) =>
            g.slug.toLowerCase() === metadata.genreSlug.toLowerCase() ||
            g.nameEn.toLowerCase() === metadata.genreSlug.toLowerCase()
        );
        if (matched) {
          setGenreId(matched.id);
          updated.add("genreId");
        }
      }
      if (metadata.hookStartSec !== undefined && metadata.hookStartSec !== null) {
        setHookStartSec(metadata.hookStartSec);
        updated.add("hookStartSec");
      }
      if (metadata.hookEndSec !== undefined && metadata.hookEndSec !== null) {
        setHookEndSec(metadata.hookEndSec);
        updated.add("hookEndSec");
      }
      if (metadata.lyricsIntro) {
        setLyricsIntro(metadata.lyricsIntro);
        updated.add("lyricsIntro");
      }
      if (metadata.lyricsChorus) {
        setLyricsChorus(metadata.lyricsChorus);
        updated.add("lyricsChorus");
      }

      // Show lyrics confidence notice
      if (metadata.lyricsConfidence === "verified" && (metadata.lyricsIntro || metadata.lyricsChorus)) {
        setLyricsNotice("✅ เนื้อเพลงถูกตรวจสอบจากฐานข้อมูลเนื้อเพลงต้นฉบับ (LRCLIB)");
      } else if (!metadata.lyricsIntro && !metadata.lyricsChorus) {
        setLyricsNotice("⚠️ ไม่พบเนื้อเพลงต้นฉบับที่ตรวจสอบแล้ว — กรุณากรอกเอง หรือค้นหาจาก Google");
      } else {
        setLyricsNotice(null);
      }

      setAiUpdatedFields(updated);
      setAiSuccess(true);
    } catch (err) {
      console.error("AI re-extract error:", err);
      setAiError("เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI API");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Lyrics Splitter: auto-split full lyrics into intro + chorus
  const handleSplitLyrics = () => {
    const text = fullLyricsInput.trim();
    if (!text) return;

    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return;

    // Intro: first 2-4 lines
    const introLines = lines.slice(0, Math.min(4, lines.length));
    setLyricsIntro(introLines.join("\n"));

    // Find chorus: look for repeated sections or second verse block
    // Heuristic: find first blank-line-separated block after the first block
    const allLines = text.split("\n").map((l) => l.trim());
    const blocks: string[][] = [];
    let currentBlock: string[] = [];
    for (const line of allLines) {
      if (line.length === 0) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);

    // If we have 3+ blocks, the chorus is often block 3 (after verse1, pre-chorus)
    // If 2 blocks, chorus = block 2
    // If 1 block, take the last 2-4 lines
    let chorusLines: string[];
    if (blocks.length >= 3) {
      chorusLines = blocks[2].slice(0, 4);
    } else if (blocks.length === 2) {
      chorusLines = blocks[1].slice(0, 4);
    } else {
      const half = Math.max(1, Math.floor(lines.length / 2));
      chorusLines = lines.slice(half, half + 4);
    }
    setLyricsChorus(chorusLines.join("\n"));
    setIsSplitterOpen(false);
    setFullLyricsInput("");
  };

  // Save handler
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!title.trim()) {
      setSaveError("กรุณาระบุชื่อเพลงทางการ");
      return;
    }
    if (!artist.trim()) {
      setSaveError("กรุณาระบุชื่อศิลปิน");
      return;
    }
    if (
      hookStartSec !== undefined &&
      hookEndSec !== undefined &&
      hookStartSec !== null &&
      hookEndSec !== null &&
      hookEndSec < hookStartSec
    ) {
      setSaveError("เวลาสิ้นสุดท่อนฮุกต้องมากกว่าหรือเท่ากับเวลาเริ่มต้น");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const calcDuration =
        hookStartSec !== undefined && hookEndSec !== undefined && hookEndSec >= hookStartSec
          ? hookEndSec - hookStartSec
          : undefined;

      const res = await fetch("/api/admin/songs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: song.id,
          title: title.trim(),
          artist: artist.trim(),
          aliases: aliases.map((a) => a.trim()).filter(Boolean),
          releaseYear:
            releaseYear !== undefined && releaseYear !== null && !isNaN(releaseYear)
              ? Number(releaseYear)
              : null,
          era: era || null,
          genreId: genreId || null,
          hookStartSec:
            hookStartSec !== undefined && hookStartSec !== null && !isNaN(hookStartSec)
              ? Number(hookStartSec)
              : null,
          hookEndSec:
            hookEndSec !== undefined && hookEndSec !== null && !isNaN(hookEndSec)
              ? Number(hookEndSec)
              : null,
          durationSec: calcDuration,
          lyricsIntro: lyricsIntro ? lyricsIntro.trim() : "",
          lyricsChorus: lyricsChorus ? lyricsChorus.trim() : "",
          audioUrl: audioUrl ? audioUrl.trim() : "",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveError(data.error || "ไม่สามารถบันทึกข้อมูลเพลงได้");
        return;
      }

      stopAudio();
      onSaved(data.song);
      onClose();
    } catch (err) {
      console.error("Save song error:", err);
      setSaveError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    } finally {
      setIsSaving(false);
    }
  };

  const renderAiBadge = (fieldName: string) => {
    if (!aiUpdatedFields.has(fieldName)) return null;
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-in fade-in zoom-in-95 duration-200">
        <Sparkles className="w-2.5 h-2.5" />
        <span>AI</span>
      </span>
    );
  };

  if (!isMounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-w-2xl w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                <Disc3 className="w-5 h-5 animate-spin-slow" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white leading-tight">
                  แก้ไขข้อมูลเพลง
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-sm sm:max-w-md mt-0.5">
                  {song.title} — {song.artist}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAiReExtract}
              disabled={isAiLoading || isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="ให้ AI ดึงข้อมูลเพลง ท่อนฮุก และเนื้อเพลงใหม่อัตโนมัติ"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังค้นหา...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ ให้ AI ค้นหาข้อมูลใหม่</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              aria-label="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto min-h-0 py-4 pr-1 space-y-5">
          {/* AI Banner Messages */}
          {aiError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {aiSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>AI สกัดข้อมูลใหม่สำเร็จแล้ว! ช่องที่มีป้าย ✨ AI ได้รับการอัปเดต</span>
              </div>
              <button
                type="button"
                onClick={() => setAiSuccess(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <span>ข้อมูลพื้นฐาน</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>ชื่อเพลงทางการ *</span>
                  {renderAiBadge("title")}
                </label>
                <input
                  type="text"
                  placeholder="เช่น วัดใจ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Artist */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>ชื่อศิลปิน *</span>
                  {renderAiBadge("artist")}
                </label>
                <input
                  type="text"
                  placeholder="เช่น Silly Fools"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Release Year */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>ปีที่ปล่อย (ค.ศ.)</span>
                  {renderAiBadge("releaseYear")}
                </label>
                <input
                  type="number"
                  placeholder="เช่น 2004"
                  value={releaseYear ?? ""}
                  onChange={(e) =>
                    setReleaseYear(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Era */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>ยุคเพลง (Era)</span>
                  {renderAiBadge("era")}
                </label>
                <select
                  value={era || ""}
                  onChange={(e) => setEra(e.target.value || undefined)}
                  className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none transition-colors"
                >
                  <option value="">-- ไม่ระบุยุค --</option>
                  <option value="80s">ยุค 80s</option>
                  <option value="90s">ยุค 90s</option>
                  <option value="2000s">ยุค 2000s</option>
                  <option value="2010s">ยุค 2010s</option>
                  <option value="2020s">ยุค 2020s</option>
                </select>
              </div>

              {/* Genre */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>หมวดหมู่ / แนวเพลง (Genre)</span>
                  {renderAiBadge("genreId")}
                </label>
                <select
                  value={genreId || ""}
                  onChange={(e) => setGenreId(e.target.value || undefined)}
                  className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:outline-none transition-colors"
                >
                  <option value="">-- ไม่ระบุแนวเพลง --</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameTh} ({g.nameEn})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Aliases Tag Manager */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>คำค้นหา / ชื่ออื่น (Aliases)</span>
                {renderAiBadge("aliases")}
              </label>
              <span className="text-[11px] text-stone-400">{aliases.length} คำค้นหา</span>
            </div>

            {/* Tags Container */}
            <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-2xl bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800">
              {aliases.length === 0 ? (
                <span className="text-xs text-stone-400 italic self-center px-1">
                  ยังไม่มีคำค้นหาเพิ่มเติม (พิมพ์คำค้นหาด้านล่างเพื่อเพิ่ม)
                </span>
              ) : (
                aliases.map((alias, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20 text-xs font-medium"
                  >
                    <span>{alias}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(idx)}
                      className="hover:text-rose-500 transition cursor-pointer p-0.5"
                      title="ลบคำค้นหานี้"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Input to add tag */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="พิมพ์คำค้นหาอื่น เช่น wat jai, ซิลลี่ฟูลส์ แล้วกด Enter หรือคลิกเพิ่ม..."
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlias();
                  }
                }}
                className="flex-1 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleAddAlias}
                className="px-3.5 py-2 rounded-2xl bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม</span>
              </button>
            </div>
          </div>

          {/* Section 3: Hook Timestamps & Audio Preview */}
          <div className="space-y-3 p-4 rounded-2xl bg-stone-50/70 dark:bg-stone-950/50 border border-stone-200/80 dark:border-stone-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>ช่วงเวลาท่อนฮุก & ไฟล์เสียง</span>
              </h3>
              {hookStartSec !== undefined &&
                hookEndSec !== undefined &&
                hookEndSec >= hookStartSec && (
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    ความยาวฮุก: {hookEndSec - hookStartSec} วินาที
                  </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Hook Start */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>เริ่มท่อนฮุก (วินาที)</span>
                  {renderAiBadge("hookStartSec")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="เช่น 68"
                  value={hookStartSec ?? ""}
                  onChange={(e) =>
                    setHookStartSec(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Hook End */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <span>จบขอบเขตท่อนฮุก (วินาที)</span>
                  {renderAiBadge("hookEndSec")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="เช่น 94"
                  value={hookEndSec ?? ""}
                  onChange={(e) =>
                    setHookEndSec(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Audio URL */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>URL ไฟล์เสียง (Audio URL)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://... หรือ /audio/uploads/..."
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors font-mono text-xs"
                />
              </div>
            </div>

            {/* Audio Preview Controls */}
            {audioUrl ? (
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-stone-900 border border-amber-200/60 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2.5 mt-2">
                <div className="flex items-center gap-2">
                  {/* Full Audio Toggle */}
                  <button
                    type="button"
                    onClick={togglePlayFull}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isPlayingFull
                        ? "bg-amber-500 text-stone-950 font-bold"
                        : "bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700"
                    }`}
                  >
                    {isPlayingFull ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlayingFull ? "หยุดเล่น" : "ฟังเพลงเต็ม"}</span>
                  </button>

                  {/* Hook Audio Toggle */}
                  <button
                    type="button"
                    onClick={togglePlayHook}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isPlayingHook
                        ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                    }`}
                  >
                    {isPlayingHook ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>
                      {isPlayingHook
                        ? "หยุดฟังฮุก"
                        : `ทดสอบฟังฮุก (${formatSec(hookStartSec || 0)} - ${formatSec(hookEndSec || 0)})`}
                    </span>
                  </button>
                </div>

                {/* Progress display */}
                <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                  {formatSec(audioCurrentTime)} / {formatSec(audioDuration)}
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-400 dark:text-stone-500 italic p-2 bg-stone-100 dark:bg-stone-900 rounded-xl">
                เพลงนี้ยังไม่มี URL ไฟล์เสียง (สามารถกรอก URL ด้านบน หรือซิงค์เสียงจาก YouTube ในคลังเพลง)
              </div>
            )}
          </div>

          {/* Section 4: Lyrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>เนื้อเพลง</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSplitterOpen(!isSplitterOpen)}
                  className="text-[11px] bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Scissors className="w-3 h-3" />
                  <span>วางเนื้อเพลงเต็มเพื่อตัดแบ่ง</span>
                </button>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent("เนื้อเพลง " + (title || song.title) + " " + (artist || song.artist))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Search className="w-3 h-3" />
                  <span>ค้นหาใน Google</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              </div>
            </div>

            {/* Lyrics Confidence Notice */}
            {lyricsNotice && (
              <div className={`text-[11px] px-3 py-2 rounded-xl border ${
                lyricsNotice.startsWith("✅")
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
              }`}>
                {lyricsNotice}
              </div>
            )}

            {/* Inline Lyrics Splitter */}
            {isSplitterOpen && (
              <div className="p-3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-2xl space-y-2">
                <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                  📋 วางเนื้อเพลงทั้งหมดที่นี่ แล้วระบบจะตัดแบ่ง Intro / Chorus ให้อัตโนมัติ
                </label>
                <textarea
                  rows={6}
                  placeholder="วางเนื้อเพลงเต็มจาก Google / Siamzone / Sanook ที่นี่..."
                  value={fullLyricsInput}
                  onChange={(e) => setFullLyricsInput(e.target.value)}
                  className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors resize-y leading-relaxed"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsSplitterOpen(false); setFullLyricsInput(""); }}
                    className="text-[11px] px-3 py-1.5 rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSplitLyrics}
                    disabled={!fullLyricsInput.trim()}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500 text-stone-950 font-bold cursor-pointer disabled:opacity-50 hover:bg-amber-400 transition-colors"
                  >
                    <span>✂️ ตัดแบ่ง Intro + Chorus</span>
                  </button>
                </div>
              </div>
            )}

            {/* Intro Lyrics */}
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                <span>เนื้อเพลงท่อนเปิด (Intro Lyrics)</span>
                {renderAiBadge("lyricsIntro")}
              </label>
              <textarea
                rows={3}
                placeholder="เช่น วันนี้ไม่มีเธออยู่ตรงนี้..."
                value={lyricsIntro || ""}
                onChange={(e) => setLyricsIntro(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl p-3 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors resize-y leading-relaxed"
              />
            </div>

            {/* Chorus Lyrics */}
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-1.5">
                <span>เนื้อเพลงท่อนฮุก (Chorus Lyrics)</span>
                {renderAiBadge("lyricsChorus")}
              </label>
              <textarea
                rows={4}
                placeholder="เช่น จะยอมให้เธอหลอกกันต่อไป แม้รู้ว่าใจเธอไม่มีฉัน..."
                value={lyricsChorus || ""}
                onChange={(e) => setLyricsChorus(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 focus:border-amber-500 rounded-2xl p-3 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none transition-colors resize-y leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            {saveError && (
              <p className="text-xs text-rose-500 font-medium truncate flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{saveError}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs transition cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isAiLoading || !title.trim() || !artist.trim()}
              className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[40px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกการเปลี่ยนแปลง</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SongEditModal;
