import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// Proxy endpoint that attempts to bypass ONPE firewall
// This endpoint tries multiple strategies to get past Cloudflare/firewall blocks

const ONPE_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";
const ONPE_V1_URL = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";

// Helper to parse ONPE's numeric strings with commas
const parseONPENumber = (str: string) => {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ""), 10);
};

export async function GET() {
  console.log("[fetch-proxy] Starting proxy fetch attempt...");

  // Strategy 1: Try with maximum browser-like headers
  let result = await tryFetchWithStrategy("full-browser", ONPE_URL);

  if (!result.success) {
    console.log("[fetch-proxy] Strategy 1 failed, trying strategy 2 (v1 API)...");
    // Strategy 2: Try v1 API which might have different firewall rules
    result = await tryFetchWithStrategy("full-browser", ONPE_V1_URL);
  }

  if (!result.success) {
    console.log("[fetch-proxy] Strategy 2 failed, trying strategy 3 (minimal headers)...");
    // Strategy 3: Try with minimal headers (some firewalls block on too many headers)
    result = await tryFetchWithStrategy("minimal", ONPE_URL);
  }

  if (!result.success) {
    return NextResponse.json({
      success: false,
      error: result.error,
      message: "All proxy strategies failed. The ONPE firewall is blocking Vercel IPs. Run Docker Sync from a local Peruvian IP.",
      strategies_tried: ["full-browser (JSON)", "full-browser (v1 API)", "minimal (JSON)"]
    }, { status: 502 });
  }

  // Process and store the data
  try {
    const processedData = result.useV1Format
      ? processOfficialV1Data(result.data)
      : processOfficialData(result.data);

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    console.log("[fetch-proxy] Successfully stored data from proxy");
    return NextResponse.json({
      success: true,
      source: `ONPE (proxy - ${result.strategy})`,
      data: processedData
    });
  } catch (error: any) {
    console.error("[fetch-proxy] Processing error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

interface FetchResult {
  success: boolean;
  data?: any;
  error?: string;
  strategy: string;
  useV1Format: boolean;
}

async function tryFetchWithStrategy(strategy: string, url: string): Promise<FetchResult> {
  console.log(`[fetch-proxy] Trying strategy: ${strategy}, URL: ${url}`);

  const headers: Record<string, string> = strategy === "full-browser"
    ? {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Referer": "https://eg2026.onpe.gob.pe/",
      "Origin": "https://eg2026.onpe.gob.pe",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
    : {
      // Minimal headers - some firewalls prefer this
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    };

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 0 },
      // Some firewalls check for cache bypass
      cache: "no-store"
    });

    console.log(`[fetch-proxy] ${strategy} - Status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "No body");
      const isCloudflare = errorBody.toLowerCase().includes("cloudflare") ||
        errorBody.includes("cf-") ||
        errorBody.includes("cf-chl");

      console.error(`[fetch-proxy] ${strategy} - Failed (${response.status}) ${isCloudflare ? "[Cloudflare]" : "[Other]"}`);
      console.error(`[fetch-proxy] ${strategy} - Response preview:`, errorBody.substring(0, 300));

      return {
        success: false,
        error: `Status ${response.status} - ${isCloudflare ? "Cloudflare block" : "Server error"}`,
        strategy,
        useV1Format: url.includes("/api/v1/")
      };
    }

    const rawData = await response.json();
    console.log(`[fetch-proxy] ${strategy} - Got data, keys:`, Object.keys(rawData));

    // Validate structure
    if (!rawData.generals || !rawData.results) {
      console.error(`[fetch-proxy] ${strategy} - Invalid structure`);
      return {
        success: false,
        error: "Invalid JSON structure",
        strategy,
        useV1Format: url.includes("/api/v1/")
      };
    }

    return {
      success: true,
      data: rawData,
      strategy,
      useV1Format: url.includes("/api/v1/")
    };
  } catch (error: any) {
    console.error(`[fetch-proxy] ${strategy} - Exception:`, error.message);
    return {
      success: false,
      error: error.message,
      strategy,
      useV1Format: url.includes("/api/v1/")
    };
  }
}

// POST handler for proxy endpoint
export async function POST(request: Request) {
  try {
    console.log("[fetch-proxy] POST - Received data push");
    const rawData = await request.json();

    let processedData;
    if (rawData.generals && rawData.results) {
      // Detect format and process accordingly
      const useV1Format = rawData.generals.porcentajeActasProcesadas !== undefined;
      processedData = useV1Format
        ? processOfficialV1Data(rawData)
        : processOfficialData(rawData);
    } else if (rawData.candidates && rawData.totals) {
      processedData = rawData;
    } else {
      return NextResponse.json({ success: false, error: "Invalid JSON structure" }, { status: 400 });
    }

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    return NextResponse.json({ success: true, message: "Proxy data updated successfully." });
  } catch (_error) {
    return NextResponse.json({ success: false, error: "Processing error" }, { status: 500 });
  }
}

function processOfficialData(data: any) {
  const isResultsMode = data.results && data.results.length > 0 &&
    data.generals.generalData?.POR_ACTAS_CONTABILIZADAS !== "0.000";

  if (!isResultsMode) {
    return {
      timestamp: Date.now(),
      status: "VOTACIÓN EN CURSO",
      percentCounted: 0,
      percentInstalled: parseFloat(data.generals.generalData?.POR_MESAS_INSTALADAS || "99.8"),
      candidates: [],
      totals: { valid: 0, blank: 0, null: 0, total: 0 },
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
    percentCounted: parseFloat(data.generals.generalData?.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: candidatesRaw.map((c: any, index: number) => ({
      id: index,
      name: c.AGRUPACION,
      party: c.AGRUPACION,
      votes: parseONPENumber(c.TOTAL_VOTOS || "0"),
      color: getPartyColor(c.AGRUPACION)
    })).sort((a: any, b: any) => b.votes - a.votes),
    totals: {
      valid: parseONPENumber(emitidosItem?.TOTAL_VOTOS || "0") -
        parseONPENumber(nulosItem?.TOTAL_VOTOS || "0") -
        parseONPENumber(blancosItem?.TOTAL_VOTOS || "0"),
      blank: parseONPENumber(blancosItem?.TOTAL_VOTOS || "0"),
      null: parseONPENumber(nulosItem?.TOTAL_VOTOS || "0"),
      total: parseONPENumber(emitidosItem?.TOTAL_VOTOS || "0")
    }
  };
}

function processOfficialV1Data(data: any) {
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
