// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Public Songs API Route
// Supplies songs for client-side search & autocomplete
// Projected to avoid leaking game secrets (lyrics/hooks)
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { getSongs } from "@/lib/services/song-service";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(1000, Math.max(1, Number(limitParam) || 500)) : 500;

    let songs = await getSongs({ limit });

    if (!songs || songs.length === 0) {
      songs = DEMO_SONGS;
    }

    // Project only fields needed for client autocomplete & search
    // Anti-cheat safe: do NOT return lyrics or hook start/end seconds
    const publicSongs = songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      aliases: Array.isArray(s.aliases) ? s.aliases : [],
      releaseYear: s.releaseYear,
      era: s.era,
      genre: s.genre,
    }));

    return NextResponse.json(
      { success: true, songs: publicSongs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[PublicSongsRoute] Error fetching songs:", error);
    // Graceful fallback to demo songs on database error
    const fallbackSongs = DEMO_SONGS.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      aliases: s.aliases,
      releaseYear: s.releaseYear,
      era: s.era,
      genre: s.genre,
    }));
    return NextResponse.json(
      { success: true, songs: fallbackSongs, fallback: true },
      { status: 200 }
    );
  }
}
