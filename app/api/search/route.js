export async function POST(req) {
    const { query } = await req.json();

    console.log("Query:", query);

    return Response.json({
        message: "API working",
        query,
    });
}