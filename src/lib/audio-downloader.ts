import { execFile, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ==========================================
// Local Audio Downloader & Processor (yt-dlp + ffmpeg)
// ==========================================

export interface DownloadResult {
  buffer: Buffer;
  durationSec: number;
  tempFilePath?: string;
  title?: string;
}

/**
 * Searches for a binary executable across common paths and PATH environment.
 */
export function findExecutable(name: string): string | null {
  const isWindows = process.platform === "win32";
  const exeName = isWindows && !name.toLowerCase().endsWith(".exe") ? `${name}.exe` : name;

  // 1. Check custom environment variable
  const envVarName = `${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PATH`;
  if (process.env[envVarName] && fs.existsSync(process.env[envVarName]!)) {
    return process.env[envVarName]!;
  }

  // 2. Check local project directories
  const localCandidates = [
    path.join(process.cwd(), "bin", exeName),
    path.join(process.cwd(), "bin", name),
    path.join(process.cwd(), "tools", exeName),
    path.join(process.cwd(), "tools", name),
    path.join(os.tmpdir(), exeName),
    path.join(os.tmpdir(), name),
  ];

  // 3. Check Windows-specific WinGet Links or AppData
  if (isWindows && process.env.LOCALAPPDATA) {
    localCandidates.push(
      path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", exeName),
      path.join(process.env.LOCALAPPDATA, "Programs", name, exeName)
    );
  }

  for (const candidate of localCandidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      return candidate;
    }
  }

  // 4. Check system PATH via 'where' (Windows) or 'which' (Unix)
  try {
    const cmd = isWindows ? "where" : "which";
    const stdout = execFileSync(cmd, [name], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    const firstLine = stdout.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
    if (firstLine && fs.existsSync(/*turbopackIgnore: true*/ firstLine)) {
      return firstLine;
    }
  } catch {
    // Binary not found in PATH
  }

  return null;
}

/**
 * Locates the local ffmpeg binary.
 */
export function getFfmpegPath(): string {
  const found = findExecutable("ffmpeg");
  if (found) return found;

  // Fallback to "ffmpeg" assuming it might be picked up by the shell environment
  return "ffmpeg";
}

/**
 * Locates the local ffprobe binary if available.
 */
export function getFfprobePath(): string | null {
  return findExecutable("ffprobe");
}

/**
 * Locates or automatically downloads the yt-dlp binary if not found.
 */
export async function getYtDlpPath(): Promise<string> {
  const found = findExecutable("yt-dlp");
  if (found) return found;

  const isWindows = process.platform === "win32";
  const binaryFileName = isWindows ? "yt-dlp.exe" : "yt-dlp";
  const downloadDir = path.join(process.cwd(), "bin");
  const targetPath = path.join(downloadDir, binaryFileName);

  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  // Attempt to auto-download yt-dlp standalone binary into ./bin/
  console.log(`[AudioProcessor] yt-dlp not found in PATH. Attempting automatic download to ${targetPath}...`);
  try {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const downloadUrl = isWindows
      ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
      : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download yt-dlp: HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));

    // Make executable on POSIX systems
    if (!isWindows) {
      fs.chmodSync(targetPath, 0o755);
    }

    console.log(`[AudioProcessor] Successfully downloaded yt-dlp to ${targetPath}`);
    return targetPath;
  } catch (err: any) {
    throw new Error(
      `yt-dlp was not found on your system, and auto-download failed: ${err.message}. ` +
        `Please install yt-dlp in PATH (e.g. 'winget install yt-dlp.yt-dlp' or 'brew install yt-dlp') ` +
        `or place the binary in '${downloadDir}'.`
    );
  }
}

/**
 * Extracts the duration in seconds of an audio file using ffprobe.
 */
export async function getAudioDurationSec(audioFilePath: string): Promise<number> {
  const ffprobe = getFfprobePath() || "ffprobe";
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      audioFilePath,
    ]);
    const parsed = parseFloat(stdout.trim());
    if (!isNaN(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  } catch {
    // ffprobe might not be installed or failed
  }
  return 0;
}

/**
 * Downloads audio from YouTube (via URL or search query) and processes it into
 * standard MP3 128kbps (44.1kHz, 2-channel) using local yt-dlp and ffmpeg.
 *
 * @param youtubeUrlOrQuery - YouTube video URL or search query (e.g. "Three Man Down ฝนตกไหม")
 * @param options - Additional download options
 * @returns Object containing the processed MP3 buffer, song duration in seconds, and temp file path.
 */
