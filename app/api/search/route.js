import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req) {
  const { query } = await req.json();

  const startTime = Date.now();

  // 🔥 STEP 1: Query Understanding (LLM)
  const queryUnderstandingStart = Date.now();

  const aiResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `
Extract structured filters from user query.

Return ONLY JSON:
{
  "location": string | null,
  "maxPrice": number | null,
  "amenities": string[]
}
        `,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  const queryUnderstandingLatency = Date.now() - queryUnderstandingStart;

  const raw = aiResponse.choices[0].message.content;

  let filters;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    filters = JSON.parse(clean);
  } catch (e) {
    return Response.json({ error: "Invalid AI response", raw });
  }

  // 🔥 STEP 2: Backend Filtering
  const results = hotels.filter((hotel) => {
    if (filters.location && hotel.location !== filters.location) return false;

    if (filters.maxPrice && hotel.price > filters.maxPrice) return false;

    if (
      filters.amenities.length &&
      !filters.amenities.every((a) => hotel.amenities.includes(a))
    ) {
      return false;
    }

    return true;
  });

  // 🔥 STEP 3: Response Generation (LLM)
  const responseGenerationStart = Date.now();

  const finalResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "Provide a short, helpful hotel recommendation.",
      },
      {
        role: "user",
        content: `
User query: ${query}

Available hotels:
${JSON.stringify(results)}
        `,
      },
    ],
  });

  const responseGenerationLatency = Date.now() - responseGenerationStart;

  const finalAnswer = finalResponse.choices[0].message.content;

  const totalLatency = Date.now() - startTime;

  // 🔥 TOKEN USAGE
  const queryUnderstandingTokens = aiResponse.usage?.total_tokens || 0;

  const responseGenerationTokens = finalResponse.usage?.total_tokens || 0;

  const totalTokens = queryUnderstandingTokens + responseGenerationTokens;

  return Response.json({
    type: "optimized",
    query,
    filters,
    results,
    finalAnswer,

    usage: {
      queryUnderstandingTokens,
      responseGenerationTokens,
      totalTokens,
    },

    latency: {
      queryUnderstandingMs: queryUnderstandingLatency,
      responseGenerationMs: responseGenerationLatency,
      totalMs: totalLatency,
    },
  });
}
