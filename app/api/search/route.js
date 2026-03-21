import { hotels } from "@/app/data/hotels";

export async function POST(req) {
  const { query } = await req.json();
  console.log("Query:", query);

  // VERY basic filtering (hardcoded logic for now)
  const results = hotels.filter((hotel) => {
    if (query.toLowerCase().includes("goa")) {
      return hotel.location === "Goa";
    }
    return true;
  });

  return Response.json({
    query,
    results,
  });
}
