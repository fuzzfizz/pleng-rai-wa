// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Answer Checking & Thai Fuzzy Matching Engine
// ==========================================

import Fuse from "fuse.js";
import type { Song } from "@/types";

export interface ThaiNormalizationOptions {
  /**
   * If true, strips Thai tone marks (่ ้ ๊ ๋) and diacritics like mai-taikhu (็),
   * karan (์), nikhahit (ํ), and yamakkan (๎) for lenient phonetic comparison.
   */
  stripTones?: boolean;
}

export interface CheckAnswerResult {
  isCorrect: boolean;
  matchedAs: string;
  similarity: number;
}

/**
 * Normalizes Thai & international text:
 * - Lowercases Latin characters
 * - Applies Unicode NFC normalization
 * - Converts Thai numeral digits (๐-๙) to Arabic digits (0-9)
 * - Strips Thai punctuation (ๆ, ฯ) and symbols
 * - Strips standard punctuation and whitespace
 * - Optionally strips Thai tone marks & mai-taikhu for lenient matching
 */
export function normalizeThaiText(text: string, options?: ThaiNormalizationOptions): string {
  if (!text) return "";

  let result = text.trim().toLowerCase().normalize("NFC");

  // 1. Normalize Thai digits (๐-๙) to Arabic digits (0-9)
  result = result.replace(/[\u0E50-\u0E59]/g, (char) =>
    String(char.charCodeAt(0) - 0x0e50)
  );

  // 2. Strip Thai-specific punctuation (ๆ Maiyamok, ฯ Paiyannoi)
  result = result.replace(/[\u0E46\u0E2F]/g, "");

  // 3. Remove whitespace, punctuation, and emoji/symbols
  // \p{P} = Unicode punctuation, \p{S} = Unicode symbols
  result = result.replace(/[\s\p{P}\p{S}]+/gu, "");

  // 4. Optionally strip tone marks and diacritics
  // \u0E47: Mai Taikhu (็)
  // \u0E48: Mai Ek (่)
  // \u0E49: Mai Tho (้)
  // \u0E4A: Mai Tri (๊)
  // \u0E4B: Mai Chattawa (๋)
  // \u0E4C: Thanthakhat / Karan (์)
  // \u0E4D: Nikhahit (ํ)
  // \u0E4E: Yamakkan (๎)
  if (options?.stripTones) {
    result = result.replace(/[\u0E47-\u0E4E]/g, "");
  }

  return result;
}

/**
 * Phonetically normalizes Thai text for common typos and equivalent homophones:
 * - 'ใ' and 'ไ'
 * - 'ัย' vs 'ไ' (e.g. จัย -> ไจ)
 * - ศ, ษ -> ส
 * - ณ -> น
 * - ญ -> ย
 * - ทร -> ซ
 * - ภ -> พ, ธ -> ท
 */
export function phoneticNormalizeThai(text: string): string {
  if (!text) return "";
  let res = normalizeThaiText(text, { stripTones: true });
  // Map ใ to ไ
  res = res.replace(/ใ/g, "ไ");
  // Map consonant + ัย to ไ + consonant (e.g. จัย -> ไจ)
  res = res.replace(/([\u0E01-\u0E2E])ัย/g, "ไ$1");
  // Homophone consonants
  res = res.replace(/[ศษ]/g, "ส");
  res = res.replace(/ณ/g, "น");
  res = res.replace(/ญ/g, "ย");
  res = res.replace(/ทร/g, "ซ");
  res = res.replace(/ภ/g, "พ");
  res = res.replace(/ธ/g, "ท");
  return res;
}

/**
 * Computes Levenshtein edit distance between two strings using O(min(N,M)) memory.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const aLen = aChars.length;
  const bLen = bChars.length;

  let prevRow = new Array<number>(bLen + 1);
  let currRow = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    const aChar = aChars[i - 1];

    for (let j = 1; j <= bLen; j++) {
      const bChar = bChars[j - 1];
      const cost = aChar === bChar ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,       // insertion
        prevRow[j] + 1,           // deletion
        prevRow[j - 1] + cost     // substitution
      );
    }

    for (let j = 0; j <= bLen; j++) {
      prevRow[j] = currRow[j];
    }
  }

  return prevRow[bLen];
}

/**
 * Computes normalized Levenshtein similarity ratio between 0 and 1.
 * Automatically normalizes strings using normalizeThaiText.
 */
