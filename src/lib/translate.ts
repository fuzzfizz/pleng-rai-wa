// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Google Translate Literal Karaoke Utility
// Translates Thai song lyrics into literal, hilarious English for the
// "translated-lyrics" game mode
// ==========================================

const translationCache = new Map<string, string>();

/**
 * Translates Thai text to English using Google Translate's literal translation engine.
 * Fast, free, requires no API key, and cached in-memory.
 */
export async function translateThaiToEnglishLiteral(text: string): Promise<string> {
  if (!text || typeof text !== "string" || !text.trim()) {
    return "";
  }

  const cleanText = text.trim();

  // Check cache
  if (translationCache.has(cleanText)) {
    return translationCache.get(cleanText)!;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=en&dt=t&q=${encodeURIComponent(
      cleanText
    )}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Translate response error: ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((segment: any) => (Array.isArray(segment) && segment[0] ? segment[0] : ""))
        .join("")
        .trim();

      if (translated) {
        translationCache.set(cleanText, translated);
        return translated;
      }
    }

    return cleanText;
  } catch (error) {
    console.warn("[translateThaiToEnglishLiteral] Translation failed, returning original text:", error);
    return cleanText;
  }
}
