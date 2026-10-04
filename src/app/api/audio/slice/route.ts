// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Dynamic MP3 Audio Slice Route
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { sliceMp3Buffer } from "@/lib/mp3-slicer";
import { getSongById } from "@/lib/services/song-service";
import { getAudioStreamFromR2 } from "@/lib/r2";
import type { Song } from "@/types";

/**
 * Helper to convert a Node.js Readable or Web ReadableStream into a Buffer.
 */
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) {
    throw new Error("Audio stream is empty");
  }

  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  const s = stream as Record<string, unknown>;

  // Check async iterator (Node Readable or Web ReadableStream in modern runtimes)
  if (typeof (s as Record<symbol, unknown>)[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array | Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // Check Web ReadableStream
  if (typeof s.getReader === "function") {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
  }

  // Check Node.js Readable EventEmitter
  if (typeof s.on === "function") {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      (stream as NodeJS.EventEmitter).on("data", (chunk: Uint8Array | Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      (stream as NodeJS.EventEmitter).on("end", () => resolve(Buffer.concat(chunks)));
      (stream as NodeJS.EventEmitter).on("error", (err: Error) => reject(err));
    });
  }

  throw new Error("Unsupported stream format");
}

/**
 * Resolves the full MP3 audio buffer from local storage, database metadata, R2, or remote URL.
 */
async function resolveAudioBuffer(id: string, song: Song | null): Promise<Buffer | null> {
  // 1. Check local public upload directory: public/audio/uploads/${id}.mp3
  const directLocalPath = path.join(process.cwd(), "public", "audio", "uploads", `${id}.mp3`);
  if (fs.existsSync(directLocalPath)) {
    try {
      return await fs.promises.readFile(directLocalPath);
    } catch (e) {
      console.warn(`[audio-slice] Failed to read direct local file ${directLocalPath}:`, e);
    }
  }

  // 2. If song found, check its audioUrl
  if (song?.audioUrl) {
    // Relative URL (e.g. /audio/uploads/xxx.mp3)
    if (song.audioUrl.startsWith("/")) {
      const relativeLocalPath = path.join(process.cwd(), "public", song.audioUrl);
      if (fs.existsSync(relativeLocalPath)) {
        try {
          return await fs.promises.readFile(relativeLocalPath);
        } catch (e) {
          console.warn(`[audio-slice] Failed to read relative local file ${relativeLocalPath}:`, e);
        }
      }
    }

    // Remote HTTP / HTTPS URL (e.g. Cloudflare R2 public bucket or CDN)
    if (song.audioUrl.startsWith("http://") || song.audioUrl.startsWith("https://")) {
      try {
        const response = await fetch(song.audioUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
      } catch (e) {
        console.warn(`[audio-slice] Failed to fetch remote audioUrl ${song.audioUrl}:`, e);
      }
    }
  }

  // 3. Check Cloudflare R2 storage
  const isR2Configured = Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );

  if (isR2Configured) {
    const candidateKeys = [
      song?.metadata?.r2Key as string | undefined,
      `songs/${id}/full.mp3`,
      `songs/${id}.mp3`,
      `${id}.mp3`,
    ].filter(Boolean) as string[];

    for (const key of candidateKeys) {
      try {
        const r2Result = await getAudioStreamFromR2(key);
        if (r2Result.stream) {
          const buffer = await streamToBuffer(r2Result.stream);
          if (buffer.length > 0) {
            return buffer;
          }
        }
      } catch {
        // Continue trying next candidate key
      }
    }
  }

  return null;
}

/**
 * GET /api/audio/slice?id=uuid&start=number&duration=number
 * Dynamically slices and returns a frame-aligned MP3 audio chunk.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const startParam = searchParams.get("start");
    const durationParam = searchParams.get("duration");

    if (!id) {
      return NextResponse.json(
        { error: "พารามิเตอร์ 'id' เป็นค่าที่จำเป็น (Missing required query parameter: id)" },
        { status: 400 }
      );
    }

    // Lookup song record if present in DB
    let song: Song | null = null;
    try {
      song = await getSongById(id);
    } catch (err) {
      console.warn(`[audio-slice] getSongById(${id}) warning:`, err);
    }

    // Determine startSec and durationSec
    let startSec = 0;
    if (startParam !== null && !isNaN(parseFloat(startParam))) {
      startSec = Math.max(0, parseFloat(startParam));
    } else if (song?.hookStartSec && song.hookStartSec > 0) {
      startSec = song.hookStartSec;
    }

    let durationSec = 2.0;
    if (durationParam !== null && !isNaN(parseFloat(durationParam))) {
      durationSec = Math.max(0.1, parseFloat(durationParam));
    }

    // Fetch full MP3 buffer
    const fullBuffer = await resolveAudioBuffer(id, song);

    if (!fullBuffer || fullBuffer.length === 0) {
      return NextResponse.json(
        { error: `ไม่พบไฟล์เสียงสำหรับเพลงรหัส: ${id} (Audio file not found)` },
        { status: 404 }
      );
    }

    // Slice MP3 with frame alignment
    const slicedBuffer = sliceMp3Buffer(fullBuffer, { startSec, durationSec });

    if (slicedBuffer.length === 0) {
      return NextResponse.json(
        { error: "ไม่สามารถตัดไฟล์เสียงได้ (Failed to slice audio)" },
        { status: 500 }
      );
    }

    // Return pure audio/mpeg response with caching headers
    return new Response(new Uint8Array(slicedBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": slicedBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("[audio-slice] Error processing audio slice request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการประมวลผลไฟล์เสียง" },
      { status: 500 }
    );
  }
}
