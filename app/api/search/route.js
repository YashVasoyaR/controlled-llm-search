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

  // 🔥 STEP 2: Backend filtering
  const results = hotels.filter((hotel) => {
    if (filters.location && hotel.location !== filters.location) {
      return false;
    }

    if (filters.maxPrice && hotel.price > filters.maxPrice) {
      return false;
    }

    if (
      filters.amenities.length &&
      !filters.amenities.every((a) => hotel.amenities.includes(a))
    ) {
      return false;
    }

    return true;
  });

  // 🔥 STEP 3: LLM → Format final response (IMPORTANT)
  const finalResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "Provide a helpful, short response recommending hotels.",
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

  // 🔥 Metrics (your differentiator)
  const fullData = JSON.stringify(hotels);
  const filteredData = JSON.stringify(results);

  const fullSize = fullData.length;
  const filteredSize = filteredData.length;

  return Response.json({
    query,
    filters,
    results,
    finalAnswer,
    metrics: {
      fullDataSize: fullSize,
      filteredDataSize: filteredSize,
      reduction: `${Math.round(((fullSize - filteredSize) / fullSize) * 100)}%`,
    },
  });
}
