import { GoogleGenAI, Type } from "@google/genai";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - AI Metadata & Lyrics Extractor
// Powered by Google Gemini API (@google/genai) with Resilient Fallbacks
// ==========================================

export interface ExtractedSongMetadata {
  /** Official Thai or English song title */
  title: string;
  /** Singer or Band name */
  artist: string;
  /** Alternative spellings, common typos, and colloquial titles */
  aliases: string[];
  /** Original release year (e.g. 2004) */
  releaseYear: number;
  /** Genre slug: 'rock' | 'pop' | 'indie' | '90s' | 't-pop' | 'country-thai' | 'life' */
  genreSlug: string;
  /** Musical era: '80s' | '90s' | '2000s' | '2010s' | '2020s' */
  era: string;
  /** Approximate start timestamp of the chorus/hook in seconds (e.g. 65) */
  hookStartSec: number;
  /** Approximate end timestamp of the chorus/hook in seconds (e.g. 85) */
  hookEndSec: number;
  /** Opening 2-4 lines of the song */
  lyricsIntro: string;
  /** Chorus 2-4 lines of the song */
  lyricsChorus: string;
  /** Clean YouTube search query (e.g. 'วัดใจ Silly Fools') */
  youtubeSearchQuery: string;
}

export const VALID_GENRE_SLUGS = [
  "rock",
  "pop",
  "indie",
  "90s",
  "t-pop",
  "country-thai",
  "life",
] as const;

export type ValidGenreSlug = (typeof VALID_GENRE_SLUGS)[number];

export const VALID_ERAS = ["80s", "90s", "2000s", "2010s", "2020s"] as const;

/**
 * Curated knowledge base of classic & viral Thai songs for instant heuristic fallback
 */
