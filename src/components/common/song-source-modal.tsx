"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Song Source & Filter Modal
// Warm Lo-Fi & Vinyl Cafe Aesthetic
// Allows filtering songs by: Random All, Era/Year, Genre, Artist/Band, Playlist
// ==========================================

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Music,
  Check,
  Search,
  Sparkles,
  Calendar,
  Mic2,
  Disc3,
  ListMusic,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { SongFilterConfig, SongFilterType, Genre, Playlist } from "@/types";
import { soundEffects } from "@/lib/sound-effects";
import { PlaylistService } from "@/lib/services/playlist-service";
import { isPlaylistPlayable } from "@/components/playlist/playlist-utils";
import { useAuth } from "@/hooks/use-auth";

export const MIN_SONGS_TO_PLAY = 5;

export interface SongSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilter?: SongFilterConfig;
  onSelectFilter: (filter: SongFilterConfig) => void | Promise<void>;
  playlists?: Playlist[];
}

export const FALLBACK_GENRES: Genre[] = [
  { id: "9e9ab69c-9c32-448a-a582-56ec140dcfe2", nameTh: "ร็อค", nameEn: "Rock", slug: "rock", icon: "🎸" },
  { id: "5b412f36-2bcd-451b-8e52-46aaa488f86f", nameTh: "ป็อป", nameEn: "Pop", slug: "pop", icon: "🎤" },
  { id: "dcb99a1c-632e-4627-874e-3c1c68e01eff", nameTh: "ที-ป็อป", nameEn: "T-Pop", slug: "t-pop", icon: "✨" },
  { id: "05232797-1b61-4a6d-ae5c-ae3efcdd3f71", nameTh: "อินดี้ / อัลเทอร์เนทีฟ", nameEn: "Indie / Alternative", slug: "indie-alt", icon: "🎧" },
  { id: "51a96d44-71fa-4bae-b6ec-e1254ab10d41", nameTh: "เพื่อชีวิต", nameEn: "Songs for Life", slug: "phua-cheewit", icon: "🪕" },
  { id: "107b4d65-ef56-41fc-bebe-361385a79b3b", nameTh: "ลูกทุ่ง / ลูกกรุง", nameEn: "Luk Thung", slug: "lukthung", icon: "🪗" },
];

export const ERA_OPTIONS = [
  {
    id: "90s",
    label: "ยุค 90s (เทปคาสเซ็ท)",
    subtitle: "1990 - 1999 • คลาสสิกยุคตลับเทป",
    icon: "📼",
    yearStart: 1990,
    yearEnd: 1999,
  },
  {
    id: "2000s",
    label: "ยุค 2000s (มิลเลนเนียม)",
    subtitle: "2000 - 2009 • ยุคซีดี & ร็อคครองเมือง",
    icon: "💿",
    yearStart: 2000,
    yearEnd: 2009,
  },
  {
    id: "2010s",
    label: "ยุค 2010s (สตรีมมิ่ง & อินดี้)",
    subtitle: "2010 - 2019 • ยุคทองเพลงอินดี้ไทย",
    icon: "📱",
    yearStart: 2010,
    yearEnd: 2019,
  },
  {
    id: "2020s",
    label: "ยุค 2020s (ฮิตติดกระแส)",
    subtitle: "2020 - ปัจจุบัน • ไวรัล & T-Pop คลื่นใหม่",
    icon: "🔥",
    yearStart: 2020,
    yearEnd: 2029,
  },
];

export function getSongFilterLabel(filter?: SongFilterConfig, customPlaylistTitle?: string): string {
  if (!filter || filter.type === "all") return "🎲 สุ่มเพลงทั้งหมด";
  if (filter.type === "genre") return `🎸 แนวเพลง: ${filter.genreName || "ตามหมวดหมู่"}`;
  if (filter.type === "era") {
    const matched = ERA_OPTIONS.find((e) => e.id === filter.era);
    return `📼 ${matched ? matched.label : `ยุค ${filter.era}`}`;
  }
  if (filter.type === "artist") return `🎤 ศิลปิน: ${filter.artist}`;
  if (filter.type === "playlist") {
    return customPlaylistTitle ? `🎶 เพลย์ลิสต์: ${customPlaylistTitle}` : "🎶 ใช้เพลย์ลิสต์";
  }
  return "🎲 สุ่มเพลงทั้งหมด";
}

