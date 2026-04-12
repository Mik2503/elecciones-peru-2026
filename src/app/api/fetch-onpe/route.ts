import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_V1_URL = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";

export async function GET() {
  try {
    console.log("[fetch-onpe] GET - Fetching from ONPE API v1...");
    console.log("[fetch-onpe] URL:", ONPE_V1_URL);

    const response = await fetch(ONPE_V1_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://eg2026.onpe.gob.pe/",
        "Origin": "https://eg2026.onpe.gob.pe",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8,en;q=0.7"
      },
      next: { revalidate: 0 }
    });

    console.log("[fetch-onpe] Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "No body");
      console.error("[fetch-onpe] Error response:", response.status, errorBody.substring(0, 500));
      throw new Error(`ONPE API v1 returned status ${response.status}`);
    }

    const rawData = await response.json();
    console.log("[fetch-onpe] Received data, keys:", Object.keys(rawData));

    const processedData = processOfficialV1Data(rawData);

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    console.log("[fetch-onpe] Successfully stored data in KV");
    return NextResponse.json({ success: true, source: "ONPE API v1", data: processedData });
  } catch (error: any) {
    console.error("[fetch-onpe] Fetch Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}

// Support for POST requests (push pre-fetched v1 data)
export async function POST(request: Request) {
  try {
    console.log("[fetch-onpe] POST - Received data push");
    const rawData = await request.json();

    // Check if it's the raw v1 structure and process it
    let processedData;
    if (rawData.generals && rawData.results) {
      processedData = processOfficialV1Data(rawData);
    } else if (rawData.candidates && rawData.totals) {
      processedData = rawData; // Already processed
    } else {
      console.error("[fetch-onpe] Invalid JSON structure received");
      return NextResponse.json({ success: false, error: "Invalid v1 JSON structure" }, { status: 400 });
    }

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    console.log("[fetch-onpe] Successfully stored pushed data in KV");
    return NextResponse.json({ success: true, message: "v1 data updated successfully." });
  } catch (error) {
    console.error("[fetch-onpe] POST processing error:", error);
    return NextResponse.json({ success: false, error: "Processing error" }, { status: 500 });
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
      color: getPartyColor(c.nombreAgrupacion || c.AGRUPACION)
    })).sort((a: any, b: any) => b.votes - a.votes),
    totals: {
      valid: parseInt((generals.votosValidos || "0").toString().replace(/,/g, ""), 10),
      blank: parseInt((generals.votosBlancos || "0").toString().replace(/,/g, ""), 10),
      null: parseInt((generals.votosNulos || "0").toString().replace(/,/g, ""), 10),
      total: parseInt((generals.votosEmitidos || "0").toString().replace(/,/g, ""), 10)
    }
  };
}

function getPartyColor(party: string) {
  // Official party-to-color mapping for Peru 2026 General Elections
  // Based on the 35 official presidential candidates
  const colors: Record<string, string> = {
    "FUERZA POPULAR": "#f97316",
    "RENOVACIÓN POPULAR": "#3b82f6",
    "PAÍS PARA TODOS": "#a855f7",
    "AHORA NACIÓN": "#84cc16",
    "ALIANZA PARA EL PROGRESO": "#06b6d4",
    "AVANZA PAÍS": "#34d399",
    "JUNTOS POR EL PERÚ": "#ec4899",
    "PERÚ LIBRE": "#ef4444",
    "SOMOS PERÚ": "#eab308",
    "PARTIDO MORADO": "#8b5cf6",
    "PODEMOS PERÚ": "#f59e0b",
    "COOPERACIÓN POPULAR": "#14b8a6",
    "PARTIDO APRISTA": "#1e40af",
    "PARTIDO DEL BUEN GOBIERNO": "#6366f1",
    "PARTIDO CÍVICO OBRAS": "#64748b",
    "PARTIDO FRENTE DE LA ESPERANZA 2021": "#22c55e",
    "LIBERTAD POPULAR": "#0ea5e9",
    "FUERZA Y LIBERTAD": "#f43f5e",
    "PARTIDO PATRIÓTICO DEL PERÚ": "#78716c",
    "PARTIDO DEMÓCRATA UNIDO PERÚ": "#a3e635",
    "PARTIDO DEMÓCRATA VERDE": "#4ade80",
    "PARTIDO DEMOCRÁTICO FEDERAL": "#2dd4bf",
    "PARTIDO POLÍTICO INTEGRIDAD DEMOCRÁTICA": "#c084fc",
    "PARTIDO POLÍTICO PERÚ ACCIÓN": "#fb923c",
    "PERÚ PRIMERO": "#fbbf24",
    "PARTIDO POLÍTICO PRIN": "#38bdf8",
    "PARTIDO SÍ CREO": "#e879f9",
    "PERÚ MODERNO": "#22d3ee",
    "PRIMERO LA GENTE": "#facc15",
    "PROGRESEMOS": "#a78bfa",
    "SALVEMOS AL PERÚ": "#fb7185",
    "UN CAMINO DIFERENTE": "#94a3b8",
    "UNIDAD NACIONAL": "#1d4ed8",
    "ALIANZA VENCEREMOS": "#0d9488",
    "FE EN EL PERÚ": "#c2410c",
    "VOTOS EN BLANCO": "#52525b",
    "VOTOS NULOS": "#71717a",
    "TOTAL DE VOTOS EMITIDOS": "#3f3f46"
  };
  if (colors[party]) return colors[party];
  let hash = 0;
  for (let i = 0; i < party.length; i++) {
    hash = party.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}
