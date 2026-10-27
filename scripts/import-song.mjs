// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - CLI Song Importer
// Usage: node --env-file=.env.local scripts/import-song.mjs "<song name or query>"
// ==========================================

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { extractSongMetadata } from "../src/lib/ai-extractor.ts";
import { downloadAndProcessYoutube } from "../src/lib/audio-downloader.ts";
import { uploadAudioToR2 } from "../src/lib/r2.ts";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("Usage: node --env-file=.env.local scripts/import-song.mjs '<song name or query>'");
    process.exit(1);
  }

  console.log(`\n🎵 กำลังค้นหาและสกัดข้อมูลเพลง: "${query}"...`);

  // 1. Extract metadata via Gemini AI
  const metadata = await extractSongMetadata(query);
  console.log(`✓ สกัดข้อมูลสำเร็จ: "${metadata.title}" โดย ${metadata.artist} (ปี ${metadata.releaseYear || "ไม่ระบุ"})`);
  console.log(`  - แนวเพลง / ยุค: ${metadata.genreSlug || "-"} / ${metadata.era || "-"}`);
  console.log(`  - ท่อนฮุก: ${metadata.hookStartSec}s - ${metadata.hookEndSec}s`);
  console.log(`  - คำค้นหา YouTube: "${metadata.youtubeSearchQuery}"`);

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
  const ytQuery = metadata.youtubeSearchQuery || `${metadata.title} ${metadata.artist} official audio`;
  const audioResult = await downloadAndProcessYoutube(ytQuery);
  console.log(`✓ ดาวน์โหลดสำเร็จ: ความยาว ${audioResult.durationSec} วินาที (ขนาด ${(audioResult.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // 4. Upload to Cloudflare R2
  const songId = crypto.randomUUID();
  const r2Key = `songs/${songId}/full.mp3`;
  console.log(`\n☁️ กำลังอัปโหลดไฟล์เสียงขึ้น Cloudflare R2 (${r2Key})...`);
  const audioUrl = await uploadAudioToR2(audioResult.buffer, r2Key, "audio/mpeg");
  console.log(`✓ อัปโหลดขึ้น Cloudflare R2 สำเร็จ: ${audioUrl}`);

  // 5. Insert song row into Supabase
  console.log(`\n💾 กำลังบันทึกข้อมูลเพลงลงในฐานข้อมูล Supabase...`);
  const songRow = {
    id: songId,
    title: metadata.title,
    artist: metadata.artist,
    aliases: metadata.aliases || [metadata.title],
    release_year: metadata.releaseYear ? Number(metadata.releaseYear) : null,
    genre_id: genreId || null,
    era: metadata.era || null,
    audio_url: audioUrl,
    hook_start_sec: metadata.hookStartSec || 0,
    hook_end_sec: metadata.hookEndSec || 0,
    duration_sec: audioResult.durationSec || metadata.durationSec || 0,
    lyrics_intro: metadata.lyricsIntro || null,
    lyrics_chorus: metadata.lyricsChorus || null,
    metadata: {
      youtubeSource: ytQuery,
      storageType: "r2",
      r2Key,
      lyricsFull: metadata.lyricsFull || null,
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
  console.log(`   Chorus Preview: "${inserted.lyrics_chorus?.split('\n')[0]}..."`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
