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
  Sparkles,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Award,
  Music,
  Square,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Song, GameMode, AnswerInputMode, Playlist } from "@/types";
import {
  playBuzzerSound,
  playCorrectSound,
  playWrongSound,
  playCountdownTickSound,
  playClickSound,
  isMuted as isSfxMuted,
  setMuted as setSfxMuted,
} from "@/lib/sound-effects";
import { ttsReader } from "@/lib/tts-reader";
import { checkAnswer, searchSongAutocomplete } from "@/lib/answer-checker";
import { PlaylistService } from "@/lib/services/playlist-service";
import { isPlaylistPlayable } from "@/components/playlist/playlist-utils";
import { useAuth } from "@/hooks/use-auth";

// Built-in seed songs for immediate offline play
const DEMO_SONGS: Song[] = [
  {
    id: "demo-1",
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai", "watjai", "วัดจัย", "มีแค่ใจดวงเดียวดวงนี้", "เพลงวัดใจ"],
    releaseYear: 2004,
    era: "2000s",
    audioUrl: "/audio/uploads/demo-1.mp3",
    hookStartSec: 68,
    hookEndSec: 94,
    durationSec: 260,
    lyricsIntro: "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย",
    lyricsChorus: "มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า",
  },
  {
    id: "demo-2",
    title: "ซ่อนกลิ่น",
    artist: "Palmy",
    aliases: ["son klin", "sorn klin", "คงไว้ได้แค่กลิ่น", "ปาล์มมี่ ซ่อนกลิ่น", "เพลงซ่อนกลิ่น"],
    releaseYear: 2018,
    era: "2010s",
    audioUrl: "/audio/uploads/demo-2.mp3",
    hookStartSec: 65,
    hookEndSec: 90,
    durationSec: 250,
    lyricsIntro: "ลืมตาตื่นมาพร้อมหยาดน้ำตา กับความทรงจำที่ยังไม่จาง",
    lyricsChorus: "คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา ยังหอมดังวันเก่ายามเมื่อลมพัดมา",
  },
  {
    id: "demo-3",
    title: "ขอบคุณที่รักกัน",
    artist: "Potato",
    aliases: ["kob koon tee ruk gun", "ขอบคุนที่รักกัน", "เพลงขอบคุณที่รักกัน"],
    releaseYear: 2006,
    era: "2000s",
    audioUrl: "/audio/uploads/demo-3.mp3",
    hookStartSec: 72,
    hookEndSec: 98,
    durationSec: 245,
    lyricsIntro: "เคยเกือบหมดหวัง และเคยเกือบถอดใจ",
    lyricsChorus: "ขอบคุณที่รักกัน ขอบคุณทุกรอยยิ้มที่มีให้กัน ขอบคุณความรักที่เธอส่งมา",
  },
];

