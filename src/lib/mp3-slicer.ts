// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Pure TypeScript MP3 Audio Slicer
// ==========================================

export interface Mp3SliceOptions {
  /** Start offset in seconds (e.g. 15.0 or song hookStartSec) */
  startSec: number;
  /** Slice duration in seconds (e.g. 1.0, 2.0, 5.0) */
  durationSec: number;
}

export interface Mp3FrameInfo {
  offset: number;
  length: number;
  durationSec: number;
  sampleRate: number;
  bitrateKbps: number;
  version: number; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  layer: number;   // 1 = Layer III, 2 = Layer II, 3 = Layer I
  isXing: boolean; // Xing/Info VBR header frame
}

export interface Mp3ParseResult {
  frames: Mp3FrameInfo[];
  audioFrames: Mp3FrameInfo[];
  totalDurationSec: number;
  id3v2Size: number;
  isStandard: boolean;
}

// Bitrates in kbps for Layer III (MP3)
// MPEG-1 Layer III
const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
// MPEG-2 and MPEG-2.5 Layer III
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

// Layer II bitrates
const BITRATES_V1_L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0];
const BITRATES_V2_L2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

// Layer I bitrates
const BITRATES_V1_L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0];
const BITRATES_V2_L1 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0];

// Sample rates in Hz: versionBits => [00, 01, 10, 11]
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000, 0], // MPEG-1
  2: [22050, 24000, 16000, 0], // MPEG-2
  0: [11025, 12000, 8000, 0],  // MPEG-2.5
};

/**
 * Calculates ID3v2 tag size from header (if present).
 */
export function getId3v2Size(buffer: Buffer): number {
  if (
    buffer.length >= 10 &&
    buffer[0] === 0x49 && // 'I'
    buffer[1] === 0x44 && // 'D'
    buffer[2] === 0x33    // '3'
  ) {
    const flags = buffer[5];
    const hasFooter = (flags & 0x10) !== 0;
    // Synchsafe integer (7 bits per byte)
    const bodySize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);

    return 10 + bodySize + (hasFooter ? 10 : 0);
  }
  return 0;
}

/**
 * Parses a single MPEG frame header at the given offset.
 * Returns frame details or null if not a valid MPEG frame header.
 */