export const KNOWN_THAI_SONGS: ExtractedSongMetadata[] = [
  {
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai", "watjai", "วัดจัย", "มีแค่ใจดวงเดียวดวงนี้", "silly fools วัดใจ"],
    releaseYear: 2004,
    genreSlug: "rock",
    era: "2000s",
    hookStartSec: 68,
    hookEndSec: 94,
    lyricsIntro: "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย",
    lyricsChorus: "มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า",
    youtubeSearchQuery: "วัดใจ Silly Fools",
  },
  {
    title: "น้ำลาย",
    artist: "Silly Fools",
    aliases: ["nam lai", "namlai", "ยิ่งคุยยิ่งลาย", "silly fools น้ำลาย"],
    releaseYear: 2004,
    genreSlug: "rock",
    era: "2000s",
    hookStartSec: 60,
    hookEndSec: 85,
    lyricsIntro: "ได้ยินข่าวลือเรื่องเธอมากมาย ได้ยินจนใจฉันแทบสลาย",
    lyricsChorus: "ยิ่งคุยก็ยิ่งลาย ยิ่งนานยิ่งไม่ตาย ยิ่งฟังก็ยิ่งเสียดายน้ำลายที่บ้วนทิ้งลงพื้น",
    youtubeSearchQuery: "น้ำลาย Silly Fools",
  },
  {
    title: "ขี้หึง",
    artist: "Silly Fools",
    aliases: ["kee heung", "khee heung", "silly fools ขี้หึง"],
    releaseYear: 2002,
    genreSlug: "rock",
    era: "2000s",
    hookStartSec: 64,
    hookEndSec: 88,
    lyricsIntro: "อาจเป็นเพราะฉันไม่มีเหตุผล อาจเป็นเพราะฉันกังวลมากไป",
    lyricsChorus: "ก็คนมันขี้หึง ก็คนมันขี้หวง อยากให้เธอเป็นของฉันคนเดียวได้ไหม",
    youtubeSearchQuery: "ขี้หึง Silly Fools",
  },
  {
    title: "ซ่อนกลิ่น",
    artist: "Palmy",
    aliases: ["son klin", "sorn klin", "คงไว้ได้แค่กลิ่น", "ปาล์มมี่ ซ่อนกลิ่น"],
    releaseYear: 2018,
    genreSlug: "pop",
    era: "2010s",
    hookStartSec: 65,
    hookEndSec: 90,
    lyricsIntro: "ลืมตาตื่นมาพร้อมหยาดน้ำตา กับความทรงจำที่ยังไม่จาง",
    lyricsChorus: "คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา ยังหอมดังวันเก่ายามเมื่อลมพัดมา",
    youtubeSearchQuery: "ซ่อนกลิ่น Palmy",
  },
  {
    title: "เล่นของสูง",
    artist: "Big Ass",
    aliases: ["len khong soong", "รู้ว่าเสี่ยงแต่คงต้องขอลอง", "บิ๊กแอส เล่นของสูง"],
    releaseYear: 2004,
    genreSlug: "rock",
    era: "2000s",
    hookStartSec: 63,
    hookEndSec: 88,
    lyricsIntro: "ก้อนหินริมทางที่ไร้ราคา เฝ้ามองนางฟ้าที่อยู่บนสวรรค์",
    lyricsChorus: "รู้ว่าเสี่ยงแต่คงต้องขอลอง รู้ว่าเหนื่อยถ้าอยากได้ของสูง ยังไงจะขอลองดูสักที",
    youtubeSearchQuery: "เล่นของสูง Big Ass",
  },
  {
    title: "สองรัก",
    artist: "Zeal",
    aliases: ["song rak", "songrak", "ฉันก็คงไม่ทน", "ซีล สองรัก"],
    releaseYear: 2004,
    genreSlug: "rock",
    era: "2000s",
    hookStartSec: 62,
    hookEndSec: 87,
    lyricsIntro: "เจ็บจนเกินจะทนไหว เมื่อเห็นเธอเดินไปกับใคร",
    lyricsChorus: "สองรักฉันรับไม่ไหว เมื่อเธอมีใครอีกคนเข้ามา ถ้าเธอจะรักสองคนข้างหน้า ฉันก็คงไม่ทนต่อไป",
    youtubeSearchQuery: "สองรัก Zeal",
  },
  {
    title: "แสงสุดท้าย",
    artist: "Bodyslam",
    aliases: ["saeng sood thai", "บอดี้สแลม แสงสุดท้าย", "จะไปให้ถึงแสงสุดท้าย"],
    releaseYear: 2010,
    genreSlug: "rock",
    era: "2010s",
    hookStartSec: 70,
    hookEndSec: 98,
    lyricsIntro: "รอนแรมมาไกลจนเหนื่อยล้า หนทางข้างหน้ายังมืดมน",
    lyricsChorus: "ตราบใดที่แสงตะวันยังมี ตราบใดที่ลมหายใจยังอยู่ จะสู้เพื่อไปให้ถึงแสงสุดท้าย",
    youtubeSearchQuery: "แสงสุดท้าย Bodyslam",
  },
  {
    title: "ความเชื่อ",
    artist: "Bodyslam feat. แอ๊ด คาราบาว",
    aliases: ["khwam chuea", "bodyslam ความเชื่อ", "ตราบใดที่มีความหวัง"],
    releaseYear: 2005,
    genreSlug: "rock",
    era: "2000s",
    hookStartSec: 66,
    hookEndSec: 92,
    lyricsIntro: "ชีวิตเริ่มต้นที่คำว่าฝ่าฟัน มุ่งมั่นเพื่อวันที่สวยงาม",
    lyricsChorus: "ตราบใดที่ใจยังคงมีความเชื่อ จะไม่ยอมแพ้ให้กับโชคชะตา จะก้าวต่อไปไม่ยอมหันหลัง",
    youtubeSearchQuery: "ความเชื่อ Bodyslam",
  },
  {
    title: "คุกเข่า",
    artist: "Cocktail",
    aliases: ["kook khao", "คุกเข่า cocktail", "ค็อกเทล คุกเข่า"],
    releaseYear: 2012,
    genreSlug: "rock",
    era: "2010s",
    hookStartSec: 62,
    hookEndSec: 88,
    lyricsIntro: "เมื่อความรักของเราต้องจบลง เมื่อเธอบอกว่าคงไปต่อไม่ไหว",
    lyricsChorus: "ให้ฉันคุกเข่าอ้อนวอนกราบเธอตรงนี้ ยอมทำทุกอย่างเพื่อรั้งเธอไว้คนดี อย่าทิ้งฉันไป",
    youtubeSearchQuery: "คุกเข่า Cocktail",
  },
  {
    title: "คิดแต่ไม่ถึง",
    artist: "Tilly Birds",
    aliases: ["kid tae mai theung", "tilly birds คิดแต่ไม่ถึง", "คิดถึงเธอแต่ไปไม่ถึง"],
    releaseYear: 2020,
    genreSlug: "indie",
    era: "2020s",
    hookStartSec: 54,
    hookEndSec: 80,
    lyricsIntro: "ผ่านไปนานเท่าไร ความทรงจำยังคงชัดเจน",
    lyricsChorus: "คิดแต่ไม่ถึง คิดถึงเธอเหลือเกิน แต่ไม่อาจย้อนคืนวันวานกลับมา",
    youtubeSearchQuery: "คิดแต่ไม่ถึง Tilly Birds",
  },
  {
    title: "ฝนตกไหม",
    artist: "Three Man Down",
    aliases: ["fon tok mai", "three man down ฝนตกไหม", "ฝนตกที่หน้าต่าง"],
    releaseYear: 2019,
    genreSlug: "indie",
    era: "2010s",
    hookStartSec: 52,
    hookEndSec: 76,
    lyricsIntro: "มองออกไปนอกหน้าต่าง หยดน้ำฝนโปรยปรายลงมา",
    lyricsChorus: "ฝนตกไหม แถวบ้านเธอหนาวไหม เธอจะเหงาหรือเปล่าในคืนที่ฝนพรำ",
    youtubeSearchQuery: "ฝนตกไหม Three Man Down",
  },
  {
    title: "ทรงอย่างแบด",
    artist: "Paper Planes",
    aliases: ["song yang bad", "bad boy", "paper planes ทรงอย่างแบด", "แซดอย่างบ่อย"],
    releaseYear: 2022,
    genreSlug: "rock",
    era: "2020s",
    hookStartSec: 42,
    hookEndSec: 66,
    lyricsIntro: "ยืนมองกระจกดูหน้าตัวเอง ทำไมมันดูไม่ค่อยเอาไหน",
    lyricsChorus: "ทรงอย่างแบด แซดอย่างบ่อย เธอไม่อินกับผู้ชายแบดบอย แต่เธอดันไปชอบคนใจร้าย",
    youtubeSearchQuery: "ทรงอย่างแบด Paper Planes",
  },
  {
    title: "ฤดูที่ฉันเหงา",
    artist: "Flure",
    aliases: ["reudoo thee chan ngao", "flure ฤดูที่ฉันเหงา", "ฝนตกยิ่งนึกถึงทีไร"],
    releaseYear: 2004,
    genreSlug: "indie",
    era: "2000s",
    hookStartSec: 60,
    hookEndSec: 86,
    lyricsIntro: "สายฝนที่เทลงมา ย้ำเตือนเรื่องราววันเก่า",
    lyricsChorus: "ฝนตกยิ่งนึกถึงทีไร ก็ยิ่งชุ่มฉ่ำอุ่นในหัวใจ แม้ว่าคืนนี้อากาศจะหนาวเหน็บเพียงใด",
    youtubeSearchQuery: "ฤดูที่ฉันเหงา Flure",
  },
  {
    title: "บัวลอย",
    artist: "คาราบาว",
    aliases: ["bua loy", "bualoy", "บัวลอยเจ้าเพื่อนยาก", "carabao บัวลอย"],
    releaseYear: 1984,
    genreSlug: "life",
    era: "80s",
    hookStartSec: 46,
    hookEndSec: 72,
    lyricsIntro: "บัวลอยเพื่อนรักร่วมสาบาน เคียงคู่ร่วมรบในดงป่า",
    lyricsChorus: "บัวลอย เจ้าเพื่อนยาก ทำไมจากข้าไปเร็วเกิน บัวลอย เจ้าเพื่อนเกลอ",
    youtubeSearchQuery: "บัวลอย คาราบาว",
  },
  {
    title: "ซมซาน",
    artist: "Loso",
    aliases: ["som san", "somsan", "โลโซ ซมซาน", "เสก โลโซ ซมซาน"],
    releaseYear: 1998,
    genreSlug: "rock",
    era: "90s",
    hookStartSec: 58,
    hookEndSec: 82,
    lyricsIntro: "เกิดมาไม่เคยเจอใครเหมือนเธอ คนอะไรช่างน่ารักจริงเชียว",
    lyricsChorus: "มอง มองดูเธอช่างเพลินใจ จนฉันต้องเดินซมซานกลับมาหาเธออีกครั้ง",
    youtubeSearchQuery: "ซมซาน Loso",
  },
  {
    title: "ใจสั่งมา",
    artist: "Loso",
    aliases: ["jai sang ma", "โลโซ ใจสั่งมา", "เสก โลโซ ใจสั่งมา"],
    releaseYear: 1999,
    genreSlug: "rock",
    era: "90s",
    hookStartSec: 62,
    hookEndSec: 88,
    lyricsIntro: "หากว่าเธอจะถาม ว่าทำไมฉันถึงยอมเธอ",
    lyricsChorus: "ก็ใจมันสั่งมา ให้รักเธอคนนี้ แม้จะต้องเจ็บปวดสักเพียงไหน ใจก็ยังสั่งมา",
    youtubeSearchQuery: "ใจสั่งมา Loso",
  },
  {
    title: "รักติดไซเรน",
    artist: "PARIS, PEARWAH",
    aliases: ["rak tid siren", "my ambulance", "ไอซ์ พาริส แพรวา รักติดไซเรน"],
    releaseYear: 2019,
    genreSlug: "t-pop",
    era: "2010s",
    hookStartSec: 48,
    hookEndSec: 72,
    lyricsIntro: "گاهیเวลาที่เธอเหงาใจ เหมือนมีสัญญาณเตือนภัยดังขึ้นมา",
    lyricsChorus: "รักติดไซเรน เปิดไฟฉุกเฉินวิ่งไปหาเธอทันที ไม่ว่าจะอยู่ที่ไหน จะรีบไปกอดเธอไว้",
    youtubeSearchQuery: "รักติดไซเรน PARIS PEARWAH",
  },
  {
    title: "นะหน้าทอง",
    artist: "โจอี้ ภูวศิษฐ์",
    aliases: ["na na thong", "โจอี้ นะหน้าทอง", "เป่ามนต์สะกดให้เธอรัก"],
    releaseYear: 2022,
    genreSlug: "country-thai",
    era: "2020s",
    hookStartSec: 56,
    hookEndSec: 82,
    lyricsIntro: "กราบหลวงพ่อลงกระหม่อม เป่าคาถามหานิยม",
    lyricsChorus: "เป่าคาถาลงหน้าทอง ให้เธอคลั่งไคล้ใหลหลง ให้รักฉันคนเดียวทั้งใจ",
    youtubeSearchQuery: "นะหน้าทอง โจอี้ ภูวศิษฐ์",
  },
];

