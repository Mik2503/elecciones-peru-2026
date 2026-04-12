import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

/**
 * FLUSH endpoint - clears all stale/fake data from KV
 * Run once to clean up bad data before fresh sync
 */
export async function POST() {
  try {
    await kv.del("election:current");
    await kv.del("election:history");
    return NextResponse.json({ success: true, message: "KV flushed. All stale data removed." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST to /api/flush to clear KV data." });
}
