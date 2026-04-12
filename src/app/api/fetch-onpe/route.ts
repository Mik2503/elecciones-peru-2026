import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_V1_URL = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";

export async function GET() {
  try {
    const response = await fetch(ONPE_V1_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://eg2026.onpe.gob.pe/",
        "Origin": "https://eg2026.onpe.gob.pe",
        "Accept": "application/json, text/plain, */*"
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`ONPE API v1 returned status ${response.status}`);
    }

    const rawData = await response.json();
    const processedData = processOfficialV1Data(rawData);

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    return NextResponse.json({ success: true, source: "ONPE API v1", data: processedData });
  } catch (error: any) {
    console.error("v1 Fetch Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}

function processOfficialV1Data(data: any) {
  // Parsing logic for the v1/resumen endpoint
  // Based on official structure
  const generals = data.generals || data;
  const results = data.results || [];

  return {
    timestamp: Date.now(),
    status: "RESULTADOS OFICIALES (v1)",
    percentCounted: parseFloat(generals.porcentajeActasProcesadas || generals.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: results.map((c: any, index: number) => ({
      id: index,
      name: c.nombreAgrupacion || c.AGRUPACION,
      party: c.nombreAgrupacion || c.AGRUPACION,
      votes: parseInt((c.votosTotales || c.TOTAL_VOTOS || "0").toString().replace(/,/g, ""), 10),
      color: "#71717a" // Default color, layout will handle it
    })).sort((a: any, b: any) => b.votes - a.votes),
    totals: {
      valid: parseInt((generals.votosValidos || "0").toString().replace(/,/g, ""), 10),
      blank: parseInt((generals.votosBlancos || "0").toString().replace(/,/g, ""), 10),
      null: parseInt((generals.votosNulos || "0").toString().replace(/,/g, ""), 10),
      total: parseInt((generals.votosEmitidos || "0").toString().replace(/,/g, ""), 10)
    }
  };
}
