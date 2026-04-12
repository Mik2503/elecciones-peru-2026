import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";

// Simulation data generator for fallback
function generateSimulationData() {
  const candidates = [
    { id: 1, name: "KEIKO FUJIMORI", party: "Fuerza Popular", votes: 2500000 + Math.floor(Math.random() * 50000), color: "#f97316" },
    { id: 2, name: "ALBERTO OTÁROLA", party: "Independiente", votes: 2450000 + Math.floor(Math.random() * 50000), color: "#3b82f6" },
    { id: 3, name: "ANTURO CASTILLO", party: "Perú Libre", votes: 1800000 + Math.floor(Math.random() * 30000), color: "#ef4444" },
    { id: 4, name: "RAFAEL LÓPEZ ALIAGA", party: "Renovación Popular", votes: 1500000 + Math.floor(Math.random() * 20000), color: "#34d399" },
  ];
  
  const totalVotes = candidates.reduce((acc, c) => acc + c.votes, 0);
  const percentCounted = 15 + (Date.now() % 85); // Simulated progress

  return {
    timestamp: Date.now(),
    percentCounted: Number(percentCounted.toFixed(2)),
    candidates: candidates.sort((a, b) => b.votes - a.votes),
    totals: {
      valid: totalVotes,
      blank: Math.floor(totalVotes * 0.05),
      null: Math.floor(totalVotes * 0.03),
      total: Math.floor(totalVotes * 1.08)
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
