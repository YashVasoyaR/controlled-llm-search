import type { Intent } from "@/types/intent";
import type {
  CacheEntry,
  IntentCacheData,
  IntentCacheStats,
} from "@/types/cache";

export type { IntentCacheData };

export const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
export const MAX_CACHE_SIZE = 100;

const cache = new Map<string, CacheEntry<IntentCacheData>>();

let cacheHits = 0;
let cacheMisses = 0;

export function getCacheKey(intent: Intent): string {
  const sorted = Object.keys(intent)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = intent[key as keyof Intent];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

function isExpired(timestamp: number, ttl: number = CACHE_TTL): boolean {
  return Date.now() - timestamp >= ttl;
}

export function getIntentCache(normalizedIntent: Intent): IntentCacheData | null {
  const key = getCacheKey(normalizedIntent);
  const entry = cache.get(key);

  if (!entry) {
    cacheMisses++;
    return null;
  }

  if (isExpired(entry.timestamp)) {
    cache.delete(key);
    cacheMisses++;
    return null;
  }

  cacheHits++;
  return entry.data;
}

export function setIntentCache(
  normalizedIntent: Intent,
  data: IntentCacheData
): void {
  const key = getCacheKey(normalizedIntent);

  // LRU eviction: if cache is at capacity, remove oldest entry
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function getCacheStats(): IntentCacheStats {
  const totalRequests = cacheHits + cacheMisses;
  const hitRate =
    totalRequests === 0 ? 0 : Math.round((cacheHits / totalRequests) * 100);

  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: `${hitRate}%`,
  };
}

export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

export function clearIntentCache(): void {
  cache.clear();
  resetCacheStats();
}
