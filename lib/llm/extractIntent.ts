import OpenAI from "openai";
import {
  IntentSchema,
  type Intent,
  type ExtractIntentResult,
} from "@/types/intent";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export { IntentSchema, type Intent, type ExtractIntentResult };

function safeParseIntent(raw: string): Intent[] | null {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return IntentSchema.parse(parsed);
  } catch {
    return null;
  }
}

function fallbackIntentFromQuery(query: string): Intent {
  const lower = query.toLowerCase();

  let location: string | null = null;

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

async function extractIntentWithRetry(
  query: string,
  maxRetries: number = 2
): Promise<ExtractIntentResult> {
  let lastRaw: string | null = null;
  let totalTokens: number = 0;

  for (let i = 0; i <= maxRetries; i++) {
    const response = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL as string,
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

    const raw = response.choices[0]?.message?.content;
    if (!raw) continue;

    lastRaw = raw;

    const parsed = safeParseIntent(raw);

    // STRICT semantic validation
    const isValid =
      parsed &&
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.some(
        (intent) =>
          intent.location !== null ||
          intent.maxPrice !== null ||
          (intent.amenities && intent.amenities.length > 0)
      );

    if (isValid) {
      return {
        intents: parsed,
        tokens: totalTokens,
        retries: i,
      };
    }
  }

  // SMART FALLBACK
  const fallback = fallbackIntentFromQuery(query);

  return {
    intents: [fallback],
    tokens: totalTokens,
    retries: maxRetries,
    error: "LLM failed → fallback used",
    raw: lastRaw,
  };
}

export async function extractIntent(query: string): Promise<ExtractIntentResult> {
  return extractIntentWithRetry(query);
}