export async function downloadAndProcessYoutube(
  youtubeUrlOrQuery: string,
  options?: {
    cleanupTemp?: boolean;
    outputDir?: string;
  }
): Promise<DownloadResult> {
  const ytDlpPath = await getYtDlpPath();
  const ffmpegPath = getFfmpegPath();

  // Normalize target: If not an HTTP URL, treat as YouTube search query
  const isUrl = /^https?:\/\//i.test(youtubeUrlOrQuery.trim());
  const target = isUrl ? youtubeUrlOrQuery.trim() : `ytsearch1:${youtubeUrlOrQuery.trim()}`;

  // Create isolated temp workspace
  const tempDir = options?.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), "pleng-dl-"));
  const rawOutputTemplate = path.join(tempDir, "source.%(ext)s");
  const convertedMp3Path = path.join(tempDir, "output.mp3");

  try {
    // 1. Download best audio stream using yt-dlp
    // Use --no-playlist to ensure single song download even if a playlist URL was given
    const ytDlpArgs = [
      "-f",
      "ba/b",
      "--no-playlist",
      "--no-warnings",
      "--no-simulate",
      "--print",
      "after_move:%(title)s",
      "--print",
      "after_move:%(duration)s",
      "-o",
      rawOutputTemplate,
      target,
    ];

    const { stdout } = await execFileAsync(ytDlpPath, ytDlpArgs);
    const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const videoTitle = lines[0] || "Unknown Title";
    let reportedDuration = lines[1] ? parseFloat(lines[1]) : 0;

    // Locate the downloaded raw audio file in tempDir
    const files = fs.readdirSync(tempDir);
    const downloadedFile =
      files.find((f) => f.startsWith("source.") && f !== "output.mp3") ||
      files.find((f) => f !== "output.mp3");
    const rawFilePath = downloadedFile ? path.join(tempDir, downloadedFile) : null;

    if (!rawFilePath || !fs.existsSync(rawFilePath)) {
      throw new Error(`Failed to find downloaded audio file in ${tempDir}. Files present: [${files.join(", ")}]`);
    }

    const inputSource = rawFilePath;

    // 2. Convert to standard MP3 128kbps, 44100Hz, stereo (2 channels)
    // ffmpeg -i input -vn -ar 44100 -ac 2 -b:a 128k -f mp3 output.mp3
    const ffmpegArgs = [
      "-y", // overwrite output
      "-i",
      inputSource,
      "-vn", // strip video
      "-ar",
      "44100", // audio sample rate 44.1kHz
      "-ac",
      "2", // stereo 2 channels
      "-b:a",
      "128k", // bitrate 128 kbps
      "-f",
      "mp3",
      convertedMp3Path,
    ];

    await execFileAsync(ffmpegPath, ffmpegArgs);

    if (!fs.existsSync(convertedMp3Path)) {
      throw new Error(`FFmpeg failed to produce output MP3 at ${convertedMp3Path}`);
    }

    // 3. Determine exact duration
    let exactDuration = await getAudioDurationSec(convertedMp3Path);
    if (!exactDuration || exactDuration <= 0) {
      exactDuration = Math.round(reportedDuration) || 0;
    }

    // 4. Read output buffer
    const buffer = fs.readFileSync(convertedMp3Path);

    // If cleanup requested, remove the raw source file
    if (inputSource && fs.existsSync(inputSource)) {
      try {
        fs.unlinkSync(inputSource);
      } catch {
        // non-critical
      }
    }

    return {
      buffer,
      durationSec: exactDuration,
      tempFilePath: convertedMp3Path,
      title: videoTitle,
    };
  } catch (err: any) {
    // If failure occurs and tempDir was created, attempt cleanup
    if (options?.cleanupTemp !== false) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

/**
 * Cleans up temporary audio files and folder.
 */
export function cleanupTempAudio(filePathOrDir: string): void {
  try {
    if (!fs.existsSync(filePathOrDir)) return;
    const stat = fs.statSync(filePathOrDir);
    if (stat.isDirectory()) {
      fs.rmSync(filePathOrDir, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePathOrDir);
      const parent = path.dirname(filePathOrDir);
      if (parent.includes("pleng-dl-")) {
        fs.rmSync(parent, { recursive: true, force: true });
      }
    }
  } catch {
    // ignore cleanup errors
  }
}
