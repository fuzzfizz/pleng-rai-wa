import { NextRequest, NextResponse } from "next/server";
import { getSongs, deleteSong, updateSong } from "@/lib/services/song-service";
import type { Song } from "@/types";
import { deleteAudioFromR2 } from "@/lib/r2";
import path from "path";
import fs from "fs/promises";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const genreId = searchParams.get("genreId") || undefined;
    const era = searchParams.get("era") || undefined;
    const artist = searchParams.get("artist") || undefined;
    const searchQuery = searchParams.get("q") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam) || 100)) : 100;

    const songs = await getSongs({ genreId, era, artist, searchQuery, limit });
    return NextResponse.json({ success: true, songs });
  } catch (error) {
    console.error("Fetch songs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถดึงข้อมูลเพลงได้" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ต้องระบุ id ของเพลงที่ต้องการลบ" }, { status: 400 });
    }

    // Try deleting from R2 or local storage
    const r2Key = `songs/${id}/full.mp3`;
    try {
      await deleteAudioFromR2(r2Key);
    } catch {
      // Ignored if not found
    }

    const localFile = path.join(process.cwd(), "public", "audio", "uploads", `${id}.mp3`);
    try {
      await fs.unlink(localFile);
    } catch {
      // Ignored
    }

    const success = await deleteSong(id);

    return NextResponse.json({ success });
  } catch (error) {
    console.error("Delete song error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถลบเพลงได้" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      artist,
      aliases,
      releaseYear,
      genreId,
      era,
      hookStartSec,
      hookEndSec,
      durationSec,
      lyricsIntro,
      lyricsChorus,
      audioUrl,
    } = body;

    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { error: "ต้องระบุ id ของเพลงที่ต้องการแก้ไข" },
        { status: 400 }
      );
    }

    const updates: Partial<Song> = {};
    if (title !== undefined) updates.title = title;
    if (artist !== undefined) updates.artist = artist;
    if (aliases !== undefined) updates.aliases = Array.isArray(aliases) ? aliases : [];
    if (releaseYear !== undefined) {
      updates.releaseYear = releaseYear !== null && releaseYear !== "" ? Number(releaseYear) : undefined;
    }
    if (genreId !== undefined) updates.genreId = genreId || undefined;
    if (era !== undefined) updates.era = era || undefined;
    if (hookStartSec !== undefined) {
      updates.hookStartSec = hookStartSec !== null && hookStartSec !== "" ? Number(hookStartSec) : undefined;
    }
    if (hookEndSec !== undefined) {
      updates.hookEndSec = hookEndSec !== null && hookEndSec !== "" ? Number(hookEndSec) : undefined;
    }
    if (durationSec !== undefined) {
      updates.durationSec = durationSec !== null && durationSec !== "" ? Number(durationSec) : undefined;
    }
    if (lyricsIntro !== undefined) updates.lyricsIntro = lyricsIntro;
    if (lyricsChorus !== undefined) updates.lyricsChorus = lyricsChorus;
    if (audioUrl !== undefined) updates.audioUrl = audioUrl;

    const updatedSong = await updateSong(id, updates);

    return NextResponse.json({ success: true, song: updatedSong }, { status: 200 });
  } catch (error: any) {
    console.error("Update song error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการแก้ไขเพลง" },
      { status: 500 }
    );
  }
}

