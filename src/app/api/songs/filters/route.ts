// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Song Filters API
// Returns available genres, eras, artists, and total song count
// ==========================================

import { NextResponse } from "next/server";
import { SongService } from "@/lib/services/song-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filters = await SongService.getSongFilterOptions();
    return NextResponse.json({
      success: true,
      filters,
    });
  } catch (error) {
    console.error("Error fetching song filters:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "ไม่สามารถโหลดตัวเลือกการกรองเพลงได้",
      },
      { status: 500 }
    );
  }
}