function SoloPlayContent() {
  const searchParams = useSearchParams();
  const queryPlaylistId = searchParams.get("playlistId");
  const { user } = useAuth();

  // Playlists State
  const [availablePlaylists, setAvailablePlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("all");
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(true);
  const [isLoadingSongs, setIsLoadingSongs] = useState<boolean>(false);
  const [playlistNotice, setPlaylistNotice] = useState<string | null>(null);
  const defaultLibrarySongsRef = useRef<Song[]>(DEMO_SONGS);

  // Game Setup State
  const [songsPool, setSongsPool] = useState<Song[]>(DEMO_SONGS);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("audio-slice");
  const [inputMode, setInputMode] = useState<AnswerInputMode>("autocomplete");
  const [sliceDuration, setSliceDuration] = useState<number>(1.0);
  const [lyricsType, setLyricsType] = useState<"chorus" | "intro">("chorus");

  // Gameplay State
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [userGuess, setUserGuess] = useState("");
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<Song[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // Audio / Buzzer State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [buzzerCountdown, setBuzzerCountdown] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAITalking, setIsAITalking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentSong = songsPool[currentSongIndex] || songsPool[0] || DEMO_SONGS[0];

  // Helper to reset round sounds & answers
  const resetRoundState = () => {
    audioRef.current?.pause();
    ttsReader.stopSpeaking();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsPlayingAudio(false);
    setIsBuzzed(false);
    setBuzzerCountdown(null);
    setIsRevealed(false);
    setUserGuess("");
    setFeedback(null);
    setAutocompleteSuggestions([]);
    setIsAITalking(false);
  };

  // Initial load: library songs + playlists + optional query param playlist
  useEffect(() => {
    setIsMuted(isSfxMuted());
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
        }
      } catch {
        // Fallback to DEMO_SONGS
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

  // Handler for user switching playlist in dropdown
  const handleSelectPlaylist = async (playlistId: string) => {
    resetRoundState();
    setPlaylistNotice(null);

    if (playlistId === "all" || !playlistId) {
      setSelectedPlaylistId("all");
      setActivePlaylist(null);
      setSongsPool(
        defaultLibrarySongsRef.current.length > 0
          ? defaultLibrarySongsRef.current
          : DEMO_SONGS
      );
      setCurrentSongIndex(0);
      setScore(0);
      setStreak(0);
      return;
    }

    setSelectedPlaylistId(playlistId);
    setIsLoadingSongs(true);

    try {
      const result = await PlaylistService.getPlaylistById(playlistId);
      if (!result || !result.songs || result.songs.length === 0) {
        setPlaylistNotice("เพลย์ลิสต์นี้ยังไม่มีเพลง กำลังใช้คลังเพลงเดิม");
        return;
      }

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
    } catch (err: any) {
      setPlaylistNotice(err?.message || "เกิดข้อผิดพลาดในการโหลดเพลย์ลิสต์");
    } finally {
      setIsLoadingSongs(false);
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
    const next = !isMuted;
    setSfxMuted(next);
    setIsMuted(next);
  };

  // Play Audio Slice
  const handlePlaySlice = async () => {
    playClickSound();
    audioRef.current?.pause();

    // If slice duration is chosen, fetch sliced audio from API or fallback
    const startSec = currentSong.hookStartSec || 45;
    const sliceUrl = `/api/audio/slice?id=${currentSong.id}&start=${startSec}&duration=${sliceDuration}`;

    const audio = new Audio(sliceUrl);
    audioRef.current = audio;
    setIsPlayingAudio(true);

    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => {
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
      audioRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
      audio.play().catch(() => {
        // Simulated tone if audio file is offline
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

    // Start 10-second answer countdown
    setBuzzerCountdown(10);
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
      lyricsType === "chorus"
        ? currentSong.lyricsChorus || "ไม่มีเนื้อเพลงท่อนฮุก"
        : currentSong.lyricsIntro || "ไม่มีเนื้อเพลงท่อนเปิด";

    setIsAITalking(true);
    ttsReader.speakLyrics(lyrics, {
      rate: 0.9,
      onEnd: () => setIsAITalking(false),
      onError: () => setIsAITalking(false),
    });
  };

  const handleStopSpeaking = () => {
    ttsReader.stopSpeaking();
    setIsAITalking(false);
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
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({
        isCorrect: true,
        message: `ถูกต้อง! เพลง "${currentSong.title}" โดย ${currentSong.artist} (ตรงกับ: ${result.matchedAs})`,
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
    setUserGuess("");
    setFeedback(null);
    setAutocompleteSuggestions([]);
    setIsAITalking(false);

    // Pick next random song
    const nextIdx = (currentSongIndex + 1) % songsPool.length;
    setCurrentSongIndex(nextIdx);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans bg-radial-glow overflow-x-hidden">
      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>โหมดซ้อมมือเดี่ยว</span>
              <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full font-semibold">
                Solo Testbed
              </span>
            </h1>
          </div>
        </div>

        {/* Score & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-white">{score} คะแนน</span>
          </div>

          {streak > 1 && (
            <div className="hidden sm:flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded-xl text-xs font-bold animate-bounce">
              <Flame className="w-3.5 h-3.5 fill-rose-500" />
              <span>{streak} คอมโบ!</span>
            </div>
          )}

          <button
            onClick={toggleMute}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              isMuted
                ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
            }`}
            title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center gap-6">
        {/* Playlist Selector Setup Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="solo-playlist-select"
                  className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                >
                  🎵 เลือกชุดเพลงที่ต้องการซ้อม
                </label>
                <select
                  id="solo-playlist-select"
                  value={selectedPlaylistId}
                  onChange={(e) => handleSelectPlaylist(e.target.value)}
                  disabled={isLoadingPlaylists || isLoadingSongs}
                  className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-purple-500 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none transition-colors min-h-[44px] cursor-pointer disabled:opacity-50"
                >
                  <option value="all">
                    🌐 สุ่มเพลงทั้งหมด (All Library - {defaultLibrarySongsRef.current.length} เพลง)
                  </option>
                  {availablePlaylists.map((pl) => {
                    const playable = isPlaylistPlayable(pl.songCount || 0);
                    return (
                      <option key={pl.id} value={pl.id}>
                        {playable ? "🎶" : "⚠️"} {pl.title} ({pl.songCount || 0} เพลง)
                        {!playable ? " - มีไม่ถึง 5 เพลง" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Active Playlist Badge */}
            {activePlaylist ? (
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3.5 py-2 rounded-2xl text-xs text-purple-200 self-start sm:self-auto shrink-0 min-h-[44px]">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-semibold truncate max-w-[180px]">
                  {activePlaylist.title}
                </span>
                <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded-full text-purple-300 font-mono">
                  {songsPool.length} เพลง
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectPlaylist("all")}
                  className="text-slate-400 hover:text-white ml-1 text-xs cursor-pointer p-1 min-h-[44px] min-w-[28px] flex items-center justify-center"
                  title="สลับกลับไปคลังทั้งหมด"
                  aria-label="สลับกลับไปคลังทั้งหมด"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 px-3.5 py-2 rounded-2xl shrink-0 min-h-[44px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>คลังเพลงมาตรฐาน ({songsPool.length} เพลง)</span>
              </div>
            )}
          </div>

          {/* Loading or Notice Messages */}
          {isLoadingSongs && (
            <div className="flex items-center gap-2 text-xs text-purple-300 animate-pulse pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>กำลังโหลดเพลงจากเพลย์ลิสต์...</span>
            </div>
          )}

          {playlistNotice && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{playlistNotice}</span>
            </div>
          )}
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => {
              setGameMode("audio-slice");
              setIsBuzzed(false);
              setIsPlayingAudio(false);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "audio-slice" ? "bg-pink-600 text-white shadow-lg shadow-pink-600/20" : "text-slate-400 hover:text-white"
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
            className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "buzzer" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-slate-400 hover:text-white"
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
            className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              gameMode === "ai-lyrics" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20" : "text-slate-400 hover:text-white"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI อ่านเนื้อเพลง</span>
          </button>
        </div>

        {/* Game Mode Interactive Play Area */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Track counter badge */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-medium text-slate-500">
              ข้อที่ {currentSongIndex + 1} จาก {songsPool.length} เพลง
            </span>

            {currentSong.era && (
              <span className="text-xs bg-slate-800/80 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                เพลงยุค {currentSong.era}
              </span>
            )}
          </div>

          {/* MODE 1: Audio Slice */}
          {gameMode === "audio-slice" && (
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">ทายเสี้ยววินาที</h3>
                <p className="text-xs text-slate-400">เลือกระยะเวลาที่ต้องการฟัง แล้วกดปุ่มเพื่อฟังเสียงสั้นๆ</p>
              </div>

              {/* Duration Pills */}
              <div className="flex items-center gap-2">
                {[1.0, 2.0, 5.0].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setSliceDuration(dur)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      sliceDuration === dur
                        ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                        : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {dur.toFixed(1)} วินาที
                  </button>
                ))}
              </div>

              {/* Big Play Button */}
              <button
                onClick={handlePlaySlice}
                disabled={isPlayingAudio}
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isPlayingAudio
                    ? "bg-pink-500 text-white scale-105 shadow-2xl shadow-pink-500/50 animate-pulse"
                    : "bg-gradient-to-tr from-pink-500 to-purple-600 hover:scale-105 text-white shadow-xl shadow-pink-500/30"
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Volume2 className="w-8 h-8 animate-bounce" />
                    <span className="text-[11px] font-bold">กำลังเล่น...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-8 h-8 ml-1" />
                    <span className="text-[11px] font-bold">ฟังเสี้ยววิ</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* MODE 2: Buzzer Battle */}
          {gameMode === "buzzer" && (
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">โหมดกดกริ่งแย่งตอบ</h3>
                <p className="text-xs text-slate-400">
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
                  <div className="text-3xl font-black text-amber-400 mb-2 font-mono animate-pulse">
                    เหลือเวลา {buzzerCountdown} วิ
                  </div>
                )}

                <button
                  onClick={isPlayingAudio ? handleBuzz : handleToggleBuzzerSong}
                  className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isBuzzed
                      ? "bg-amber-500 text-slate-950 scale-105 shadow-2xl shadow-amber-500/50"
                      : isPlayingAudio
                      ? "bg-red-600 hover:bg-red-500 text-white shadow-2xl shadow-red-600/50 animate-pulse active:scale-95"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-600/30"
                  }`}
                >
                  {isBuzzed ? (
                    <>
                      <Bell className="w-10 h-10" />
                      <span className="text-xs font-black">กดกริ่งแล้ว!</span>
                    </>
                  ) : isPlayingAudio ? (
                    <>
                      <Bell className="w-12 h-12 animate-wiggle" />
                      <span className="text-xs font-black">กดกริ่งแย่งตอบ!</span>
                      <span className="text-[10px] opacity-80">(Spacebar)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-10 h-10 ml-1" />
                      <span className="text-xs font-bold">เริ่มเปิดเพลง</span>
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
                <h3 className="text-xl font-bold text-white mb-1">โหมด AI อ่านเนื้อเพลง</h3>
                <p className="text-xs text-slate-400">
                  เสียงหุ่นยนต์จะอ่านเนื้อเพลงภาษาไทยแบบเรียบนิ่ง ไร้อารมณ์ ไร้เมโลดี้
                </p>
              </div>

              {/* Lyrics Type Switch */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLyricsType("chorus")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    lyricsType === "chorus"
                      ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🎵 ท่อนฮุก (Chorus)
                </button>
                <button
                  onClick={() => setLyricsType("intro")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    lyricsType === "intro"
                      ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🚀 ท่อนเปิด (Intro)
                </button>
              </div>

              {/* Speak Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={isAITalking ? handleStopSpeaking : handleSpeakLyrics}
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isAITalking
                      ? "bg-cyan-500 text-white shadow-2xl shadow-cyan-500/50 scale-105 animate-pulse"
                      : "bg-gradient-to-tr from-cyan-500 to-blue-600 hover:scale-105 text-white shadow-xl shadow-cyan-500/30"
                  }`}
                >
                  {isAITalking ? (
                    <>
                      <Square className="w-8 h-8 fill-white" />
                      <span className="text-[11px] font-bold">หยุดพูด</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-8 h-8" />
                      <span className="text-[11px] font-bold">ให้ AI อ่าน</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Feedback & Song Reveal Banner */}
          {feedback && (
            <div
              className={`mt-4 p-4 rounded-2xl flex items-center gap-3 border ${
                feedback.isCorrect
                  ? "bg-emerald-950/60 border-emerald-700 text-emerald-200"
                  : "bg-rose-950/60 border-rose-800 text-rose-200"
              }`}
            >
              {feedback.isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <p className="text-sm font-medium">{feedback.message}</p>
            </div>
          )}

          {/* Answer Revealed Card */}
          {isRevealed && (
            <div className="mt-4 p-4 rounded-2xl bg-purple-950/30 border border-purple-800/60 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-purple-300 font-semibold mb-0.5">เฉลยเพลงนี้:</div>
                <h4 className="text-base font-bold text-white">{currentSong.title}</h4>
                <p className="text-xs text-slate-400">
                  {currentSong.artist} • ปี {currentSong.releaseYear || "ไม่ระบุ"}
                </p>
              </div>

              <button
                onClick={handleNextSong}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-purple-600/25"
              >
                <span>เพลงถัดไป</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Answer Input Section */}
        {!isRevealed && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">ตอบคำถาม (ชื่อเพลง):</label>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  onClick={() => setInputMode("autocomplete")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    inputMode === "autocomplete" ? "bg-slate-800 text-white font-medium" : "text-slate-500"
                  }`}
                >
                  Autocomplete (มีตัวช่วย)
                </button>
                <button
                  onClick={() => setInputMode("free-text")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    inputMode === "free-text" ? "bg-slate-800 text-white font-medium" : "text-slate-500"
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
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  onClick={() => handleSubmitAnswer()}
                  disabled={!userGuess.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold px-6 rounded-2xl text-sm transition-colors cursor-pointer shadow-lg shadow-purple-600/20"
                >
                  ตอบ
                </button>
              </div>

              {/* Autocomplete Dropdown List */}
              {inputMode === "autocomplete" && autocompleteSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-2xl z-20 space-y-1">
                  {autocompleteSuggestions.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => {
                        setUserGuess(song.title);
                        setAutocompleteSuggestions([]);
                        handleSubmitAnswer(song.title);
                      }}
                      className="w-full text-left px-3.5 py-2 rounded-xl text-xs hover:bg-slate-800 transition-colors flex items-center justify-between text-slate-200 cursor-pointer"
                    >
                      <span className="font-semibold text-white">{song.title}</span>
                      <span className="text-slate-500 text-[11px]">{song.artist}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skip / Give up Button */}
            <div className="flex justify-between items-center pt-1 text-xs">
              <button
                onClick={() => {
                  playClickSound();
                  setIsRevealed(true);
                  setFeedback({
                    isCorrect: false,
                    message: `เฉลย: เพลง "${currentSong.title}" โดย ${currentSong.artist}`,
                  });
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>ยอมแพ้ / ดูเฉลย</span>
              </button>

              <button
                onClick={handleNextSong}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>ข้ามไปเพลงถัดไป</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SoloPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
          <div className="flex items-center gap-3 text-purple-400">
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
