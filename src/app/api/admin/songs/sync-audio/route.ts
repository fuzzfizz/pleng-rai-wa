import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, supabase } from "@/lib/supabase";
import { downloadAndProcessYoutube } from "@/lib/audio-downloader";
import { uploadAudioToR2 } from "@/lib/r2";
import path from "path";
import fs from "fs/promises";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { songId, customQuery } = body;

    if (!songId || typeof songId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid songId" },
        { status: 400 }
      );
    }

    const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? getServiceSupabase() : supabase;

    // 1. Fetch song info
    const { data: song, error: fetchErr } = await client
      .from("songs")
      .select("id, title, artist, duration_sec")
      .eq("id", songId)
      .single();

    if (fetchErr || !song) {
      return NextResponse.json(
        { success: false, error: "Song not found in database" },
        { status: 404 }
      );
    }

    // 2. Search target on YouTube
    const searchQuery = customQuery?.trim() || `${song.title} ${song.artist}`;
    console.log(`[SyncAudio] Downloading audio for "${searchQuery}" (ID: ${song.id})...`);

    // 3. Download and convert to standardized MP3 128kbps via yt-dlp & ffmpeg
    const audioResult = await downloadAndProcessYoutube(searchQuery, { cleanupTemp: true });

    let audioUrl = "";
    const isR2Configured = Boolean(
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    );

    // 4. Save to Cloudflare R2 or Local Storage
    if (isR2Configured) {
      const r2Key = `songs/${song.id}/full.mp3`;
      audioUrl = await uploadAudioToR2(audioResult.buffer, r2Key, "audio/mpeg");
    } else {
      const uploadDir = path.join(process.cwd(), "public", "audio", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const localFilePath = path.join(uploadDir, `${song.id}.mp3`);
      await fs.writeFile(localFilePath, audioResult.buffer);
      audioUrl = `/audio/uploads/${song.id}.mp3`;
    }

    // 5. Update database record with actual audioUrl and duration
    const finalDuration = audioResult.durationSec > 0 ? audioResult.durationSec : song.duration_sec || 0;
    const { error: updateErr } = await client
      .from("songs")
      .update({
        audio_url: audioUrl,
        duration_sec: finalDuration,
      })
      .eq("id", song.id);

    if (updateErr) {
      throw new Error(`Failed to update song in database: ${updateErr.message}`);
    }

    console.log(`[SyncAudio] Successfully updated "${song.title}" with audio: ${audioUrl}`);

    return NextResponse.json({
      success: true,
      songId: song.id,
      title: song.title,
      artist: song.artist,
      audioUrl,
      durationSec: finalDuration,
    });
  } catch (error) {
    console.error("[SyncAudio] Error syncing audio:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync audio from YouTube",
      },
      { status: 500 }
    );
  }
}
