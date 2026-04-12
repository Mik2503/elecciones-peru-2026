import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";

// Helper to parse ONPE's numeric strings with commas
const parseONPENumber = (str: string) => {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ""), 10);
};

export async function GET() {
  try {
    console.log("[fetch-results] GET - Fetching from ONPE...");
    console.log("[fetch-results] URL:", ONPE_URL);

    const response = await fetch(ONPE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8,en;q=0.7",
        "Referer": "https://eg2026.onpe.gob.pe/",
        "Origin": "https://eg2026.onpe.gob.pe",
      },
      next: { revalidate: 0 }
    });

    console.log("[fetch-results] Response status:", response.status);
    console.log("[fetch-results] Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "No body");
      console.error("[fetch-results] Error response:", response.status, errorBody.substring(0, 500));

      // Check if it's a Cloudflare/firewall block page
      if (response.status === 403) {
        const isCloudflare = errorBody.includes("cloudflare") || errorBody.includes("cf-");
        console.error(`[fetch-results] BLOCKED by firewall! ${isCloudflare ? "(Cloudflare detected)" : "(Unknown firewall)"}`);
      }

      throw new Error(`ONPE Official Server returned status ${response.status}`);
    }

    const rawData = await response.json();
    console.log("[fetch-results] Received data, keys:", Object.keys(rawData));

    // VALIDATION: Ensure it's the real official structure
    if (!rawData.generals || !rawData.results) {
      console.error("[fetch-results] Invalid official JSON structure");
      throw new Error("Invalid official JSON structure received from ONPE.");
    }

    const processedData = processOfficialData(rawData);

    // Save to KV
    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    console.log("[fetch-results] Successfully stored data in KV");
    return NextResponse.json({ success: true, source: "ONPE Official API", data: processedData });
  } catch (error: any) {
    console.error("[fetch-results] Fetch Error:", error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: "Check local Docker sync if Vercel is blocked by Cloudflare."
    }, { status: 502 });
  }
}

// Support for POST requests (Official Data Pushing)
export async function POST(request: Request) {
  try {
    console.log("[fetch-results] POST - Received data push");
    const rawData = await request.json();
    console.log("[fetch-results] POST - Received keys:", Object.keys(rawData));

    // Check if it's the raw official structure and process it
    let processedData;
    if (rawData.generals && rawData.results) {
      console.log("[fetch-results] POST - Processing raw official data");
      processedData = processOfficialData(rawData);
    } else if (rawData.candidates && rawData.totals) {
      console.log("[fetch-results] POST - Using pre-processed data");
      processedData = rawData; // Already processed
    } else {
      console.error("[fetch-results] POST - Invalid JSON structure");
      return NextResponse.json({ success: false, error: "Invalid official JSON structure" }, { status: 400 });
    }

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    console.log("[fetch-results] POST - Successfully stored data in KV");
    return NextResponse.json({ success: true, message: "Official data updated successfully." });
  } catch (error) {
    console.error("[fetch-results] POST processing error:", error);
    return NextResponse.json({ success: false, error: "Processing error" }, { status: 500 });
  }
}

function processOfficialData(data: any) {
  // During the election day (before 6 PM PET), ONPE shows Installation Stats
  // After 6 PM PET, they show Presidential Results

  const isResultsMode = data.results && data.results.length > 0 && data.generals.generalData.POR_ACTAS_CONTABILIZADAS !== "0.000";

  if (!isResultsMode) {
    // Return Official Installation Data
    return {
      timestamp: Date.now(),
      status: "VOTACIÓN EN CURSO",
      percentCounted: 0, // No result actas yet
      percentInstalled: parseFloat(data.generals.generalData.POR_MESAS_INSTALADAS || "99.8"),
      candidates: [], // No results yet
      totals: {
        valid: 0,
        blank: 0,
        null: 0,
        total: 0
      },
      message: "Mesas cerrarán a las 18:00 (Hora Perú). Resultados oficiales en breve."
    };
  }

  const candidatesRaw = data.results.filter((item: any) =>
    !["VOTOS EN BLANCO", "VOTOS NULOS", "TOTAL DE VOTOS EMITIDOS"].includes(item.AGRUPACION)
  );

  const nulosItem = data.results.find((item: any) => item.AGRUPACION === "VOTOS NULOS");
  const blancosItem = data.results.find((item: any) => item.AGRUPACION === "VOTOS EN BLANCO");
  const emitidosItem = data.results.find((item: any) => item.AGRUPACION === "TOTAL DE VOTOS EMITIDOS");

  return {
    timestamp: Date.now(),
    status: "RESULTADOS OFICIALES",
    percentCounted: parseFloat(data.generals.generalData.POR_ACTAS_CONTABILIZADAS),
    candidates: candidatesRaw.map((c: any, index: number) => ({
      id: index,
      name: c.AGRUPACION,
      party: c.AGRUPACION,
      votes: parseONPENumber(c.TOTAL_VOTOS),
      color: getPartyColor(c.AGRUPACION)
    })).sort((a: any, b: any) => b.votes - a.votes),
    totals: {
      valid: parseONPENumber(emitidosItem?.TOTAL_VOTOS || "0") - parseONPENumber(nulosItem?.TOTAL_VOTOS || "0") - parseONPENumber(blancosItem?.TOTAL_VOTOS || "0"),
      blank: parseONPENumber(blancosItem?.TOTAL_VOTOS || "0"),
      null: parseONPENumber(nulosItem?.TOTAL_VOTOS || "0"),
      total: parseONPENumber(emitidosItem?.TOTAL_VOTOS || "0")
    }
  };
}

function getPartyColor(party: string) {
  // Official party-to-color mapping for Peru 2026 General Elections
  // Based on the 35 official presidential candidates
  const colors: Record<string, string> = {
    // Main candidates (mapped to real 2026 parties)
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
    // Special entries
    "VOTOS EN BLANCO": "#52525b",
    "VOTOS NULOS": "#71717a",
    "TOTAL DE VOTOS EMITIDOS": "#3f3f46"
  };
  if (colors[party]) return colors[party];

  // Generate a deterministic color for unknown parties
  let hash = 0;
  for (let i = 0; i < party.length; i++) {
    hash = party.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}
