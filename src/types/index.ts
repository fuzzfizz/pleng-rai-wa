// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Core TypeScript Types
// ==========================================

export type GameMode = "audio-slice" | "buzzer" | "ai-lyrics";

export type AnswerInputMode = "autocomplete" | "free-text" | "multiple-choice";

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

export interface Playlist {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  songCount: number;
  createdAt: string;
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

export interface RoomSettings {
  gameMode: GameMode;
  answerInputMode: AnswerInputMode;
  lyricsType?: LyricsType;
  sliceDurationSec: number; // e.g. 1.0, 2.0, 5.0
  roundTimeoutSec: number; // 0 for unlimited, or e.g. 15, 30
  totalRounds: number; // 0 for unlimited, or e.g. 5, 10, 20
  targetScore: number; // 0 for disabled, or e.g. 10
  genreId?: string; // all or specific genre
  playlistId?: string; // custom playlist
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
