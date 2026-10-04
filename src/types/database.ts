// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Database Row Types
// ==========================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      genres: {
        Row: {
          id: string;
          name_th: string;
          name_en: string;
          slug: string;
          icon: string | null;
        };
        Insert: {
          id?: string;
          name_th: string;
          name_en: string;
          slug: string;
          icon?: string | null;
        };
        Update: {
          id?: string;
          name_th?: string;
          name_en?: string;
          slug?: string;
          icon?: string | null;
        };
        Relationships: [];
      };
      songs: {
        Row: {
          id: string;
          title: string;
          artist: string;
          aliases: string[];
          release_year: number | null;
          genre_id: string | null;
          era: string | null;
          audio_url: string;
          hook_start_sec: number;
          hook_end_sec: number;
          duration_sec: number;
          lyrics_intro: string | null;
          lyrics_chorus: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist: string;
          aliases?: string[];
          release_year?: number | null;
          genre_id?: string | null;
          era?: string | null;
          audio_url: string;
          hook_start_sec?: number;
          hook_end_sec?: number;
          duration_sec?: number;
          lyrics_intro?: string | null;
          lyrics_chorus?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string;
          aliases?: string[];
          release_year?: number | null;
          genre_id?: string | null;
          era?: string | null;
          audio_url?: string;
          hook_start_sec?: number;
          hook_end_sec?: number;
          duration_sec?: number;
          lyrics_intro?: string | null;
          lyrics_chorus?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "songs_genre_id_fkey";
            columns: ["genre_id"];
            isOneToOne: false;
            referencedRelation: "genres";
            referencedColumns: ["id"];
          }
        ];
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      playlist_songs: {
        Row: {
          playlist_id: string;
          song_id: string;
          order_num: number;
        };
        Insert: {
          playlist_id: string;
          song_id: string;
          order_num?: number;
        };
        Update: {
          playlist_id?: string;
          song_id?: string;
          order_num?: number;
        };
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };
      rooms: {
        Row: {
          id: string;
          room_code: string;
          host_player_id: string;
          status: string;
          settings: Json;
          current_song_id: string | null;
          played_song_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          host_player_id: string;
          status?: string;
          settings?: Json;
          current_song_id?: string | null;
          played_song_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          host_player_id?: string;
          status?: string;
          settings?: Json;
          current_song_id?: string | null;
          played_song_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_current_song_id_fkey";
            columns: ["current_song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type GenreRow = Database["public"]["Tables"]["genres"]["Row"];
export type GenreInsert = Database["public"]["Tables"]["genres"]["Insert"];
export type GenreUpdate = Database["public"]["Tables"]["genres"]["Update"];

export type SongRow = Database["public"]["Tables"]["songs"]["Row"];
export type SongInsert = Database["public"]["Tables"]["songs"]["Insert"];
export type SongUpdate = Database["public"]["Tables"]["songs"]["Update"];

export type PlaylistRow = Database["public"]["Tables"]["playlists"]["Row"];
export type PlaylistSongRow = Database["public"]["Tables"]["playlist_songs"]["Row"];
export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