/**
 * Extracts a YouTube Video ID from standard YouTube URL patterns
 */
export function parseYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Match 11-character video ID directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL regex
  const regex =
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/|music\.youtube\.com\/watch\?.*v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

/**
 * Safely fetches the video title from YouTube's public oEmbed API
 */
export async function fetchYouTubeOEmbedTitle(urlOrVideoId: string): Promise<string | null> {
  try {
    const videoId = parseYouTubeVideoId(urlOrVideoId);
    const targetUrl = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : urlOrVideoId.trim();

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.title === "string" ? data.title : null;
  } catch {
    return null;
  }
}

/**
 * Cleans song titles by stripping extraneous noise (MV, Official Video, 4K, brackets, etc.)
 */
export function cleanSongTitle(raw: string): string {
  if (!raw) return "";

  let cleaned = raw
    // Remove brackets with video / quality metadata
    .replace(/\[[^\]]*(?:official|mv|audio|video|lyric|remaster|hd|4k|1080p|full)[^\]]*\]/gi, " ")
    .replace(/\([^)]*(?:official|mv|audio|video|lyric|remaster|hd|4k|1080p|full)[^)]*\)/gi, " ")
    // Remove bracket artifacts like [Official MV] or (MV)
    .replace(/\[\s*\]|\(\s*\)/g, " ")
    // Remove standalone noise terms
    .replace(/\b(official\s*mv|official\s*video|official\s*audio|official\s*lyric\s*video|lyric\s*video|music\s*video|lyrics|full\s*song|4k|1080p|hd)\b/gi, " ")
    .replace(/เนื้อเพลง|คอร์ดเพลง|เพลงเต็ม/g, " ")
    // Normalize quotes and spaces
    .replace(/["'“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Derives musical era string from release year
 */
export function getEraFromYear(year: number): string {
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

/**
 * Heuristic metadata extraction used when Gemini API key is absent, rate-limited, or offline
 */
export async function heuristicExtractSongMetadata(
  queryOrUrl: string
): Promise<ExtractedSongMetadata> {
  let text = queryOrUrl.trim();

  // If input is a YouTube URL, attempt to resolve title via oEmbed
  const isUrl = /^https?:\/\//i.test(text);
  if (isUrl) {
    const oembedTitle = await fetchYouTubeOEmbedTitle(text);
    if (oembedTitle) {
      text = oembedTitle;
    }
  }

  const cleanText = cleanSongTitle(text);
  const lowerClean = cleanText.toLowerCase();

  // Check known curated songs
  for (const song of KNOWN_THAI_SONGS) {
    const titleMatch = lowerClean.includes(song.title.toLowerCase());
    const artistMatch = lowerClean.includes(song.artist.toLowerCase());
    const aliasMatch = song.aliases.some((a) => lowerClean.includes(a.toLowerCase()));

    if (titleMatch || (artistMatch && aliasMatch) || aliasMatch) {
      return {
        ...song,
        youtubeSearchQuery: song.youtubeSearchQuery || `${song.title} ${song.artist}`,
      };
    }
  }

  // Parse title and artist using standard delimiters ("-", "–", "by", "โดย", "|")
  let title = cleanText;
  let artist = "Various Artists";

  const delimiters = [" - ", " – ", " by ", " โดย ", " | "];
  for (const delim of delimiters) {
    if (cleanText.includes(delim)) {
      const parts = cleanText.split(delim).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Common Thai YouTube format is often "Artist - Title" or "Title - Artist"
        // Check for artist names or English band names
        const part0IsEnglish = /^[a-zA-Z0-9\s]+$/.test(parts[0]);
        const part1IsThai = /[\u0E00-\u0E7F]/.test(parts[1]);

        if (part0IsEnglish && part1IsThai) {
          artist = parts[0];
          title = parts[1];
        } else {
          artist = parts[0];
          title = parts[1];
        }
        break;
      }
    }
  }

  // Extract release year if present in text
  const yearMatch = text.match(/\b(19\d{2}|20[0-2]\d)\b/);
  const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : 2015;
  const era = getEraFromYear(releaseYear);

  // Guess genre based on query keywords
  let genreSlug: ValidGenreSlug = "pop";
  if (/\b(rock|ร็อก|ร็อค)\b/i.test(text)) {
    genreSlug = "rock";
  } else if (/\b(indie|อินดี้)\b/i.test(text)) {
    genreSlug = "indie";
  } else if (/\b(ลูกทุ่ง|หมอลำ|อีสาน|ไทบ้าน)\b/i.test(text)) {
    genreSlug = "country-thai";
  } else if (/\b(เพื่อชีวิต|คาราบาว|มาลีฮวนน่า)\b/i.test(text)) {
    genreSlug = "life";
  } else if (/\b(t-pop|tpop|บอยแบนด์|เกิร์ลกรุ๊ป)\b/i.test(text)) {
    genreSlug = "t-pop";
  } else if (era === "90s") {
    genreSlug = "90s";
  }

  const aliases: string[] = [title.toLowerCase()];
  const noSpace = title.replace(/\s+/g, "");
  if (noSpace !== title) aliases.push(noSpace.toLowerCase());
  if (artist !== "Various Artists") {
    aliases.push(`${title} ${artist}`.toLowerCase());
  }

  return {
    title: title || "เพลงไม่ระบุชื่อ",
    artist: artist || "ศิลปินนิรนาม",
    aliases,
    releaseYear,
    genreSlug,
    era,
    hookStartSec: 65,
    hookEndSec: 88,
    lyricsIntro: `${title} - ขับร้องโดย ${artist}`,
    lyricsChorus: `ท่อนฮุกจำง่ายของเพลง ${title} โดย ${artist}`,
    youtubeSearchQuery: `${title} ${artist}`.trim(),
  };
}

/**
 * Structured schema definition for Gemini Function/JSON generation
 */
const SONG_METADATA_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Official Thai or English song title, clean of MV / official audio noise",
    },
    artist: {
      type: Type.STRING,
      description: "Primary artist, singer, or band name",
    },
    aliases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Alternative spellings, transliterations, romanized karaoke spellings, and common colloquial titles",
    },
    releaseYear: {
      type: Type.INTEGER,
      description: "Original release year as integer (e.g. 2004)",
    },
    genreSlug: {
      type: Type.STRING,
      description: "Genre slug strictly one of: rock, pop, indie, 90s, t-pop, country-thai, life",
    },
    era: {
      type: Type.STRING,
      description: "Era string strictly one of: 80s, 90s, 2000s, 2010s, 2020s",
    },
    hookStartSec: {
      type: Type.NUMBER,
      description: "Estimated start time of the chorus/hook in seconds (e.g. 65)",
    },
    hookEndSec: {
      type: Type.NUMBER,
      description: "Estimated end time of the chorus/hook in seconds (e.g. 85)",
    },
    lyricsIntro: {
      type: Type.STRING,
      description: "Opening 2-4 lines of the song in Thai",
    },
    lyricsChorus: {
      type: Type.STRING,
      description: "Chorus 2-4 lines of the song in Thai",
    },
    youtubeSearchQuery: {
      type: Type.STRING,
      description: "Clean YouTube search query string, format: '{Official Song Title} {Artist}'",
    },
  },
  required: [
    "title",
    "artist",
    "aliases",
    "releaseYear",
    "genreSlug",
    "era",
    "hookStartSec",
    "hookEndSec",
    "lyricsIntro",
    "lyricsChorus",
    "youtubeSearchQuery",
  ],
};

function isValidApiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 10 &&
    trimmed !== "your-gemini-api-key" &&
    !trimmed.startsWith("placeholder")
  );
}

/**
 * Builds the system prompt for Gemini song metadata extraction
 */
function buildExtractionPrompt(queryOrUrl: string, oembedTitle?: string | null): string {
  return `You are an expert Thai music database curator and lyrics specialist for the web quiz game "เพลงไรวะ" (Pleng-Rai-Wa).
Your task is to identify the exact song from the provided query or URL, extract accurate metadata, and pinpoint the chorus/hook timestamps and key lyrics.

User Input: "${queryOrUrl}"
${oembedTitle ? `Resolved YouTube Video Title: "${oembedTitle}"` : ""}

Instructions:
1. Identify the official Thai or English song title (clean of tags like [Official MV], HD, 4K).
2. Identify the primary artist or band name.
3. Provide 4-8 alternative spellings in 'aliases' (Thai variations, romanized/karaoke spellings, colloquial names, and common typos).
4. Identify the original release year (releaseYear integer, e.g. 2004).
5. Assign genreSlug strictly from: 'rock', 'pop', 'indie', '90s', 't-pop', 'country-thai', 'life'.
6. Assign era strictly from: '80s', '90s', '2000s', '2010s', '2020s'.
7. Estimate the chorus/hook timestamps in seconds (hookStartSec and hookEndSec). The hook should typically be 15 to 30 seconds long.
8. Provide accurate Thai lyrics for the intro (2-4 lines) and chorus (2-4 lines).
9. Provide a clean recommended YouTube search query: "{Official Title} {Artist}".

Output MUST be valid JSON adhering strictly to the schema.`;
}

