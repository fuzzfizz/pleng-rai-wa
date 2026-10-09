import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RedisService,
  isRedisAvailable,
  resetRedisClient,
  getRedisClient,
} from "../services/redis-service";
import { Redis } from "@upstash/redis";

vi.mock("@upstash/redis", () => {
  class MockRedis {
    set = vi.fn();
    get = vi.fn();
    del = vi.fn();
  }
  return { Redis: MockRedis };
});

describe("RedisService & Graceful Fallback Architecture", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.REDIS_REST_URL;
    delete process.env.REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    resetRedisClient();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetRedisClient();
  });

  describe("Scenario 1: Redis is NOT configured (Default Graceful Fallback)", () => {
    it("reports isRedisAvailable as false without crashing", () => {
      expect(isRedisAvailable()).toBe(false);
      expect(getRedisClient()).toBeNull();
    });

    it("returns acquired: false and isRedisActive: false on acquireBuzzerLock", async () => {
      const result = await RedisService.acquireBuzzerLock(
        "TEST12",
        "player-1",
        "Player One"
      );
      expect(result.acquired).toBe(false);
      expect(result.isRedisActive).toBe(false);
      expect(result.holder).toBeUndefined();
    });

    it("returns null on getBuzzerLock when Redis is inactive", async () => {
      const lock = await RedisService.getBuzzerLock("TEST12");
      expect(lock).toBeNull();
    });

    it("returns false on releaseBuzzerLock when Redis is inactive", async () => {
      const released = await RedisService.releaseBuzzerLock("TEST12");
      expect(released).toBe(false);
    });

    it("returns false / null on saveRoundState and getRoundState when Redis is inactive", async () => {
      const saved = await RedisService.saveRoundState("TEST12", { round: 1 });
      expect(saved).toBe(false);

      const state = await RedisService.getRoundState("TEST12");
      expect(state).toBeNull();
    });

    it("returns false on deleteRoom when Redis is inactive", async () => {
      const deleted = await RedisService.deleteRoom("TEST12");
      expect(deleted).toBe(false);
    });
  });

  describe("Scenario 2: Redis IS configured (Active Serverless Mode)", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://upstash-mock.com";
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-secret-token";
      resetRedisClient();
    });

    it("initializes Redis client and reports isRedisAvailable as true", () => {
      expect(isRedisAvailable()).toBe(true);
      expect(getRedisClient()).not.toBeNull();
    });

    it("successfully acquires buzzer lock on first request", async () => {
      const client = getRedisClient()!;
      (client.set as any).mockResolvedValue("OK");

      const result = await RedisService.acquireBuzzerLock(
        "TEST99",
        "player-1",
        "คนมือกดไว"
      );

      expect(result.acquired).toBe(true);
      expect(result.isRedisActive).toBe(true);
      expect(result.holder?.playerId).toBe("player-1");
      expect(result.holder?.displayName).toBe("คนมือกดไว");
      expect(client.set).toHaveBeenCalledWith(
        "pleng:room:TEST99:buzzer",
        expect.any(String),
        { nx: true, ex: 10 }
      );
    });

    it("rejects lock acquisition and returns current holder when already locked", async () => {
      const client = getRedisClient()!;
      (client.set as any).mockResolvedValue(null); // SET NX returned null -> lock already exists
      const existingHolder = {
        playerId: "first-player",
        displayName: "First Winner",
        buzzedAt: new Date().toISOString(),
        deadline: new Date().toISOString(),
      };
      (client.get as any).mockResolvedValue(JSON.stringify(existingHolder));

      const result = await RedisService.acquireBuzzerLock(
        "TEST99",
        "second-player",
        "Second Player"
      );

      expect(result.acquired).toBe(false);
      expect(result.isRedisActive).toBe(true);
      expect(result.holder?.playerId).toBe("first-player");
      expect(result.holder?.displayName).toBe("First Winner");
    });

    it("releases buzzer lock using DEL", async () => {
      const client = getRedisClient()!;
      (client.del as any).mockResolvedValue(1);

      const success = await RedisService.releaseBuzzerLock("TEST99");
      expect(success).toBe(true);
      expect(client.del).toHaveBeenCalledWith("pleng:room:TEST99:buzzer");
    });

    it("saves and retrieves round state with TTL", async () => {
      const client = getRedisClient()!;
      (client.set as any).mockResolvedValue("OK");
      const sampleState = { currentRound: 2, roundStatus: "question_active" };
      (client.get as any).mockResolvedValue(JSON.stringify(sampleState));

      const saved = await RedisService.saveRoundState("TEST99", sampleState, 600);
      expect(saved).toBe(true);
      expect(client.set).toHaveBeenCalledWith(
        "pleng:room:TEST99:round_state",
        JSON.stringify(sampleState),
        { ex: 600 }
      );

      const retrieved = await RedisService.getRoundState("TEST99");
      expect(retrieved).toEqual(sampleState);
    });

    it("deletes all room keys upon room dissolution", async () => {
      const client = getRedisClient()!;
      (client.del as any).mockResolvedValue(2);

      const deleted = await RedisService.deleteRoom("TEST99");
      expect(deleted).toBe(true);
      expect(client.del).toHaveBeenCalledWith(
        "pleng:room:TEST99:buzzer",
        "pleng:room:TEST99:round_state"
      );
    });

    it("catches Redis network exceptions and returns fallback gracefully without throwing", async () => {
      const client = getRedisClient()!;
      (client.set as any).mockRejectedValue(new Error("Connection timeout / rate limited"));

      const result = await RedisService.acquireBuzzerLock(
        "TEST99",
        "player-error",
        "Player Error"
      );

      expect(result.acquired).toBe(false);
      expect(result.isRedisActive).toBe(false);
    });
  });
});