export function SongSourceModal({
  isOpen,
  onClose,
  currentFilter,
  onSelectFilter,
  playlists: propPlaylists,
}: SongSourceModalProps): React.JSX.Element | null {
  const { user } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<SongFilterType>("all");

  // Draft Filter state
  const [draft, setDraft] = useState<SongFilterConfig>({ type: "all" });

  // Loaded metadata from API
  const [genres, setGenres] = useState<Genre[]>(FALLBACK_GENRES);
  const [artists, setArtists] = useState<string[]>([]);
  const [totalSongsCount, setTotalSongsCount] = useState<number>(0);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(false);

  // Playlists
  const [playlists, setPlaylists] = useState<Playlist[]>(propPlaylists || []);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(false);

  // Artist search input
  const [artistSearch, setArtistSearch] = useState<string>("");

  // Sync draft when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = currentFilter || { type: "all" };
      setDraft(initial);
      setActiveTab(initial.type || "all");
      setArtistSearch("");
    }
  }, [isOpen, currentFilter]);

  // Load Filter Options from API
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingFilters(true);

    async function fetchFilters() {
      try {
        const res = await fetch("/api/songs/filters");
        const data = await res.json();
        if (isMounted && data.success && data.filters) {
          if (data.filters.genres && data.filters.genres.length > 0) {
            setGenres(data.filters.genres);
          }
          if (data.filters.artists) {
            setArtists(data.filters.artists);
          }
          if (typeof data.filters.totalSongs === "number") {
            setTotalSongsCount(data.filters.totalSongs);
          }
        }
      } catch (err) {
        console.warn("Could not fetch song filters API:", err);
      } finally {
        if (isMounted) setIsLoadingFilters(false);
      }
    }

    fetchFilters();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Load Playlists if not provided in props
  useEffect(() => {
    if (!isOpen) return;
    if (propPlaylists && propPlaylists.length > 0) {
      setPlaylists(propPlaylists);
      return;
    }

    let isMounted = true;
    setIsLoadingPlaylists(true);

    async function fetchPlaylists() {
      try {
        const publicPromise = PlaylistService.getPublicPlaylists();
        const userPromise = user?.id
          ? PlaylistService.getUserPlaylists(user.id)
          : Promise.resolve([]);

        const [publicList, userList] = await Promise.all([
          publicPromise.catch(() => []),
          userPromise.catch(() => []),
        ]);

        const map = new Map<string, Playlist>();
        for (const p of userList) map.set(p.id, p);
        for (const p of publicList) {
          if (!map.has(p.id)) map.set(p.id, p);
        }

        if (isMounted) {
          setPlaylists(Array.from(map.values()));
        }
      } catch (err) {
        console.warn("Could not load playlists in modal:", err);
      } finally {
        if (isMounted) setIsLoadingPlaylists(false);
      }
    }

    fetchPlaylists();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, propPlaylists]);

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

  // Filtered artists based on search
  const filteredArtists = useMemo(() => {
    if (!artistSearch.trim()) return artists;
    const q = artistSearch.toLowerCase().trim();
    return artists.filter((a) => a.toLowerCase().includes(q));
  }, [artists, artistSearch]);

  const selectedPlaylist = useMemo(() => {
    if (draft.type !== "playlist" || !draft.playlistId) return null;
    return playlists.find((p) => p.id === draft.playlistId);
  }, [draft, playlists]);

  // Current pill label
  const activePillLabel = useMemo(() => {
    return getSongFilterLabel(draft, selectedPlaylist?.title);
  }, [draft, selectedPlaylist]);

  // Validation
  const isDraftValid = useMemo(() => {
    if (draft.type === "all") return true;
    if (draft.type === "era") return Boolean(draft.era);
    if (draft.type === "genre") return Boolean(draft.genreId);
    if (draft.type === "artist") return Boolean(draft.artist && draft.artist.trim().length > 0);
    if (draft.type === "playlist") {
      if (!draft.playlistId) return false;
      const target = playlists.find((p) => p.id === draft.playlistId);
      return Boolean(target && isPlaylistPlayable(target.songCount || 0));
    }
    return true;
  }, [draft, playlists]);

  const handleConfirm = () => {
    try {
      soundEffects.click();
    } catch {}
    onSelectFilter(draft);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="song-source-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-left my-auto max-h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-72 h-28 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <Disc3 className="w-5 h-5 animate-[spin_8s_linear_infinite]" />
            </div>
            <div>
              <h2
                id="song-source-modal-title"
                className="text-lg sm:text-xl font-bold font-serif text-stone-900 dark:text-white tracking-tight"
              >
                เลือกแหล่งเพลงสำหรับเล่นเกม
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                กรองเพลงตามความชอบ หรือสุ่มจากคลังทั้งหมด {totalSongsCount > 0 ? `(${totalSongsCount} เพลง)` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800/80 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Selection Pill */}
        <div className="py-3 shrink-0">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
              <span className="text-base">🎯</span>
              <span>ตัวกรองที่เลือกขณะนี้:</span>
              <span className="font-bold underline decoration-amber-400 dark:decoration-amber-500 underline-offset-2">
                {activePillLabel}
              </span>
            </div>
            {isDraftValid && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> พร้อมใช้งาน
              </span>
            )}
          </div>
        </div>

        {/* Filter Mode Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-950/70 border border-stone-200/80 dark:border-stone-800/80 shrink-0 text-xs font-semibold">
          {/* Tab 1: All */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setDraft({ type: "all" });
            }}
            className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === "all"
                ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
            }`}
          >
            <span>🎲</span>
            <span>สุ่มทั้งหมด</span>
          </button>

          {/* Tab 2: Era */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("era");
              if (draft.type !== "era" || !draft.era) {
                setDraft({
                  type: "era",
                  era: "2000s",
                  yearStart: 2000,
                  yearEnd: 2009,
                });
              }
            }}
            className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === "era"
                ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
            }`}
          >
            <span>📅</span>
            <span>ตามยุค / ปี</span>
          </button>

          {/* Tab 3: Genre */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("genre");
              if (draft.type !== "genre" || !draft.genreId) {
                const first = genres[0];
                if (first) {
                  setDraft({
                    type: "genre",
                    genreId: first.id,
                    genreName: first.nameTh,
                  });
                }
              }
            }}
            className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === "genre"
                ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
            }`}
          >
            <span>🎸</span>
            <span>แนวเพลง</span>
          </button>

          {/* Tab 4: Artist */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("artist");
              if (draft.type !== "artist" || !draft.artist) {
                const firstArtist = artists[0] || "Silly Fools";
                setDraft({
                  type: "artist",
                  artist: firstArtist,
                });
              }
            }}
            className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === "artist"
                ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
            }`}
          >
            <span>🎤</span>
            <span>ศิลปิน / วง</span>
          </button>

          {/* Tab 5: Playlist */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("playlist");
              if (draft.type !== "playlist" || !draft.playlistId) {
                const playable = playlists.find((p) => isPlaylistPlayable(p.songCount || 0));
                if (playable) {
                  setDraft({
                    type: "playlist",
                    playlistId: playable.id,
                  });
                }
              }
            }}
            className={`col-span-2 sm:col-span-1 py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === "playlist"
                ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
            }`}
          >
            <span>🎶</span>
            <span>เพลย์ลิสต์</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto py-4 pr-1">
          {/* TAB 1: RANDOM ALL */}
          {activeTab === "all" && (
            <div className="space-y-4">
              <div
                onClick={() => setDraft({ type: "all" })}
                className={`p-5 rounded-3xl border text-left cursor-pointer transition-all flex flex-col gap-2 ${
                  draft.type === "all"
                    ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-md"
                    : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-amber-400/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎲</span>
                    <div>
                      <h3 className="font-bold text-base text-stone-900 dark:text-white">
                        สุ่มเพลงทั้งหมดจากคลังเพลง (Random All)
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        ไม่จำกัดยุค ไม่จำกัดแนวเพลง — เล่นได้ทุกสไตล์ตั้งแต่ 90s จนถึงฮิตติดกระแสปัจจุบัน
                      </p>
                    </div>
                  </div>
                  {draft.type === "all" && (
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  โหมดแนะนำสำหรับปาร์ตี้หรือเล่นทั่วไป เพราะมีความหลากหลายสูงสุด เหมาะสำหรับทดสอบความจำเพลงรอบด้าน!
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: ERA / YEAR */}
          {activeTab === "era" && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-stone-600 dark:text-stone-300 flex items-center justify-between">
                <span>เลือกยุคสมัยของบทเพลง:</span>
                <span className="text-[11px] text-stone-400">คลิกที่การ์ดเพื่อเลือก</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ERA_OPTIONS.map((era) => {
                  const isSelected = draft.type === "era" && draft.era === era.id;
                  return (
                    <div
                      key={era.id}
                      onClick={() => {
                        setDraft({
                          type: "era",
                          era: era.id,
                          yearStart: era.yearStart,
                          yearEnd: era.yearEnd,
                        });
                      }}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 min-h-[90px] ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                          : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-amber-400/50 hover:bg-stone-100/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{era.icon}</span>
                          <div>
                            <div className="font-bold text-sm text-stone-900 dark:text-white">
                              {era.label}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                              {era.subtitle}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GENRE */}
          {activeTab === "genre" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-300">
                <span>เลือกหมวดหมู่แนวเพลง:</span>
                {isLoadingFilters && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px]">
                    <Loader2 className="w-3 h-3 animate-spin" /> โหลดหมวดหมู่...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {genres.map((g) => {
                  const isSelected = draft.type === "genre" && draft.genreId === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        setDraft({
                          type: "genre",
                          genreId: g.id,
                          genreName: g.nameTh,
                        });
                      }}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 min-h-[80px] ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm"
                          : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-amber-400/50 hover:bg-stone-100/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{g.icon || "🎵"}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-stone-900 dark:text-white">
                          {g.nameTh}
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">
                          {g.nameEn}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ARTIST / BAND */}
          {activeTab === "artist" && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อศิลปิน หรือ วงดนตรี เช่น Bodyslam, Silly Fools..."
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Popular Artist Chips */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wider">
                  ศิลปินยอดนิยมในฐานข้อมูล:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {filteredArtists.length > 0 ? (
                    filteredArtists.map((artistName) => {
                      const isSelected =
                        draft.type === "artist" &&
                        draft.artist?.toLowerCase() === artistName.toLowerCase();
                      return (
                        <button
                          key={artistName}
                          type="button"
                          onClick={() => {
                            setDraft({
                              type: "artist",
                              artist: artistName,
                            });
                          }}
                          className={`py-1.5 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-amber-500 border-amber-600 text-white font-bold shadow-sm"
                              : "bg-stone-100 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700/80 text-stone-700 dark:text-stone-300 hover:border-amber-400"
                          }`}
                        >
                          <Mic2 className="w-3 h-3 opacity-70" />
                          <span>{artistName}</span>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="w-full p-4 text-center text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-950/40 rounded-2xl border border-stone-200 dark:border-stone-800">
                      ไม่พบศิลปินที่ตรงกับคำค้นหา
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Freeform Artist Input */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800/80 space-y-2">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  หรือพิมพ์ชื่อศิลปินที่ต้องการระบุเจาะจง:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="เช่น Palmy, Loso, Carabao"
                    value={draft.type === "artist" ? draft.artist || "" : ""}
                    onChange={(e) => {
                      setDraft({
                        type: "artist",
                        artist: e.target.value,
                      });
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (artistSearch.trim()) {
                        setDraft({
                          type: "artist",
                          artist: artistSearch.trim(),
                        });
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    ใช้ชื่อนี้
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PLAYLIST */}
          {activeTab === "playlist" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-300">
                <span>เลือกเพลย์ลิสต์ (ต้องการเพลงขั้นต่ำ {MIN_SONGS_TO_PLAY} เพลง):</span>
                {isLoadingPlaylists && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px]">
                    <Loader2 className="w-3 h-3 animate-spin" /> โหลดเพลย์ลิสต์...
                  </span>
                )}
              </div>

              {playlists.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {playlists.map((pl) => {
                    const isPlayable = isPlaylistPlayable(pl.songCount || 0);
                    const isSelected = draft.type === "playlist" && draft.playlistId === pl.id;

                    return (
                      <div
                        key={pl.id}
                        onClick={() => {
                          if (!isPlayable) return;
                          setDraft({
                            type: "playlist",
                            playlistId: pl.id,
                          });
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                          !isPlayable
                            ? "opacity-50 cursor-not-allowed bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800"
                            : isSelected
                            ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white cursor-pointer shadow-sm"
                            : "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-amber-400/50 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                            <ListMusic className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-stone-900 dark:text-white truncate">
                              {pl.title}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2">
                              <span>{pl.songCount || 0} เพลง</span>
                              {pl.authorName && <span>• โดย {pl.authorName}</span>}
                              {!isPlayable && (
                                <span className="text-rose-500 dark:text-rose-400 font-semibold">
                                  (ยังไม่ครบ {MIN_SONGS_TO_PLAY} เพลง)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-950/40 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-2">
                  <ListMusic className="w-8 h-8 mx-auto text-stone-400 stroke-1" />
                  <p>ยังไม่มีเพลย์ลิสต์ในระบบ หรือเพลย์ลิสต์ยังไม่มีเพลง</p>
                  <p className="text-[11px] text-stone-400">
                    คุณสามารถสร้างเพลย์ลิสต์ได้ที่เมนู <strong>คลังเพลย์ลิสต์</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer / Confirm Button */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isDraftValid}
            className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>ยืนยันแหล่งเพลง</span>
          </button>
        </div>
      </div>
    </div>
  );
}