/**
 * Calls Gemini using the official @google/genai SDK
 */
async function callGeminiSdk(
  prompt: string,
  apiKey: string,
  modelName: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: SONG_METADATA_GEMINI_SCHEMA,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini SDK returned empty response text");
  }
  return text;
}

/**
 * REST fallback to Google Generative Language API
 */
async function callGeminiRest(
  prompt: string,
  apiKey: string,
  modelName: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SONG_METADATA_GEMINI_SCHEMA,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini REST API failed with status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini REST API returned empty text candidate");
  }
  return text;
}

/**
 * Parses and sanitizes raw JSON output from Gemini
 */
function sanitizeExtractedMetadata(
  parsed: Record<string, unknown>,
  fallbackQuery: string
): ExtractedSongMetadata {
  const title = typeof parsed.title === "string" && parsed.title.trim()
    ? cleanSongTitle(parsed.title)
    : cleanSongTitle(fallbackQuery);

  const artist = typeof parsed.artist === "string" && parsed.artist.trim()
    ? parsed.artist.trim()
    : "Various Artists";

  const rawAliases = Array.isArray(parsed.aliases)
    ? parsed.aliases.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    : [];

  const aliasesSet = new Set<string>([title.toLowerCase(), ...rawAliases.map((a) => a.toLowerCase())]);
  const aliases = Array.from(aliasesSet);

  const releaseYear =
    typeof parsed.releaseYear === "number" && !isNaN(parsed.releaseYear)
      ? parsed.releaseYear
      : parseInt(String(parsed.releaseYear), 10) || 2015;

  const rawGenre = typeof parsed.genreSlug === "string" ? parsed.genreSlug.toLowerCase().trim() : "pop";
  const genreSlug: string = (VALID_GENRE_SLUGS as readonly string[]).includes(rawGenre)
    ? rawGenre
    : "pop";

  const era = typeof parsed.era === "string" && (VALID_ERAS as readonly string[]).includes(parsed.era.toLowerCase())
    ? parsed.era.toLowerCase()
    : getEraFromYear(releaseYear);

  const hookStartSec = Math.max(0, Number(parsed.hookStartSec) || 60);
  const hookEndSec = Math.max(hookStartSec + 5, Number(parsed.hookEndSec) || hookStartSec + 25);

  const lyricsIntro = typeof parsed.lyricsIntro === "string" ? parsed.lyricsIntro.trim() : "";
  const lyricsChorus = typeof parsed.lyricsChorus === "string" ? parsed.lyricsChorus.trim() : "";

  const youtubeSearchQuery =
    typeof parsed.youtubeSearchQuery === "string" && parsed.youtubeSearchQuery.trim()
      ? parsed.youtubeSearchQuery.trim()
      : `${title} ${artist}`;

  return {
    title,
    artist,
    aliases,
    releaseYear,
    genreSlug,
    era,
    hookStartSec,
    hookEndSec,
    lyricsIntro,
    lyricsChorus,
    youtubeSearchQuery,
  };
}

