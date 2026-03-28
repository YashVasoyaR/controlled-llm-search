import type { Intent } from "@/types/intent";
import type { Hotel } from "@/types/hotel";

export function rankByIntent(results: Hotel[], intent: Intent): Hotel[] {
  return results.sort((a, b) => {
    // 1. Amenity priority (hard signal)
    if (intent.amenities && intent.amenities.length > 0) {
      const aAmenitiesLower = a.amenities.map((x) => x.toLowerCase().trim());
      const bAmenitiesLower = b.amenities.map((x) => x.toLowerCase().trim());

      const aMatch =
        intent.amenities.every((amenity) => aAmenitiesLower.includes(amenity)) ? 1 : 0;
      const bMatch =
        intent.amenities.every((amenity) => bAmenitiesLower.includes(amenity)) ? 1 : 0;

      if (aMatch !== bMatch) {
        return bMatch - aMatch;
      }
    }

    // 2. Price closeness
    if (intent.maxPrice) {
      const aDiff = Math.abs(intent.maxPrice - a.price);
      const bDiff = Math.abs(intent.maxPrice - b.price);

      if (aDiff !== bDiff) {
        return aDiff - bDiff;
      }
    }

    // 3. Location match (safety)
    if (intent.location) {
      const aLoc = a.location.toLowerCase().includes(intent.location) ? 1 : 0;
      const bLoc = b.location.toLowerCase().includes(intent.location) ? 1 : 0;

      if (aLoc !== bLoc) {
        return bLoc - aLoc;
      }
    }

    return 0;
  });
}
