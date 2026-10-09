// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Serverless Redis Service
// Optional Upstash Redis integration with Graceful Fallback
// Provides atomic FCFS buzzer locking (SET NX EX) and distributed round caching
// ==========================================

import { Redis } from "@upstash/redis";

export interface BuzzerHolder {
  playerId: string;
  displayName: string;
  buzzedAt: string;
  deadline: string;
}

export interface AcquireBuzzerLockResult {
  acquired: boolean;
  isRedisActive: boolean;
  holder?: BuzzerHolder;
}

let redisClient: Redis | null = null;
let isInitialized = false;

/**
 * Resolves the Upstash Redis client if environment variables are configured.
 * Returns null if not configured, allowing callers to gracefully fallback to Supabase / In-Memory.
 */
export function getRedisClient(): Redis | null {
  if (isInitialized) {
    return redisClient;
  }

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (url && token && url.trim().length > 0 && token.trim().length > 0) {
    try {
      redisClient = new Redis({
        url: url.trim(),
        token: token.trim(),
      });
    } catch (err) {
      console.warn("[RedisService] Failed to initialize Upstash Redis client:", err);
      redisClient = null;
    }
  } else {
    redisClient = null;
  }

  isInitialized = true;
  return redisClient;
}

/**
 * Resets the cached Redis client (useful for unit testing with mocked env vars).
 */
export function resetRedisClient(): void {
  redisClient = null;
  isInitialized = false;
}

/**
 * Checks whether Redis is configured and active in the current environment.
 */
export function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}

export class RedisService {
  static isRedisAvailable = isRedisAvailable;
  static getRedisClient = getRedisClient;

  private static getBuzzerKey(code: string): string {
    return `pleng:room:${code.trim().toUpperCase()}:buzzer`;
  }

  private static getRoundStateKey(code: string): string {
    return `pleng:room:${code.trim().toUpperCase()}:round_state`;
  }

  /**
   * Attempts an atomic First-Come-First-Serve buzzer lock using Redis `SET key value NX EX ttl`.
   * Returns:
   * - acquired: true if lock was successfully obtained
   * - acquired: false + current holder info if another player got there first
   * - isRedisActive: false if Redis is not configured (gracefully proceed with database/memory)
   */
  static async acquireBuzzerLock(
    roomCode: string,
    playerId: string,
    displayName: string,
    ttlSec: number = 10
  ): Promise<AcquireBuzzerLockResult> {
    const client = getRedisClient();
    if (!client) {
      return { acquired: false, isRedisActive: false };
    }

    try {
      const key = this.getBuzzerKey(roomCode);
      const now = new Date();
      const deadline = new Date(now.getTime() + ttlSec * 1000);

      const holder: BuzzerHolder = {
        playerId,
        displayName,
        buzzedAt: now.toISOString(),
        deadline: deadline.toISOString(),
      };

      // Atomic SET IF NOT EXISTS with TTL in seconds
      const result = await client.set(key, JSON.stringify(holder), {
        nx: true,
        ex: ttlSec,
      });

      if (result === "OK" || (result as unknown) === 1) {
        return {
          acquired: true,
          isRedisActive: true,
          holder,
        };
      }

      // Lock already held by someone else, fetch current holder
      const rawCurrent = await client.get<string | BuzzerHolder>(key);
      let currentHolder: BuzzerHolder | undefined = undefined;
      if (rawCurrent) {
        currentHolder =
          typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
      }

      return {
        acquired: false,
        isRedisActive: true,
        holder: currentHolder,
      };
    } catch (error) {
      console.warn("[RedisService] acquireBuzzerLock error, falling back to database:", error);
      return { acquired: false, isRedisActive: false };
    }
  }

  /**
   * Retrieves current active buzzer holder from Redis.
   */
  static async getBuzzerLock(roomCode: string): Promise<BuzzerHolder | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const key = this.getBuzzerKey(roomCode);
      const data = await client.get<string | BuzzerHolder>(key);
      if (!data) return null;
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.warn("[RedisService] getBuzzerLock error:", error);
      return null;
    }
  }

  /**
   * Releases buzzer lock in Redis (e.g. after answering, timing out, or skipping).
   */
  static async releaseBuzzerLock(roomCode: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const key = this.getBuzzerKey(roomCode);
      await client.del(key);
      return true;
    } catch (error) {
      console.warn("[RedisService] releaseBuzzerLock error:", error);
      return false;
    }
  }

  /**
   * Caches active round state in Redis with automatic TTL expiration (default 10 minutes).
   */
  static async saveRoundState(
    roomCode: string,
    roundState: any,
    ttlSec: number = 600
  ): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const key = this.getRoundStateKey(roomCode);
      await client.set(key, JSON.stringify(roundState), { ex: ttlSec });
      return true;
    } catch (error) {
      console.warn("[RedisService] saveRoundState error:", error);
      return false;
    }
  }

  /**
   * Retrieves cached active round state from Redis.
   */
  static async getRoundState(roomCode: string): Promise<any | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const key = this.getRoundStateKey(roomCode);
      const data = await client.get<string | any>(key);
      if (!data) return null;
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.warn("[RedisService] getRoundState error:", error);
      return null;
    }
  }

  /**
   * Removes all Redis keys associated with a room code upon room leave or deletion.
   */
  static async deleteRoom(roomCode: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const buzzerKey = this.getBuzzerKey(roomCode);
      const roundKey = this.getRoundStateKey(roomCode);
      await client.del(buzzerKey, roundKey);
      return true;
    } catch (error) {
      console.warn("[RedisService] deleteRoom error:", error);
      return false;
    }
  }
}
