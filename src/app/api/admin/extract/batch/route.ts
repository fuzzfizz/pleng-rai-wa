// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Admin Batch Discography Extraction API
// Extracts albums / discographies and flags duplicates against Supabase DB
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { extractBatchDiscography } from "@/lib/ai-extractor";
import { getSongs } from "@/lib/services/song-service";

function normalizeString(str: string): string {
  return (str || "").toLowerCase().replace(/[\s\-_–()[\].'"]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, apiKey } = body as { prompt?: string; apiKey?: string };

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "กรุณาระบุชื่อศิลปิน อัลบั้ม หรือชุดเพลง เช่น 'Bodyslam อัลบั้ม Drive'" },
        { status: 400 }
      );
    }

    // 1. Extract discography via Gemini AI or heuristic fallback
    const result = await extractBatchDiscography(prompt.trim(), apiKey);

    // 2. Query existing songs from Supabase database to detect duplicates
    let existingSongs: any[] = [];
    try {
      existingSongs = await getSongs({ limit: 1000 });
    } catch (dbErr) {
      console.warn("[BatchExtract] Could not fetch existing songs for duplicate check:", dbErr);
    }

    let duplicatesCount = 0;
    const songsWithDuplicateFlags = result.songs.map((song) => {
      const normTitle = normalizeString(song.title);
      const normArtist = normalizeString(song.artist);

      const matchedExisting = existingSongs.find((existing) => {
        const exTitle = normalizeString(existing.title);
        const exArtist = normalizeString(existing.artist);

        const isExactTitle = exTitle === normTitle;
        const isArtistOverlap =
          exArtist.includes(normArtist) ||
          normArtist.includes(exArtist) ||
          exArtist.length === 0;

        return isExactTitle && isArtistOverlap;
      });

      if (matchedExisting) {
        duplicatesCount++;
        return {
          ...song,
          isDuplicate: true,
          duplicateId: matchedExisting.id,
        };
      }

      return {
        ...song,
        isDuplicate: false,
      };
    });

    const finalResult = {
      ...result,
      songs: songsWithDuplicateFlags,
      totalExtracted: songsWithDuplicateFlags.length,
      newSongsCount: songsWithDuplicateFlags.length - duplicatesCount,
      duplicatesCount,
    };

    return NextResponse.json({
      success: true,
      result: finalResult,
    });
  } catch (error) {
    console.error("[BatchExtract] Error extracting batch discography:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการดึงข้อมูลเพลงแบบ Batch",
      },
      { status: 500 }
    );
  }
}
