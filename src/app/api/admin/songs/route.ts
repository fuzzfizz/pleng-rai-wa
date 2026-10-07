import { NextRequest, NextResponse } from "next/server";
import { getSongs, deleteSong } from "@/lib/services/song-service";
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

    const songs = await getSongs({ genreId, era, artist, searchQuery, limit: 100 });
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
