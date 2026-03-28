import { z } from "zod";

export const IntentSchema = z.array(
  z.object({
    type: z.literal("hotel").default("hotel"),
    location: z.string().nullable(),
    maxPrice: z.number().nullable(),
    amenities: z.array(z.string()).default([]),
  }),
);

export type Intent = z.infer<typeof IntentSchema>[number];

export interface ExtractIntentResult {
  intents: Intent[];
  tokens: number;
  retries: number;
  error?: string;
  raw?: string | null;
}
