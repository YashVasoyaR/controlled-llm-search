import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

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
      if (intent.location && hotel.location.toLowerCase() !== intent.location)
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
  return results
    .map((hotel) => {
      let score = 0;

      if (intent.maxPrice) {
        score += intent.maxPrice - hotel.price;
      }

      score += hotel.amenities.length * 10;

      return { ...hotel, score };
    })
    .sort((a, b) => b.score - a.score);
}

export async function POST(req) {
  const { query } = await req.json();

  const requestStart = Date.now();

  // 🔥 STEP 1: Extract intent (ONLY LLM CALL)
  const extractStart = Date.now();

  const aiResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `
Extract ALL intents from user query.

Return JSON array:
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

  const extractLatency = Date.now() - extractStart;

  let intents = [];

  try {
    const raw = aiResponse.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    intents = JSON.parse(clean);
  } catch (e) {
    return Response.json({ error: "Invalid AI response" });
  }

  // 🔥 STEP 2: Process intents with cache
  const intentResults = intents.map((intent) => {
    const normalized = normalizeIntent(intent);
    const cacheKey = getCacheKey(normalized);

    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      cacheHits++;

      return {
        intent,
        cached: true,
        data: cachedEntry.data,
      };
    }

    cacheMisses++;

    let results = handleIntent(normalized);
    results = rankResults(results, normalized);

    // prevent empty cache pollution
    if (results.length > 0) {
      if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(cacheKey, {
        data: results,
        timestamp: Date.now(),
      });
    }

    return {
      intent,
      cached: false,
      data: results,
    };
  });

  // 🔥 Flatten results
  const results = intentResults.flatMap((r) => r.data);

  // 🔥 Deterministic response (NO 2nd LLM)
  const firstIntent = intents[0];

  const finalAnswer =
    results.length > 0
      ? `Found ${results.length} results in ${firstIntent?.location || "selected location"}${
          firstIntent?.maxPrice ? ` under ${firstIntent.maxPrice}` : ""
        }.`
      : `No results found. Try adjusting filters.`;

  // 🔥 Metrics
  const totalLatency = Date.now() - requestStart;
  const extractTokens = aiResponse.usage?.total_tokens || 0;

  const totalRequests = cacheHits + cacheMisses;
  const hitRate =
    totalRequests === 0 ? 0 : Math.round((cacheHits / totalRequests) * 100);

  const isCached = intentResults.some((r) => r.cached);

  return Response.json({
    query,
    intents,
    results,
    finalAnswer,
    cached: isCached,

    usage: {
      extractTokens,
      totalTokens: extractTokens,
    },

    latency: {
      extractMs: extractLatency,
      totalMs: totalLatency,
    },

    cacheStats: {
      hits: cacheHits,
      misses: cacheMisses,
      hitRate: `${hitRate}%`,
    },
  });
}
