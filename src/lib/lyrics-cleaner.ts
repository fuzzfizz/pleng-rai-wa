// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Lyrics Cleaner Utility
// Strips song title, artist, album, and credits headers from lyrics
// to avoid spoiling game clues in AI Lyrics and Translated Karaoke modes.
// ==========================================

/**
 * Regex matching metadata and credit header lines in Thai & English song lyrics.
 * Matches lines starting with (optional brackets/bullets) followed by
 * metadata labels and a delimiter (colon, dash, equal sign) or "by".
 */
const METADATA_HEADER_REGEX =
  /^\s*[\[({<]?\s*(?:[-*•#>~]+\s*)?(?:เพลง|ชื่อเพลง|ศิลปิน|นักร้อง|อัลบั้ม|คำร้อง[\s/\\&,]*ทำนอง|ทำนอง[\s/\\&,]*คำร้อง|คำร้องและทำนอง|คำร้อง|เนื้อร้อง|ทำนอง|เรียบเรียง(?:เสียงประสาน)?|โปรดิวเซอร์|โปรดิวซ์|สังกัด|ค่ายเพลง|ค่าย|artist|singer|song|title|album|lyrics?|melody|music|composer|composed(?:\s+by)?|author|written(?:\s+by)?|writer|arranger?|arranged(?:\s+by)?|producer|produced(?:\s+by)?|label|featuring|feat\.?|ft\.?)\s*[:：\-–—=]\s*.*[\])}>]*\s*$/i;

/**
 * Regex matching common credits phrases without explicit punctuation delimiters
 * (e.g. "Produced by Montonn Jira", "Written by Boyd Kosiyabong").
 */
const CREDITS_PHRASE_REGEX =
  /^\s*[\[({<]?\s*(?:[-*•#>~]+\s*)?(?:composed\s+by|written\s+by|produced\s+by|arranged\s+by)\s+.*[\])}>]*\s*$/i;

/**
 * Strips title, artist, album, composer, and credits header lines from lyrics text
 * so that AI TTS reading or Google Translate Karaoke does not spoil the answer to players.
 *
 * Preserves actual song lyrics and stanza spacing.
 */
export function cleanLyricsForGame(lyrics: string | null | undefined): string {
  if (!lyrics || typeof lyrics !== "string") {
    return "";
  }

  const lines = lyrics.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Keep empty lines temporarily for stanza spacing
    if (METADATA_HEADER_REGEX.test(trimmed)) return false;
    if (CREDITS_PHRASE_REGEX.test(trimmed)) return false;
    return true;
  });

  // Join lines back together, trim leading/trailing blank lines,
  // and normalize excessive consecutive empty lines (max 2 newlines).
  const joined = filtered.join("\n");
  const trimmedEdges = joined.replace(/^\s*[\r\n]+/, "").replace(/[\r\n]+\s*$/, "");
  return trimmedEdges.replace(/\n{3,}/g, "\n\n").trim();
}