export function calculateSimilarity(
  a: string,
  b: string,
  options?: { normalize?: boolean; stripTones?: boolean }
): number {
  const shouldNormalize = options?.normalize !== false;
  const aStr = shouldNormalize ? normalizeThaiText(a, options) : a;
  const bStr = shouldNormalize ? normalizeThaiText(b, options) : b;

  if (aStr === bStr) return 1.0;
  if (aStr.length === 0 && bStr.length === 0) return 1.0;
  if (aStr.length === 0 || bStr.length === 0) return 0.0;

  const aChars = Array.from(aStr);
  const bChars = Array.from(bStr);
  const maxLen = Math.max(aChars.length, bChars.length);
  if (maxLen === 0) return 1.0;

  const dist = calculateLevenshteinDistance(aStr, bStr);
  const sim = Math.max(0, 1 - dist / maxLen);

  return Number(sim.toFixed(4));
}

/**
 * Checks a player's answer against a song's title and optional aliases.
 * Returns isCorrect: true if exact match or similarity >= 0.82 (tolerates typos, dropped vowels/tones).
 */
export function checkAnswer(
  userAnswer: string,
  song: { title: string; aliases?: string[] }
): CheckAnswerResult {
  const trimmedInput = userAnswer?.trim() || "";
  const defaultTitle = song.title || "";

  if (!trimmedInput) {
    return {
      isCorrect: false,
      matchedAs: defaultTitle,
      similarity: 0,
    };
  }

  const candidates = [defaultTitle, ...(song.aliases || [])]
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c && c.length > 0));

  if (candidates.length === 0) {
    return {
      isCorrect: false,
      matchedAs: defaultTitle,
      similarity: 0,
    };
  }

  let highestSim = 0;
  let bestMatch = defaultTitle;

  const normUser = normalizeThaiText(trimmedInput);
  const normUserNoTones = normalizeThaiText(trimmedInput, { stripTones: true });

  for (const candidate of candidates) {
    const normCand = normalizeThaiText(candidate);
    const normCandNoTones = normalizeThaiText(candidate, { stripTones: true });

    // 1. Direct normalized equality
    if (normUser === normCand) {
      return {
        isCorrect: true,
        matchedAs: candidate,
        similarity: 1.0,
      };
    }

    // 2. Direct Levenshtein similarity
    const rawSim = calculateSimilarity(normUser, normCand, { normalize: false });

    // 3. User entered "เพลง..." prefix (e.g. "เพลงรักแท้" vs "รักแท้")
    let prefixSim = 0;
    if (normUser.startsWith("เพลง") && !normCand.startsWith("เพลง") && normUser.length > 4) {
      prefixSim = calculateSimilarity(normUser.slice(4), normCand, { normalize: false });
    }

    // 4. Tone-stripped similarity for lenient Thai mobile keyboard matching
    let toneSim = 0;
    if (normUserNoTones === normCandNoTones) {
      // Consonants and vowels match 100%, only tone marks differ
      toneSim = 0.95;
    } else {
      const strippedSim = calculateSimilarity(normUserNoTones, normCandNoTones, { normalize: false });
      if (strippedSim >= 0.85) {
        toneSim = strippedSim * 0.94;
      }
    }

    // 5. Phonetic match (handles ใ vs ไ, -ัย vs ไ, homophone consonants like ศ vs ส)
    const phoneUser = phoneticNormalizeThai(trimmedInput);
    const phoneCand = phoneticNormalizeThai(candidate);
    let phoneSim = 0;
    if (phoneUser === phoneCand) {
      phoneSim = 0.95;
    } else {
      const pSim = calculateSimilarity(phoneUser, phoneCand, { normalize: false });
      if (pSim >= 0.85) {
        phoneSim = pSim * 0.93;
      }
    }

    const candidateBestSim = Math.max(rawSim, prefixSim, toneSim, phoneSim);

    if (candidateBestSim > highestSim) {
      highestSim = candidateBestSim;
      bestMatch = candidate;
    }
  }

  const finalScore = Number(highestSim.toFixed(4));
  const isCorrect = finalScore >= 0.82;

  return {
    isCorrect,
    matchedAs: bestMatch,
    similarity: finalScore,
  };
}

/**
 * Fast, typo-tolerant song autocomplete using strict matching for short queries and Fuse.js for longer queries.
 * - If query is 1 or 2 characters:
 *   Matches strictly by checking if song.title (or song.artist) contains or starts with the normalized query.
 *   DOES NOT search across aliases (such as "คงไว้ได้แค่กลิ่น") when query is only 1-2 characters (e.g. typing "ว" must NOT match "ซ่อนกลิ่น").
 * - If query is 3+ characters:
 *   Prioritizes songs where title contains the query first.
 *   Uses Fuse.js with a strict threshold (threshold: 0.25) so loose accidental matches don't appear.
 */
