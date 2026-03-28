import type { Intent } from "@/types/intent";

// Self-learning location memory
const locationMemory = new Map<string, string>();

function cleanLocation(location: string | null): string | null {
  if (!location) return null;

  return location
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\b(india|city|area|region|state|country)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilar(a: string | null, b: string | null): boolean {
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

function normalizeLocation(location: string | null): string | null {
  if (!location) return null;

  const cleaned = cleanLocation(location);
  if (!cleaned) return null;

  // 1. direct memory hit
  if (locationMemory.has(cleaned)) {
    return locationMemory.get(cleaned) ?? null;
  }

  // 2. similarity match with existing keys
  for (const [known, canonical] of locationMemory.entries()) {
    if (isSimilar(cleaned, known)) {
      return canonical;
    }
  }

  // 3. fallback → use cleaned as canonical
  locationMemory.set(cleaned, cleaned);

  return cleaned;
}

export function learnLocation(
  original: string | null,
  normalized: string | null
): void {
  if (!original || !normalized) return;

  const cleaned = cleanLocation(original);
  if (!cleaned) return;

  if (!locationMemory.has(cleaned)) {
    locationMemory.set(cleaned, normalized);
  }
}

export function normalizeIntent(intent: Intent): Intent {
  const normalizedLocation = normalizeLocation(intent.location);

  // learn mapping
  learnLocation(intent.location, normalizedLocation);

  return {
    type: "hotel",
    location: normalizedLocation,
    maxPrice: intent.maxPrice ?? null,
    amenities: (intent.amenities ?? [])
      .map((a) => a.toLowerCase().trim())
      .sort(),
  };
}
