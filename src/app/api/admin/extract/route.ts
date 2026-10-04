import { NextRequest, NextResponse } from "next/server";
import { extractSongMetadata } from "@/lib/ai-extractor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, apiKey } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "กรุณาระบุชื่อเพลง ศิลปิน หรือลิงก์ YouTube ที่ต้องการสกัดข้อมูล" },
        { status: 400 }
      );
    }

    const metadata = await extractSongMetadata(query, apiKey);

    return NextResponse.json({ success: true, metadata });
  } catch (error) {
    console.error("AI extraction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสกัดข้อมูลเพลงด้วย AI" },
      { status: 500 }
    );
  }
}
