// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - CLI Song Importer
// Usage: node --env-file=.env.local scripts/import-song.mjs "<song name or query>" [options]
// ==========================================

import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { extractSongMetadata } from "../src/lib/ai-extractor.ts";
import { downloadAndProcessYoutube } from "../src/lib/audio-downloader.ts";
import { uploadAudioToR2 } from "../src/lib/r2.ts";

/**
 * Parses command-line arguments and flags for song importer.
 *
 * Supported flags:
 *   --youtube-url <url> : Override YouTube source URL
 *   --lyrics <text>     : Override/provide complete lyrics
 *   --hook-start <sec>  : Override hook start time in seconds
 *   --hook-end <sec>    : Override hook end time in seconds
 *   -h, --help          : Display help and usage information
 */
export function parseCliArgs(args = process.argv.slice(2)) {
  const flags = {
    youtubeUrl: undefined,
    lyrics: undefined,
    hookStart: undefined,
    hookEnd: undefined,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--youtube-url") {
      flags.youtubeUrl = args[++i];
    } else if (arg.startsWith("--youtube-url=")) {
      flags.youtubeUrl = arg.slice("--youtube-url=".length);
    } else if (arg === "--lyrics") {
      flags.lyrics = args[++i];
    } else if (arg.startsWith("--lyrics=")) {
      flags.lyrics = arg.slice("--lyrics=".length);
    } else if (arg === "--hook-start") {
      flags.hookStart = args[++i];
    } else if (arg.startsWith("--hook-start=")) {
      flags.hookStart = arg.slice("--hook-start=".length);
    } else if (arg === "--hook-end") {
      flags.hookEnd = args[++i];
    } else if (arg.startsWith("--hook-end=")) {
      flags.hookEnd = arg.slice("--hook-end=".length);
    } else if (arg.startsWith("-")) {
      console.warn(`⚠️ Warning: unrecognized option '${arg}'`);
    } else {
      positional.push(arg);
    }
  }

  const query = positional.join(" ").trim();
  return { query, flags };
}

export function printUsage() {
  console.log(`
🎵 เพลงไรวะ (Pleng-Rai-Wa) - CLI Song Importer

Usage:
  node --env-file=.env.local scripts/import-song.mjs "<song name or URL>" [options]

Options:
  --youtube-url <url>   Override the YouTube audio source URL directly
  --lyrics <text>       Override/provide the full song lyrics
  --hook-start <sec>    Override hook start time in seconds (e.g. 65)
  --hook-end <sec>      Override hook end time in seconds (e.g. 95)
  -h, --help            Show this help message

Examples:
  node --env-file=.env.local scripts/import-song.mjs "วัดใจ Silly Fools"
  node --env-file=.env.local scripts/import-song.mjs "https://www.youtube.com/watch?v=..."
  node --env-file=.env.local scripts/import-song.mjs "วัดใจ Silly Fools" --youtube-url "https://youtu.be/..." --hook-start 68 --hook-end 94
`);
}

