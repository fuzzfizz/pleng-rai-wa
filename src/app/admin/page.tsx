"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Music,
  ArrowLeft,
  Sparkles,
  Download,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Database,
  Volume2,
  Zap,
  Square,
  Layers,
  Disc3,
  Check,
} from "lucide-react";
import { Genre, Song } from "@/types";
import {
  ExtractedSongMetadata,
  BatchDiscographyResult,
  BatchExtractedSongItem,
} from "@/lib/ai-extractor";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"import" | "batch" | "library" | "settings">("import");

  // Import State
  const [searchQuery, setSearchQuery] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedSongMetadata | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<string>("");
  const [importStatusMessage, setImportStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSplitLyricsModalOpen, setIsSplitLyricsModalOpen] = useState(false);
  const [rawFullLyrics, setRawFullLyrics] = useState("");

  // Batch Discography State
  const [batchPrompt, setBatchPrompt] = useState("");
  const [isBatchExtracting, setIsBatchExtracting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchDiscographyResult | null>(null);
  const [selectedTrackIndices, setSelectedTrackIndices] = useState<Set<number>>(new Set());
  const [batchGenreId, setBatchGenreId] = useState<string>("");
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<{
    current: number;
    total: number;
    songTitle: string;
    status: string;
  } | null>(null);
  const [batchStatusMessage, setBatchStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const stopBatchImportRef = useRef(false);

  const handleAutoSplitLyrics = () => {
    if (!rawFullLyrics.trim() || !extractedData) return;
    const lines = rawFullLyrics
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    // Intro: first 2-4 lines
    const introLines = lines.slice(0, Math.min(4, lines.length)).join("\n");

    // Chorus: look for hook marker or middle
    let chorusLines = "";
    const hookIndex = lines.findIndex((l) => /ฮุก|hook|chorus|\*/i.test(l));
    if (hookIndex !== -1 && lines.length > hookIndex + 1) {
      chorusLines = lines.slice(hookIndex + 1, hookIndex + 5).join("\n");
    } else if (lines.length > 6) {
      const mid = Math.floor(lines.length / 2);
      chorusLines = lines.slice(mid, mid + 4).join("\n");
    } else {
      chorusLines = lines.slice(Math.min(2, lines.length)).join("\n");
    }

    setExtractedData({
      ...extractedData,
      lyricsIntro: introLines,
      lyricsChorus: chorusLines,
    });
    setIsSplitLyricsModalOpen(false);
    setRawFullLyrics("");
  };

  // Library State
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Room Cleanup State
  const [isCleaningRooms, setIsCleaningRooms] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const handleCleanupRooms = async () => {
    setIsCleaningRooms(true);
    setCleanupMessage(null);
    try {
      const res = await fetch("/api/admin/rooms/cleanup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCleanupMessage(`✓ ล้างห้องร้างเรียบร้อยแล้ว: ลบไปทั้งหมด ${data.deletedCount} ห้อง`);
      } else {
        setCleanupMessage(`❌ เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch {
      setCleanupMessage("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsCleaningRooms(false);
    }
  };

  // Audio Audit & Auto-Queue State
  const [audioAuditMap, setAudioAuditMap] = useState<Record<string, boolean>>({});
  const [isAuditing, setIsAuditing] = useState(false);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [syncingSongId, setSyncingSongId] = useState<string | null>(null);
  const [queueProgress, setQueueProgress] = useState<{
    current: number;
    total: number;
    songTitle: string;
  } | null>(null);
  const [queueStatusMessage, setQueueStatusMessage] = useState<string | null>(null);
  const stopQueueRef = useRef(false);

  // Load Genres, Songs, and API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("pleng_gemini_key");
    if (savedKey) setCustomApiKey(savedKey);

    fetchGenres();
    fetchSongs();
    fetchAudioAudit();
  }, []);

  const fetchGenres = async () => {
    try {
      const res = await fetch("/api/admin/genres");
      const data = await res.json();
      if (data.success && data.genres) {
        setGenres(data.genres);
      }
    } catch (e) {
      console.error("Failed to load genres:", e);
    }
  };

  const fetchSongs = async () => {
    setIsLoadingSongs(true);
    try {
      const res = await fetch("/api/admin/songs");
      const data = await res.json();
      if (data.success && data.songs) {
        setSongs(data.songs);
      }
    } catch (e) {
      console.error("Failed to load songs:", e);
    } finally {
      setIsLoadingSongs(false);
    }
  };

  const fetchAudioAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch("/api/admin/songs/audit");
      const data = await res.json();
      if (data.success && data.songs) {
        const map: Record<string, boolean> = {};
        data.songs.forEach((s: { id: string; hasAudio: boolean }) => {
          map[s.id] = s.hasAudio;
        });
        setAudioAuditMap(map);
      }
    } catch (e) {
      console.error("Audio audit failed:", e);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSyncSingleSong = async (songId: string, songTitle: string) => {
    setSyncingSongId(songId);
    setQueueStatusMessage(`กำลังค้นหาและดาวน์โหลดเสียงสำหรับ "${songTitle}"...`);
    try {
      const res = await fetch("/api/admin/songs/sync-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      const data = await res.json();
      if (data.success) {
        setAudioAuditMap((prev) => ({ ...prev, [songId]: true }));
        setSongs((prev) =>
          prev.map((s) => (s.id === songId ? { ...s, audioUrl: data.audioUrl, durationSec: data.durationSec } : s))
        );
        setQueueStatusMessage(`✓ ดาวน์โหลดเสียง "${songTitle}" สำเร็จแล้ว!`);
      } else {
        setQueueStatusMessage(`❌ ดาวน์โหลดเสียงไม่สำเร็จ: ${data.error}`);
      }
    } catch {
      setQueueStatusMessage(`❌ เกิดข้อผิดพลาดในการดาวน์โหลด "${songTitle}"`);
    } finally {
      setSyncingSongId(null);
    }
  };

  const handleStartQueue = async () => {
    const missing = songs.filter((s) => audioAuditMap[s.id] === false || !audioAuditMap[s.id]);
    if (missing.length === 0) {
      setQueueStatusMessage("✓ ทุกเพลงในคลังมีไฟล์เสียงเรียบร้อยแล้ว!");
      return;
    }

    setIsQueueRunning(true);
    stopQueueRef.current = false;
    setQueueStatusMessage(`เริ่มคิวค้นหาและดาวน์โหลดเสียง (${missing.length} เพลง)...`);

    for (let i = 0; i < missing.length; i++) {
      if (stopQueueRef.current) {
        setQueueStatusMessage("⏹ หยุดการทำงานของคิวเรียบร้อยแล้ว");
        break;
      }

      const currentSong = missing[i];
      setSyncingSongId(currentSong.id);
      setQueueProgress({
        current: i + 1,
        total: missing.length,
        songTitle: `${currentSong.title} - ${currentSong.artist}`,
      });

      try {
        const res = await fetch("/api/admin/songs/sync-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: currentSong.id }),
        });
        const data = await res.json();
        if (data.success) {
          setAudioAuditMap((prev) => ({ ...prev, [currentSong.id]: true }));
          setSongs((prev) =>
            prev.map((s) =>
              s.id === currentSong.id
                ? { ...s, audioUrl: data.audioUrl, durationSec: data.durationSec }
                : s
            )
          );
        }
      } catch (e) {
        console.error(`Failed to sync song ${currentSong.title}:`, e);
      }
    }

    setSyncingSongId(null);
    setQueueProgress(null);
    setIsQueueRunning(false);
    if (!stopQueueRef.current) {
      setQueueStatusMessage("🎉 ดำเนินการดาวน์โหลดทุกเพลงในคิวเสร็จสมบูรณ์แล้ว!");
    }
    fetchAudioAudit();
  };

  const handleStopQueue = () => {
    stopQueueRef.current = true;
    setIsQueueRunning(false);
    setSyncingSongId(null);
    setQueueStatusMessage("⏹ กำลังหยุดคิว...");
  };

  // Handle AI Extraction
  const handleExtract = async () => {
    if (!searchQuery.trim()) return;
    setIsExtracting(true);
    setImportStatusMessage(null);
    try {
      const res = await fetch("/api/admin/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), apiKey: customApiKey || undefined }),
      });
      const data = await res.json();
      if (data.success && data.metadata) {
        setExtractedData(data.metadata);
        if (data.metadata.songFound === false) {
          setImportStatusMessage({
            type: "error",
            text: `⚠️ ${data.metadata.notFoundReason || "ไม่พบเพลงตามชื่อที่ระบุ (กรุณาตรวจสอบชื่อเพลง หรือกรอกด้วยตนเอง)"}`,
          });
          setSelectedGenreId("");
        } else {
          // Auto match genre if available
          const matched = genres.find(
            (g) => g.slug === data.metadata.genreSlug || g.nameEn.toLowerCase() === data.metadata.genreSlug.toLowerCase()
          );
          setSelectedGenreId(matched ? matched.id : "");
        }
      } else {
        setImportStatusMessage({ type: "error", text: data.error || "ไม่สามารถสกัดข้อมูลได้" });
      }
    } catch (e) {
      setImportStatusMessage({ type: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI API" });
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle Download & Import
  const handleImport = async () => {
    if (!extractedData) return;
    if (!extractedData.title.trim()) {
      setImportStatusMessage({ type: "error", text: "กรุณาระบุชื่อเพลงทางการ (Title) ก่อนนำเข้า" });
      return;
    }
    if (!extractedData.artist.trim()) {
      setImportStatusMessage({ type: "error", text: "กรุณาระบุชื่อศิลปิน (Artist) ก่อนนำเข้า" });
      return;
    }
    setIsImporting(true);
    setImportStatusMessage(null);
    try {
      const payload = {
        youtubeUrlOrQuery: searchQuery.trim(),
        metadata: {
          ...extractedData,
          genreId: selectedGenreId || undefined,
        },
      };

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setImportStatusMessage({
          type: "success",
          text: `นำเข้าเพลง "${data.song?.title}" สำเร็จ! (${data.storageNotice})`,
        });
        setExtractedData(null);
        setSearchQuery("");
        fetchSongs();
      } else {
        setImportStatusMessage({ type: "error", text: data.error || "เกิดข้อผิดพลาดในการนำเข้าเพลง" });
      }
    } catch (e) {
      setImportStatusMessage({ type: "error", text: "เกิดข้อผิดพลาดในการส่งข้อมูลไปยังเซิร์ฟเวอร์" });
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Song Deletion
  const handleDeleteSong = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบเพลง "${title}" ออกจากคลังใช่หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/admin/songs?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSongs((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert(data.error || "ไม่สามารถลบเพลงได้");
      }
    } catch (e) {
      alert("เกิดข้อผิดพลาดในการลบเพลง");
    }
  };

  // Audio preview playback
  const togglePlayAudio = (songId: string, audioUrl: string) => {
    if (playingSongId === songId) {
      audioElement?.pause();
      setPlayingSongId(null);
    } else {
      audioElement?.pause();
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingSongId(null);
      audio.play().catch(() => alert("ไม่สามารถเล่นไฟล์เสียงได้"));
      setAudioElement(audio);
      setPlayingSongId(songId);
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      s.artist.toLowerCase().includes(librarySearch.toLowerCase()) ||
      s.era?.toLowerCase().includes(librarySearch.toLowerCase())
  );

  // Batch Extraction Handlers
  const handleExtractBatch = async () => {
    if (!batchPrompt.trim()) return;
    setIsBatchExtracting(true);
    setBatchStatusMessage(null);
    try {
      const res = await fetch("/api/admin/extract/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: batchPrompt.trim(), apiKey: customApiKey || undefined }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setBatchResult(data.result);
        const newTrackIndices = new Set<number>();
        data.result.songs.forEach((song: BatchExtractedSongItem, idx: number) => {
          if (!song.isDuplicate) {
            newTrackIndices.add(idx);
          }
        });
        setSelectedTrackIndices(newTrackIndices);
      } else {
        setBatchStatusMessage({
          type: "error",
          text: data.error || "เกิดข้อผิดพลาดในการดึงข้อมูลเพลงแบบ Batch",
        });
      }
    } catch {
      setBatchStatusMessage({
        type: "error",
        text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์สกัดข้อมูลแบบ Batch ได้",
      });
    } finally {
      setIsBatchExtracting(false);
    }
  };

  const handleToggleTrack = (idx: number) => {
    setSelectedTrackIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectAllNew = () => {
    if (!batchResult) return;
    const newIndices = new Set<number>();
    batchResult.songs.forEach((s, i) => {
      if (!s.isDuplicate) newIndices.add(i);
    });
    setSelectedTrackIndices(newIndices);
  };

  const handleSelectAll = () => {
    if (!batchResult) return;
    if (selectedTrackIndices.size === batchResult.songs.length) {
      setSelectedTrackIndices(new Set());
    } else {
      setSelectedTrackIndices(new Set(batchResult.songs.map((_, i) => i)));
    }
  };

  const handleStartBatchImport = async () => {
    if (!batchResult || selectedTrackIndices.size === 0) return;
    setIsBatchImporting(true);
    stopBatchImportRef.current = false;
    setBatchStatusMessage(null);

    const tracksToImport = Array.from(selectedTrackIndices)
      .map((idx) => batchResult.songs[idx])
      .filter(Boolean);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < tracksToImport.length; i++) {
      if (stopBatchImportRef.current) {
        setBatchStatusMessage({
          type: "success",
          text: `⏹ หยุดคิวแล้ว: นำเข้าสำเร็จ ${successCount} เพลง (ล้มเหลว/ข้าม ${failCount} เพลง)`,
        });
        break;
      }

      const track = tracksToImport[i];
      setBatchImportProgress({
        current: i + 1,
        total: tracksToImport.length,
        songTitle: `${track.title} - ${track.artist}`,
        status: "กำลังค้นหา & ดาวน์โหลดไฟล์เสียง...",
      });

      try {
        const payload = {
          youtubeUrlOrQuery: track.youtubeSearchQuery || `${track.title} ${track.artist}`,
          metadata: {
            ...track,
            genreId: batchGenreId || selectedGenreId || undefined,
          },
        };

        const res = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
          console.warn(`[BatchImport] Failed to import ${track.title}:`, data.error);
        }
      } catch (err) {
        failCount++;
        console.error(`[BatchImport] Error importing ${track.title}:`, err);
      }
    }

    setBatchImportProgress(null);
    setIsBatchImporting(false);
    if (!stopBatchImportRef.current) {
      setBatchStatusMessage({
        type: "success",
        text: `🎉 นำเข้าเพลงแบบชุดเสร็จสมบูรณ์! สำเร็จ ${successCount} เพลง${failCount > 0 ? ` (ขัดข้อง ${failCount} เพลง)` : ""}`,
      });
    }

    fetchSongs();
    fetchAudioAudit();
  };

  const handleStopBatchImport = () => {
    stopBatchImportRef.current = true;
    setIsBatchImporting(false);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans pb-safe">
      {/* Admin Navbar */}
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur-md px-4 sm:px-8 py-3.5 sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/80 flex items-center justify-center text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-stone-900 dark:text-stone-100">เครื่องมือเพิ่มเพลง (Admin Portal)</h1>
              <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono">
                Local Only
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Pleng-Rai-Wa Music Library & AI Pipeline</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-stone-200/60 dark:bg-stone-950/80 p-1 rounded-xl border border-stone-300/60 dark:border-stone-800">
          <button
            onClick={() => setActiveTab("import")}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "import" ? "bg-amber-500 text-stone-950 shadow-sm font-bold" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>เพิ่มเพลงเดี่ยว</span>
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "batch" ? "bg-amber-500 text-stone-950 shadow-sm font-bold" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ดูดเพลงชุด (Batch)</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "library" ? "bg-amber-500 text-stone-950 shadow-sm font-bold" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>คลังเพลง ({songs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "settings" ? "bg-amber-500 text-stone-950 shadow-sm font-bold" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ตั้งค่า</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        {/* Status Notification */}
        {importStatusMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border ${
              importStatusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
            }`}
          >
            {importStatusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            )}
            <p className="text-sm">{importStatusMessage.text}</p>
          </div>
        )}

        {/* TAB 1: AI Importer */}
        {activeTab === "import" && (
          <div className="space-y-6">
            {/* Input Card */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm backdrop-blur-md">
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>สกัดข้อมูลเพลงด้วย AI</span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                พิมพ์ชื่อเพลง/ศิลปิน หรือแปะลิงก์ YouTube แล้วให้ AI สกัดชื่อ, แนวเพลง, ท่อนฮุก, และเนื้อเพลงให้อัตโนมัติ
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="เช่น วัดใจ Silly Fools หรือ https://www.youtube.com/watch?v=..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                  className="flex-1 min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-2xl px-4 py-3 text-base sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || !searchQuery.trim()}
                  className="min-h-[44px] bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold px-6 py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังสกัดข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>สกัดข้อมูลด้วย AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Shortcuts */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-stone-200 dark:border-stone-800/60">
                <span className="text-[11px] text-stone-500">ตัวอย่างทดสอบ:</span>
                {["วัดใจ Silly Fools", "ซ่อนกลิ่น Palmy", "ขอบคุณที่รักกัน Potato", "ทรงอย่างแบด Paper Planes"].map(
                  (sample) => (
                    <button
                      key={sample}
                      onClick={() => setSearchQuery(sample)}
                      className="min-h-[44px] text-xs bg-stone-100 dark:bg-stone-950 hover:bg-stone-200 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800/80 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                    >
                      {sample}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Review & Edit Card */}
            {extractedData && (
              <div className="bg-white dark:bg-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>ตรวจสอบและแก้ไขข้อมูลเพลงก่อนนำเข้า</span>
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">AI ได้สกัดข้อมูลให้อัตโนมัติแล้ว คุณสามารถแก้ไขทุกฟิลด์ได้ตามต้องการ</p>
                  </div>
                  {extractedData.era ? (
                    <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/30 font-mono">
                      ยุค {extractedData.era}
                    </span>
                  ) : (
                    <span className="bg-stone-500/10 text-stone-500 dark:text-stone-400 text-xs px-2.5 py-1 rounded-full border border-stone-500/20 font-mono">
                      ยังไม่ระบุยุค
                    </span>
                  )}
                </div>

                {/* Warning if song was not definitively found */}
                {extractedData.songFound === false && (
                  <div className="p-4 rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 text-sm flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>⚠️ ไม่พบเพลงแทร็กตามชื่อที่ระบุ</span>
                      </div>
                      <p className="text-xs text-rose-900 dark:text-rose-300">
                        {extractedData.notFoundReason || "คำค้นหานี้อาจเป็นชื่อวงดนตรี/อัลบั้ม หรือไม่มีเพลงนี้ในระบบ"}
                      </p>
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        💡 ข้อมูลอื่น (ปีที่ปล่อยเพลง, ตำแหน่งท่อน, แนวเพลง, เนื้อเพลง) ถูกเว้นว่างไว้ทั้งหมด คุณสามารถค้นหาและกรอกข้อมูลจริงด้วยตนเองด้านล่าง
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">ชื่อเพลงทางการ (Title)</label>
                    <input
                      type="text"
                      value={extractedData.title}
                      placeholder="เช่น วัดใจ (กรุณากรอกชื่อเพลง)"
                      onChange={(e) => setExtractedData({ ...extractedData, title: e.target.value })}
                      className="w-full min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Artist */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">ศิลปิน / วง (Artist)</label>
                    <input
                      type="text"
                      value={extractedData.artist}
                      placeholder="เช่น Silly Fools (ศิลปิน)"
                      onChange={(e) => setExtractedData({ ...extractedData, artist: e.target.value })}
                      className="w-full min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Release Year */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">ปีที่ปล่อยเพลง (Release Year)</label>
                    <input
                      type="number"
                      value={extractedData.releaseYear && extractedData.releaseYear > 0 ? extractedData.releaseYear : ""}
                      placeholder="เช่น 2004 (เว้นว่างหรือกรอกเอง)"
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setExtractedData({
                          ...extractedData,
                          releaseYear: val,
                          era:
                            val > 0
                              ? val < 1990
                                ? "80s"
                                : val < 2000
                                ? "90s"
                                : val < 2010
                                ? "2000s"
                                : val < 2020
                                ? "2010s"
                                : "2020s"
                              : "",
                        });
                      }}
                      className="w-full min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Genre */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">แนวเพลง (Genre)</label>
                    <select
                      value={selectedGenreId}
                      onChange={(e) => setSelectedGenreId(e.target.value)}
                      className="w-full min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- เลือกแนวเพลง --</option>
                      {genres.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nameTh} ({g.nameEn})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Aliases / Keywords */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    ชื่อเรียกอื่น / คำสะกดผิดที่ยอมรับให้ถูก (Aliases)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {extractedData.aliases?.map((alias, idx) => (
                      <span
                        key={idx}
                        className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 border border-stone-200 dark:border-stone-700"
                      >
                        {alias}
                        <button
                          type="button"
                          onClick={() =>
                            setExtractedData({
                              ...extractedData,
                              aliases: extractedData.aliases.filter((_, i) => i !== idx),
                            })
                          }
                          className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="เพิ่มชื่อเรียกอื่น แล้วกดเพิ่ม..."
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && aliasInput.trim()) {
                          setExtractedData({
                            ...extractedData,
                            aliases: [...(extractedData.aliases || []), aliasInput.trim()],
                          });
                          setAliasInput("");
                        }
                      }}
                      className="flex-1 min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-1.5 text-base sm:text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (aliasInput.trim()) {
                          setExtractedData({
                            ...extractedData,
                            aliases: [...(extractedData.aliases || []), aliasInput.trim()],
                          });
                          setAliasInput("");
                        }
                      }}
                      className="min-h-[44px] min-w-[44px] bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs px-3 py-1.5 rounded-xl flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Hook / Chorus Timestamps */}
                <div className="p-4 bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800/80 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      <span>ตำแหน่งท่อนฮุก (Hook Range ในหน่วยวินาที)</span>
                    </label>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                      {extractedData.hookEndSec && extractedData.hookEndSec > (extractedData.hookStartSec || 0)
                        ? `ความยาวท่อนฮุก: ${(extractedData.hookEndSec - (extractedData.hookStartSec || 0)).toFixed(1)} วิ`
                        : "ยังไม่กำหนดตำแหน่งท่อนฮุก"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">เริ่มต้นที่วินาที:</span>
                      <input
                        type="number"
                        step="0.5"
                        value={
                          extractedData.hookStartSec && extractedData.hookStartSec > 0
                            ? extractedData.hookStartSec
                            : (extractedData.hookStartSec === 0 && extractedData.songFound && (extractedData.hookEndSec || 0) > 0 ? 0 : "")
                        }
                        placeholder="0"
                        onChange={(e) =>
                          setExtractedData({ ...extractedData, hookStartSec: Number(e.target.value) || 0 })
                        }
                        className="w-full min-h-[44px] bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-2 text-base sm:text-sm text-stone-900 dark:text-stone-100 font-mono mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">สิ้นสุดที่วินาที:</span>
                      <input
                        type="number"
                        step="0.5"
                        value={extractedData.hookEndSec && extractedData.hookEndSec > 0 ? extractedData.hookEndSec : ""}
                        placeholder="เช่น 30"
                        onChange={(e) => setExtractedData({ ...extractedData, hookEndSec: Number(e.target.value) || 0 })}
                        className="w-full min-h-[44px] bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-2 text-base sm:text-sm text-stone-900 dark:text-stone-100 font-mono mt-1"
                      />
                    </div>
                  </div>
                  {(!extractedData.hookEndSec || extractedData.hookEndSec === 0) && (
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2">
                      ℹ️ หากยังไม่ทราบช่วงท่อนฮุก สามารถเว้นว่างไว้แล้วมาระบุภายหลังเมื่อทดลองฟังไฟล์เสียงได้
                    </p>
                  )}
                </div>

                {/* Lyrics Section (For New AI Lyrics Mode) */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        เนื้อเพลงสำหรับโหมดทายเนื้อเพลง AI
                      </span>
                      {(!extractedData.lyricsIntro || extractedData.lyricsConfidence === "not_found") && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                          ⚠️ AI ไม่พบเนื้อเพลง (กรุณากรอกเอง)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSplitLyricsModalOpen(true)}
                        className="text-xs bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <span>📋 วางเนื้อเพลงเต็มเพื่อตัดแบ่ง</span>
                      </button>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent('เนื้อเพลง ' + extractedData.title + ' ' + extractedData.artist)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>ค้นหาใน Google</span>
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                        🚀 เนื้อเพลงท่อนเปิด (Intro Lyrics)
                      </label>
                      <textarea
                        rows={3}
                        value={extractedData.lyricsIntro || ""}
                        onChange={(e) => setExtractedData({ ...extractedData, lyricsIntro: e.target.value })}
                        placeholder="กรอกเนื้อเพลง 2-4 บรรทัดแรก หรือกดปุ่มค้นหาใน Google ด้านบน..."
                        className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl p-3 text-base sm:text-xs text-stone-900 dark:text-stone-200 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                        🎵 เนื้อเพลงท่อนฮุก (Chorus Lyrics)
                      </label>
                      <textarea
                        rows={3}
                        value={extractedData.lyricsChorus || ""}
                        onChange={(e) => setExtractedData({ ...extractedData, lyricsChorus: e.target.value })}
                        placeholder="กรอกเนื้อเพลงท่อนฮุกสำหรับให้เสียง AI อ่าน..."
                        className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl p-3 text-base sm:text-xs text-stone-900 dark:text-stone-200 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Import Button */}
                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setExtractedData(null)}
                    className="min-h-[44px] px-5 py-3 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={isImporting}
                    className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3 rounded-2xl flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังแปลง MP3 และอัปโหลด...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลด MP3 & บันทึกเข้าคลังเพลง</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB BATCH: AI Batch Discography Importer */}
        {activeTab === "batch" && (
          <div className="space-y-6">
            {/* Batch Status Notification */}
            {batchStatusMessage && (
              <div
                className={`p-4 rounded-2xl flex items-start gap-3 border ${
                  batchStatusMessage.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                }`}
              >
                {batchStatusMessage.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                )}
                <p className="text-sm">{batchStatusMessage.text}</p>
              </div>
            )}

            {/* Input Card */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm backdrop-blur-md">
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                <span>ดูดเพลงแบบชุด (Batch Discography)</span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                กรอกชื่อศิลปิน อัลบั้ม หรือชุดเพลง เช่น &quot;Bodyslam อัลบั้ม Drive&quot; หรือ &quot;Potato 15 เพลงฮิต&quot; AI จะสร้างรายการแทร็กพร้อมเช็คเพลงซ้ำในคลังให้อัตโนมัติ
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="เช่น Bodyslam อัลบั้ม Drive หรือ Silly Fools อัลบั้ม Mint หรือ Potato 15 เพลงฮิต"
                  value={batchPrompt}
                  onChange={(e) => setBatchPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExtractBatch()}
                  disabled={isBatchExtracting || isBatchImporting}
                  className="flex-1 min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-2xl px-4 py-3 text-base sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleExtractBatch}
                  disabled={isBatchExtracting || isBatchImporting || !batchPrompt.trim()}
                  className="min-h-[44px] bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold px-6 py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {isBatchExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังสกัดรายชื่อเพลง...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>ดึงรายชื่อด้วย AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Shortcuts */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-stone-200 dark:border-stone-800/60">
                <span className="text-[11px] text-stone-500">ตัวอย่าง:</span>
                {[
                  "Bodyslam อัลบั้ม Drive",
                  "Silly Fools อัลบั้ม Mint",
                  "Potato 15 เพลงฮิต",
                  "Loso 10 เพลงดัง",
                  "Palmy รวมเพลงฮิต",
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setBatchPrompt(sample)}
                    disabled={isBatchExtracting || isBatchImporting}
                    className="min-h-[36px] text-xs bg-stone-100 dark:bg-stone-950 hover:bg-stone-200 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800/80 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Progress Banner (while importing) */}
            {isBatchImporting && batchImportProgress && (
              <div className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 dark:text-amber-100 shadow-md flex flex-col gap-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400" />
                    <span className="font-bold text-sm">
                      กำลังนำเข้าเพลงชุด: {batchImportProgress.current} จาก {batchImportProgress.total} เพลง
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStopBatchImport}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold transition cursor-pointer"
                  >
                    ⏹ หยุดคิว
                  </button>
                </div>

                <div className="w-full bg-stone-200 dark:bg-stone-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{
                      width: `${Math.round((batchImportProgress.current / batchImportProgress.total) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 font-medium">
                  <span className="truncate pr-2">🎵 {batchImportProgress.songTitle}</span>
                  <span className="shrink-0">{batchImportProgress.status}</span>
                </div>
              </div>
            )}

            {/* Batch Extracted Result Review Table */}
            {batchResult && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-5 animate-in fade-in">
                {/* Header & Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <Disc3 className="w-5 h-5 text-amber-500" />
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {batchResult.artist}
                        {batchResult.albumOrCollection ? ` - ${batchResult.albumOrCollection}` : ""}
                      </h3>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      เลือกเพลงที่ต้องการนำเข้าสู่คลังเพลง ระบบจะค้นหาและดาวน์โหลดไฟล์เสียงจาก YouTube อัตโนมัติ
                    </p>
                  </div>

                  {/* Summary Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                      ทั้งหมด {batchResult.totalExtracted} เพลง
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                      ✨ ใหม่ {batchResult.newSongsCount} เพลง
                    </span>
                    {batchResult.duplicatesCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        ⚠️ ซ้ำ {batchResult.duplicatesCount} เพลง
                      </span>
                    )}
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllNew}
                      disabled={isBatchImporting}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 transition cursor-pointer"
                    >
                      เลือกเฉพาะเพลงใหม่ ({batchResult.newSongsCount})
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={isBatchImporting}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 transition cursor-pointer"
                    >
                      {selectedTrackIndices.size === batchResult.songs.length
                        ? "ยกเลิกการเลือกทั้งหมด"
                        : "เลือกทั้งหมด"}
                    </button>
                  </div>

                  {/* Optional Override Genre */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 font-medium shrink-0">แนวเพลงที่นำเข้า:</span>
                    <select
                      value={batchGenreId}
                      onChange={(e) => setBatchGenreId(e.target.value)}
                      disabled={isBatchImporting}
                      className="min-h-[36px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">ตามที่ AI วิเคราะห์ (อัตโนมัติ)</option>
                      {genres.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nameTh} ({g.nameEn})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tracklist Table */}
                <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 font-bold uppercase text-[11px]">
                        <tr>
                          <th className="py-3 px-3 w-10 text-center">เลือก</th>
                          <th className="py-3 px-2 w-8 text-center">#</th>
                          <th className="py-3 px-4">ชื่อเพลง</th>
                          <th className="py-3 px-3">ศิลปิน</th>
                          <th className="py-3 px-3">ปี / ยุค</th>
                          <th className="py-3 px-3">แนวเพลง</th>
                          <th className="py-3 px-3">ท่อนฮุก (วิ)</th>
                          <th className="py-3 px-3 text-right">สถานะในคลัง</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                        {batchResult.songs.map((track, idx) => {
                          const isSelected = selectedTrackIndices.has(idx);
                          return (
                            <tr
                              key={idx}
                              onClick={() => !isBatchImporting && handleToggleTrack(idx)}
                              className={`transition cursor-pointer ${
                                isSelected
                                  ? "bg-amber-500/10 dark:bg-amber-500/15"
                                  : track.isDuplicate
                                  ? "bg-stone-50/50 dark:bg-stone-950/40 opacity-70"
                                  : "hover:bg-stone-50 dark:hover:bg-stone-950/50"
                              }`}
                            >
                              <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleTrack(idx)}
                                  disabled={isBatchImporting}
                                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-2 text-center text-stone-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4 font-semibold text-stone-900 dark:text-stone-100">
                                {track.title}
                              </td>
                              <td className="py-3 px-3 text-stone-600 dark:text-stone-300">
                                {track.artist}
                              </td>
                              <td className="py-3 px-3 text-stone-500 dark:text-stone-400">
                                {track.releaseYear} ({track.era})
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-[10px] font-mono text-stone-700 dark:text-stone-300">
                                  {track.genreSlug}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-stone-500 dark:text-stone-400 font-mono text-[11px]">
                                {track.hookStartSec}s - {track.hookEndSec}s
                              </td>
                              <td className="py-3 px-3 text-right">
                                {track.isDuplicate ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>มีในระบบแล้ว</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                    <Check className="w-3 h-3" />
                                    <span>เพลงใหม่</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchResult(null);
                      setSelectedTrackIndices(new Set());
                    }}
                    disabled={isBatchImporting}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer self-start sm:self-auto"
                  >
                    ล้างรายการ
                  </button>

                  <button
                    type="button"
                    onClick={handleStartBatchImport}
                    disabled={isBatchImporting || selectedTrackIndices.size === 0}
                    className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer w-full sm:w-auto"
                  >
                    {isBatchImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังนำเข้าเพลงแบบชุด...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>เริ่มนำเข้าและดาวน์โหลดเสียง ({selectedTrackIndices.size} เพลง)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Song Library */}
        {activeTab === "library" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อเพลง, ศิลปิน, ยุค..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full min-h-[44px] bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-xl pl-9 pr-4 py-2 text-base sm:text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => {
                  fetchSongs();
                  fetchAudioAudit();
                }}
                className="min-h-[44px] text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors self-end sm:self-auto cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSongs ? "animate-spin" : ""}`} />
                <span>รีเฟรช ({songs.length} เพลง)</span>
              </button>
            </div>

            {/* Audio Health & Batch Queue Controller Banner */}
            <div className="bg-white dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-500" />
                    <span>สถานะความพร้อมของไฟล์เสียง (Audio Health & Queue)</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    ตรวจเช็คไฟล์เสียงในระบบ หากยังไม่มีไฟล์เสียง สามารถสั่งระบบค้นหาและดาวน์โหลดจาก YouTube เข้าคลังอัตโนมัติ
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={fetchAudioAudit}
                    disabled={isAuditing}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`} />
                    <span>ตรวจเช็คไฟล์เสียง</span>
                  </button>

                  {isQueueRunning ? (
                    <button
                      type="button"
                      onClick={handleStopQueue}
                      className="min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>หยุดคิว</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartQueue}
                      disabled={songs.filter((s) => !audioAuditMap[s.id]).length === 0}
                      className="min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>เริ่มคิวดาวน์โหลดอัตโนมัติ</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status summary pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800/80">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    เพลงทั้งหมด: <strong className="text-stone-900 dark:text-white">{songs.length}</strong> เพลง
                  </span>
                </div>

                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    มีไฟล์เสียงพร้อมเล่น: <strong>{songs.filter((s) => audioAuditMap[s.id]).length}</strong> เพลง
                  </span>
                </div>

                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-medium text-rose-800 dark:text-rose-300">
                    ยังไม่มีไฟล์เสียง: <strong>{songs.filter((s) => !audioAuditMap[s.id]).length}</strong> เพลง
                  </span>
                </div>
              </div>

              {/* Live Queue Progress Bar */}
              {isQueueRunning && queueProgress && (
                <div className="pt-2 space-y-2 border-t border-stone-100 dark:border-stone-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังดาวน์โหลด: {queueProgress.songTitle}</span>
                    </span>
                    <span className="font-mono text-stone-500">
                      {queueProgress.current} / {queueProgress.total} (
                      {Math.round((queueProgress.current / queueProgress.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(queueProgress.current / queueProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {queueStatusMessage && !isQueueRunning && (
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {queueStatusMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Song Cards List */}
            {isLoadingSongs ? (
              <div className="text-center py-16 text-stone-500 dark:text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                <p className="text-xs">กำลังโหลดคลังเพลง...</p>
              </div>
            ) : filteredSongs.length === 0 ? (
              <div className="text-center py-16 bg-stone-50/50 dark:bg-stone-900/40 border border-dashed border-stone-300 dark:border-stone-800 rounded-3xl p-8">
                <Music className="w-10 h-10 text-stone-400 dark:text-stone-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">ยังไม่มีเพลงในคลัง</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-4">
                  เริ่มต้นเพิ่มเพลงใหม่โดยใช้ AI ค้นหาจาก YouTube หรือชื่อเพลงในแท็บ "เพิ่มเพลงด้วย AI"
                </p>
                <button
                  onClick={() => setActiveTab("import")}
                  className="min-h-[44px] bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ไปที่หน้าเพิ่มเพลง</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    className="bg-white dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800/80 hover:border-stone-300 dark:hover:border-stone-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {/* Audio Play/Pause Button */}
                      <button
                        onClick={() => togglePlayAudio(song.id, song.audioUrl)}
                        className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          playingSongId === song.id
                            ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/30"
                            : "bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
                        }`}
                      >
                        {playingSongId === song.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">{song.title}</h4>
                          {song.era && (
                            <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded font-mono">
                              {song.era}
                            </span>
                          )}
                          {song.genre && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              {song.genre.nameTh}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {song.artist} {song.releaseYear ? `• ${song.releaseYear}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {/* Audio status pill or individual fetch button */}
                      {audioAuditMap[song.id] ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                          <CheckCircle className="w-3 h-3" />
                          <span>มีไฟล์เสียงแล้ว</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">
                            <AlertCircle className="w-3 h-3" />
                            <span>ขาดไฟล์เสียง</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSyncSingleSong(song.id, song.title)}
                            disabled={syncingSongId === song.id || isQueueRunning}
                            className="min-h-[36px] px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                            title="ค้นหาจาก YouTube และดาวน์โหลดเข้าคลังทันที"
                          >
                            {syncingSongId === song.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3 fill-current" />
                            )}
                            <span>{syncingSongId === song.id ? "กำลังโหลด..." : "โหลดเสียง"}</span>
                          </button>
                        </div>
                      )}

                      {song.hookStartSec !== undefined && song.hookEndSec !== undefined && (
                        <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                          ฮุก: {song.hookStartSec}s - {song.hookEndSec}s
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteSong(song.id, song.title)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="ลบเพลง"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Settings */}
        {activeTab === "settings" && (
          <div className="bg-white dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-500" />
                <span>การตั้งค่าระบบ (Admin Settings)</span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">กำหนด API Keys และตรวจสอบความพร้อมของระบบเชื่อมต่อ</p>
            </div>

            {/* Custom Gemini Key for Local Dev */}
            <div className="p-4 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl space-y-3">
              <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                Google Gemini API Key (สำหรับทดสอบในเครื่องส่วนตัว)
              </label>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                สามารถรับฟรีได้ที่{" "}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Google AI Studio (ฟรี 1,500 req/day)
                </a>{" "}
                ระบบจะเซฟลงใน LocalStorage ของเบราว์เซอร์คุณโดยไม่แชร์ออกไป
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="flex-1 min-h-[44px] bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-2 text-base sm:text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => {
                    localStorage.setItem("pleng_gemini_key", customApiKey);
                    alert("บันทึก Gemini API Key เรียบร้อยแล้ว!");
                  }}
                  className="min-h-[44px] bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-stone-50 dark:text-stone-900 text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  บันทึก Key
                </button>
              </div>
            </div>

            {/* System Status Indicators */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200">สถานะบริการและเครื่องมือ:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800/80 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-stone-500 dark:text-stone-400">Local ffmpeg</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">ติดตั้งพร้อมใช้งาน (v8.1)</p>
                </div>

                <div className="bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800/80 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-stone-500 dark:text-stone-400">Database</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">Supabase PostgreSQL</p>
                </div>

                <div className="bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800/80 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-stone-500 dark:text-stone-400">Audio Storage</span>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">Cloudflare R2 / Local</p>
                </div>
              </div>
            </div>

            {/* Room Maintenance & Cleanup */}
            <div className="p-4 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>จัดการทำความสะอาดห้องเกม (Room Cleanup)</span>
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    ระบบจะเคลียร์ห้องร้างที่ไม่มีคนเล่นเกิน 24 ชั่วโมง และห้องที่จบเกมแล้วอัตโนมัติเมื่อมีการสร้างห้องใหม่
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCleanupRooms}
                  disabled={isCleaningRooms}
                  className="min-h-[40px] px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                >
                  {isCleaningRooms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>สั่งล้างห้องร้างทันที</span>
                </button>
              </div>
              {cleanupMessage && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {cleanupMessage}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quick Paste & Split Full Lyrics Modal */}
      {isSplitLyricsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
              <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white flex items-center gap-2">
                <span>📋 วางเนื้อเพลงเต็มเพื่อตัดแบ่งท่อน</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSplitLyricsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              ก๊อปปี้เนื้อเพลงจาก Google หรือเว็บเนื้อเพลงมาวางทั้งหมด ระบบจะช่วยคัดเลือกท่อนเปิด (Intro 2-4 บรรทัดแรก) และท่อนฮุก (Chorus) ให้อัตโนมัติ
            </p>
            <textarea
              rows={8}
              value={rawFullLyrics}
              onChange={(e) => setRawFullLyrics(e.target.value)}
              placeholder="วางเนื้อเพลงทั้งหมดที่นี่..."
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-2xl p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSplitLyricsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAutoSplitLyrics}
                disabled={!rawFullLyrics.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors disabled:opacity-50 cursor-pointer"
              >
                แยกท่อนเปิดและฮุกทันที
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
