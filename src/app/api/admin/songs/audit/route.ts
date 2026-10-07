import { NextResponse } from "next/server";
import { getServiceSupabase, supabase } from "@/lib/supabase";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * Checks if a song's audio URL points to an existing file on disk or reachable remote URL.
 */
async function checkAudioExists(audioUrl: string | null | undefined): Promise<boolean> {
  if (!audioUrl || typeof audioUrl !== "string") return false;

  // Local file path: e.g. /audio/uploads/xyz.mp3
  if (audioUrl.startsWith("/audio/")) {
    const localFilePath = path.join(process.cwd(), "public", audioUrl);
    return fs.existsSync(localFilePath);
  }

  // Remote URL: Cloudflare R2 or CDN
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    try {
      const res = await fetch(audioUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(3500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return false;
}

export async function GET() {
  try {
    const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? getServiceSupabase() : supabase;
    const { data: songs, error } = await client
      .from("songs")
      .select("id, title, artist, audio_url, duration_sec")
      .order("title");

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!songs || songs.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        readyCount: 0,
        missingCount: 0,
        songs: [],
      });
    }

    // Check each song's audio status
    const auditedSongs = await Promise.all(
      songs.map(async (song) => {
        const hasAudio = await checkAudioExists(song.audio_url);
        return {
          id: song.id,
          title: song.title,
          artist: song.artist,
          audioUrl: song.audio_url,
          durationSec: song.duration_sec,
          hasAudio,
        };
      })
    );

    const readyCount = auditedSongs.filter((s) => s.hasAudio).length;
    const missingCount = auditedSongs.length - readyCount;

    return NextResponse.json({
      success: true,
      total: auditedSongs.length,
      readyCount,
      missingCount,
      songs: auditedSongs,
    });
  } catch (error) {
    console.error("Audio audit error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to audit songs" },
      { status: 500 }
    );
  }
}
