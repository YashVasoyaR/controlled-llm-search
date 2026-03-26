import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";
import { z } from "zod";

const queryCache = new Map();

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const IntentSchema = z.array(
  z.object({
    type: z.literal("hotel").default("hotel"),
    location: z.string().nullable(),
    maxPrice: z.number().nullable(),
    amenities: z.array(z.string()).default([]),
  }),
);

function safeParseIntent(raw) {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return IntentSchema.parse(parsed);
  } catch (err) {
    return null;
  }
}

// 🔥 Memory setup
const locationMemory = new Map(); // self-learning map

// 🔥 Cache setup
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5;
const MAX_CACHE_SIZE = 100;

let cacheHits = 0;
let cacheMisses = 0;

function cleanLocation(location) {
  if (!location) return null;

  return location
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\b(india|city|area|region|state|country)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilar(a, b) {
  if (!a || !b) return false;

  if (a === b) return true;

  // partial match
  if (a.includes(b) || b.includes(a)) return true;

  // word overlap
  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));

  const common = [...aWords].filter((w) => bWords.has(w));

  return common.length >= Math.min(aWords.size, bWords.size);
}

function normalizeLocation(location) {
  if (!location) return null;

  const cleaned = cleanLocation(location);

  // 1. direct memory hit
  if (locationMemory.has(cleaned)) {
    return locationMemory.get(cleaned);
  }

  // 2. similarity match with existing keys
  for (let [known, canonical] of locationMemory.entries()) {
    if (isSimilar(cleaned, known)) {
      return canonical;
    }
  }

  // 3. fallback → use cleaned as canonical
  locationMemory.set(cleaned, cleaned);

  return cleaned;
}

function learnLocation(original, normalized) {
  const cleaned = cleanLocation(original);

  if (!locationMemory.has(cleaned)) {
    locationMemory.set(cleaned, normalized);
  }
}

// ✅ STRONG normalization (FIXED)
function normalizeIntent(intent) {
  const normalizedLocation = normalizeLocation(intent.location);

  // learn mapping
  learnLocation(intent.location, normalizedLocation);

  return {
    type: intent.type || "hotel",
    location: normalizedLocation,
    maxPrice: intent.maxPrice || null,
    amenities: (intent.amenities || [])
      .map((a) => a.toLowerCase().trim())
      .sort(),
  };
}

// ✅ Stable cache key
function getCacheKey(intent) {
  return JSON.stringify(
    Object.keys(intent)
      .sort()
      .reduce((acc, key) => {
        acc[key] = intent[key];
        return acc;
      }, {}),
  );
}

// ✅ Filtering
function handleIntent(intent) {
  if (intent.type === "hotel") {
    return hotels.filter((hotel) => {
      if (
        intent.location &&
        !hotel.location.toLowerCase().includes(intent.location)
      )
        return false;

      if (intent.maxPrice && hotel.price > intent.maxPrice) return false;

      if (
        intent.amenities.length &&
        !intent.amenities.every((a) =>
          hotel.amenities.map((x) => x.toLowerCase()).includes(a),
        )
      ) {
        return false;
      }

      return true;
    });
  }

  return [];
}

// ✅ Ranking
function rankResults(results, intent) {
  return results.sort((a, b) => {
    // 🔥 1. Amenity priority (hard signal)
    if (intent.amenities.length) {
      const aMatch = intent.amenities.every((am) =>
        a.amenities.map((x) => x.toLowerCase()).includes(am),
      );
      const bMatch = intent.amenities.every((am) =>
        b.amenities.map((x) => x.toLowerCase()).includes(am),
      );

      if (aMatch !== bMatch) return bMatch - aMatch;
    }

    // 🔥 2. Price closeness
    if (intent.maxPrice) {
      const aDiff = Math.abs(intent.maxPrice - a.price);
      const bDiff = Math.abs(intent.maxPrice - b.price);

      if (aDiff !== bDiff) return aDiff - bDiff;
    }

    // 🔥 3. Location match (safety)
    if (intent.location) {
      const aLoc = a.location.toLowerCase().includes(intent.location);
      const bLoc = b.location.toLowerCase().includes(intent.location);

      if (aLoc !== bLoc) return bLoc - aLoc;
    }

    return 0;
  });
}

function isEmptyIntent(intent) {
  return (
    !intent.location &&
    !intent.maxPrice &&
    (!intent.amenities || intent.amenities.length === 0)
  );
}

