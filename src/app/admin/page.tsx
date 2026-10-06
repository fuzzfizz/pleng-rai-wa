"use client";

import { useState, useEffect } from "react";
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
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Database,
  Volume2,
} from "lucide-react";
import { Genre, Song } from "@/types";
import { ExtractedSongMetadata } from "@/lib/ai-extractor";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"import" | "library" | "settings">("import");

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

  // Library State
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Load Genres and API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("pleng_gemini_key");
    if (savedKey) setCustomApiKey(savedKey);

    fetchGenres();
    fetchSongs();
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
        // Auto match genre if available
        const matched = genres.find(
          (g) => g.slug === data.metadata.genreSlug || g.nameEn.toLowerCase() === data.metadata.genreSlug.toLowerCase()
        );
        if (matched) setSelectedGenreId(matched.id);
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
            <span>เพิ่มเพลงด้วย AI</span>
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
                  <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/30 font-mono">
                    ยุค {extractedData.era}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">ชื่อเพลงทางการ (Title)</label>
                    <input
                      type="text"
                      value={extractedData.title}
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
                      onChange={(e) => setExtractedData({ ...extractedData, artist: e.target.value })}
                      className="w-full min-h-[44px] bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Release Year */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">ปีที่ปล่อยเพลง (Release Year)</label>
                    <input
                      type="number"
                      value={extractedData.releaseYear || ""}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, releaseYear: Number(e.target.value) || 0 })
                      }
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
                      ความยาวท่อนฮุก: {((extractedData.hookEndSec || 0) - (extractedData.hookStartSec || 0)).toFixed(1)} วิ
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">เริ่มต้นที่วินาที:</span>
                      <input
                        type="number"
                        step="0.5"
                        value={extractedData.hookStartSec || 0}
                        onChange={(e) =>
                          setExtractedData({ ...extractedData, hookStartSec: Number(e.target.value) })
                        }
                        className="w-full min-h-[44px] bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-2 text-base sm:text-sm text-stone-900 dark:text-stone-100 font-mono mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">สิ้นสุดที่วินาที:</span>
                      <input
                        type="number"
                        step="0.5"
                        value={extractedData.hookEndSec || 0}
                        onChange={(e) => setExtractedData({ ...extractedData, hookEndSec: Number(e.target.value) })}
                        className="w-full min-h-[44px] bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-3 py-2 text-base sm:text-sm text-stone-900 dark:text-stone-100 font-mono mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Lyrics Section (For New AI Lyrics Mode) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                      🚀 เนื้อเพลงท่อนเปิด (Intro Lyrics)
                    </label>
                    <textarea
                      rows={3}
                      value={extractedData.lyricsIntro || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, lyricsIntro: e.target.value })}
                      placeholder="เนื้อเพลง 2-4 บรรทัดแรกของเพลง..."
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
                      placeholder="เนื้อเพลงท่อนฮุกสำหรับให้เสียง AI อ่าน..."
                      className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl p-3 text-base sm:text-xs text-stone-900 dark:text-stone-200 focus:outline-none focus:border-amber-500 resize-none"
                    />
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
                onClick={fetchSongs}
                className="min-h-[44px] text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors self-end sm:self-auto cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSongs ? "animate-spin" : ""}`} />
                <span>รีเฟรช ({songs.length} เพลง)</span>
              </button>
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

                    <div className="flex items-center gap-2 self-end sm:self-auto">
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
          </div>
        )}
      </main>
    </div>
  );
}
