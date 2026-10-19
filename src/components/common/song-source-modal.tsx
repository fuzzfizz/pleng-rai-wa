"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Song Source & Filter Modal
// Warm Lo-Fi & Vinyl Cafe Aesthetic
// Allows filtering songs by: Random All, Era/Year, Genre, Artist/Band
// ==========================================

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Check,
  Search,
  Sparkles,
  Mic2,
  Disc3,
  Loader2,
  AlertTriangle,
  LogIn,
  ListMusic,
} from "lucide-react";
import type { SongFilterConfig, SongFilterType, Genre, Playlist } from "@/types";
import { soundEffects } from "@/lib/sound-effects";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth/auth-modal";
import { PlaylistService } from "@/lib/services/playlist-service";
import { isPlaylistPlayable } from "@/components/playlist/playlist-utils";

export const MIN_SONGS_TO_PLAY = 5;

export interface SongSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilter?: SongFilterConfig;
  onSelectFilter: (filter: SongFilterConfig) => void | Promise<void>;
  playlists?: Playlist[];
  initialPlaylistSubTab?: "public" | "my";
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
  if (filter.type === "genre") {
    if (filter.genreNames && filter.genreNames.length > 1) {
      return `🎸 แนวเพลง (${filter.genreNames.length} หมวด): ${filter.genreNames.join(", ")}`;
    }
    return `🎸 แนวเพลง: ${filter.genreName || "ตามหมวดหมู่"}`;
  }
  if (filter.type === "era") {
    if (filter.eraIds && filter.eraIds.length > 1) {
      if (filter.eraIds.length === ERA_OPTIONS.length) {
        return `📼 ยุคเพลง: ทุกยุคสมัย (${filter.eraIds.length} ยุค)`;
      }
      return `📼 ยุคเพลง (${filter.eraIds.length} ยุค): ${filter.eraIds.join(", ")}`;
    }
    const matched = ERA_OPTIONS.find((e) => e.id === (filter.eraIds?.[0] || filter.era));
    return `📼 ${matched ? matched.label : `ยุค ${filter.era || "ไม่ระบุ"}`}`;
  }
  if (filter.type === "artist") {
    if (filter.artists && filter.artists.length > 1) {
      return `🎤 ศิลปิน (${filter.artists.length} ศิลปิน): ${filter.artists.join(", ")}`;
    }
    return `🎤 ศิลปิน: ${filter.artist || filter.artists?.[0] || "ไม่ระบุ"}`;
  }
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
  initialPlaylistSubTab,
}: SongSourceModalProps): React.JSX.Element | null {
  const { user, isGuest } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active Tab: all | era | genre | artist | playlist
  const [activeTab, setActiveTab] = useState<SongFilterType>(
    currentFilter?.type || "all"
  );

  // Playlist sub-tab: "public" | "my"
  const [playlistSubTab, setPlaylistSubTab] = useState<"public" | "my">(() => {
    if (initialPlaylistSubTab) return initialPlaylistSubTab;
    if (currentFilter?.type === "playlist" && currentFilter.playlistId) {
      const found = (propPlaylists || []).find((p) => p.id === currentFilter.playlistId);
      if (found && (!found.isPublic || (user && found.userId === user.id))) {
        return "my";
      }
    }
    return "public";
  });
  const [playlistSearch, setPlaylistSearch] = useState<string>("");
  const [playlistWarningId, setPlaylistWarningId] = useState<string | null>(null);

  // Draft Filter state
  const [draft, setDraft] = useState<SongFilterConfig>(
    currentFilter || { type: "all" }
  );

  // Loaded metadata from API
  const [genres, setGenres] = useState<Genre[]>(FALLBACK_GENRES);
  const [eraCounts, setEraCounts] = useState<Record<string, number>>({});
  const [artists, setArtists] = useState<string[]>([]);
  const [totalSongsCount, setTotalSongsCount] = useState<number>(0);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(false);

  // Internal playlists fallback if propPlaylists is not provided
  const [internalPlaylists, setInternalPlaylists] = useState<Playlist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(false);

  // Artist search input
  const [artistSearch, setArtistSearch] = useState<string>("");

  // Filter out non-musical / era categories from genres
  const displayGenres = useMemo(() => {
    return genres.filter(
      (g) =>
        g.slug !== "90s" &&
        g.slug !== "2000s" &&
        !g.nameTh.includes("ยุค")
    );
  }, [genres]);

  // Load playlists fallback if propPlaylists not provided
  useEffect(() => {
    if (!isOpen || propPlaylists !== undefined) return;

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

        if (!isMounted) return;

        const map = new Map<string, Playlist>();
        for (const p of userList) map.set(p.id, p);
        for (const p of publicList) {
          if (!map.has(p.id)) map.set(p.id, p);
        }
        setInternalPlaylists(Array.from(map.values()));
      } catch (err) {
        console.warn("Could not fetch playlists in SongSourceModal:", err);
      } finally {
        if (isMounted) setIsLoadingPlaylists(false);
      }
    }

    fetchPlaylists();

    return () => {
      isMounted = false;
    };
  }, [isOpen, propPlaylists, user?.id]);

  const effectivePlaylists = propPlaylists ?? internalPlaylists;

  // Track previous isOpen state so draft only initializes when isOpen transitions false -> true
  const prevIsOpenRef = React.useRef(false);

  // Sync draft when modal opens (only when transitioning from closed to open)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      const initial = currentFilter || { type: "all" };
      setDraft(initial);
      setActiveTab(initial.type || "all");
      setArtistSearch("");
      setPlaylistSearch("");
      setPlaylistWarningId(null);

      if (initial.type === "playlist" && initial.playlistId) {
        const currentP = effectivePlaylists.find((p) => p.id === initial.playlistId);
        if (currentP && user && currentP.userId === user.id) {
          setPlaylistSubTab("my");
        } else {
          setPlaylistSubTab("public");
        }
      }
    }
  }, [isOpen, currentFilter, effectivePlaylists, user]);

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
          if (data.filters.eras && data.filters.eras.length > 0) {
            const counts: Record<string, number> = {};
            for (const era of data.filters.eras) {
              if (typeof era.songCount === "number") {
                counts[era.id] = era.songCount;
              }
            }
            setEraCounts(counts);
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

  // Filtered playlists based on sub-tab and search
  const filteredPlaylists = useMemo(() => {
    let list = effectivePlaylists;
    if (playlistSubTab === "my") {
      if (!user || isGuest) {
        return [];
      }
      list = list.filter((p) => p.userId === user.id);
    } else {
      list = list.filter((p) => p.isPublic !== false);
    }

    if (playlistSearch.trim()) {
      const q = playlistSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.authorName && p.authorName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [effectivePlaylists, playlistSubTab, user, isGuest, playlistSearch]);

  // Current pill label
  const activePillLabel = useMemo(() => {
    if (draft.type === "playlist") {
      const targetPlaylist = effectivePlaylists.find((p) => p.id === draft.playlistId);
      const title = targetPlaylist?.title;
      return title
        ? `🎶 เพลย์ลิสต์: ${title}`
        : draft.playlistId
        ? `🎶 เพลย์ลิสต์: ${draft.playlistId}`
        : "🎶 ใช้เพลย์ลิสต์";
    }
    return getSongFilterLabel(draft);
  }, [draft, effectivePlaylists]);

  // Validation
  const isDraftValid = useMemo(() => {
    if (draft.type === "all") return true;
    if (draft.type === "era") {
      return Boolean(draft.era || (draft.eraIds && draft.eraIds.length > 0));
    }
    if (draft.type === "genre") {
      return Boolean((draft.genreIds && draft.genreIds.length > 0) || draft.genreId);
    }
    if (draft.type === "artist") {
      return Boolean(
        (draft.artists && draft.artists.length > 0) ||
        (draft.artist && draft.artist.trim().length > 0)
      );
    }
    if (draft.type === "playlist") return Boolean(draft.playlistId);
    return true;
  }, [draft]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-950/70 border border-stone-200/80 dark:border-stone-800/80 shrink-0 text-xs font-semibold">
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
              if (
                draft.type !== "era" ||
                (!draft.era && (!draft.eraIds || draft.eraIds.length === 0))
              ) {
                setDraft({
                  type: "era",
                  era: "2000s",
                  eraIds: ["2000s"],
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
            <span>ตามยุค</span>
          </button>

          {/* Tab 3: Genre */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("genre");
              if (
                draft.type !== "genre" ||
                (!draft.genreId && (!draft.genreIds || draft.genreIds.length === 0))
              ) {
                const first = displayGenres[0] || genres[0];
                if (first) {
                  setDraft({
                    type: "genre",
                    genreId: first.id,
                    genreName: first.nameTh,
                    genreIds: [first.id],
                    genreNames: [first.nameTh],
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
              if (
                draft.type !== "artist" ||
                (!draft.artist && (!draft.artists || draft.artists.length === 0))
              ) {
                const firstArtist = artists[0] || "Silly Fools";
                setDraft({
                  type: "artist",
                  artist: firstArtist,
                  artists: [firstArtist],
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
            <span>ศิลปิน</span>
          </button>

          {/* Tab 5: Playlist */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("playlist");
            }}
            className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] col-span-2 sm:col-span-1 md:col-span-1 ${
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
          {activeTab === "era" && (() => {
            const selectedEraIds =
              draft.type === "era"
                ? draft.eraIds && draft.eraIds.length > 0
                  ? draft.eraIds
                  : draft.era
                  ? [draft.era]
                  : []
                : [];
            const totalEraSongs = ERA_OPTIONS
              .filter((e) => selectedEraIds.includes(e.id))
              .reduce((sum, e) => sum + (eraCounts[e.id] ?? 0), 0);

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
                  <div className="flex items-center gap-2">
                    <span>เลือกยุคสมัยของบทเพลง (เลือกได้หลายยุค):</span>
                    {selectedEraIds.length > 0 && (
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        เลือกแล้ว {selectedEraIds.length} ยุค (รวม {totalEraSongs} เพลง)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const allEraIds = ERA_OPTIONS.map((e) => e.id);
                        setDraft({
                          type: "era",
                          era: allEraIds[0],
                          eraIds: allEraIds,
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      ✓ เลือกทุกยุค
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          type: "era",
                          era: undefined,
                          eraIds: [],
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      ✕ ล้างค่า
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ERA_OPTIONS.map((era) => {
                    const isSelected = selectedEraIds.includes(era.id);
                    const count = eraCounts[era.id] ?? 0;
                    return (
                      <div
                        key={era.id}
                        onClick={() => {
                          let newEraIds: string[];
                          if (isSelected) {
                            newEraIds = selectedEraIds.filter((id) => id !== era.id);
                          } else {
                            newEraIds = [...selectedEraIds, era.id];
                          }
                          const singleEra =
                            newEraIds.length === 1
                              ? ERA_OPTIONS.find((e) => e.id === newEraIds[0])
                              : undefined;

                          setDraft({
                            type: "era",
                            eraIds: newEraIds,
                            era: newEraIds[0] || undefined,
                            yearStart: singleEra ? singleEra.yearStart : undefined,
                            yearEnd: singleEra ? singleEra.yearEnd : undefined,
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
                              <div className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-2">
                                <span>{era.label}</span>
                                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  {count} เพลง
                                </span>
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
            );
          })()}

          {/* TAB 3: GENRE */}
          {activeTab === "genre" && (() => {
            const selectedGenreIds =
              draft.type === "genre"
                ? draft.genreIds && draft.genreIds.length > 0
                  ? draft.genreIds
                  : draft.genreId
                  ? [draft.genreId]
                  : []
                : [];
            const totalGenreSongs = displayGenres
              .filter((g) => selectedGenreIds.includes(g.id))
              .reduce((sum, g) => sum + (g.songCount || 0), 0);

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
                  <div className="flex items-center gap-2">
                    <span>เลือกหมวดหมู่แนวเพลง (เลือกได้หลายหมวดหมู่):</span>
                    {selectedGenreIds.length > 0 && (
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        เลือกแล้ว {selectedGenreIds.length} หมวด (รวม {totalGenreSongs} เพลง)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = displayGenres.map((g) => g.id);
                        const allNames = displayGenres.map((g) => g.nameTh);
                        setDraft({
                          type: "genre",
                          genreIds: allIds,
                          genreNames: allNames,
                          genreId: allIds[0] || undefined,
                          genreName: allNames[0] || undefined,
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      ✓ เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          type: "genre",
                          genreIds: [],
                          genreNames: [],
                          genreId: undefined,
                          genreName: undefined,
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      ✕ ล้างทั้งหมด
                    </button>
                    {isLoadingFilters && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] ml-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> โหลดหมวดหมู่...
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {displayGenres.map((g) => {
                    const isSelected = selectedGenreIds.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          let newIds: string[];
                          if (isSelected) {
                            newIds = selectedGenreIds.filter((id) => id !== g.id);
                          } else {
                            newIds = [...selectedGenreIds, g.id];
                          }
                          const newNames = displayGenres
                            .filter((gen) => newIds.includes(gen.id))
                            .map((gen) => gen.nameTh);

                          setDraft({
                            type: "genre",
                            genreIds: newIds,
                            genreNames: newNames,
                            genreId: newIds[0] || undefined,
                            genreName: newNames[0] || undefined,
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
                            <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-stone-900 dark:text-white">
                            {g.nameTh}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between mt-0.5">
                            <span>{g.nameEn}</span>
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                              {g.songCount || 0} เพลง
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* TAB 4: ARTIST / BAND */}
          {activeTab === "artist" && (() => {
            const selectedArtists: string[] =
              draft.type === "artist"
                ? draft.artists && draft.artists.length > 0
                  ? draft.artists
                  : draft.artist
                  ? [draft.artist]
                  : []
                : [];

            return (
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

                {/* Verified Artist Chips from Database */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                        ศิลปินในฐานข้อมูล:
                      </label>
                      {selectedArtists.length > 0 && (
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          เลือกแล้ว {selectedArtists.length} ศิลปิน
                        </span>
                      )}
                    </div>
                    {selectedArtists.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            type: "artist",
                            artists: [],
                            artist: undefined,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        ✕ ล้างค่า
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {filteredArtists.length > 0 ? (
                      filteredArtists.map((artistName) => {
                        const isSelected = selectedArtists.some(
                          (a) => a.toLowerCase() === artistName.toLowerCase()
                        );
                        return (
                          <button
                            key={artistName}
                            type="button"
                            onClick={() => {
                              let nextArtists: string[];
                              if (isSelected) {
                                nextArtists = selectedArtists.filter(
                                  (a) => a.toLowerCase() !== artistName.toLowerCase()
                                );
                              } else {
                                nextArtists = [...selectedArtists, artistName];
                              }
                              setDraft({
                                type: "artist",
                                artists: nextArtists,
                                artist: nextArtists[0] || undefined,
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
              </div>
            );
          })()}
          {/* TAB 5: PLAYLIST */}
          {activeTab === "playlist" && (
            <div className="space-y-4">
              {/* Sub-tab switcher: Public vs My Playlists */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-950/70 border border-stone-200/80 dark:border-stone-800/80 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaylistSubTab("public");
                      setPlaylistWarningId(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                      playlistSubTab === "public"
                        ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                        : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                    }`}
                  >
                    <span>🌐</span>
                    <span>เพลย์ลิสต์สาธารณะ (Public)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlaylistSubTab("my");
                      setPlaylistWarningId(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                      playlistSubTab === "my"
                        ? "bg-white dark:bg-stone-800 text-amber-800 dark:text-amber-300 shadow-sm font-bold"
                        : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                    }`}
                  >
                    <span>👤</span>
                    <span>เพลย์ลิสต์ของฉัน (My Playlists)</span>
                  </button>
                </div>

                {isLoadingPlaylists && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดเพลย์ลิสต์...
                  </span>
                )}
              </div>

              {/* Guest prompt when selecting 'my' playlists */}
              {playlistSubTab === "my" && (!user || isGuest) ? (
                <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-center flex flex-col items-center justify-center gap-3 my-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl">
                    🔒
                  </div>
                  <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
                    เข้าสู่ระบบเพื่อใช้เพลย์ลิสต์ส่วนตัวของคุณในห้องเกม
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm">
                    สร้างและจัดเรียงเพลย์ลิสต์เพลงโปรดของคุณเอง แล้วนำมาท้าดวลกับเพื่อนๆ ในห้องเกมได้ทันที
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="mt-1 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Playlist Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อเพลย์ลิสต์ หรือ คำอธิบาย..."
                      value={playlistSearch}
                      onChange={(e) => setPlaylistSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Playlist Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                    {filteredPlaylists.length > 0 ? (
                      filteredPlaylists.map((p) => {
                        const isPlayable = isPlaylistPlayable(p.songCount || 0);
                        const isSelected = draft.type === "playlist" && draft.playlistId === p.id;
                        const authorName =
                          p.authorName || p.userProfile?.displayName || "ไม่ระบุชื่อ";
                        const authorAvatar =
                          p.authorAvatar || p.userProfile?.avatar || "🦊";
                        const showWarning = playlistWarningId === p.id;

                        return (
                          <div
                            key={p.id}
                            data-testid={`playlist-card-${p.id}`}
                            onClick={() => {
                              if (!isPlayable) {
                                setPlaylistWarningId(p.id);
                                try {
                                  soundEffects.buzzer();
                                } catch {}
                                return;
                              }
                              setPlaylistWarningId(null);
                              try {
                                soundEffects.click();
                              } catch {}
                              setDraft({
                                type: "playlist",
                                playlistId: p.id,
                              });
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 min-h-[110px] ${
                              isSelected
                                ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-stone-900 dark:text-white shadow-sm cursor-pointer"
                                : isPlayable
                                ? "bg-stone-50 dark:bg-stone-950/60 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-amber-400/50 hover:bg-stone-100/50 cursor-pointer"
                                : "bg-stone-50/60 dark:bg-stone-950/40 border-stone-200/80 dark:border-stone-800/80 text-stone-500 dark:text-stone-400 cursor-not-allowed opacity-80"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-sm text-stone-900 dark:text-white truncate">
                                    {p.title}
                                  </h4>
                                  {isPlayable ? (
                                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                                      พร้อมเล่น
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                                      {`ต้องมีอย่างน้อย ${MIN_SONGS_TO_PLAY} เพลง`}
                                    </span>
                                  )}
                                </div>
                                {p.description && (
                                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            {showWarning && !isPlayable && (
                              <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20 animate-in fade-in">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>มีเพียง {p.songCount || 0} เพลง ไม่สามารถเริ่มเล่นได้ (ต้องมีอย่างน้อย 5 เพลง)</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-stone-200/60 dark:border-stone-800/60">
                              <div className="flex items-center gap-1.5 min-w-0 text-stone-600 dark:text-stone-400">
                                <span className="text-sm shrink-0">{authorAvatar}</span>
                                <span className="truncate text-[11px]">{authorName}</span>
                              </div>
                              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                                {`${p.songCount || 0} เพลง`}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-1 sm:col-span-2 p-8 text-center text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-950/40 rounded-2xl border border-stone-200 dark:border-stone-800">
                        {playlistSubTab === "my"
                          ? "ยังไม่มีเพลย์ลิสต์ส่วนตัว หรือไม่ตรงกับคำค้นหา"
                          : "ไม่พบเพลย์ลิสต์สาธารณะที่ตรงกับคำค้นหา"}
                      </div>
                    )}
                  </div>
                </>
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

      {/* Auth Modal for Guests */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