export function searchSongAutocomplete(
  query: string,
  songPool: Song[],
  limit = 6
): Song[] {
  if (!songPool || songPool.length === 0) {
    return [];
  }

  const trimmedQuery = query?.trim() || "";
  if (!trimmedQuery) {
    return songPool.slice(0, limit);
  }

  const normQuery = normalizeThaiText(trimmedQuery);
  const normQueryNoTones = normalizeThaiText(trimmedQuery, { stripTones: true });
  const rawLowerQuery = trimmedQuery.toLowerCase();

  // If query is 1 or 2 characters:
  // Match strictly by checking if song.title (or song.artist) contains or starts with the normalized query.
  // DO NOT search across aliases when query is only 1-2 characters (e.g. typing "ว" must NOT match "ซ่อนกลิ่น").
  if (trimmedQuery.length <= 2 || (normQuery && normQuery.length <= 2)) {
    const titleStarts: Song[] = [];
    const titleContains: Song[] = [];
    const artistStarts: Song[] = [];
    const artistContains: Song[] = [];

    for (const song of songPool) {
      const title = song.title || "";
      const artist = song.artist || "";

      const normTitle = normalizeThaiText(title);
      const normTitleNoTones = normalizeThaiText(title, { stripTones: true });
      const rawLowerTitle = title.toLowerCase();

      const normArtist = normalizeThaiText(artist);
      const normArtistNoTones = normalizeThaiText(artist, { stripTones: true });
      const rawLowerArtist = artist.toLowerCase();

      const titleMatchesStart =
        (normQuery && normTitle.startsWith(normQuery)) ||
        (normQueryNoTones && normTitleNoTones.startsWith(normQueryNoTones)) ||
        rawLowerTitle.startsWith(rawLowerQuery);

      const titleMatchesContains =
        (normQuery && normTitle.includes(normQuery)) ||
        (normQueryNoTones && normTitleNoTones.includes(normQueryNoTones)) ||
        rawLowerTitle.includes(rawLowerQuery);

      const artistMatchesStart =
        (normQuery && normArtist.startsWith(normQuery)) ||
        (normQueryNoTones && normArtistNoTones.startsWith(normQueryNoTones)) ||
        rawLowerArtist.startsWith(rawLowerQuery);

      const artistMatchesContains =
        (normQuery && normArtist.includes(normQuery)) ||
        (normQueryNoTones && normArtistNoTones.includes(normQueryNoTones)) ||
        rawLowerArtist.includes(rawLowerQuery);

      if (titleMatchesStart) {
        titleStarts.push(song);
      } else if (titleMatchesContains) {
        titleContains.push(song);
      } else if (artistMatchesStart) {
        artistStarts.push(song);
      } else if (artistMatchesContains) {
        artistContains.push(song);
      }
    }

    return [...titleStarts, ...titleContains, ...artistStarts, ...artistContains].slice(0, limit);
  }

  // If query is 3+ characters:
  // Prioritize songs where title contains the query first.
  const titleStarts: Song[] = [];
  const titleContains: Song[] = [];
  const seenIds = new Set<string>();

  for (const song of songPool) {
    const title = song.title || "";
    const normTitle = normalizeThaiText(title);
    const normTitleNoTones = normalizeThaiText(title, { stripTones: true });
    const rawLowerTitle = title.toLowerCase();

    const titleMatchesStart =
      (normQuery && normTitle.startsWith(normQuery)) ||
      (normQueryNoTones && normTitleNoTones.startsWith(normQueryNoTones)) ||
      rawLowerTitle.startsWith(rawLowerQuery);

    const titleMatchesContains =
      (normQuery && normTitle.includes(normQuery)) ||
      (normQueryNoTones && normTitleNoTones.includes(normQueryNoTones)) ||
      rawLowerTitle.includes(rawLowerQuery);

    if (titleMatchesStart) {
      titleStarts.push(song);
      seenIds.add(song.id || song.title);
    } else if (titleMatchesContains) {
      titleContains.push(song);
      seenIds.add(song.id || song.title);
    }
  }

  const prioritized = [...titleStarts, ...titleContains];
  if (prioritized.length >= limit) {
    return prioritized.slice(0, limit);
  }

  // Use Fuse.js with a strict threshold (threshold: 0.25) so loose accidental matches don't appear.
  const fuse = new Fuse(songPool, {
    keys: [
      { name: "title", weight: 0.6 },
      { name: "aliases", weight: 0.25 },
      { name: "artist", weight: 0.15 },
    ],
    threshold: 0.25,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 2,
    shouldSort: true,
  });

  const fuseResults = fuse.search(trimmedQuery);
  const results: Song[] = [...prioritized];

  for (const match of fuseResults) {
    const key = match.item.id || match.item.title;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      results.push(match.item);
      if (results.length >= limit) {
        break;
      }
    }
  }

  return results.slice(0, limit);
}
