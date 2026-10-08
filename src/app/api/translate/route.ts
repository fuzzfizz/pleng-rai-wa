// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Translate API Route
// Translates lyrics to English for Solo & Multiplayer game modes
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { translateThaiToEnglishLiteral } from "@/lib/translate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body as { text?: string };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ success: false, error: "กรุณาระบุข้อความที่ต้องการแปล" }, { status: 400 });
    }

    const translated = await translateThaiToEnglishLiteral(text.trim());

    return NextResponse.json({
      success: true,
      original: text,
      translated,
    });
  } catch (error) {
    console.error("[TranslateAPI] Error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการแปลภาษา" },
      { status: 500 }
    );
  }
}
