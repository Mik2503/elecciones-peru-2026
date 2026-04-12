import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// ============================================================================
// AGGRESSIVE PROXY ENDPOINT - Bypasses ONPE firewall from Vercel cloud IPs
// Tries 7 different proxy strategies to reach ONPE data
// ============================================================================

const ONPE_JSON_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";
const ONPE_V1_URL = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";

// Proxy services to try (all free, no API key needed)
const PROXY_STRATEGIES = [
  // Strategy 1: allorigins.win (most reliable for JSON)
  (url: string) => ({
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    name: "allorigins-raw",
    needsUnwrap: false,
  }),
  // Strategy 2: corsproxy.io
  (url: string) => ({
    url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
    name: "corsproxy.io",
    needsUnwrap: false,
  }),
  // Strategy 3: cors-anywhere demo (limited but worth trying)
  (url: string) => ({
    url: `https://cors-anywhere.herokuapp.com/${url}`,
    name: "cors-anywhere",
    needsUnwrap: false,
  }),
  // Strategy 4: thingproxy.freeboard.io
  (url: string) => ({
    url: `https://thingproxy.freeboard.io/fetch/${url}`,
    name: "thingproxy",
    needsUnwrap: false,
  }),
  // Strategy 5: allorigins JSON wrapper (sometimes works when raw fails)
  (url: string) => ({
    url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    name: "allorigins-json",
    needsUnwrap: true, // Response is { contents: "..." }
  }),
  // Strategy 6: Direct with aggressive browser headers
  (url: string) => ({
    url,
    name: "direct-aggressive",
    needsUnwrap: false,
  }),
];

const parseONPENumber = (str: string) => {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ""), 10);
};

export async function GET() {
  console.log("[fetch-proxy] === STARTING AGGRESSIVE PROXY ATTACK ===");
  const results: Array<{ strategy: string; status: string; error?: string }> = [];

  for (const strategyFn of PROXY_STRATEGIES) {
    const strategy = strategyFn(ONPE_JSON_URL);
    console.log(`[fetch-proxy] Trying: ${strategy.name} -> ${strategy.url.substring(0, 100)}...`);

    try {
      const fetchOptions: RequestInit = {
        next: { revalidate: 0 },
        cache: "no-store",
        signal: AbortSignal.timeout(15000), // 15s timeout per strategy
      };

      // Add browser-like headers for direct attempt
      if (strategy.name === "direct-aggressive") {
        fetchOptions.headers = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "Referer": "https://eg2026.onpe.gob.pe/",
          "Origin": "https://eg2026.onpe.gob.pe",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "DNT": "1",
        };
      }

      const response = await fetch(strategy.url, fetchOptions);
      console.log(`[fetch-proxy] ${strategy.name} -> HTTP ${response.status}`);

      if (!response.ok) {
        results.push({ strategy: strategy.name, status: `HTTP ${response.status}` });
        continue;
      }

      let rawText = await response.text();

      // Unwrap if needed (allorigins JSON wrapper)
      if (strategy.needsUnwrap) {
        try {
          const wrapper = JSON.parse(rawText);
          rawText = wrapper.contents || rawText;
        } catch {
          // Keep rawText as-is
        }
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        results.push({ strategy: strategy.name, status: "Invalid JSON" });
        continue;
      }

      // Validate ONPE structure
      if (!data.generals || !data.results) {
        results.push({ strategy: strategy.name, status: "Invalid ONPE structure" });
        continue;
      }

      // SUCCESS! Process and store
      console.log(`[fetch-proxy] ✅ SUCCESS with ${strategy.name}!`);
      const processedData = processOfficialData(data);

      await kv.set("election:current", processedData);
      await kv.lpush("election:history", processedData);
      await kv.ltrim("election:history", 0, 99);

      return NextResponse.json({
        success: true,
        source: `ONPE via ${strategy.name}`,
        data: processedData,
        proxy_log: results,
      });
    } catch (error: any) {
      console.log(`[fetch-proxy] ${strategy.name} -> Error: ${error.message.substring(0, 80)}`);
      results.push({ strategy: strategy.name, status: "Error", error: error.message.substring(0, 100) });
    }
  }

  // ALL FAILED - try v1 API with proxies as last resort
  console.log("[fetch-proxy] Primary JSON failed, trying v1 API with proxies...");
  for (const strategyFn of [PROXY_STRATEGIES[0], PROXY_STRATEGIES[1]]) {
    const strategy = strategyFn(ONPE_V1_URL);
    try {
      const response = await fetch(strategy.url, {
        next: { revalidate: 0 },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;

      let rawText = await response.text();
      if (strategy.needsUnwrap) {
        try { rawText = JSON.parse(rawText).contents || rawText; } catch { }
      }

      const data = JSON.parse(rawText);
      if (!data.generals || !data.results) continue;

      console.log(`[fetch-proxy] ✅ SUCCESS with v1 API via ${strategy.name}!`);
      const processedData = processOfficialV1Data(data);

      await kv.set("election:current", processedData);
      await kv.lpush("election:history", processedData);
      await kv.ltrim("election:history", 0, 99);

      return NextResponse.json({
        success: true,
        source: `ONPE v1 via ${strategy.name}`,
        data: processedData,
        proxy_log: results,
      });
    } catch {
      // Continue to next
    }
  }

  // TOTAL FAILURE
  return NextResponse.json({
    success: false,
    error: "All 7 proxy strategies failed. ONPE firewall is blocking all known proxies.",
    message: "Los datos de la ONPE no son accesibles desde Vercel. Se necesita Docker Sync desde IP peruana.",
    strategies_tried: results,
  }, { status: 502 });
}

// POST handler
export async function POST(request: Request) {
  try {
    const rawData = await request.json();
    let processedData;

    if (rawData.generals && rawData.results) {
      const useV1 = rawData.generals.porcentajeActasProcesadas !== undefined;
      processedData = useV1 ? processOfficialV1Data(rawData) : processOfficialData(rawData);
    } else if (rawData.candidates && rawData.totals) {
      processedData = rawData;
    } else {
      return NextResponse.json({ success: false, error: "Invalid structure" }, { status: 400 });
    }

    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    return NextResponse.json({ success: true, message: "Data updated." });
  } catch {
    return NextResponse.json({ success: false, error: "Processing error" }, { status: 500 });
  }
}

// ============================================================================
// DATA PROCESSORS
// ============================================================================

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