async function extractIntentWithRetry(query, maxRetries = 2) {
  let lastRaw = null;
  let totalTokens = 0;

  for (let i = 0; i <= maxRetries; i++) {

    const response = await client.chat.completions.create({
      model: "openai/gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `
Return ONLY valid JSON array.
No explanation. No markdown.

Rules:
- Must return at least ONE intent
- location should be extracted if present
- amenities should not be empty if mentioned

Format:
[
  {
    "type": "hotel",
    "location": string | null,
    "maxPrice": number | null,
    "amenities": string[]
  }
]
          `,
        },
        { role: "user", content: query },
      ],
    });

    totalTokens += response.usage?.total_tokens || 0;

    const raw = response.choices[0].message.content;

    lastRaw = raw;

    const parsed = safeParseIntent(raw);

    // 🔥 STRICT semantic validation (THIS WAS MISSING)
    const isValid =
      parsed &&
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.some(
        (i) =>
          i.location !== null ||
          i.maxPrice !== null ||
          (i.amenities && i.amenities.length > 0),
      );

    if (isValid) {
      return {
        intents: parsed,
        tokens: totalTokens,
        retries: i,
      };
    }
  }

  // 🔥 SMART FALLBACK (never return useless intent)
  const fallback = fallbackIntentFromQuery(query);

  return {
    intents: [fallback],
    tokens: totalTokens,
    retries: maxRetries,
    error: "LLM failed → fallback used",
    raw: lastRaw,
  };
}

function fallbackIntentFromQuery(query) {
  const lower = query.toLowerCase();

  let location = null;

  if (lower.includes("goa")) location = "goa";
  else if (lower.includes("mumbai")) location = "mumbai";
  else if (lower.includes("delhi")) location = "delhi";
  else if (lower.includes("manali")) location = "manali";

  return {
    type: "hotel",
    location,
    maxPrice: null,
    amenities: [],
  };
}

export async function POST(req) {
  const { query } = await req.json();

  const requestStart = performance.now();

  // 🔥 Normalize query (important)
  const queryKey = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 🔥 QUERY CACHE (before LLM)
  const cachedQuery = queryCache.get(queryKey);

  if (cachedQuery && Date.now() - cachedQuery.timestamp < CACHE_TTL) {
    const cacheLatency = Math.max(3, performance.now() - requestStart);
    return Response.json({
      ...cachedQuery.data,
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

  // 🔥 LLM extraction
  const extractStart = performance.now();

  const { intents, tokens: extractTokens } =
    await extractIntentWithRetry(query);

  const extractLatency = performance.now() - extractStart;

  const validIntents = intents.filter((intent) => !isEmptyIntent(intent));

  if (validIntents.length === 0) {
    return Response.json({
      query,
      intents,
      results: [],
      finalAnswer:
        "Could not understand the query. Try something like 'Hotels in Goa under 5000'.",
      cached: false,

      usage: {
        extractTokens,
        totalTokens: extractTokens,
      },

      latency: {
        extractMs: Math.round(extractLatency),
        filterMs: 0,
        totalMs: Math.round(performance.now() - requestStart),
      },
    });
  }

  let totalFilterLatency = 0;
  // 🔥 INTENT CACHE + processing
  const intentResults = validIntents.map((intent) => {
    const normalized = normalizeIntent(intent);
    const cacheKey = getCacheKey(normalized);

    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      cacheHits++;

      return {
        intent,
        cached: true,
        data: cachedEntry.data.results,
        finalAnswer: cachedEntry.data.finalAnswer,
      };
    }

    cacheMisses++;

    const filterStart = performance.now();

    let results = handleIntent(normalized);
    results = rankResults(results, normalized);

    const filterLatency = performance.now() - filterStart;
    totalFilterLatency += filterLatency;

    const firstIntent = normalized;

    const finalAnswer =
      results.length > 0
        ? `${results.length} matching hotels in ${
            firstIntent?.location || "selected location"
          }${firstIntent?.maxPrice ? ` under ${firstIntent.maxPrice}` : ""}.`
        : `No results found. Try adjusting filters.`;

    // 🔥 store FULL response (important)
    if (results.length > 0) {
      if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(cacheKey, {
        data: {
          results,
          finalAnswer,
        },
        timestamp: Date.now(),
      });
    }

    return {
      intent,
      cached: false,
      data: results,
      finalAnswer,
    };
  });

  // 🔥 Flatten
  const results = intentResults.flatMap((r) => r.data);

  const finalAnswer =
    intentResults[0]?.finalAnswer || "No results found. Try adjusting filters.";

  const totalLatency = performance.now() - requestStart;

  const totalRequests = cacheHits + cacheMisses;
  const hitRate =
    totalRequests === 0 ? 0 : Math.round((cacheHits / totalRequests) * 100);

  const isCached = intentResults.some((r) => r.cached);

  const responsePayload = {
    query,
    intents,
    results,
    finalAnswer,
    cached: isCached,
    cache: {
      type: cachedQuery ? "query" : isCached ? "intent" : "none",
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
      hits: cacheHits,
      misses: cacheMisses,
      hitRate: `${hitRate}%`,
    },

    meta: {
      totalItems: hotels.length,
      filteredItems: results.length,
      sentToLLM: 0,
    },
  };

  // 🔥 STORE in query cache (after full processing)
  queryCache.set(queryKey, {
    data: responsePayload,
    timestamp: Date.now(),
  });

  return Response.json(responsePayload);
}
