import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

describe("GET /api/tts", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 400 when text query param is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/tts");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Text parameter is required");
  });

  it("returns 400 when text query param is empty whitespace", async () => {
    const req = new NextRequest("http://localhost:3000/api/tts?text=%20%20%20");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Text parameter is required");
  });

  it("returns 400 when text query param exceeds 1000 characters", async () => {
    const longText = "a".repeat(1001);
    const req = new NextRequest(`http://localhost:3000/api/tts?text=${longText}`);
    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("1000 characters");
  });

  it("successfully proxies audio from Google Translate TTS with correct headers", async () => {
    const mockAudioBytes = new Uint8Array([1, 2, 3, 4, 5]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(mockAudioBytes.buffer),
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/tts?text=%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B9%83%E0%B8%88&lang=th-TH&gender=female"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800"
    );

    const buffer = await res.arrayBuffer();
    expect(new Uint8Array(buffer)).toEqual(mockAudioBytes);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = (globalThis.fetch as any).mock.calls[0];
    expect(fetchUrl).toContain("https://translate.google.com/translate_tts");
    expect(fetchUrl).toContain("tl=th");
    expect(fetchUrl).toContain("client=tw-ob");
    expect(fetchUrl).toContain("q=%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B9%83%E0%B8%88");
    expect(fetchOptions.headers["User-Agent"]).toContain("Mozilla/5.0");
  });

  it("handles upstream Google TTS failure gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/tts?text=%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B9%83%E0%B8%88");
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Google TTS request failed");
  });
});
