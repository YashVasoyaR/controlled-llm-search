import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req) {
  const { query } = await req.json();

  // ❌ NAIVE: Send EVERYTHING to LLM
  const naiveResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `
You are a hotel assistant.

Find the best hotels based on user query using the provided data.
Return helpful recommendations.
        `,
      },
      {
        role: "user",
        content: `
User query: ${query}

All hotels data:
${JSON.stringify(hotels)}
        `,
      },
    ],
  });

  const naiveAnswer = naiveResponse.choices[0].message.content;
  const usage = naiveResponse.usage || null;
  const fullData = JSON.stringify(hotels);

  console.log("NAIVE-SEARCH",{
    type: "naive",
    query,
    naiveAnswer,
    usage,
    metrics: {
      fullDataSize: fullData.length,
    },
  });
  return Response.json({
    type: "naive",
    query,
    naiveAnswer,
    usage,
    metrics: {
      fullDataSize: fullData.length,
    },
  });
}
