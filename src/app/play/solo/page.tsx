"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Bell,
  Bot,
  Scissors,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Award,
  Square,
  Loader2,
  Disc3,
  Filter,
  Lightbulb,
  Tag,
  Calendar,
  UserCheck,
  Languages,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Song, GameMode, AnswerInputMode, Playlist, SongFilterConfig } from "@/types";
import {
  playBuzzerSound,
  playCorrectSound,
  playWrongSound,
  playCountdownTickSound,
  playClickSound,
  isMuted as isSfxMuted,
  setMuted as setSfxMuted,
} from "@/lib/sound-effects";
import {
  getMasterVolume,
  isMasterMuted,
  subscribeMasterVolume,
  toggleMasterMute,
} from "@/lib/audio-volume";
import { ttsReader, type AIVoiceGender } from "@/lib/tts-reader";
import { checkAnswer, searchSongAutocomplete } from "@/lib/answer-checker";
import { PlaylistService } from "@/lib/services/playlist-service";
import { isPlaylistPlayable } from "@/components/playlist/playlist-utils";
import { useAuth } from "@/hooks/use-auth";
import { SongSourceModal, getSongFilterLabel } from "@/components/common/song-source-modal";
import {
  formatTime,
  getInitialHookPosition,
  clampSeekTime,
  getVinylAnimationClass,
} from "@/components/room/round-reveal-card";
import { calculateSliceStart } from "@/lib/audio-slice-utils";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";