/**
 * Main service function to extract comprehensive song metadata and lyrics
 *
 * @param queryOrUrl Search string (e.g. "วัดใจ Silly Fools") or YouTube video URL
 * @param customApiKey Optional override for GEMINI_API_KEY
 * @returns Promise<ExtractedSongMetadata>
 */
export async function extractSongMetadata(
  queryOrUrl: string,
  customApiKey?: string
): Promise<ExtractedSongMetadata> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;

  // 1. If no valid API key is configured, seamlessly execute heuristic fallback
  if (!isValidApiKey(apiKey)) {
    return heuristicExtractSongMetadata(queryOrUrl);
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  // 2. If query is a YouTube URL, fetch oEmbed title to provide rich context to Gemini
  let oembedTitle: string | null = null;
  if (/^https?:\/\//i.test(queryOrUrl.trim())) {
    oembedTitle = await fetchYouTubeOEmbedTitle(queryOrUrl.trim());
  }

  const prompt = buildExtractionPrompt(queryOrUrl, oembedTitle);

  // 3. Try official @google/genai SDK
  try {
    const rawJsonText = await callGeminiSdk(prompt, apiKey!, modelName);
    const parsed = JSON.parse(rawJsonText);
    return sanitizeExtractedMetadata(parsed, queryOrUrl);
  } catch (sdkError) {
    console.warn("[ai-extractor] Google GenAI SDK failed, attempting REST fallback:", sdkError);

    // 4. Try REST fallback
    try {
      const restJsonText = await callGeminiRest(prompt, apiKey!, modelName);
      const parsed = JSON.parse(restJsonText);
      return sanitizeExtractedMetadata(parsed, queryOrUrl);
    } catch (restError) {
      console.warn("[ai-extractor] Gemini REST fallback failed, using heuristic parser:", restError);
      // 5. Ultimate fallback to heuristic parser
      return heuristicExtractSongMetadata(queryOrUrl);
    }
  }
}
