import { NextRequest, NextResponse } from "next/server";
import { downloadAndProcessYoutube } from "@/lib/audio-downloader";
import { uploadAudioToR2 } from "@/lib/r2";
import { insertSong } from "@/lib/services/song-service";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtubeUrlOrQuery, metadata } = body;

    if (!youtubeUrlOrQuery || !metadata?.title || !metadata?.artist) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบถ้วน: ต้องระบุ youtubeUrlOrQuery, title, และ artist" },
        { status: 400 }
      );
    }

    const songId = crypto.randomUUID();
    const r2Key = `songs/${songId}/full.mp3`;

    // 1. Download and convert to standardized MP3 128kbps via ffmpeg
    const audioResult = await downloadAndProcessYoutube(youtubeUrlOrQuery);

    let audioUrl = "";

    // 2. Upload to Cloudflare R2 (or fallback to local public storage if R2 is not configured)
    const isR2Configured = Boolean(
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    );

    if (isR2Configured) {
      audioUrl = await uploadAudioToR2(audioResult.buffer, r2Key, "audio/mpeg");
    } else {
      // Local development fallback
      const uploadDir = path.join(process.cwd(), "public", "audio", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const localFilePath = path.join(uploadDir, `${songId}.mp3`);
      await fs.writeFile(localFilePath, audioResult.buffer);
      audioUrl = `/audio/uploads/${songId}.mp3`;
    }

    // 3. Save metadata into Supabase Database
    const duration = audioResult.durationSec > 0 ? audioResult.durationSec : (metadata.durationSec || 0);

    const newSong = await insertSong({
      id: songId,
      title: metadata.title,
      artist: metadata.artist,
      aliases: metadata.aliases || [],
      releaseYear: metadata.releaseYear ? Number(metadata.releaseYear) : undefined,
      genreId: metadata.genreId || undefined,
      era: metadata.era || undefined,
      audioUrl,
      hookStartSec: metadata.hookStartSec ? Number(metadata.hookStartSec) : 0,
      hookEndSec: metadata.hookEndSec ? Number(metadata.hookEndSec) : 0,
      durationSec: duration,
      lyricsIntro: metadata.lyricsIntro || "",
      lyricsChorus: metadata.lyricsChorus || "",
      metadata: {
        youtubeSource: youtubeUrlOrQuery,
        storageType: isR2Configured ? "r2" : "local",
        r2Key: isR2Configured ? r2Key : undefined,
        importedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      song: newSong,
      storageNotice: isR2Configured
        ? "บันทึกลง Cloudflare R2 และ Supabase สำเร็จ"
        : "บันทึกในเครื่อง Local และ Supabase สำเร็จ (เนื่องจากยังไม่ได้ตั้งค่า Cloudflare R2)",
    });
  } catch (error) {
    console.error("Song import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดาวน์โหลดและนำเข้าเพลง" },
      { status: 500 }
    );
  }
}