export async function main() {
  const { query, flags } = parseCliArgs(process.argv.slice(2));

  if (flags.help) {
    printUsage();
    process.exit(0);
  }

  const targetQuery = query || flags.youtubeUrl;
  if (!targetQuery) {
    printUsage();
    process.exit(1);
  }

  console.log(`\n🎵 กำลังค้นหาและสกัดข้อมูลเพลง: "${targetQuery}"...`);

  // 1. Extract metadata via Gemini AI
  const metadata = await extractSongMetadata(targetQuery);

  // Hook override determination
  const hookStart =
    flags.hookStart !== undefined && !isNaN(Number(flags.hookStart))
      ? Number(flags.hookStart)
      : (metadata.hookStartSec || 0);

  const hookEnd =
    flags.hookEnd !== undefined && !isNaN(Number(flags.hookEnd))
      ? Number(flags.hookEnd)
      : (metadata.hookEndSec || 0);

  // Direct URL detection & YouTube audio target resolution
  const isDirectUrl = /^https?:\/\//i.test(targetQuery);
  const ytTarget =
    flags.youtubeUrl ||
    (isDirectUrl
      ? targetQuery
      : (metadata.youtubeSearchQuery || `${metadata.title} ${metadata.artist} official audio`));

  console.log(`✓ สกัดข้อมูลสำเร็จ: "${metadata.title}" โดย ${metadata.artist} (ปี ${metadata.releaseYear || "ไม่ระบุ"})`);
  console.log(`  - แนวเพลง / ยุค: ${metadata.genreSlug || "-"} / ${metadata.era || "-"}`);
  console.log(`  - ท่อนฮุก: ${hookStart}s - ${hookEnd}s${flags.hookStart !== undefined || flags.hookEnd !== undefined ? " (กำหนดเอง)" : ""}`);

  if (flags.youtubeUrl) {
    console.log(`  - YouTube URL: "${ytTarget}" (กำหนดเอง)`);
  } else if (isDirectUrl) {
    console.log(`  - YouTube URL: "${ytTarget}" (URL ตรง)`);
  } else {
    console.log(`  - คำค้นหา YouTube: "${ytTarget}"`);
  }

  if (flags.lyrics) {
    console.log(`  - เนื้อเพลงเต็ม: กำหนดเอง (${flags.lyrics.length} ตัวอักษร)`);
  } else if (metadata.lyricsFull) {
    console.log(`  - เนื้อเพลงเต็ม: สกัดได้อัตโนมัติ (${metadata.lyricsFull.length} ตัวอักษร)`);
  }

  // 2. Resolve genre ID from Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let genreId = undefined;
  if (metadata.genreSlug) {
    const { data: genre } = await supabase
      .from("genres")
      .select("id")
      .eq("slug", metadata.genreSlug)
      .maybeSingle();
    if (genre) genreId = genre.id;
  }

  // 3. Download & process audio from YouTube
  console.log(`\n🎧 กำลังดาวน์โหลดและแปลงไฟล์เสียง MP3 (128kbps) จาก YouTube...`);
  const audioResult = await downloadAndProcessYoutube(ytTarget);
  console.log(`✓ ดาวน์โหลดสำเร็จ: ความยาว ${audioResult.durationSec} วินาที (ขนาด ${(audioResult.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // 4. Upload to Cloudflare R2
  const songId = crypto.randomUUID();
  const r2Key = `songs/${songId}/full.mp3`;
  console.log(`\n☁️ กำลังอัปโหลดไฟล์เสียงขึ้น Cloudflare R2 (${r2Key})...`);
  const audioUrl = await uploadAudioToR2(audioResult.buffer, r2Key, "audio/mpeg");
  console.log(`✓ อัปโหลดขึ้น Cloudflare R2 สำเร็จ: ${audioUrl}`);

  // 5. Insert song row into Supabase
  console.log(`\n💾 กำลังบันทึกข้อมูลเพลงลงในฐานข้อมูล Supabase...`);
  const customLyrics = flags.lyrics;
  const lyricsFull = customLyrics ?? metadata.lyricsFull ?? null;
  const lyricsConfidence = customLyrics ? "verified" : (metadata.lyricsConfidence || "not_found");

  const songRow = {
    id: songId,
    title: metadata.title,
    artist: metadata.artist,
    aliases: metadata.aliases || [metadata.title],
    release_year: metadata.releaseYear ? Number(metadata.releaseYear) : null,
    genre_id: genreId || null,
    era: metadata.era || null,
    audio_url: audioUrl,
    hook_start_sec: hookStart,
    hook_end_sec: hookEnd,
    duration_sec: audioResult.durationSec || metadata.durationSec || 0,
    lyrics_intro: metadata.lyricsIntro || null,
    lyrics_chorus: metadata.lyricsChorus || null,
    lyrics_full: lyricsFull,
    metadata: {
      youtubeSource: ytTarget,
      storageType: "r2",
      r2Key,
      lyricsFull: lyricsFull,
      lyricsConfidence: lyricsConfidence,
      importedAt: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("songs")
    .insert(songRow)
    .select()
    .single();

  if (insertError) {
    console.error("❌ บันทึกเพลงลง Supabase ไม่สำเร็จ:", insertError);
    process.exit(1);
  }

  console.log(`\n🎉 บันทึกเพลง "${inserted.title}" โดย ${inserted.artist} ลงฐานข้อมูลสำเร็จเรียบร้อย!`);
  console.log(`   Song ID: ${inserted.id}`);
  console.log(`   Audio URL: ${inserted.audio_url}`);
  console.log(`   Hook: ${inserted.hook_start_sec}s - ${inserted.hook_end_sec}s (${inserted.duration_sec}s total)`);
  if (inserted.lyrics_chorus) {
    console.log(`   Chorus Preview: "${inserted.lyrics_chorus?.split('\n')[0]}..."`);
  }
  if (inserted.lyrics_full) {
    console.log(`   Full Lyrics: มีข้อมูล (${inserted.lyrics_full.length} ตัวอักษร)`);
  }
}

const currentFilePath = fileURLToPath(import.meta.url).toLowerCase();
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]).toLowerCase() : "";

if (currentFilePath === invokedFilePath) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
