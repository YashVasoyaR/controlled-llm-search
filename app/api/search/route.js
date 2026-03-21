import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req) {
  const { query } = await req.json();

  // 🔥 Step 1: Convert query → structured JSON
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
  console.log("AI:", raw);

  let filters;
  console.log("aiResponse", aiResponse);
  try {
    filters = JSON.parse(aiResponse.choices[0].message.content);
  } catch (e) {
    return Response.json({ error: "Invalid AI response" });
  }

  // 🔥 Step 2: Apply filters
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

  return Response.json({
    query,
    filters,
    results,
  });
}
