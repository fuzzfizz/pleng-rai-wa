import { NextResponse } from "next/server";
import { getGenres } from "@/lib/services/song-service";

export async function GET() {
  try {
    const genres = await getGenres();
    return NextResponse.json({ success: true, genres });
  } catch (error) {
    console.error("Fetch genres error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถดึงข้อมูลแนวเพลงได้" },
      { status: 500 }
    );
  }
}
