import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const ONPE_JSON_URL = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";
const ONPE_V1_URL = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";

// Same proxy strategies as fetch-proxy, embedded for auto-fetch
const PROXY_URLS = (base: string) => [
  { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`, name: "allorigins", needsUnwrap: false },
  { url: `https://corsproxy.io/?${encodeURIComponent(base)}`, name: "corsproxy.io", needsUnwrap: false },
  { url: `https://thingproxy.freeboard.io/fetch/${base}`, name: "thingproxy", needsUnwrap: false },
  { url: `https://api.allorigins.win/get?url=${encodeURIComponent(base)}`, name: "allorigins-json", needsUnwrap: true },
];

const parseONPENumber = (str: string) => {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ""), 10);
};

export async function GET() {
  try {
    const current = await kv.get("election:current");
    const history = await kv.lrange("election:history", 0, -1);

    if (current) {
      return NextResponse.json({ current, history: history.reverse() });
    }

    // KV empty - auto-fetch through all proxies
    console.log("[data] KV empty, attempting proxy auto-fetch...");
    const fetchResult = await tryFetchThroughProxies();

    if (fetchResult.success) {
      const fresh = await kv.get("election:current");
      const freshHistory = await kv.lrange("election:history", 0, -1);
      return NextResponse.json({
        current: fresh,
        history: freshHistory.reverse(),
        source: fetchResult.source
      });
    }

    // All proxies failed - try boca de urna data
    console.log("[data] Proxies failed, loading boca de urna data...");
    const bocaData = getBocaDeUrnaData();
    if (bocaData) {
      await kv.set("election:current", bocaData);
      await kv.lpush("election:history", bocaData);
      await kv.ltrim("election:history", 0, 99);
      return NextResponse.json({
        current: bocaData,
        history: [bocaData],
        source: "Boca de Urna - Datum Internacional",
        note: "Encuesta de salida - NO son resultados oficiales de ONPE"
      });
    }

    return NextResponse.json({
      current: null,
      history: [],
      message: "Esperando datos oficiales de ONPE...",
      error: fetchResult.error
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to retrieve data" }, { status: 500 });
  }
}

async function tryFetchThroughProxies(): Promise<{ success: boolean; source: string; error?: string }> {
  // Try primary JSON URL through all proxies
  for (const proxy of PROXY_URLS(ONPE_JSON_URL)) {
    try {
      const res = await fetch(proxy.url, { next: { revalidate: 0 }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;

      let text = await res.text();
      if (proxy.needsUnwrap) { try { text = JSON.parse(text).contents || text; } catch { } }

      const data = JSON.parse(text);
      if (!data.generals || !data.results) continue;

      const processed = processOfficialData(data);
      await kv.set("election:current", processed);
      await kv.lpush("election:history", processed);
      await kv.ltrim("election:history", 0, 99);
      console.log(`[data] ✅ Success via ${proxy.name}`);
      return { success: true, source: `ONPE JSON via ${proxy.name}` };
    } catch { /* continue */ }
  }

  // Try v1 API through proxies
  for (const proxy of PROXY_URLS(ONPE_V1_URL)) {
    try {
      const res = await fetch(proxy.url, { next: { revalidate: 0 }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;

      let text = await res.text();
      if (proxy.needsUnwrap) { try { text = JSON.parse(text).contents || text; } catch { } }

      const data = JSON.parse(text);
      if (!data.generals || !data.results) continue;

      const processed = processOfficialV1Data(data);
      await kv.set("election:current", processed);
      await kv.lpush("election:history", processed);
      await kv.ltrim("election:history", 0, 99);
      console.log(`[data] ✅ Success via v1 + ${proxy.name}`);
      return { success: true, source: `ONPE v1 via ${proxy.name}` };
    } catch { /* continue */ }
  }

  return { success: false, source: "none", error: "All proxy strategies failed" };
}

/** Boca de urna data from Datum Internacional (April 12, 2026) */
function getBocaDeUrnaData(): any | null {
  const topCandidates = [
    { name: "KEIKO FUJIMORI", party: "Fuerza Popular", percent: 16.5 },
    { name: "RAFAEL LÓPEZ ALIAGA", party: "Renovación Popular", percent: 12.8 },
    { name: "JORGE NIETO", party: "Partido del Buen Gobierno", percent: 11.6 },
    { name: "RICARDO BELMONT", party: "Partido Cívico Obras", percent: 10.5 }
  ];
  const estimatedTurnout = 20250000;
  const estimatedTotalVotes = Math.round(estimatedTurnout * 0.85);

  return {
    timestamp: Date.now(),
    status: "BOCA DE URNA (Encuesta de Salida - Datum)",
    percentCounted: 0, percentEstimated: 100,
    isExitPoll: true,
    candidates: topCandidates.map((c, i) => ({
      id: i, name: c.name, party: c.party,
      votes: Math.round(estimatedTotalVotes * c.percent / 100),
      percent: c.percent,
      color: getPartyColor(c.party)
    })),
    totals: {
      valid: estimatedTotalVotes,
      blank: Math.round(estimatedTurnout * 0.03),
      null: Math.round(estimatedTurnout * 0.05),
      total: estimatedTurnout
    },
    message: "Encuesta de salida Datum - Resultados oficiales ONPE desde las 7:30 PM"
  };
}

function processOfficialData(data: any) {
  const isResultsMode = data.results && data.results.length > 0 &&
    data.generals.generalData?.POR_ACTAS_CONTABILIZADAS !== "0.000";

  if (!isResultsMode) {
    return {
      timestamp: Date.now(), status: "VOTACIÓN EN CURSO",
      percentCounted: 0, percentInstalled: parseFloat(data.generals.generalData?.POR_MESAS_INSTALADAS || "99.8"),
      candidates: [], totals: { valid: 0, blank: 0, null: 0, total: 0 },
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
    timestamp: Date.now(), status: "RESULTADOS OFICIALES",
    percentCounted: parseFloat(data.generals.generalData?.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: candidatesRaw.map((c: any, i: number) => ({
      id: i, name: c.AGRUPACION, party: c.AGRUPACION,
      votes: parseONPENumber(c.TOTAL_VOTOS || "0"), color: getPartyColor(c.AGRUPACION)
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
  const g = data.generals || data;
  const r = data.results || [];
  return {
    timestamp: Date.now(), status: "RESULTADOS OFICIALES (v1)",
    percentCounted: parseFloat(g.porcentajeActasProcesadas || g.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: r.map((c: any, i: number) => ({
      id: i, name: c.nombreAgrupacion || c.AGRUPACION, party: c.nombreAgrupacion || c.AGRUPACION,
      votes: parseInt((c.votosTotales || c.TOTAL_VOTOS || "0").toString().replace(/,/g, ""), 10),
      color: getPartyColor(c.nombreAgrupacion || c.AGRUPACION)
    })).sort((a: any, b: any) => b.votes - a.votes),
    totals: {
      valid: parseInt((g.votosValidos || "0").toString().replace(/,/g, ""), 10),
      blank: parseInt((g.votosBlancos || "0").toString().replace(/,/g, ""), 10),
      null: parseInt((g.votosNulos || "0").toString().replace(/,/g, ""), 10),
      total: parseInt((g.votosEmitidos || "0").toString().replace(/,/g, ""), 10)
    }
  };
}

function getPartyColor(party: string) {
  const colors: Record<string, string> = {
    "FUERZA POPULAR": "#f97316", "RENOVACIÓN POPULAR": "#3b82f6",
    "PAÍS PARA TODOS": "#a855f7", "AHORA NACIÓN": "#84cc16",
    "ALIANZA PARA EL PROGRESO": "#06b6d4", "AVANZA PAÍS": "#34d399",
    "JUNTOS POR EL PERÚ": "#ec4899", "PERÚ LIBRE": "#ef4444",
    "SOMOS PERÚ": "#eab308", "PARTIDO MORADO": "#8b5cf6",
    "PODEMOS PERÚ": "#f59e0b", "COOPERACIÓN POPULAR": "#14b8a6",
    "PARTIDO APRISTA": "#1e40af", "VOTOS EN BLANCO": "#52525b", "VOTOS NULOS": "#71717a"
  };
  if (colors[party]) return colors[party];
  let hash = 0;
  for (let i = 0; i < party.length; i++) hash = party.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}
