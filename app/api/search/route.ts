import { hotels } from "@/app/data/hotels";
import { extractIntent } from "@/lib/llm/extractIntent";
import { normalizeIntent } from "@/lib/core/normalize";
import { filterByIntent, isEmptyIntent, type Hotel } from "@/lib/core/filter";
import { rankByIntent } from "@/lib/core/rank";
import { getQueryCache, setQueryCache } from "@/lib/cache/queryCache";
import {
  getIntentCache,
  setIntentCache,
  getCacheStats,
} from "@/lib/cache/intentCache";
import type { Intent, ExtractIntentResult } from "@/types/intent";
import type { IntentCacheData, IntentCacheStats } from "@/types/cache";
import type {
  SearchResponse,
  SearchIntentResult,
  SearchRequestBody,
} from "@/types/search";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as SearchRequestBody;
  const { query } = body;

  const requestStart = performance.now();

  // 1️⃣ Query cache (before LLM)
  const cachedQuery = getQueryCache<SearchResponse>(query);

  if (cachedQuery) {
    const cacheLatency = performance.now() - requestStart;
    return Response.json({
      ...cachedQuery,
      cached: true,
      cache: {
        type: "query",
      },
      usage: {
        extractTokens: 0,
        totalTokens: 0,
      },
      latency: {
        extractMs: 0,
        filterMs: 0,
        totalMs: Math.max(0.1, Math.round(cacheLatency * 10) / 10),
      },
    });
  }

  // 2️⃣ Extract intent
  const extractStart = performance.now();

  const extractionResult: ExtractIntentResult = await extractIntent(query);
  const { intents, tokens: extractTokens } = extractionResult;

  const extractLatency = performance.now() - extractStart;

  // 3️⃣ Filter empty intents
  const validIntents: Intent[] = intents.filter(
    (intent: Intent) => !isEmptyIntent(intent)
  );

  if (validIntents.length === 0) {
    return Response.json({
      query,
      intents,
      results: [],
      finalAnswer:
        "Could not understand the query. Try something like 'Hotels in Goa under 5000'.",
      cached: false,
      cache: {
        type: "none",
      },
      usage: {
        extractTokens,
        totalTokens: extractTokens,
      },
      latency: {
        extractMs: Math.round(extractLatency),
        filterMs: 0,
        totalMs: Math.round(performance.now() - requestStart),
      },
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: "0%",
      },
      meta: {
        totalItems: hotels.length,
        filteredItems: 0,
        sentToLLM: 0,
      },
    });
  }

  let totalFilterLatency = 0;

  // 4️⃣ Process each intent: normalize → cache → filter → rank → store
  const intentResults: SearchIntentResult[] = validIntents.map((intent: Intent) => {
    // a. Normalize intent
    const normalized: Intent = normalizeIntent(intent);

    // b. Check intent cache
    const cachedIntent: IntentCacheData | null = getIntentCache(normalized);
    if (cachedIntent) {
      return {
        intent,
        cached: true,
        data: cachedIntent.results as Hotel[],
        finalAnswer: cachedIntent.finalAnswer,
      };
    }

    // c. Filter + rank
    const filterStart = performance.now();

    let results: Hotel[] = filterByIntent(
      hotels as Hotel[],
      normalized
    );
    results = rankByIntent(results, normalized);

    const filterLatency = performance.now() - filterStart;
    totalFilterLatency += filterLatency;

    // d. Build answer
    const finalAnswer: string =
      results.length > 0
        ? `${results.length} matching hotels in ${
            normalized?.location || "selected location"
          }${normalized?.maxPrice ? ` under ${normalized.maxPrice}` : ""}.`
        : `No results found. Try adjusting filters.`;

    // e. Store in intent cache (if has results)
    if (results.length > 0) {
      setIntentCache(normalized, {
        results: results as unknown[],
        finalAnswer,
      });
    }

    return {
      intent,
      cached: false,
      data: results,
      finalAnswer,
    };
  });

  // 5️⃣ Flatten results
  const results: Hotel[] = intentResults.flatMap((r: SearchIntentResult) => r.data);

  const finalAnswer: string =
    intentResults[0]?.finalAnswer || "No results found. Try adjusting filters.";

  const totalLatency = performance.now() - requestStart;

  const isCached: boolean = intentResults.some((r: SearchIntentResult) => r.cached);

  // 6️⃣ Build response
  const cacheStatsData: IntentCacheStats = getCacheStats();

  const responsePayload: SearchResponse = {
    query,
    intents,
    results,
    finalAnswer,
    cached: isCached,
    cache: {
      type: isCached ? "intent" : "none",
    },
    usage: {
      extractTokens,
      totalTokens: extractTokens,
    },
    latency: {
      extractMs: Math.round(extractLatency),
      filterMs: Math.max(0.1, Math.round(totalFilterLatency * 10) / 10),
      totalMs: Math.round(totalLatency),
    },
    cacheStats: {
      hits: cacheStatsData.hits,
      misses: cacheStatsData.misses,
      hitRate: cacheStatsData.hitRate,
    },
    meta: {
      totalItems: hotels.length,
      filteredItems: results.length,
      sentToLLM: 0,
    },
  };

  // 7️⃣ Store in query cache (after full processing)
  setQueryCache(query, responsePayload);

  return Response.json(responsePayload);
}
