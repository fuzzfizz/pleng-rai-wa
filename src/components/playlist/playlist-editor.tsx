"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Playlist Editor Component
// Interactive editor for creating and modifying playlists with song catalog search,
// audio preview, sequence reordering, and minimum 5 songs validation
// ==========================================

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  X,
  Search,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Play,
  Square,
  Music2,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { Playlist, Song } from "@/types";
import { PlaylistService } from "@/lib/services/playlist-service";
import { getSongs } from "@/lib/services/song-service";
import {
  reorderSongs,
  formatPlaylistDuration,
  isPlaylistPlayable,
  calculateTotalDuration,
} from "./playlist-utils";
import { soundEffects } from "@/lib/sound-effects";

export interface PlaylistEditorProps {
  initialPlaylist?: (Playlist & { songs?: Song[] }) | null;
  userId: string;
  onSaveSuccess?: (playlist: Playlist) => void;
  onCancel?: () => void;
}

export function PlaylistEditor({
  initialPlaylist,
  userId,
  onSaveSuccess,
  onCancel,
}: PlaylistEditorProps): React.JSX.Element {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState(initialPlaylist?.title || "");
  const [description, setDescription] = useState(initialPlaylist?.description || "");
  const [isPublic, setIsPublic] = useState(initialPlaylist?.isPublic ?? true);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>(
    initialPlaylist?.songs || []
  );

  // Search & Catalog State
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogSongs, setCatalogSongs] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Audio Preview State
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);

  // Load initial playlist songs if not embedded
  useEffect(() => {
    if (initialPlaylist?.id && (!initialPlaylist.songs || initialPlaylist.songs.length === 0)) {
      setIsLoadingSongs(true);
      PlaylistService.getPlaylistById(initialPlaylist.id)
        .then((res) => {
          if (res?.songs) {
            setSelectedSongs(res.songs);
          }
        })
        .catch((err) => {
          console.error("Error fetching playlist songs for editor:", err);
        })
        .finally(() => {
          setIsLoadingSongs(false);
        });
    }
  }, [initialPlaylist]);

  // Load catalog songs (debounced search or default pool)
  useEffect(() => {
    let isCancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const query = searchQuery.trim();
        const songs = await getSongs({
          searchQuery: query || undefined,
          limit: 20,
        });
        if (!isCancelled) {
          setCatalogSongs(songs);
        }
      } catch (err) {
        console.error("Failed to search songs:", err);
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, []);

  // Audio Preview Handler (5-second slice or direct audio)
  const handleTogglePreview = (song: Song) => {
    try {
      soundEffects.click();
    } catch {}

    // Stop currently playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (previewingSongId === song.id) {
      setPreviewingSongId(null);
      return;
    }

    try {
      const sliceUrl = `/api/audio/slice?id=${encodeURIComponent(song.id)}&start=${song.hookStartSec || 0}&duration=5`;
      const audio = new Audio(sliceUrl);
      audioRef.current = audio;
      setPreviewingSongId(song.id);

      audio.onended = () => {
        setPreviewingSongId(null);
        if (previewTimerRef.current) {
          clearTimeout(previewTimerRef.current);
          previewTimerRef.current = null;
        }
      };

      audio.onerror = () => {
        // Fallback to song.audioUrl
        if (song.audioUrl && !song.audioUrl.startsWith("/api/audio/slice")) {
          const fallbackAudio = new Audio(song.audioUrl);
          audioRef.current = fallbackAudio;
          fallbackAudio.addEventListener(
            "loadedmetadata",
            () => {
              try {
                fallbackAudio.currentTime = song.hookStartSec || 0;
              } catch (e) {
                console.warn("Could not seek fallback audio:", e);
              }
            },
            { once: true }
          );
          fallbackAudio.play().catch(() => {
            setPreviewingSongId(null);
            if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
              previewTimerRef.current = null;
            }
          });
          fallbackAudio.onended = () => {
            setPreviewingSongId(null);
            if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
              previewTimerRef.current = null;
            }
          };
          fallbackAudio.onerror = () => {
            setPreviewingSongId(null);
            if (previewTimerRef.current) {
              clearTimeout(previewTimerRef.current);
              previewTimerRef.current = null;
            }
          };
        } else {
          setPreviewingSongId(null);
          if (previewTimerRef.current) {
            clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
          }
        }
      };

      audio.play().catch((err) => {
        console.warn("Autoplay audio slice error:", err);
        setPreviewingSongId(null);
        if (previewTimerRef.current) {
          clearTimeout(previewTimerRef.current);
          previewTimerRef.current = null;
        }
      });

      // 5-second automatic cutoff
      previewTimerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setPreviewingSongId(null);
      }, 5000);
    } catch (err) {
      console.error("Audio preview failed:", err);
      setPreviewingSongId(null);
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    }
  };

  // Song selection management
  const handleAddSong = (song: Song) => {
    if (selectedSongs.some((s) => s.id === song.id)) return;
    try {
      soundEffects.click();
    } catch {}
    setSelectedSongs((prev) => [...prev, song]);
    setErrorMessage(null);
  };

  const handleRemoveSong = (index: number) => {
    try {
      soundEffects.click();
    } catch {}
    const removedSong = selectedSongs[index];
    if (previewingSongId === removedSong?.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      setPreviewingSongId(null);
    }
    setSelectedSongs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    try {
      soundEffects.click();
    } catch {}
    setSelectedSongs((prev) => reorderSongs(prev, index, index - 1));
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedSongs.length - 1) return;
    try {
      soundEffects.click();
    } catch {}
    setSelectedSongs((prev) => reorderSongs(prev, index, index + 1));
  };

  // Validation
  const trimmedTitle = title.trim();
  const isTitleValid = trimmedTitle.length >= 1 && trimmedTitle.length <= 60;
  const isPlayable = isPlaylistPlayable(selectedSongs.length);
  const isFormValid = isTitleValid && isPlayable;

  const totalDuration = calculateTotalDuration(selectedSongs);

  // Save playlist
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!isTitleValid) {
      setErrorMessage("ชื่อเพลย์ลิสต์ต้องมีความยาว 1 - 60 ตัวอักษร");
      return;
    }

    if (!isPlayable) {
      setErrorMessage(
        `ต้องเลือกเพลงอย่างน้อย 5 เพลงเพื่อสร้างเพลย์ลิสต์ (เลือกแล้ว ${selectedSongs.length}/5 เพลง)`
      );
      return;
    }

    setIsSaving(true);
    try {
      let savedPlaylist: Playlist;
      const songIds = selectedSongs.map((s) => s.id);

      if (initialPlaylist?.id) {
        savedPlaylist = await PlaylistService.updatePlaylist(
          initialPlaylist.id,
          userId,
          {
            title: trimmedTitle,
            description: description.trim() || undefined,
            isPublic,
            songIds,
          }
        );
      } else {
        savedPlaylist = await PlaylistService.createPlaylist(userId, {
          title: trimmedTitle,
          description: description.trim() || undefined,
          isPublic,
          songIds,
        });
      }

      try {
        soundEffects.correct();
      } catch {}

      if (onSaveSuccess) {
        onSaveSuccess(savedPlaylist);
      } else {
        router.push("/playlists");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดในการบันทึกเพลย์ลิสต์");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelClick = () => {
    try {
      soundEffects.click();
    } catch {}
    if (onCancel) {
      onCancel();
    } else {
      router.push("/playlists");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Editor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
            <Music2 className="w-7 h-7 text-amber-500" />
            {initialPlaylist ? "แก้ไขเพลย์ลิสต์" : "สร้างเพลย์ลิสต์ใหม่"}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            เลือกเพลงโปรดจัดเซ็ตไว้ทายกับเพื่อน หรือซ้อมเดี่ยวเพื่อฝึกความไว
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSaving}
            className="min-h-[44px] px-4 rounded-2xl bg-stone-200/70 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-stone-300/60 dark:border-stone-700 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            <span>ยกเลิก</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={!isFormValid || isSaving}
            className={`min-h-[44px] px-6 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              isFormValid && !isSaving
                ? "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                : "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 border border-stone-300 dark:border-stone-700/60 cursor-not-allowed opacity-60"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>บันทึกเพลย์ลิสต์</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Validation Error */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Basic Metadata Form */}
      <div className="rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Title Field with Live Counter */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200">
              ชื่อเพลย์ลิสต์ <span className="text-amber-500">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                trimmedTitle.length > 60
                  ? "text-rose-500 font-bold"
                  : trimmedTitle.length > 0
                  ? "text-stone-500 dark:text-stone-400"
                  : "text-stone-400 dark:text-stone-600"
              }`}
            >
              [{trimmedTitle.length}/60]
            </span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrorMessage(null);
            }}
            placeholder="เช่น เพลงฮิตยุค 90s, กามิกาเซ่ในตำนาน..."
            maxLength={60}
            className="w-full min-h-[44px] px-4 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-base sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
        </div>

        {/* Description Field */}
        <div>
          <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
            คำอธิบาย (ไม่บังคับ)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="เพิ่มคำอธิบายสั้นๆ เกี่ยวกับเพลงในลิสต์นี้..."
            className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-base sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors resize-none"
          />
        </div>

        {/* Visibility Switch */}
        <div className="pt-2 flex items-center justify-between border-t border-stone-200 dark:border-stone-800/60">
          <div className="flex items-center gap-2.5">
            {isPublic ? (
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Globe className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                <Lock className="w-4 h-4" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                {isPublic ? "เปิดเป็นสาธารณะ (Public)" : "ตั้งเป็นส่วนตัว (Private)"}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isPublic
                  ? "ผู้เล่นคนอื่นสามารถค้นหาและนำเพลย์ลิสต์นี้ไปใช้เล่นได้"
                  : "เฉพาะคุณคนเดียวเท่านั้นที่สามารถมองเห็นและใช้งานได้"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPublic((prev) => !prev)}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isPublic
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "bg-stone-200/70 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            {isPublic ? "สาธารณะ" : "ส่วนตัว"}
          </button>
        </div>
      </div>

      {/* Two Column Layout: Selected Songs & Song Search */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Selected Songs (Target) */}
        <div className="rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm flex flex-col h-[520px]">
          {/* Header & Threshold Status */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>เพลงในเพลย์ลิสต์</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400 font-mono">
                  {selectedSongs.length}
                </span>
              </h2>
              {totalDuration > 0 && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  เวลารวม: {formatPlaylistDuration(totalDuration)}
                </p>
              )}
            </div>

            {/* Validation Badge */}
            {isPlayable ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ครบตามเกณฑ์แล้ว (เลือกแล้ว {selectedSongs.length} เพลง)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <AlertCircle className="w-3.5 h-3.5" />
                ยังไม่ครบ 5 เพลง (เลือกแล้ว {selectedSongs.length}/5)
              </span>
            )}
          </div>

          {/* Songs List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-200 dark:divide-stone-800/60 pr-1 py-2 space-y-1">
            {isLoadingSongs ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 dark:text-stone-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">กำลังโหลดเพลง...</span>
              </div>
            ) : selectedSongs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 dark:text-stone-500">
                <Music2 className="w-10 h-10 mb-2 stroke-[1.5] text-stone-300 dark:text-stone-600" />
                <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">ยังไม่มีเพลงในเพลย์ลิสต์</p>
                <p className="text-[11px] mt-1 text-stone-400 dark:text-stone-500">
                  ค้นหาและกดปุ่ม &quot;+ เพิ่ม&quot; จากรายการด้านขวาเพื่อเพิ่มเพลง (ต้องมีอย่างน้อย 5 เพลง)
                </p>
              </div>
            ) : (
              selectedSongs.map((song, index) => {
                const isPreviewing = previewingSongId === song.id;
                return (
                  <div
                    key={`${song.id}-${index}`}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors group"
                  >
                    {/* Index & Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-center text-xs font-mono font-bold text-stone-400 dark:text-stone-500 shrink-0">
                        {index + 1}
                      </span>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(song)}
                        className={`min-h-[44px] min-w-[44px] p-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                          isPreviewing
                            ? "bg-amber-500 text-stone-950 animate-pulse"
                            : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700"
                        }`}
                        title={isPreviewing ? "หยุดฟังตัวอย่าง" : "ฟังตัวอย่าง 5 วิ"}
                      >
                        {isPreviewing ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {song.title}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {song.artist}
                        </p>
                      </div>
                    </div>

                    {/* Sequence Controls & Remove */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === selectedSongs.length - 1}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSong(index)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-lg text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="ลบเพลงนี้ออก"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Song Catalog Search */}
        <div className="rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm flex flex-col h-[520px]">
          {/* Search Box */}
          <div className="pb-3 border-b border-stone-200 dark:border-stone-800 shrink-0">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-2">ค้นหาเพลงในระบบ</h2>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาตามชื่อเพลง หรือ ศิลปิน..."
                className="w-full min-h-[44px] pl-10 pr-4 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-base sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />
              )}
            </div>
          </div>

          {/* Catalog Results */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-200 dark:divide-stone-800/60 pr-1 py-2 space-y-1">
            {catalogSongs.length === 0 && !isSearching ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 dark:text-stone-500">
                <Search className="w-8 h-8 mb-2 stroke-[1.5] text-stone-300 dark:text-stone-600" />
                <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">ไม่พบเพลงที่ค้นหา</p>
                <p className="text-[11px] mt-1 text-stone-400 dark:text-stone-500">
                  ลองเปลี่ยนคำค้นหา เช่น ชื่อเพลง หรือ ชื่อศิลปิน
                </p>
              </div>
            ) : (
              catalogSongs.map((song) => {
                const isSelected = selectedSongs.some((s) => s.id === song.id);
                const isPreviewing = previewingSongId === song.id;

                return (
                  <div
                    key={song.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* 5s Preview Button */}
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(song)}
                        className={`min-h-[44px] min-w-[44px] p-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                          isPreviewing
                            ? "bg-amber-500 text-stone-950 animate-pulse"
                            : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700"
                        }`}
                        title={isPreviewing ? "หยุดฟังตัวอย่าง" : "ฟังตัวอย่าง 5 วิ"}
                      >
                        {isPreviewing ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {song.title}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {song.artist}{" "}
                          {song.era && (
                            <span className="text-[10px] text-stone-400 dark:text-stone-500">
                              • {song.era}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Add Button */}
                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="min-h-[36px] px-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 select-none">
                          <CheckCircle2 className="w-3 h-3" />
                          เพิ่มแล้ว
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddSong(song)}
                          className="min-h-[44px] px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-stone-950 dark:hover:text-stone-950 border border-amber-500/30 hover:border-transparent text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่ม</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
