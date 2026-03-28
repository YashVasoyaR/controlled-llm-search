import { hotels } from "@/app/data/hotels";
import OpenAI from "openai";
import type { BaselineResponse } from "@/types/baseline";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req: Request): Promise<Response> {
  const body = await req.json() as { query: string };
  const { query } = body;

  const startTime = Date.now();

  // ❌ Baseline: Full context sent to LLM
  const baselineResponse = await client.chat.completions.create({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a inventory assistant. Find best results from data.",
      },
      {
        role: "user",
        content: `
User query: ${query}

All inventory items:
${JSON.stringify(hotels)}
        `,
      },
    ],
  });

  const latency = Date.now() - startTime;

  const finalAnswer = baselineResponse.choices[0].message.content;

  const totalTokens = baselineResponse.usage?.total_tokens || 0;

  const payload: BaselineResponse = {
    type: "baseline",
    query,
    finalAnswer,

    usage: {
      totalTokens,
    },

    latency: {
      totalMs: latency,
    },

    meta: {
      totalItems: hotels.length,
      sentToLLM: hotels.length,
    },
  };

  return Response.json(payload);
}
