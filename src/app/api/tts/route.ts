// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Google Translate TTS Proxy Route
// Dual-engine fallback for natural Thai female voice on Windows/Chrome
// ==========================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const textParam = searchParams.get("text");

    if (!textParam || !textParam.trim()) {
      return NextResponse.json(
        { error: "Text parameter is required" },
        { status: 400 }
      );
    }

    const cleanText = textParam.trim();
    if (cleanText.length > 1000) {
      return NextResponse.json(
        { error: "Text exceeds maximum length of 1000 characters" },
        { status: 400 }
      );
    }

    // Resolve target language code (defaults to 'th')
    const rawLang = searchParams.get("lang") || "th";
    let langCode = "th";
    const lowerLang = rawLang.toLowerCase();
    if (lowerLang.startsWith("th")) {
      langCode = "th";
    } else if (lowerLang.startsWith("en")) {
      langCode = "en";
    } else {
      langCode = lowerLang.split("-")[0] || "th";
    }

    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
      langCode
    )}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

    const response = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Google TTS request failed with status ${response.status}` },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const audioArrayBuffer = await response.arrayBuffer();

    return new Response(audioArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioArrayBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("[TTS API] Error proxying Google TTS:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error fetching TTS",
      },
      { status: 500 }
    );
  }
}