function SoloPlayContent() {
  const searchParams = useSearchParams();
  const queryPlaylistId = searchParams.get("playlistId");
  const { user } = useAuth();

  // Playlists State
  const [availablePlaylists, setAvailablePlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("all");
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<SongFilterConfig>({ type: "all" });
  const [isSongSourceModalOpen, setIsSongSourceModalOpen] = useState<boolean>(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(true);
  const [isLoadingSongs, setIsLoadingSongs] = useState<boolean>(true);
  const [playlistNotice, setPlaylistNotice] = useState<string | null>(null);
  const defaultLibrarySongsRef = useRef<Song[]>(DEMO_SONGS);

  // Game Setup State
  const [songsPool, setSongsPool] = useState<Song[]>(DEMO_SONGS);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("audio-slice");
  const [inputMode, setInputMode] = useState<AnswerInputMode>("autocomplete");
  const [sliceDuration, setSliceDuration] = useState<number>(1.0);
  const [lyricsType, setLyricsType] = useState<"intro" | "chorus">("intro");
  const [voiceGender, setVoiceGender] = useState<AIVoiceGender>("female");
  const [roundSliceStartSec, setRoundSliceStartSec] = useState<number>(() =>
    calculateSliceStart(DEMO_SONGS[0], 1.0)
  );

  // Gameplay State
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [userGuess, setUserGuess] = useState("");
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<Song[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // Audio / Buzzer / AI Lyrics State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [buzzerCountdown, setBuzzerCountdown] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAITalking, setIsAITalking] = useState(false);
  const [translatedLyrics, setTranslatedLyrics] = useState<string>("");
  const [isLoadingTranslation, setIsLoadingTranslation] = useState<boolean>(false);
  const [revealCurrentTime, setRevealCurrentTime] = useState<number>(0);
  const [revealDuration, setRevealDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync audio element volume with master volume in real-time
  useEffect(() => {
    const unsubscribe = subscribeMasterVolume((newVol) => {
      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, newVol));
        audioRef.current.muted = newVol === 0 || isMasterMuted();
      }
      setIsMuted(newVol === 0 || isMasterMuted());
    });
    return () => unsubscribe();
  }, []);

  const currentSong = songsPool[currentSongIndex] || songsPool[0] || DEMO_SONGS[0];

  // Recalculate randomized slice start whenever the current song/round changes
  useEffect(() => {
    if (currentSong) {
      setRoundSliceStartSec(calculateSliceStart(currentSong, sliceDuration));
    }
  }, [currentSongIndex, currentSong?.id]);

  // Helper to reset round sounds & answers
  const resetRoundState = () => {
    audioRef.current?.pause();
    ttsReader.stopSpeaking();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsPlayingAudio(false);
    setIsBuzzed(false);
    setBuzzerCountdown(null);
    setIsRevealed(false);
    setRevealCurrentTime(0);
    setRevealDuration(0);
    setHintLevel(0);
    setUserGuess("");
    setFeedback(null);
    setAutocompleteSuggestions([]);
    setIsAITalking(false);
    setTranslatedLyrics("");
    setIsLoadingTranslation(false);
  };

  // Initial load: library songs + playlists + optional query param playlist
  useEffect(() => {
    setIsMuted(isMasterMuted());
    let isMounted = true;

    async function initialize() {
      setIsLoadingPlaylists(true);

      // 1. Fetch library songs
      let librarySongs = DEMO_SONGS;
      try {
        const res = await fetch("/api/admin/songs");
        const data = await res.json();
        if (data.success && data.songs && data.songs.length > 0) {
          librarySongs = data.songs;
          defaultLibrarySongsRef.current = data.songs;
          if (isMounted && !queryPlaylistId?.trim()) {
            setSongsPool(data.songs);
            setIsLoadingSongs(false);
          }
        }
      } catch {
        // Fallback to DEMO_SONGS
      } finally {
        if (isMounted && !queryPlaylistId?.trim()) {
          setIsLoadingSongs(false);
        }
      }

      // 2. Fetch playlists
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
        const merged = Array.from(map.values());
        if (isMounted) {
          setAvailablePlaylists(merged);
        }
      } catch (err) {
        console.warn("Could not load playlists for solo play:", err);
      } finally {
        if (isMounted) setIsLoadingPlaylists(false);
      }

      // 3. Resolve initial playlist if query param exists
      const targetPlaylistId = queryPlaylistId?.trim();
      if (targetPlaylistId) {
        if (isMounted) {
          setSelectedPlaylistId(targetPlaylistId);
          setSelectedFilter({ type: "playlist", playlistId: targetPlaylistId });
          setIsLoadingSongs(true);
        }
        try {
          const result = await PlaylistService.getPlaylistById(targetPlaylistId);
          if (!isMounted) return;

          if (result && result.songs && result.songs.length > 0) {
            setSongsPool(result.songs);
            setActivePlaylist(result.playlist);
            setCurrentSongIndex(0);
            setScore(0);
            setStreak(0);
            if (!isPlaylistPlayable(result.songs.length)) {
              setPlaylistNotice(
                `เพลย์ลิสต์นี้มี ${result.songs.length} เพลง (ต่ำกว่า 5 เพลง)`
              );
            }
          } else {
            setSongsPool(librarySongs);
            setPlaylistNotice("ไม่พบเพลงในเพลย์ลิสต์ที่ระบุ กำลังใช้คลังเพลงหลักแทน");
          }
        } catch {
          if (isMounted) {
            setSongsPool(librarySongs);
            setPlaylistNotice("ไม่สามารถโหลดเพลย์ลิสต์ได้ กำลังใช้คลังเพลงหลักแทน");
          }
        } finally {
          if (isMounted) setIsLoadingSongs(false);
        }
      } else {
        if (isMounted) {
          setSongsPool(librarySongs);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [user?.id, queryPlaylistId]);

  // Autoplay hook audio when answer is revealed in Solo mode
  useEffect(() => {
    if (isRevealed && currentSong?.audioUrl) {
      audioRef.current?.pause();
      const audio = new Audio(currentSong.audioUrl);
      const startSec = getInitialHookPosition(currentSong.hookStartSec);
      audio.currentTime = startSec;
      setRevealCurrentTime(startSec);
      audio.loop = true;
      audio.volume = getMasterVolume();
      audio.muted = isMasterMuted();
      audio.ontimeupdate = () => {
        setRevealCurrentTime(audio.currentTime);
      };
      audio.onloadedmetadata = () => {
        if (!isNaN(audio.duration) && audio.duration > 0) {
          setRevealDuration(audio.duration);
        }
      };
      audio.ondurationchange = () => {
        if (!isNaN(audio.duration) && audio.duration > 0) {
          setRevealDuration(audio.duration);
        }
      };
      audio.onplay = () => setIsPlayingAudio(true);
      audio.onpause = () => setIsPlayingAudio(false);
      audio.onended = () => setIsPlayingAudio(false);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      audio.play().catch(() => {
        setIsPlayingAudio(false);
      });

      return () => {
        audio.pause();
        audio.ontimeupdate = null;
        audio.onloadedmetadata = null;
        audio.ondurationchange = null;
        audio.onplay = null;
        audio.onpause = null;
        audio.onended = null;
      };
    }
  }, [isRevealed, currentSong?.audioUrl, currentSong?.hookStartSec]);

  // Handle seeking in solo reveal player
  const handleRevealSeek = (newTime: number) => {
    const clamped = clampSeekTime(newTime, revealDuration || 100);
    setRevealCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  // Handle play/pause toggle in solo reveal player
  const handleToggleRevealAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.volume = getMasterVolume();
      audioRef.current.muted = isMasterMuted();
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }
  };

  // Handler for user applying filters from SongSourceModal
  const handleApplyFilter = async (filter: SongFilterConfig) => {
    resetRoundState();
    setSelectedFilter(filter);
    setIsLoadingSongs(true);
    setPlaylistNotice(null);

    try {
      if (filter.type === "playlist" && filter.playlistId) {
        setSelectedPlaylistId(filter.playlistId);
        const result = await PlaylistService.getPlaylistById(filter.playlistId);
        if (result && result.songs && result.songs.length > 0) {
          setSongsPool(result.songs);
          setActivePlaylist(result.playlist);
          if (!isPlaylistPlayable(result.songs.length)) {
            setPlaylistNotice(
              `เพลย์ลิสต์นี้มี ${result.songs.length} เพลง (ต่ำกว่า 5 เพลง)`
            );
          }
        } else {
          setSongsPool(
            defaultLibrarySongsRef.current.length > 0
              ? defaultLibrarySongsRef.current
              : DEMO_SONGS
          );
          setPlaylistNotice("ไม่พบเพลงในเพลย์ลิสต์ กำลังใช้คลังเพลงหลักแทน");
        }
      } else {
        setSelectedPlaylistId("all");
        setActivePlaylist(null);

        const queryParams = new URLSearchParams();
        if (filter.type === "genre" && filter.genreId) {
          queryParams.set("genreId", filter.genreId);
        }
        if (filter.type === "era" && filter.era) {
          queryParams.set("era", filter.era);
        }
        if (filter.type === "artist" && filter.artist) {
          queryParams.set("artist", filter.artist);
        }

        const queryString = queryParams.toString();
        const url = queryString ? `/api/admin/songs?${queryString}` : "/api/admin/songs";

        const res = await fetch(url);
        const data = await res.json();

        if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
          setSongsPool(data.songs);
        } else {
          // Client-side fallback if offline / demo songs
          let pool =
            defaultLibrarySongsRef.current.length > 0
              ? [...defaultLibrarySongsRef.current]
              : [...DEMO_SONGS];
          if (filter.type === "era" && filter.era) {
            const eraFiltered = pool.filter((s) => s.era === filter.era);
            if (eraFiltered.length > 0) pool = eraFiltered;
          } else if (filter.type === "genre" && filter.genreId) {
            const genreFiltered = pool.filter((s) => s.genreId === filter.genreId);
            if (genreFiltered.length > 0) pool = genreFiltered;
          } else if (filter.type === "artist" && filter.artist) {
            const artistFiltered = pool.filter((s) =>
              s.artist?.toLowerCase().includes(filter.artist!.toLowerCase())
            );
            if (artistFiltered.length > 0) pool = artistFiltered;
          }
          setSongsPool(pool);
        }
      }
    } catch (err) {
      console.warn("Error filtering songs in solo mode:", err);
      setSongsPool(
        defaultLibrarySongsRef.current.length > 0
          ? defaultLibrarySongsRef.current
          : DEMO_SONGS
      );
    } finally {
      setCurrentSongIndex(0);
      setScore(0);
      setStreak(0);
      setIsLoadingSongs(false);
    }
  };

  // Handler for user switching playlist in dropdown (legacy backward compatibility)
  const handleSelectPlaylist = async (playlistId: string) => {
    if (playlistId === "all" || !playlistId) {
      await handleApplyFilter({ type: "all" });
    } else {
      await handleApplyFilter({ type: "playlist", playlistId });
    }
  };

  // Keyboard shortcut for Buzzer (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && gameMode === "buzzer" && isPlayingAudio && !isBuzzed && !isRevealed) {
        e.preventDefault();
        handleBuzz();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameMode, isPlayingAudio, isBuzzed, isRevealed]);

  // Clean up sounds and speech on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      ttsReader.stopSpeaking();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Sound Mute Toggle
  const toggleMute = () => {
    const isNowMuted = toggleMasterMute();
    setIsMuted(isNowMuted);
    if (audioRef.current) {
      audioRef.current.muted = isNowMuted;
      audioRef.current.volume = isNowMuted ? 0 : getMasterVolume();
    }
  };

  // Play Audio Slice
  const handlePlaySlice = async () => {
    playClickSound();
    audioRef.current?.pause();

    // Use randomized slice start calculated for this round
    const startSec = roundSliceStartSec;
    const sliceUrl = `/api/audio/slice?id=${currentSong.id}&start=${startSec}&duration=${sliceDuration}`;

    const audio = new Audio(sliceUrl);
    audio.volume = getMasterVolume();
    audio.muted = isMasterMuted();
    audioRef.current = audio;
    setIsPlayingAudio(true);

    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => {
      // Fallback: If slice route fails, play direct song audio from hook timestamp
      if (currentSong.audioUrl && currentSong.audioUrl.startsWith("http")) {
        try {
          const fallbackAudio = new Audio(currentSong.audioUrl);
          fallbackAudio.currentTime = startSec;
          fallbackAudio.volume = getMasterVolume();
          fallbackAudio.muted = isMasterMuted();
          audioRef.current = fallbackAudio;
          fallbackAudio.onended = () => setIsPlayingAudio(false);
          fallbackAudio
            .play()
            .then(() => {
              setTimeout(() => {
                fallbackAudio.pause();
                setIsPlayingAudio(false);
              }, sliceDuration * 1000);
            })
            .catch(() => {
              setIsPlayingAudio(false);
              playCountdownTickSound(5);
            });
          return;
        } catch {
          // Continue to error indicator
        }
      }
      setIsPlayingAudio(false);
      // Play a short synth tone indicator if audio file isn't uploaded yet
      playCountdownTickSound(5);
    };

    try {
      await audio.play();
    } catch {
      setIsPlayingAudio(false);
    }
  };

  // Start Buzzer Game Mode song stream
  const handleToggleBuzzerSong = () => {
    if (isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      playClickSound();
      const audio = new Audio(currentSong.audioUrl);
      audio.volume = getMasterVolume();
      audio.muted = isMasterMuted();
      audioRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => {
        setIsPlayingAudio(false);
        playCountdownTickSound(3);
      };
      audio.play().catch(() => {
        // Simulated tone if audio file is offline
        setIsPlayingAudio(false);
        playCountdownTickSound(3);
      });
      setIsPlayingAudio(true);
    }
  };

  // Hit Buzzer!
  const handleBuzz = () => {
    if (isBuzzed || isRevealed) return;
    audioRef.current?.pause();
    setIsPlayingAudio(false);
    setIsBuzzed(true);
    playBuzzerSound();
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([45]);
    }

    // Start 15-second answer countdown
    setBuzzerCountdown(15);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setBuzzerCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          playWrongSound();
          setFeedback({ isCorrect: false, message: "หมดเวลาตอบคำถาม!" });
          return 0;
        }
        if (prev <= 5) {
          playCountdownTickSound(prev);
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Play AI Lyrics
  const handleSpeakLyrics = () => {
    playClickSound();
    const lyrics =
      lyricsType === "intro"
        ? currentSong.lyricsIntro || "ไม่มีเนื้อเพลงท่อนเปิด"
        : currentSong.lyricsChorus || "ไม่มีเนื้อเพลงท่อนฮุก";

    setIsAITalking(true);
    ttsReader.speakLyrics(lyrics, {
      gender: voiceGender,
      onEnd: () => setIsAITalking(false),
      onError: () => setIsAITalking(false),
    });
  };

  const handleStopSpeaking = () => {
    ttsReader.stopSpeaking();
    setIsAITalking(false);
  };

  // Fetch translated lyrics whenever song, lyrics type or gameMode changes to translated-lyrics
  useEffect(() => {
    if (gameMode !== "translated-lyrics") return;

    const sourceText =
      lyricsType === "intro"
        ? currentSong.lyricsIntro || ""
        : currentSong.lyricsChorus || "";

    if (!sourceText) {
      setTranslatedLyrics("ไม่พบเนื้อเพลงของเพลงนี้");
      return;
    }

    let isMounted = true;
    setIsLoadingTranslation(true);

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sourceText }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && (data.translation || data.translated)) {
          setTranslatedLyrics(data.translation || data.translated);
        } else {
          setTranslatedLyrics(sourceText);
        }
      })
      .catch(() => {
        if (isMounted) setTranslatedLyrics(sourceText);
      })
      .finally(() => {
        if (isMounted) setIsLoadingTranslation(false);
      });

    return () => {
      isMounted = false;
    };
  }, [gameMode, currentSong.id, lyricsType, currentSong.lyricsIntro, currentSong.lyricsChorus]);

  // Play Translated Lyrics in English TTS
  const handleSpeakTranslatedLyrics = () => {
    if (!translatedLyrics) return;
    playClickSound();
    setIsAITalking(true);
    ttsReader.speakLyrics(translatedLyrics, {
      lang: "en-US",
      gender: voiceGender,
      onEnd: () => setIsAITalking(false),
      onError: () => setIsAITalking(false),
    });
  };

  // Autocomplete search
  const handleInputChange = (text: string) => {
    setUserGuess(text);
    if (inputMode === "autocomplete" && text.trim().length > 0) {
      const results = searchSongAutocomplete(text, songsPool, 5);
      setAutocompleteSuggestions(results);
    } else {
      setAutocompleteSuggestions([]);
    }
  };

  // Submit Answer
  const handleSubmitAnswer = (answerToSubmit?: string) => {
    const finalAnswer = (answerToSubmit ?? userGuess).trim();
    if (!finalAnswer) return;

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setBuzzerCountdown(null);

    const result = checkAnswer(finalAnswer, currentSong);

    if (result.isCorrect) {
      playCorrectSound();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      const points = hintLevel === 0 ? 10 : hintLevel === 1 ? 7 : hintLevel === 2 ? 5 : 3;
      setScore((s) => s + points);
      setStreak((st) => st + 1);
      setFeedback({
        isCorrect: true,
        message: `ถูกต้อง! (+${points} คะแนน) เพลง "${currentSong.title}" โดย ${currentSong.artist} (ตรงกับ: ${result.matchedAs})`,
      });
      setIsRevealed(true);
    } else {
      playWrongSound();
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `ยังไม่ถูกนะ ลองฟังอีกรอบ หรือเดาใหม่!`,
      });
    }
  };

  // Next Question
  const handleNextSong = () => {
    playClickSound();
    audioRef.current?.pause();
    ttsReader.stopSpeaking();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setIsPlayingAudio(false);
    setIsBuzzed(false);
    setBuzzerCountdown(null);
    setIsRevealed(false);
    setRevealCurrentTime(0);
    setRevealDuration(0);
    setHintLevel(0);
    setUserGuess("");
    setFeedback(null);
    setAutocompleteSuggestions([]);
    setIsAITalking(false);

    // Pick next random song
    const nextIdx = (currentSongIndex + 1) % songsPool.length;
    setCurrentSongIndex(nextIdx);
    const nextSong = songsPool[nextIdx];
    if (nextSong) {
      setRoundSliceStartSec(calculateSliceStart(nextSong, sliceDuration));
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--background)] text-stone-900 dark:text-stone-100 flex flex-col font-sans bg-radial-glow overflow-x-hidden pt-safe pb-safe">
      {/* Top Bar */}
      <header className="border-b border-stone-200 dark:border-stone-800/80 bg-stone-50/80 dark:bg-stone-900/60 backdrop-blur-md px-4 sm:px-8 lg:px-12 py-3 lg:py-4 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-11 h-11 min-h-[44px] min-w-[44px] p-2.5 shrink-0 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors touch-manipulation cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm sm:text-base lg:text-lg font-bold font-serif text-stone-900 dark:text-white flex items-center gap-2">
              <span>โหมดซ้อมมือเดี่ยว</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                Solo Testbed
              </span>
            </h1>
          </div>
        </div>

        {/* Score & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 px-3 py-1.5 lg:px-4 lg:py-2 rounded-xl text-xs lg:text-sm font-semibold">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-stone-900 dark:text-white">{score} คะแนน</span>
          </div>

          {streak > 1 && (
            <div className="hidden sm:flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 rounded-xl text-xs font-bold animate-bounce">
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{streak} คอมโบ!</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
            className={`w-11 h-11 min-h-[44px] min-w-[44px] p-2.5 shrink-0 rounded-xl border flex items-center justify-center transition-colors cursor-pointer touch-manipulation ${
              isMuted
                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
            }`}
            title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="flex-1 max-w-3xl lg:max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center gap-6 lg:gap-8">
        {/* Song Source Filter Card */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 bg-white/70 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 rounded-2xl backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <Disc3 className="w-4 h-4 animate-[spin_8s_linear_infinite]" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                แหล่งเพลงสำหรับซ้อมมือ
              </div>
              <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">
                {getSongFilterLabel(selectedFilter, activePlaylist?.title)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLoadingSongs && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังโหลด...</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsSongSourceModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[38px]"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>เลือกแหล่งเพลง / กรองเพลง</span>
            </button>
          </div>
        </div>

        {playlistNotice && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>{playlistNotice}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-stone-100 dark:bg-stone-900/80 p-1.5 rounded-2xl border border-stone-200 dark:border-stone-800">
          <button
            onClick={() => {
              setGameMode("audio-slice");
              setIsBuzzed(false);
              setIsPlayingAudio(false);
            }}
            className={`min-h-[44px] lg:min-h-[50px] py-2 lg:py-2.5 px-3 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "audio-slice" ? "bg-amber-500 text-stone-950 shadow-sm" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Audio Slice</span>
          </button>

          <button
            onClick={() => {
              setGameMode("buzzer");
              setIsPlayingAudio(false);
            }}
            className={`min-h-[44px] lg:min-h-[50px] py-2 lg:py-2.5 px-3 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "buzzer" ? "bg-amber-500 text-stone-950 shadow-sm" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Buzzer แย่งตอบ</span>
          </button>

          <button
            onClick={() => {
              setGameMode("ai-lyrics");
              setIsPlayingAudio(false);
              setIsBuzzed(false);
            }}
            className={`min-h-[44px] lg:min-h-[50px] py-2 lg:py-2.5 px-3 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "ai-lyrics" ? "bg-amber-500 text-stone-950 shadow-sm" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI อ่านเนื้อเพลง</span>
          </button>

          <button
            onClick={() => {
              setGameMode("translated-lyrics");
              setIsPlayingAudio(false);
              setIsBuzzed(false);
            }}
            className={`min-h-[44px] lg:min-h-[50px] py-2 lg:py-2.5 px-3 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "translated-lyrics" ? "bg-amber-500 text-stone-950 shadow-sm" : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>แปลไทย-อังกฤษ</span>
          </button>
        </div>

        {/* Game Mode Interactive Play Area */}
        <div className="bg-white/80 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-sm dark:shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Track counter badge */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs lg:text-sm font-medium text-stone-500 dark:text-stone-400">
              ข้อที่ {currentSongIndex + 1} จาก {songsPool.length} เพลง
            </span>

            {currentSong.era && (
              <span className="text-xs lg:text-sm bg-stone-100 dark:bg-stone-800/80 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 lg:px-3 py-0.5 lg:py-1 rounded-full">
                เพลงยุค {currentSong.era}
              </span>
            )}
          </div>

          {/* MODE 1: Audio Slice */}
          {gameMode === "audio-slice" && (
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div>
                <h3 className="text-xl lg:text-2xl font-bold font-serif text-stone-900 dark:text-white mb-1">ทายเสี้ยววินาที</h3>
                <p className="text-xs lg:text-sm text-stone-500 dark:text-stone-400">เลือกระยะเวลาที่ต้องการฟัง แล้วกดปุ่มเพื่อฟังเสียงสั้นๆ</p>
              </div>

              {/* Duration Pills & Slider (Up to 20.0s) */}
              <div className="w-full max-w-md flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  {[1.0, 2.0, 5.0, 10.0, 15.0, 20.0].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setSliceDuration(dur)}
                      className={`min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center ${
                        sliceDuration === dur
                          ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                          : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                      }`}
                    >
                      {dur.toFixed(0)} วินาที
                    </button>
                  ))}
                </div>

                {/* Slider for custom duration up to 20s */}
                <div className="w-full flex items-center gap-3 px-2">
                  <span className="text-[11px] font-mono text-stone-500">0.5s</span>
                  <input
                    type="range"
                    min="0.5"
                    max="20.0"
                    step="0.5"
                    value={sliceDuration}
                    onChange={(e) => setSliceDuration(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 w-12 text-right">
                    {sliceDuration.toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Big Play Button */}
              <button
                type="button"
                onClick={handlePlaySlice}
                disabled={isPlayingAudio}
                aria-label="ฟังเสียงตัวอย่างเสี้ยววินาที"
                className={`w-28 h-28 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full flex flex-col items-center justify-center gap-1 transition-transform duration-75 active:scale-95 touch-manipulation [touch-action:manipulation] cursor-pointer ${
                  isPlayingAudio
                    ? "bg-amber-500 text-stone-950 scale-105 shadow-2xl shadow-amber-500/40 animate-pulse"
                    : "bg-amber-500 hover:bg-amber-400 hover:scale-105 text-stone-950 shadow-lg shadow-amber-500/25"
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Volume2 className="w-8 h-8 lg:w-10 lg:h-10 animate-bounce text-stone-950" />
                    <span className="text-[11px] lg:text-xs font-bold">กำลังเล่น...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-8 h-8 lg:w-10 lg:h-10 ml-1 text-stone-950" />
                    <span className="text-[11px] lg:text-xs font-bold">ฟังเสี้ยววิ</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* MODE 2: Buzzer Battle */}
          {gameMode === "buzzer" && (
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div>
                <h3 className="text-xl lg:text-2xl font-bold font-serif text-stone-900 dark:text-white mb-1">โหมดกดกริ่งแย่งตอบ</h3>
                <p className="text-xs lg:text-sm text-stone-500 dark:text-stone-400">
                  {isPlayingAudio
                    ? "เพลงกำลังเล่นอยู่... เมื่อมั่นใจให้กดกริ่งหรือกด SPACEBAR ทันที!"
                    : isBuzzed
                    ? "คุณกดกริ่งแล้ว! รีบตอบภายในเวลาที่กำหนด"
                    : "กดปุ่มเริ่มเล่นเพลง เพื่อเริ่มฟัง"}
                </p>
              </div>

              {/* Buzzer Button */}
              <div className="relative">
                {buzzerCountdown !== null && (
                  <div className="text-3xl font-black text-amber-500 dark:text-amber-400 mb-2 font-mono animate-pulse">
                    เหลือเวลา {buzzerCountdown} วิ
                  </div>
                )}

                <button
                  type="button"
                  onClick={isPlayingAudio ? handleBuzz : handleToggleBuzzerSong}
                  aria-label={isBuzzed ? "กดกริ่งแล้ว" : isPlayingAudio ? "กดกริ่งแย่งตอบ" : "เริ่มเปิดเพลง"}
                  className={`w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-64 lg:h-64 rounded-full flex flex-col items-center justify-center gap-1 transition-transform duration-75 active:scale-95 touch-manipulation [touch-action:manipulation] cursor-pointer ${
                    isBuzzed
                      ? "bg-amber-400 text-stone-950 scale-105 shadow-2xl shadow-amber-500/50 ring-4 ring-amber-300"
                      : isPlayingAudio
                      ? "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-2xl shadow-amber-500/40 ring-4 ring-amber-400/50 animate-pulse active:scale-95"
                      : "bg-stone-800 hover:bg-stone-700 text-amber-400 shadow-xl border-2 border-stone-700"
                  }`}
                >
                  {isBuzzed ? (
                    <>
                      <Bell className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 text-stone-950" />
                      <span className="text-xs sm:text-sm lg:text-base font-black">กดกริ่งแล้ว!</span>
                    </>
                  ) : isPlayingAudio ? (
                    <>
                      <Bell className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 animate-wiggle text-stone-950" />
                      <span className="text-xs sm:text-sm lg:text-base font-black">กดกริ่งแย่งตอบ!</span>
                      <span className="text-[10px] lg:text-xs opacity-80">(Spacebar)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 ml-1 text-amber-400" />
                      <span className="text-xs sm:text-sm lg:text-base font-bold text-stone-100">เริ่มเปิดเพลง</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* MODE 3: AI Deadpan Lyrics */}
          {gameMode === "ai-lyrics" && (
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div>
                <h3 className="text-xl lg:text-2xl font-bold font-serif text-stone-900 dark:text-white mb-1">โหมด AI อ่านเนื้อเพลง</h3>
                <p className="text-xs lg:text-sm text-stone-500 dark:text-stone-400">
                  เสียงหุ่นยนต์จะอ่านเนื้อเพลงภาษาไทยแบบเรียบนิ่ง ไร้อารมณ์ ไร้เมโลดี้
                </p>
              </div>

              {/* Lyrics Type Switch: Intro first, then Chorus */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLyricsType("intro")}
                  className={`min-h-[44px] lg:min-h-[48px] px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center touch-manipulation ${
                    lyricsType === "intro"
                      ? "bg-amber-500 text-stone-950 shadow-sm"
                      : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  🚀 ท่อนเปิด (Intro)
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsType("chorus")}
                  className={`min-h-[44px] lg:min-h-[48px] px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center touch-manipulation ${
                    lyricsType === "chorus"
                      ? "bg-amber-500 text-stone-950 shadow-sm"
                      : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  🎵 ท่อนฮุก (Chorus)
                </button>
              </div>

              {/* Voice Gender Switcher */}
              <div className="flex flex-col items-center gap-1.5 w-full max-w-sm">
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  โทนเสียง AI (ฟรี)
                </span>
                <div className="grid grid-cols-3 gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setVoiceGender("female")}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      voiceGender === "female"
                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                        : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    👩 เสียงหญิง
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceGender("male")}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      voiceGender === "male"
                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                        : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    👨 เสียงชาย
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceGender("random")}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      voiceGender === "random"
                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                        : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    🎲 สุ่มเสียงอัตโนมัติ
                  </button>
                </div>
              </div>

              {/* Speak Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isAITalking ? handleStopSpeaking : handleSpeakLyrics}
                  aria-label={isAITalking ? "หยุดพูด" : "ให้ AI อ่านเนื้อเพลง"}
                  className={`w-28 h-28 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full flex flex-col items-center justify-center gap-1 transition-transform duration-75 active:scale-95 touch-manipulation [touch-action:manipulation] cursor-pointer ${
                    isAITalking
                      ? "bg-amber-500 text-stone-950 shadow-2xl shadow-amber-500/50 scale-105 animate-pulse"
                      : "bg-amber-500 hover:bg-amber-400 hover:scale-105 text-stone-950 shadow-lg shadow-amber-500/25"
                  }`}
                >
                  {isAITalking ? (
                    <>
                      <Square className="w-8 h-8 lg:w-10 lg:h-10 fill-stone-950 text-stone-950" />
                      <span className="text-[11px] lg:text-xs font-bold">หยุดพูด</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-8 h-8 lg:w-10 lg:h-10 text-stone-950" />
                      <span className="text-[11px] lg:text-xs font-bold">ให้ AI อ่าน</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* MODE 4: Translated Lyrics (Google Translate Karaoke) */}
          {gameMode === "translated-lyrics" && (
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div>
                <h3 className="text-xl lg:text-2xl font-bold font-serif text-stone-900 dark:text-white mb-1">
                  🌐 โหมดแปลไทยเป็นอังกฤษ (Google Translate Karaoke)
                </h3>
                <p className="text-xs lg:text-sm text-stone-500 dark:text-stone-400 max-w-lg mx-auto">
                  เนื้อเพลงไทยถูกแปลเป็นอังกฤษแบบตรงตัวคำต่อคำ (Literal Translation) ปนความกวนโอ๊ย อ่านเนื้อหรือกดฟังเสียงภาษาอังกฤษแบบสำเนียงโรบ็อตแล้วทายชื่อเพลง!
                </p>
              </div>

              {/* Lyrics Type Switch: Intro vs Chorus */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLyricsType("intro")}
                  className={`min-h-[44px] lg:min-h-[48px] px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center touch-manipulation ${
                    lyricsType === "intro"
                      ? "bg-amber-500 text-stone-950 shadow-sm"
                      : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  🚀 ท่อนเปิด (Intro)
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsType("chorus")}
                  className={`min-h-[44px] lg:min-h-[48px] px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center touch-manipulation ${
                    lyricsType === "chorus"
                      ? "bg-amber-500 text-stone-950 shadow-sm"
                      : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  🎵 ท่อนฮุก (Chorus)
                </button>
              </div>

              {/* Translated Lyrics Card */}
              <div className="w-full max-w-xl p-5 sm:p-7 rounded-3xl bg-stone-50 dark:bg-stone-950/90 border border-amber-500/30 text-center shadow-md">
                <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3">
                  <Languages className="w-4 h-4" />
                  <span>Google Translate Literal Lyrics</span>
                </div>
                {isLoadingTranslation ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-stone-400 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    <span>กำลังแปลเนื้อเพลงภาษาไทย...</span>
                  </div>
                ) : (
                  <blockquote className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-serif text-stone-900 dark:text-white leading-relaxed italic">
                    &quot;{translatedLyrics || "ไม่มีเนื้อเพลงสำหรับท่อนนี้"}&quot;
                  </blockquote>
                )}
              </div>

              {/* Voice Gender Switcher */}
              <div className="flex flex-col items-center gap-1.5 w-full max-w-sm">
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  โทนเสียงภาษาอังกฤษ (US English)
                </span>
                <div className="grid grid-cols-3 gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setVoiceGender("female")}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      voiceGender === "female"
                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                        : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    👩 หญิง (US)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceGender("male")}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      voiceGender === "male"
                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                        : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    👨 ชาย (US)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceGender("random")}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      voiceGender === "random"
                        ? "bg-amber-500 text-stone-950 shadow-sm font-bold"
                        : "bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700"
                    }`}
                  >
                    🎲 สุ่มอัตโนมัติ
                  </button>
                </div>
              </div>

              {/* Speak English Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isAITalking ? handleStopSpeaking : handleSpeakTranslatedLyrics}
                  disabled={isLoadingTranslation || !translatedLyrics}
                  aria-label={isAITalking ? "หยุดพูด" : "ฟังเสียงอ่านอังกฤษ"}
                  className={`w-28 h-28 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full flex flex-col items-center justify-center gap-1 transition-transform duration-75 active:scale-95 touch-manipulation [touch-action:manipulation] cursor-pointer ${
                    isAITalking
                      ? "bg-amber-500 text-stone-950 shadow-2xl shadow-amber-500/50 scale-105 animate-pulse"
                      : "bg-amber-500 hover:bg-amber-400 hover:scale-105 text-stone-950 shadow-lg shadow-amber-500/25 disabled:opacity-50"
                  }`}
                >
                  {isAITalking ? (
                    <>
                      <Square className="w-8 h-8 lg:w-10 lg:h-10 fill-stone-950 text-stone-950" />
                      <span className="text-[11px] lg:text-xs font-bold">หยุดพูด</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-8 h-8 lg:w-10 lg:h-10 text-stone-950" />
                      <span className="text-[11px] lg:text-xs font-bold">ฟังเสียง US</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Feedback & Song Reveal Banner */}
          {feedback && (
            <div
              className={`mt-4 p-4 lg:p-5 rounded-2xl flex items-center gap-3 border ${
                feedback.isCorrect
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              }`}
            >
              {feedback.isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <p className="text-sm lg:text-base font-medium">{feedback.message}</p>
            </div>
          )}

          {/* Answer Revealed Card with Spinning Vinyl & Scrubbable Seek Bar */}
          {isRevealed && (
            <div className="mt-4 p-5 lg:p-6 rounded-2xl bg-stone-50 dark:bg-stone-950/80 border-2 border-amber-500/40 shadow-lg flex flex-col md:flex-row items-center gap-5 justify-between">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto flex-1 min-w-0">
                {/* Spinning Vinyl Record Disc */}
                <div
                  className={`w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-stone-900 border-4 border-stone-700 shadow-xl relative flex items-center justify-center overflow-hidden shrink-0 select-none animate-[spin_6s_linear_infinite] ${getVinylAnimationClass(
                    isPlayingAudio
                  )}`}
                  aria-hidden="true"
                >
                  {/* Concentric vinyl groove rings */}
                  <div className="absolute inset-2 rounded-full border border-stone-800" />
                  <div className="absolute inset-4 rounded-full border border-stone-800/80" />
                  <div className="absolute inset-6 rounded-full border border-stone-800/60" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 pointer-events-none" />

                  {/* Center sticker label */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-md relative">
                    <Disc3 className="w-5 h-5 text-stone-950/80" />
                    {/* Center spindle hole */}
                    <div className="absolute w-2 h-2 rounded-full bg-stone-950 shadow-inner" />
                  </div>
                </div>

                {/* Song Info & Interactive Scrubbable Seek Bar */}
                <div className="text-center sm:text-left flex-1 min-w-0 w-full">
                  <div className="text-[11px] lg:text-xs text-amber-700 dark:text-amber-400 font-semibold mb-0.5">
                    เฉลยเพลงนี้:
                  </div>
                  <h4 className="text-base sm:text-lg lg:text-xl font-bold font-serif text-stone-900 dark:text-white truncate">
                    {currentSong.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate">
                    {currentSong.artist} • ปี {currentSong.releaseYear || "ไม่ระบุ"}
                  </p>

                  {/* Seek Bar & Audio Controls */}
                  {currentSong?.audioUrl && (
                    <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center gap-3 shadow-xs">
                      <button
                        type="button"
                        onClick={handleToggleRevealAudio}
                        aria-label={isPlayingAudio ? "หยุดเสียงเพลง" : "เล่นเสียงเพลง"}
                        className={`inline-flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl text-xs font-bold transition shadow-sm active:scale-95 touch-manipulation cursor-pointer shrink-0 ${
                          isPlayingAudio
                            ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30"
                            : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20"
                        }`}
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-4 h-4 fill-white text-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-stone-950 text-stone-950 ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 flex flex-col gap-1 min-w-[140px]">
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {formatTime(revealCurrentTime)}
                          </span>
                          <span className="text-stone-500 dark:text-stone-400">
                            {revealDuration > 0 ? formatTime(revealDuration) : "--:--"}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={revealDuration > 0 ? revealDuration : 100}
                          step="0.5"
                          value={Math.min(revealCurrentTime, revealDuration > 0 ? revealDuration : 100)}
                          onChange={(e) => handleRevealSeek(parseFloat(e.target.value))}
                          onInput={(e) => handleRevealSeek(parseFloat((e.target as HTMLInputElement).value))}
                          aria-label="แถบเลื่อนเวลาเพลง"
                          className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none touch-manipulation"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Song Button */}
              <button
                onClick={handleNextSong}
                className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs lg:text-sm px-5 py-3 min-h-[44px] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
              >
                <span>เพลงถัดไป</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Answer Input Section */}
        {!isRevealed && (
          <div className="bg-white/80 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 lg:p-8 shadow-sm dark:shadow-xl space-y-4 lg:space-y-5">
            {/* Progressive Hint Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                  คำใบ้:
                </span>
                {hintLevel === 0 && (
                  <span className="text-xs text-stone-400 dark:text-stone-500 italic">
                    ยังไม่มีการเปิดคำใบ้
                  </span>
                )}
                {hintLevel >= 1 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                    <Tag className="w-3 h-3 text-emerald-500" />
                    <span>แนวเพลง: {currentSong.genre?.nameTh || "เพลงไทยยอดนิยม"}</span>
                  </span>
                )}
                {hintLevel >= 2 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-800 dark:text-blue-300 animate-in fade-in">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    <span>
                      {currentSong.releaseYear
                        ? `ปี ${currentSong.releaseYear}${currentSong.era ? ` (${currentSong.era})` : ""}`
                        : `ยุค ${currentSong.era || "ไม่ระบุ"}`}
                    </span>
                  </span>
                )}
                {hintLevel >= 3 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-300 animate-in fade-in">
                    <UserCheck className="w-3 h-3 text-purple-500" />
                    <span>ศิลปิน: {currentSong.artist}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
                  ได้คะแนน:{" "}
                  <span className="text-amber-500 font-extrabold font-mono">
                    +{hintLevel === 0 ? 10 : hintLevel === 1 ? 7 : hintLevel === 2 ? 5 : 3}
                  </span>
                </span>
                {hintLevel < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setHintLevel((l) => Math.min(3, l + 1));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 transition cursor-pointer touch-manipulation"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>ขอคำใบ้ (ขั้นที่ {hintLevel + 1}/3)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Input Mode Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs lg:text-sm font-semibold text-stone-700 dark:text-stone-300">ตอบคำถาม (ชื่อเพลง):</label>
              <div className="flex bg-stone-100 dark:bg-stone-950 p-1 rounded-xl border border-stone-200 dark:border-stone-800 text-[11px] lg:text-xs">
                <button
                  onClick={() => setInputMode("autocomplete")}
                  className={`px-3 lg:px-4 py-2 min-h-[44px] rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    inputMode === "autocomplete" ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-medium shadow-xs" : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  Autocomplete (มีตัวช่วย)
                </button>
                <button
                  onClick={() => setInputMode("free-text")}
                  className={`px-3 lg:px-4 py-2 min-h-[44px] rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    inputMode === "free-text" ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-medium shadow-xs" : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  พิมพ์เอง (ท้าทาย)
                </button>
              </div>
            </div>

            {/* Input Field with Dropdown */}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อเพลงที่คิดว่าเป็น..."
                  value={userGuess}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                  className="flex-1 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-2xl px-4 py-3 lg:px-5 lg:py-3.5 min-h-[44px] lg:min-h-[52px] text-base sm:text-sm lg:text-base text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={() => handleSubmitAnswer()}
                  disabled={!userGuess.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-bold px-6 lg:px-8 min-h-[44px] lg:min-h-[52px] rounded-2xl text-base sm:text-sm lg:text-base transition-colors cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center"
                >
                  ตอบ
                </button>
              </div>

              {/* Autocomplete Dropdown List */}
              {inputMode === "autocomplete" && autocompleteSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-1.5 shadow-2xl z-20 space-y-1">
                  {autocompleteSuggestions.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => {
                        setUserGuess(song.title);
                        setAutocompleteSuggestions([]);
                        handleSubmitAnswer(song.title);
                      }}
                      className="w-full text-left px-3.5 py-2.5 lg:px-4.5 lg:py-3 min-h-[44px] rounded-xl text-xs lg:text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-between text-stone-800 dark:text-stone-200 cursor-pointer"
                    >
                      <span className="font-semibold text-stone-900 dark:text-white">{song.title}</span>
                      <span className="text-stone-500 text-[11px] lg:text-xs">{song.artist}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skip / Give up Button */}
            <div className="flex justify-between items-center pt-1 text-xs lg:text-sm">
              <button
                onClick={() => {
                  playClickSound();
                  setIsRevealed(true);
                  setFeedback({
                    isCorrect: false,
                    message: `เฉลย: เพลง "${currentSong.title}" โดย ${currentSong.artist}`,
                  });
                }}
                className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 transition-colors flex items-center gap-1 cursor-pointer min-h-[44px] py-2 px-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>ยอมแพ้ / ดูเฉลย</span>
              </button>

              <button
                onClick={handleNextSong}
                className="text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer min-h-[44px] py-2 px-1"
              >
                <span>ข้ามไปเพลงถัดไป</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Song Source & Multi-filtering Modal */}
      <SongSourceModal
        isOpen={isSongSourceModalOpen}
        onClose={() => setIsSongSourceModalOpen(false)}
        currentFilter={selectedFilter}
        playlists={availablePlaylists}
        onSelectFilter={handleApplyFilter}
      />
    </div>
  );
}

export default function SoloPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] text-stone-900 dark:text-stone-100 flex items-center justify-center font-sans">
          <div className="flex items-center gap-3 text-amber-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">กำลังโหลดโหมดซ้อมเดี่ยว...</span>
          </div>
        </div>
      }
    >
      <SoloPlayContent />
    </Suspense>
  );
}
