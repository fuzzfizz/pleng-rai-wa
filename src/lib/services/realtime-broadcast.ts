// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Realtime Broadcast Service
// Helper to broadcast game events to Supabase Realtime & in-process event bus
// ==========================================

export type RealtimeListener = (event: string, payload: any) => void;

// In-process event bus for local dev and integration test verification
const globalForRealtime = globalThis as unknown as {
  __realtimeListeners?: Map<string, Set<RealtimeListener>>;
};
const localListeners =
  globalForRealtime.__realtimeListeners ?? new Map<string, Set<RealtimeListener>>();
globalForRealtime.__realtimeListeners = localListeners;

export class RealtimeBroadcastService {
  /**
   * Normalizes channel name to 'room:CODE'
   */
  static getChannelName(codeOrChannel: string): string {
    const trimmed = (codeOrChannel || "").trim();
    if (trimmed.toUpperCase().startsWith("ROOM:")) {
      return `room:${trimmed.slice(5).trim().toUpperCase()}`;
    }
    return `room:${trimmed.toUpperCase()}`;
  }

  /**
   * Subscribes a local in-process listener for testing and development.
   * Returns an unsubscribe function.
   */
  static subscribe(
    codeOrChannel: string,
    listener: RealtimeListener
  ): () => void {
    const channel = this.getChannelName(codeOrChannel);
    let set = localListeners.get(channel);
    if (!set) {
      set = new Set();
      localListeners.set(channel, set);
    }
    set.add(listener);

    return () => {
      const currentSet = localListeners.get(channel);
      if (currentSet) {
        currentSet.delete(listener);
        if (currentSet.size === 0) {
          localListeners.delete(channel);
        }
      }
    };
  }

  /**
   * Alias for subscribe.
   */
  static on(codeOrChannel: string, listener: RealtimeListener): () => void {
    return this.subscribe(codeOrChannel, listener);
  }

  /**
   * Broadcasts an event to channel `room:${cleanCode}`.
   * Emits to local listeners immediately and attempts to send to Supabase Realtime REST API.
   * Gracefully catches any errors (offline / mock fallback).
   */
  static async broadcast(
    codeOrChannel: string,
    event: string,
    payload: any
  ): Promise<boolean> {
    const channel = this.getChannelName(codeOrChannel);

    // 1. Emit to in-process subscribers
    const listeners = localListeners.get(channel);
    if (listeners && listeners.size > 0) {
      for (const listener of listeners) {
        try {
          listener(event, payload);
        } catch (e) {
          console.error(
            `[realtime-broadcast] Error in local listener for ${channel}/${event}:`,
            e
          );
        }
      }
    }

    // 2. Send to Supabase Realtime REST API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !apiKey || supabaseUrl.includes("placeholder-project")) {
      // Running offline or in mock test environment without live Supabase
      return true;
    }

    try {
      const endpoint = `${supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: channel,
              event,
              payload,
            },
          ],
        }),
        signal: AbortSignal.timeout(3000), // 3s timeout
      });

      if (!response.ok) {
        console.warn(
          `[realtime-broadcast] REST API returned ${response.status} for ${channel}/${event}`
        );
        return false;
      }

      return true;
    } catch (err: any) {
      // Gracefully catch network / connection errors
      console.warn(
        `[realtime-broadcast] Broadcast failed for ${channel}/${event}: ${err?.message || err}`
      );
      return false;
    }
  }

  /**
   * Clears all local listeners (useful for test resets).
   */
  static clearAllListeners(): void {
    localListeners.clear();
  }
}
