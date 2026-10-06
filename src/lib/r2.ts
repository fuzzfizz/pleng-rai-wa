import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

// ==========================================
// Cloudflare R2 Client & Audio Storage Helper
// ==========================================

let s3ClientInstance: S3Client | null = null;

/**
 * Returns a configured S3Client instance targeting Cloudflare R2.
 */
export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    const accountId =
      process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId =
      process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";

    if (!accountId) {
      console.warn("[Cloudflare R2] Warning: R2_ACCOUNT_ID or CLOUDFLARE_R2_ACCOUNT_ID is not defined.");
    }

    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Uploads an audio buffer to Cloudflare R2.
 * @param buffer - Audio file Buffer
 * @param key - Storage path / key (e.g. `songs/${songId}.mp3` or `${songId}.mp3`)
 * @param contentType - MIME type (defaults to 'audio/mpeg')
 * @returns Public URL or stream URL for the uploaded audio
 */
export async function uploadAudioToR2(
  buffer: Buffer,
  key: string,
  contentType: string = "audio/mpeg"
): Promise<string> {
  const client = getR2Client();
  const bucketName =
    process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || "pleng-rai-wa-audio";

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  // If a public R2 domain or dev URL is configured (e.g. https://pub-xxx.r2.dev or custom cdn)
  const publicUrlBase = (
    process.env.R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL
  )?.replace(/\/+$/, "");
  if (publicUrlBase) {
    return `${publicUrlBase}/${key}`;
  }

  // Fallback to internal audio stream endpoint
  return `/api/audio/stream?key=${encodeURIComponent(key)}`;
}

/**
 * Deletes an audio file from Cloudflare R2.
 * @param key - Storage path / key
 */
export async function deleteAudioFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "pleng-rai-wa-audio";

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
}

export interface R2AudioStreamResult {
  stream: Readable | ReadableStream;
  contentLength?: number;
  contentRange?: string;
  contentType?: string;
  acceptRanges?: string;
  status: number;
  rawResponse: GetObjectCommandOutput;
}

/**
 * Fetches an audio stream from Cloudflare R2, with optional HTTP Range header support.
 * @param key - Storage path / key
 * @param range - Optional HTTP Range header string (e.g. `bytes=0-1048575`)
 */
export async function getAudioStreamFromR2(
  key: string,
  range?: string
): Promise<R2AudioStreamResult> {
  const client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "pleng-rai-wa-audio";

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    Range: range,
  });

  const response = await client.send(command);

  const status = range ? 206 : (response.$metadata.httpStatusCode || 200);

  return {
    stream: response.Body as unknown as (Readable | ReadableStream),
    contentLength: response.ContentLength,
    contentRange: response.ContentRange,
    contentType: response.ContentType || "audio/mpeg",
    acceptRanges: response.AcceptRanges || "bytes",
    status,
    rawResponse: response,
  };
}

/**
 * Checks if an audio file exists in Cloudflare R2 and retrieves its metadata.
 * @param key - Storage path / key
 */
export async function getAudioMetadataFromR2(key: string) {
  const client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "pleng-rai-wa-audio";

  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await client.send(command);
}
