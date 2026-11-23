import type { ServerResponse } from "node:http";
import type { Redis } from "ioredis";

export type PubSubMessageListener = (message: string) => void;

/**
 * Shared O(1) Redis Pub/Sub multiplexer for SSE streams.
 * Prevents per-client `redis.duplicate()` connection exhaustion and guarantees
 * deterministic stream draining on Fastify shutdown.
 */
export class RedisPubSubHub {
  private subscriber: Redis | null = null;
  private readonly channels = new Map<string, Set<PubSubMessageListener>>();
  private readonly activeStreams = new Set<ServerResponse>();
  private closed = false;

  constructor(private readonly baseRedis: Redis) {}

  private ensureSubscriber(): Redis {
    if (this.subscriber) {
      return this.subscriber;
    }
    const sub = this.baseRedis.duplicate({
      commandTimeout: undefined,
      maxRetriesPerRequest: null,
    });
    sub.on("error", () => undefined);
    sub.on("message", (channel, message) => {
      const listeners = this.channels.get(channel);
      if (!listeners || listeners.size === 0) return;
      for (const listener of listeners) {
        try {
          listener(message);
        } catch {
          // Isolate per-stream errors so one broken SSE client never stalls others.
        }
      }
    });
    this.subscriber = sub;
    return sub;
  }

  trackStream(res: ServerResponse): () => void {
    this.activeStreams.add(res);
    return () => {
      this.activeStreams.delete(res);
    };
  }

  async subscribe(
    channel: string,
    listener: PubSubMessageListener,
  ): Promise<() => void> {
    if (this.closed) {
      return () => undefined;
    }

    let listeners = this.channels.get(channel);
    const isFirstForChannel = !listeners || listeners.size === 0;
    if (!listeners) {
      listeners = new Set();
      this.channels.set(channel, listeners);
    }
    listeners.add(listener);

    if (isFirstForChannel) {
      const sub = this.ensureSubscriber();
      try {
        await sub.subscribe(channel);
      } catch (err) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.channels.delete(channel);
        }
        throw err;
      }
    }

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const set = this.channels.get(channel);
      if (!set) return;
      set.delete(listener);
      if (set.size === 0) {
        this.channels.delete(channel);
        if (this.subscriber && !this.closed) {
          void this.subscriber.unsubscribe(channel).catch(() => undefined);
        }
      }
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const stream of this.activeStreams) {
      try {
        if (!stream.writableEnded) {
          stream.end();
        }
      } catch {
        // Best-effort drain on shutdown
      }
    }
    this.activeStreams.clear();
    this.channels.clear();
    if (this.subscriber) {
      const sub = this.subscriber;
      this.subscriber = null;
      await sub.quit().catch(() => {
        sub.disconnect();
      });
    }
  }
}

const HUBS = new WeakMap<Redis, RedisPubSubHub>();

export function getRedisPubSubHub(redis: Redis): RedisPubSubHub {
  let hub = HUBS.get(redis);
  if (!hub) {
    hub = new RedisPubSubHub(redis);
    HUBS.set(redis, hub);
  }
  return hub;
}

export async function closeRedisPubSubHub(redis: Redis): Promise<void> {
  const hub = HUBS.get(redis);
  if (hub) {
    HUBS.delete(redis);
    await hub.close();
  }
}