export function parseFrameHeader(buffer: Buffer, offset: number): Mp3FrameInfo | null {
  if (offset + 4 > buffer.length) return null;

  // Byte 0: 0xFF (Sync word byte 1)
  if (buffer[offset] !== 0xff) return null;

  // Byte 1: 111BBCCD (Sync word byte 2 upper 3 bits + version + layer + protection)
  const b1 = buffer[offset + 1];
  if ((b1 & 0xe0) !== 0xe0) return null; // Upper 3 bits must be 111

  const versionBits = (b1 >> 3) & 0x03; // 00=MPEG-2.5, 01=reserved, 10=MPEG-2, 11=MPEG-1
  if (versionBits === 1) return null;   // reserved version

  const layerBits = (b1 >> 1) & 0x03;   // 00=reserved, 01=Layer III, 10=Layer II, 11=Layer I
  if (layerBits === 0) return null;     // reserved layer

  // Byte 2: EEEEFFGH (Bitrate index, sample rate index, padding bit, private bit)
  const b2 = buffer[offset + 2];
  const bitrateIndex = (b2 >> 4) & 0x0f;
  if (bitrateIndex === 0 || bitrateIndex === 15) return null; // 0=free, 15=bad

  const sampleRateIndex = (b2 >> 2) & 0x03;
  if (sampleRateIndex === 3) return null; // reserved sample rate

  const paddingBit = (b2 >> 1) & 0x01;

  // Byte 3: IIJJKLMM (Channel mode, mode extension, copyright, original, emphasis)
  const b3 = buffer[offset + 3];
  const channelMode = (b3 >> 6) & 0x03; // 0=stereo, 1=joint stereo, 2=dual mono, 3=single mono

  const sampleRate = SAMPLE_RATES[versionBits]?.[sampleRateIndex] || 0;
  if (sampleRate === 0) return null;

  let bitrateKbps = 0;
  if (layerBits === 1) {
    // Layer III (MP3)
    bitrateKbps = versionBits === 3 ? BITRATES_V1_L3[bitrateIndex] : BITRATES_V2_L3[bitrateIndex];
  } else if (layerBits === 2) {
    // Layer II
    bitrateKbps = versionBits === 3 ? BITRATES_V1_L2[bitrateIndex] : BITRATES_V2_L2[bitrateIndex];
  } else if (layerBits === 3) {
    // Layer I
    bitrateKbps = versionBits === 3 ? BITRATES_V1_L1[bitrateIndex] : BITRATES_V2_L1[bitrateIndex];
  }

  if (bitrateKbps === 0) return null;

  // Frame length calculation
  let frameLength = 0;
  let samplesPerFrame = 0;

  if (layerBits === 1) {
    // Layer III:
    // MPEG-1: 144 * bitrate / sampleRate + padding
    // MPEG-2/2.5: 72 * bitrate / sampleRate + padding
    const coef = versionBits === 3 ? 144 : 72;
    frameLength = Math.floor((coef * bitrateKbps * 1000) / sampleRate) + paddingBit;
    samplesPerFrame = versionBits === 3 ? 1152 : 576;
  } else if (layerBits === 2) {
    // Layer II: 144 * bitrate / sampleRate + padding
    frameLength = Math.floor((144 * bitrateKbps * 1000) / sampleRate) + paddingBit;
    samplesPerFrame = 1152;
  } else if (layerBits === 3) {
    // Layer I: (12 * bitrate / sampleRate + padding) * 4
    frameLength = Math.floor((12 * bitrateKbps * 1000) / sampleRate + paddingBit) * 4;
    samplesPerFrame = 384;
  }

  // Sanity check frame length
  if (frameLength < 4 || offset + frameLength > buffer.length) {
    return null;
  }

  // Detect Xing/Info VBR header tag
  let isXing = false;
  let sideInfoSize = 32;
  if (versionBits === 3) {
    sideInfoSize = channelMode === 3 ? 17 : 32;
  } else {
    sideInfoSize = channelMode === 3 ? 9 : 17;
  }
  const xingOffset = offset + 4 + sideInfoSize;
  if (xingOffset + 4 <= offset + frameLength && xingOffset + 4 <= buffer.length) {
    const magic = buffer.toString("latin1", xingOffset, xingOffset + 4);
    if (magic === "Xing" || magic === "Info") {
      isXing = true;
    }
  }

  const durationSec = samplesPerFrame / sampleRate;

  return {
    offset,
    length: frameLength,
    durationSec,
    sampleRate,
    bitrateKbps,
    version: versionBits,
    layer: layerBits,
    isXing,
  };
}

/**
 * Scans an MP3 buffer and parses all valid MPEG audio frames.
 */
export function parseMp3Frames(buffer: Buffer): Mp3ParseResult {
  const frames: Mp3FrameInfo[] = [];
  const id3v2Size = getId3v2Size(buffer);
  let offset = Math.min(id3v2Size, buffer.length);
  const maxScan = buffer.length - 4;

  while (offset <= maxScan) {
    // Quickly seek to next 0xFF sync candidate
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset++;
      continue;
    }

    const frame = parseFrameHeader(buffer, offset);
    if (!frame) {
      offset++;
      continue;
    }

    // For the initial frame, double-check next frame header to eliminate false sync words in non-audio data
    if (frames.length === 0 && offset + frame.length + 4 <= buffer.length) {
      const nextSyncByte = buffer[offset + frame.length];
      const nextSyncByte2 = buffer[offset + frame.length + 1];
      const looksLikeNextSync = nextSyncByte === 0xff && (nextSyncByte2 & 0xe0) === 0xe0;

      // If next frame header doesn't match sync, skip and keep searching unless it's a Xing frame
      if (!looksLikeNextSync && !frame.isXing) {
        offset++;
        continue;
      }
    }

    frames.push(frame);
    offset += frame.length;
  }

  const audioFrames = frames.filter((f) => !f.isXing);
  const totalDurationSec = audioFrames.reduce((acc, f) => acc + f.durationSec, 0);

  return {
    frames,
    audioFrames,
    totalDurationSec,
    id3v2Size,
    isStandard: audioFrames.length > 0,
  };
}

