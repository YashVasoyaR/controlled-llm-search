import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req) {
  const { query } = await req.json();

  const startTime = Date.now();

  // ❌ Baseline: Full context sent to LLM
  const baselineResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a hotel assistant. Find best hotels from data.",
      },
      {
        role: "user",
        content: `
User query: ${query}

All hotels:
${JSON.stringify(hotels)}
        `,
      },
    ],
  });

  const latency = Date.now() - startTime;

  const finalAnswer = baselineResponse.choices[0].message.content;

  const totalTokens = baselineResponse.usage?.total_tokens || 0;

  return Response.json({
    type: "baseline",
    query,
    finalAnswer,

    usage: {
      totalTokens,
    },

    latency: {
      totalMs: latency,
    },
  });
}
