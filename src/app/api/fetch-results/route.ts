import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";

// Simulation data generator for fallback
function generateSimulationData() {
  const electionDate = new Date("2026-04-12T00:00:00Z").getTime();
  const now = Date.now();
  
  // Candidates based on 2026 projections
  const candidates = [
    { id: 1, name: "KEIKO FUJIMORI", party: "Fuerza Popular", votes: 2845000 + Math.floor(Math.random() * 10000), color: "#f97316" },
    { id: 2, name: "RAFAEL LÓPEZ ALIAGA", party: "Renovación Popular", votes: 2712300 + Math.floor(Math.random() * 10000), color: "#3b82f6" },
    { id: 3, name: "ANTURO CASTILLO", party: "Perú Libre", votes: 1950000 + Math.floor(Math.random() * 8000), color: "#ef4444" },
    { id: 4, name: "HERNANDO DE SOTO", party: "Avanza País", votes: 1420000 + Math.floor(Math.random() * 5000), color: "#34d399" },
    { id: 5, name: "ANTURO SÁNCHEZ", party: "Alianza para el Progreso", votes: 980000 + Math.floor(Math.random() * 3000), color: "#a855f7" },
  ];
  
  const totalVotes = candidates.reduce((acc, c) => acc + c.votes, 0);
  
  // Progress based on current time of the election day (8am to 11pm simulation)
  // At 10pm (22:00), we should be around 80-90%
  const hoursSinceStart = (now - electionDate) / (1000 * 60 * 60);
  let percentCounted = Math.min(Math.max((hoursSinceStart - 8) * 6, 0.5), 99.8);
  if (percentCounted < 0.5) percentCounted = 0.5;

  return {
    timestamp: now,
    percentCounted: Number(percentCounted.toFixed(2)),
    candidates: candidates.sort((a, b) => b.votes - a.votes),
    totals: {
      valid: totalVotes,
      blank: Math.floor(totalVotes * 0.04),
      null: Math.floor(totalVotes * 0.02),
      total: Math.floor(totalVotes * 1.06)
    }
  };
}

export async function GET(request: Request) {
  try {
    const response = await fetch(ONPE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 0 } // Bypass cache
    });

    let data;
    if (response.ok) {
      data = await response.json();
      // Add timestamp if not present
      if (!data.timestamp) data.timestamp = Date.now();
    } else {
      console.warn("ONPE API unreachable, using simulation data");
      data = generateSimulationData();
    }

    // Save current state
    await kv.set("election:current", data);
    
    // Save to historical list (limit to last 100 entries)
    await kv.lpush("election:history", data);
    await kv.ltrim("election:history", 0, 99);

    return NextResponse.json({ success: true, source: response.ok ? "ONPE" : "Simulation", data });
  } catch (error) {
    console.error("Fetch error:", error);
    const data = generateSimulationData();
    await kv.set("election:current", data);
    await kv.lpush("election:history", data);
    await kv.ltrim("election:history", 0, 99);
    
    return NextResponse.json({ success: true, source: "Simulation (Error Fallback)", data });
  }
}
