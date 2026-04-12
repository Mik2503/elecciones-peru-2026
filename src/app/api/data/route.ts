import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";
const ONPE_V1_URL = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";

// Helper to parse ONPE's numeric strings with commas
const parseONPENumber = (str: string) => {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ""), 10);
};

export async function GET() {
  try {
    const current = await kv.get("election:current");
    const history = await kv.lrange("election:history", 0, -1);

    if (!current) {
      // KV is empty - try to fetch from ONPE automatically
      console.log("[data] KV is empty, attempting automatic fetch from ONPE...");

      // Try primary endpoint first, then fallback to v1
      const fetchResult = await tryFetchFromONPE();

      if (fetchResult.success) {
        // Return the freshly fetched data
        const freshCurrent = await kv.get("election:current");
        const freshHistory = await kv.lrange("election:history", 0, -1);
        return NextResponse.json({
          current: freshCurrent,
          history: freshHistory.reverse(),
          source: fetchResult.source,
          message: "Data fetched automatically from ONPE."
        });
      }

      // Both endpoints failed
      return NextResponse.json({
        current: null,
        history: [],
        message: "Esperando datos oficiales de ONPE... (Los servidores de la ONPE pueden estar bloqueando IPs de Vercel. Ejecute Docker Sync desde una IP local.)",
        error: fetchResult.error
      });
    }

    return NextResponse.json({
      current,
      history: history.reverse() // Return chronological order for charts
    });
  } catch (error) {
    console.error("[data] Data retrieval error:", error);
    return NextResponse.json({ error: "Failed to retrieve data" }, { status: 500 });
  }
}

/**
 * Attempts to fetch from ONPE with fallback between endpoints
 */
async function tryFetchFromONPE(): Promise<{ success: boolean; source: string; error?: string }> {
  // Try primary JSON endpoint
  try {
    console.log("[data] Trying primary endpoint:", ONPE_URL);
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

    if (response.ok) {
      const rawData = await response.json();
      if (rawData.generals && rawData.results) {
        const processedData = processOfficialData(rawData);
        await kv.set("election:current", processedData);
        await kv.lpush("election:history", processedData);
        await kv.ltrim("election:history", 0, 99);
        console.log("[data] Primary endpoint successful");
        return { success: true, source: "ONPE JSON (primary)" };
      }
    } else {
      console.log("[data] Primary endpoint returned:", response.status);
    }
  } catch (error: any) {
    console.log("[data] Primary endpoint failed:", error.message);
  }

  // Fallback to v1 API
  try {
    console.log("[data] Trying v1 API endpoint:", ONPE_V1_URL);
    const response = await fetch(ONPE_V1_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8,en;q=0.7",
        "Referer": "https://eg2026.onpe.gob.pe/",
        "Origin": "https://eg2026.onpe.gob.pe",
      },
      next: { revalidate: 0 }
    });

    if (response.ok) {
      const rawData = await response.json();
      if (rawData.generals && rawData.results) {
        const processedData = processOfficialV1Data(rawData);
        await kv.set("election:current", processedData);
        await kv.lpush("election:history", processedData);
        await kv.ltrim("election:history", 0, 99);
        console.log("[data] v1 API endpoint successful");
        return { success: true, source: "ONPE API v1 (fallback)" };
      }
    } else {
      console.log("[data] v1 API endpoint returned:", response.status);
    }
  } catch (error: any) {
    console.log("[data] v1 API endpoint failed:", error.message);
  }

  return { success: false, source: "none", error: "Both ONPE endpoints are unreachable from this server." };
}

function processOfficialData(data: any) {
  const isResultsMode = data.results && data.results.length > 0 && data.generals.generalData.POR_ACTAS_CONTABILIZADAS !== "0.000";

  if (!isResultsMode) {
    return {
      timestamp: Date.now(),
      status: "VOTACIÓN EN CURSO",
      percentCounted: 0,
      percentInstalled: parseFloat(data.generals.generalData.POR_MESAS_INSTALADAS || "99.8"),
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
