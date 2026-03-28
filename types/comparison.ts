/** Shared UI shape for optimized vs baseline API JSON (demo page). */

export interface ComparisonUsageData {
  totalTokens?: number;
  fullContextProcessingTokens?: number;
  queryUnderstandingTokens?: number;
  responseGenerationTokens?: number;
}

export interface ComparisonLatencyData {
  totalMs?: number;
  extractMs?: number;
  filterMs?: number;
  fullContextProcessingMs?: number;
  queryUnderstandingMs?: number;
  responseGenerationMs?: number;
  cacheHitMs?: number;
}

export interface ComparisonHotelPreview {
  name?: string;
  title?: string;
  price?: number;
  rate?: number;
  currency?: string;
}

export interface ComparisonApiResponse {
  query: string;
  finalAnswer: string;
  results?: ComparisonHotelPreview[];
  usage: ComparisonUsageData;
  latency: ComparisonLatencyData;
  cached?: boolean;
  cache?: {
    type: "query" | "intent" | "none";
  };
  filters?: Record<string, unknown>;
  type?: string;
  source?: string;
  meta?: {
    totalItems?: number;
    filteredItems?: number;
    sentToLLM?: number;
  };
}
