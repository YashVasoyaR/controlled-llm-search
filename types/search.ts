import type { Intent } from "@/types/intent";
import type { Hotel } from "@/types/hotel";
import type { IntentCacheStats } from "@/types/cache";

export interface SearchLatencyMetrics {
  extractMs: number;
  filterMs: number;
  totalMs: number;
}

export interface SearchUsageMetrics {
  extractTokens: number;
  totalTokens: number;
}

export interface SearchResponseCache {
  type: "query" | "intent" | "none";
}

export interface SearchMeta {
  totalItems: number;
  filteredItems: number;
  sentToLLM: number;
}

export interface SearchResponse {
  query: string;
  intents: Intent[];
  results: Hotel[];
  finalAnswer: string;
  cached: boolean;
  cache: SearchResponseCache;
  usage: SearchUsageMetrics;
  latency: SearchLatencyMetrics;
  cacheStats: IntentCacheStats;
  meta: SearchMeta;
}

export interface SearchIntentResult {
  intent: Intent;
  cached: boolean;
  data: Hotel[];
  finalAnswer: string;
}

export interface SearchRequestBody {
  query: string;
}
