const store = new Map<string, { data: unknown; expires: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;

export function getCached(key: string): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key: string, data: unknown): void {
  if (store.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (v.expires < now) store.delete(k);
      if (store.size < MAX_ENTRIES) break;
    }
  }
  store.set(key, { data, expires: Date.now() + TTL_MS });
}

export function invalidateProfilesCache(): void {
  for (const key of store.keys()) {
    if (key.startsWith("profiles:")) store.delete(key);
  }
}
