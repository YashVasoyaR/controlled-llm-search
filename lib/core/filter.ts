import type { Intent } from "@/types/intent";
import type { Hotel } from "@/types/hotel";

export type { Hotel };

export function isEmptyIntent(intent: Intent): boolean {
  return (
    !intent.location &&
    !intent.maxPrice &&
    (!intent.amenities || intent.amenities.length === 0)
  );
}

export function filterByIntent(hotels: Hotel[], intent: Intent): Hotel[] {
  if (intent.type !== "hotel") {
    return [];
  }

  return hotels.filter((hotel) => {
    // Filter by location
    if (
      intent.location &&
      !hotel.location.toLowerCase().includes(intent.location)
    ) {
      return false;
    }

    // Filter by max price
    if (intent.maxPrice && hotel.price > intent.maxPrice) {
      return false;
    }

    // Filter by amenities (all required amenities must be present)
    if (intent.amenities && intent.amenities.length > 0) {
      const hotelAmenitiesLower = hotel.amenities.map((x) =>
        x.toLowerCase().trim()
      );
      const hasAllAmenities = intent.amenities.every((amenity) =>
        hotelAmenitiesLower.includes(amenity)
      );
      if (!hasAllAmenities) {
        return false;
      }
    }

    return true;
  });
}
