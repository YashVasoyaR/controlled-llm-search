import type { CacheEntry } from "@/types/cache";

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const queryCache = new Map<string, CacheEntry<unknown>>();

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExpired(timestamp: number, ttl: number = CACHE_TTL): boolean {
  return Date.now() - timestamp >= ttl;
}

export function getQueryCache<T>(query: string): T | null {
  const key = normalizeQuery(query);
  const entry = queryCache.get(key);

  if (!entry) return null;

  if (isExpired(entry.timestamp)) {
    queryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setQueryCache<T>(query: string, data: T): void {
  const key = normalizeQuery(query);
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearQueryCache(): void {
  queryCache.clear();
}
