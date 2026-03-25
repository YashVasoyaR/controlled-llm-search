import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req) {
  const { query } = await req.json();

  // 🔥 STEP 1: LLM → Extract filters
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

  const raw = aiResponse.choices[0].message.content;

  let filters;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    filters = JSON.parse(clean);
  } catch (e) {
    return Response.json({ error: "Invalid AI response", raw });
  }

  // 🔥 STEP 2: Backend filtering (REAL LOGIC)
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

  // 🔥 STEP 3: LLM → Format response (small data)
  const finalResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "Provide a short, helpful response recommending hotels.",
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

  const finalAnswer = finalResponse.choices[0].message.content;
  const extractUsage = aiResponse.usage || null;
  const finalUsage = finalResponse.usage || null;
  // 🔥 Metrics (core differentiator)
  const fullData = JSON.stringify(hotels);
  const filteredData = JSON.stringify(results);

  console.log("--- OPTIMIZED SEARCH ---", {
    type: "optimized",
    query,
    filters,
    results,
    finalAnswer,
    usage: {
      extract: extractUsage,
      final: finalUsage,
    },
    metrics: {
      fullDataSize: fullData.length,
      filteredDataSize: filteredData.length,
      reduction: `${Math.round(
        ((fullData.length - filteredData.length) / fullData.length) * 100,
      )}%`,
    },
  });
  return Response.json({
    type: "optimized",
    query,
    filters,
    results,
    finalAnswer,
    usage: {
      extract: extractUsage,
      final: finalUsage,
    },
    metrics: {
      fullDataSize: fullData.length,
      filteredDataSize: filteredData.length,
      reduction: `${Math.round(
        ((fullData.length - filteredData.length) / fullData.length) * 100,
      )}%`,
    },
  });
}
