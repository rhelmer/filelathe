/**
 * Minimal KV surface compatible with Cloudflare Workers KV bindings.
 * Local dev uses MemoryKv; production binds RATE_LIMIT_KV.
 */

export type KvPutOptions = {
  expirationTtl?: number;
};

export type KvLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KvPutOptions): Promise<void>;
};

/** In-process KV for the Node/Vite dev server (and tests). */
export function createMemoryKv(): KvLike {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  function purgeExpired(key: string) {
    const entry = store.get(key);
    if (!entry) return;
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      store.delete(key);
    }
  }

  return {
    async get(key) {
      purgeExpired(key);
      return store.get(key)?.value ?? null;
    },
    async put(key, value, options) {
      const ttlSec = options?.expirationTtl;
      const expiresAt =
        typeof ttlSec === "number" && ttlSec > 0
          ? Date.now() + ttlSec * 1000
          : null;
      store.set(key, { value, expiresAt });
    },
  };
}
