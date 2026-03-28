export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface IntentCacheData {
  results: unknown[];
  finalAnswer: string;
}

export interface IntentCacheStats {
  hits: number;
  misses: number;
  hitRate: string;
}