/**
 * Fallback range slicer for non-standard MP3 streams or corrupted files.
 * Uses estimated bitrate (default 128 kbps) and attempts sync-byte boundary alignment.
 */
function fallbackSlice(buffer: Buffer, options: Mp3SliceOptions): Buffer {
  const id3v2Size = getId3v2Size(buffer);
  const audioDataSize = Math.max(0, buffer.length - id3v2Size);

  // Approximate bytes per second at 128kbps (16,000 bytes/sec)
  const bytesPerSec = 16000;
  const startSec = Math.max(0, options.startSec || 0);
  const durationSec = Math.max(0.1, options.durationSec || 2.0);

  let startByte = id3v2Size + Math.floor(startSec * bytesPerSec);
  const lengthBytes = Math.floor(durationSec * bytesPerSec);

  // Clamp within bounds
  if (startByte >= buffer.length) {
    startByte = Math.max(id3v2Size, buffer.length - lengthBytes);
  }
  startByte = Math.max(id3v2Size, Math.min(startByte, buffer.length));

  // Align startByte to nearest 0xFF within a small search window
  const searchWindow = Math.min(1024, buffer.length - startByte);
  for (let i = 0; i < searchWindow; i++) {
    const pos = startByte + i;
    if (pos + 1 < buffer.length && buffer[pos] === 0xff && (buffer[pos + 1] & 0xe0) === 0xe0) {
      startByte = pos;
      break;
    }
  }

  const endByte = Math.min(buffer.length, startByte + lengthBytes);
  return buffer.subarray(startByte, endByte);
}

/**
 * Lightweight pure Node.js/TypeScript MP3 slicer:
 * Given a full MP3 Buffer and { startSec, durationSec }, slices exact MPEG audio frames
 * with proper frame alignment so any browser or Web Audio API can decode it cleanly without pop noise.
 *
 * Falls back to range slicing if frame parsing encounters non-standard or corrupted streams.
 */
export function sliceMp3Buffer(buffer: Buffer, options: Mp3SliceOptions): Buffer {
  if (!buffer || buffer.length === 0) {
    return Buffer.alloc(0);
  }

  const parseResult = parseMp3Frames(buffer);

  // If no audio frames could be parsed, fallback to byte-range slice
  if (!parseResult.isStandard || parseResult.audioFrames.length === 0) {
    return fallbackSlice(buffer, options);
  }

  const { audioFrames, totalDurationSec } = parseResult;
  let startSec = Math.max(0, options.startSec || 0);
  const durationSec = Math.max(0.1, options.durationSec || 2.0);

  // If startSec exceeds total duration, clamp to the tail end of the song
  if (totalDurationSec > 0 && startSec >= totalDurationSec) {
    startSec = Math.max(0, totalDurationSec - durationSec);
  }

  const targetEndSec = startSec + durationSec;

  let currentTime = 0;
  const selectedBuffers: Buffer[] = [];
  let accumulatedDuration = 0;

  for (const frame of audioFrames) {
    const frameStart = currentTime;
    const frameEnd = currentTime + frame.durationSec;
    currentTime = frameEnd;

    // Collect frames that overlap with [startSec, targetEndSec]
    if (frameEnd > startSec && frameStart < targetEndSec) {
      selectedBuffers.push(buffer.subarray(frame.offset, frame.offset + frame.length));
      accumulatedDuration += frame.durationSec;
    }

    if (frameStart >= targetEndSec && accumulatedDuration >= durationSec) {
      break;
    }
  }

  // If for any reason no frames matched, fallback
  if (selectedBuffers.length === 0) {
    return fallbackSlice(buffer, options);
  }

  return Buffer.concat(selectedBuffers);
}

/**
 * Returns the total duration in seconds of an MP3 Buffer by summing parsed audio frames.
 */
export function getMp3Duration(buffer: Buffer): number {
  const result = parseMp3Frames(buffer);
  return result.totalDurationSec;
}
