// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Core TypeScript Types
// ==========================================

export type GameMode = "audio-slice" | "buzzer" | "ai-lyrics" | "translated-lyrics";

export type AnswerInputMode = "autocomplete" | "free-text" | "multiple-choice";

export interface ChoiceOption {
  id: string; // Masked choice key, e.g. "choice_0", "choice_1"
  title: string;
  artist: string;
}

export interface ActiveQuestion {
  sliceUrl?: string;
  durationSec?: number;
  lyrics?: string;
  startedAt?: string;
  choices?: ChoiceOption[];
}

export type LyricsType = "chorus" | "intro";


export interface Genre {
  id: string;
  nameTh: string;
  nameEn: string;
  slug: string;
  icon?: string;
  songCount?: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  aliases: string[];
  releaseYear?: number;
  genreId?: string;
  genre?: Genre;
  era?: string; // e.g. "90s", "2000s", "2010s", "2020s"
  audioUrl: string;
  hookStartSec?: number;
  hookEndSec?: number;
  durationSec?: number;
  lyricsIntro?: string;
  lyricsChorus?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface ExtractedSongMetadata {
  songFound?: boolean;
  notFoundReason?: string;
  lyricsConfidence?: "verified" | "not_found";
  title: string;
  artist: string;
  aliases: string[];
  releaseYear: number;
  genreSlug: string;
  era: string;
  hookStartSec: number;
  hookEndSec: number;
  lyricsIntro: string;
  lyricsChorus: string;
  youtubeSearchQuery: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatar: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Playlist {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  songCount: number;
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
  authorAvatar?: string;
  userProfile?: UserProfile;
}

export interface Player {
  id: string; // guest uuid or auth user id
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  sessionToken: string;
  lastSeenAt: string;
}

export type AIVoiceGender = "male" | "female" | "random";

export type SongFilterType = "all" | "era" | "genre" | "artist" | "playlist";

export interface SongFilterConfig {
  type: SongFilterType;
  genreId?: string;
  genreName?: string;
  era?: string;
  artist?: string;
  yearStart?: number;
  yearEnd?: number;
  playlistId?: string;
}

export interface RoomSettings {
  gameMode: GameMode;
  answerInputMode: AnswerInputMode;
  maxWrongGuesses?: number; // 0 = unlimited, 1 = 1 time [default], 2 = 2 times, etc.
  lyricsType?: LyricsType;
  voiceGender?: AIVoiceGender;
  sliceDurationSec: number; // e.g. 1.0, 2.0, 5.0
  roundTimeoutSec: number; // 0 for unlimited, or e.g. 15, 30
  totalRounds: number; // 0 for unlimited, or e.g. 5, 10, 20
  targetScore: number; // 0 for disabled, or e.g. 10
  genreId?: string; // all or specific genre
  playlistId?: string | null; // custom playlist
  songFilter?: SongFilterConfig;
  // Room listing & access control
  isPrivate?: boolean;
  password?: string;
  hostDisplayName?: string;
  hostAvatar?: string;
  // Progressive hints (0 = none, 1 = genre, 2 = year, 3 = artist)
  revealedHintLevel?: number;
  // Live player count in room
  playerCount?: number;
}

export interface RoomState {
  roomCode: string;
  hostPlayerId: string;
  status: "lobby" | "playing" | "question_active" | "buzzed" | "revealing" | "game_over";
  settings: RoomSettings;
  currentRound: number;
  currentSong?: Partial<Song>;
  currentSliceStart?: number;
  currentSliceDuration?: number;
  buzzedPlayerId?: string;
  buzzedAt?: string;
  players: Player[];
  playedSongIds: string[];
  roundStartTime?: string;
}

export * from "./database";
