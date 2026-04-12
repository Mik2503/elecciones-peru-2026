import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const current = await kv.get("election:current");
    const history = await kv.lrange("election:history", 0, -1);

    if (!current) {
      // If no data in KV, trigger a simulation fetch transparently or return empty
      return NextResponse.json({ 
        current: null, 
        history: [], 
        message: "No data available. Waiting for first cron job or direct /api/fetch-results call." 
      });
    }

    return NextResponse.json({ 
      current, 
      history: history.reverse() // Return chronological order for charts
    });
  } catch (error) {
    console.error("Data retrieval error:", error);
    return NextResponse.json({ error: "Failed to retrieve data" }, { status: 500 });
  }
}
