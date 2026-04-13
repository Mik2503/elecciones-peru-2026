import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getComprehensiveElectionData } from "../comprehensive-data/route";
import { getCorruptionAnalysisData } from "../corruption-analysis/route";
import { getRealONPEData } from "./onpe-real-data";

const ONPE_JSON = "https://eg2026.onpe.gob.pe/resultados/presidencial.json";
const ONPE_V1 = "https://eg2026.onpe.gob.pe/api/v1/presidencial/resumen";
const PROXIES = (url: string) => [
  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  `https://corsproxy.io/?${encodeURIComponent(url)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  `https://thingproxy.freeboard.io/fetch/${url}`,
];
const parseN = (s: string) => s ? parseInt(String(s).replace(/,/g, ""), 10) : 0;

export async function GET() {
  console.log("[data] === REAL-TIME DATA FETCH ===");

  // 1. Try ONPE via proxies
  for (const proxyUrl of PROXIES(ONPE_JSON)) {
    try {
      const res = await fetch(proxyUrl, { next: { revalidate: 0 }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      let text = await res.text();
      if (text.startsWith('{"contents"')) { try { text = JSON.parse(text).contents; } catch { } }
      const data = JSON.parse(text);
      if (data?.generals && data?.results) {
        const processed = processONPEData(data);
        await saveToKV(processed);
        return NextResponse.json({ current: processed, source: "ONPE (proxy)", fresh: true, comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData() });
      }
    } catch { /* continue */ }
  }

  // 2. Try ONPE v1 via proxies
  for (const proxyUrl of PROXIES(ONPE_V1)) {
    try {
      const res = await fetch(proxyUrl, { next: { revalidate: 0 }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      let text = await res.text();
      if (text.startsWith('{"contents"')) { try { text = JSON.parse(text).contents; } catch { } }
      const data = JSON.parse(text);
      if (data?.generals && data?.results) {
        const processed = processONPEV1Data(data);
        await saveToKV(processed);
        return NextResponse.json({ current: processed, source: "ONPE v1 (proxy)", fresh: true, comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData() });
      }
    } catch { /* continue */ }
  }

  // 3. Try direct ONPE
  for (const url of [ONPE_JSON, ONPE_V1]) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 0 }, cache: "no-store", signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "application/json", "Accept-Language": "es-PE,es;q=0.9" }
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.generals && data?.results) {
        const processed = url === ONPE_JSON ? processONPEData(data) : processONPEV1Data(data);
        await saveToKV(processed);
        return NextResponse.json({ current: processed, source: "ONPE Direct", fresh: true, comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData() });
      }
    } catch { /* continue */ }
  }

  // 4. Try live media scraping
  try {
    console.log("[data] Trying live media scraping...");
    const scraperRes = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/live-scraper`, {
      next: { revalidate: 0 }, cache: "no-store", signal: AbortSignal.timeout(90000)
    });
    if (scraperRes.ok) {
      const scraperData = await scraperRes.json();
      if (scraperData.success && scraperData.data) {
        console.log("[data] SUCCESS from live media scraper!");
        return NextResponse.json({
          current: scraperData.data, source: scraperData.source, fresh: true,
          comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData()
        });
      }
    }
  } catch (e: any) {
    console.log("[data] Live scraper failed:", e.message.substring(0, 80));
  }

  // 5. Check KV cache (from Playwright scraper POST)
  const existing = await kv.get("election:current");
  if (existing) {
    const history = await kv.lrange("election:history", 0, -1);
    return NextResponse.json({
      current: existing, history: history.reverse(), source: "KV Cache",
      comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData()
    });
  }

  // 6. Fallback to REAL ONPE scraped data
  console.log("[data] Using real ONPE scraped data");
  const realData = getRealONPEData();
  await saveToKV(realData);
  return NextResponse.json({
    current: realData, history: [realData], source: "ONPE Oficial (scraped)",
    fresh: false, note: "Datos reales de resultadoelectoral.onpe.gob.pe - 13/04/2026 02:40 AM",
    comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData()
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.generals && body.results) {
      await saveToKV(processONPEData(body));
      return NextResponse.json({ success: true, source: "POST: ONPE raw" });
    }
    if (body.candidates && body.totals) {
      await saveToKV(body);
      return NextResponse.json({ success: true, source: "POST: processed" });
    }
    return NextResponse.json({ success: false, error: "Invalid format" }, { status: 400 });
  } catch { return NextResponse.json({ success: false, error: "Error" }, { status: 500 }); }
}

async function saveToKV(data: any) {
  await kv.set("election:current", data);
  await kv.lpush("election:history", data);
  await kv.ltrim("election:history", 0, 199);
}

function processONPEData(data: any) {
  const gd = data.generals?.generalData || data.generals || {};
  const isResults = data.results?.length > 0 && gd.POR_ACTAS_CONTABILIZADAS !== "0.000";
  if (!isResults) return { timestamp: Date.now(), status: "VOTACION EN CURSO", percentCounted: 0, percentInstalled: parseFloat(gd.POR_MESAS_INSTALADAS || "0"), candidates: [], totals: { valid: 0, blank: 0, null: 0, total: 0 }, message: "Esperando resultados..." };
  const nulos = data.results.find((i: any) => i.AGRUPACION === "VOTOS NULOS");
  const blancos = data.results.find((i: any) => i.AGRUPACION === "VOTOS EN BLANCO");
  const emitidos = data.results.find((i: any) => i.AGRUPACION === "TOTAL DE VOTOS EMITIDOS");
  return {
    timestamp: Date.now(), status: "RESULTADOS OFICIALES ONPE",
    percentCounted: parseFloat(gd.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: data.results.filter((i: any) => !["VOTOS EN BLANCO", "VOTOS NULOS", "TOTAL DE VOTOS EMITIDOS"].includes(i.AGRUPACION)).map((c: any, i: number) => ({ id: i, name: c.AGRUPACION, party: c.AGRUPACION, votes: parseN(c.TOTAL_VOTOS || "0"), color: getPartyColor(c.AGRUPACION) })).sort((a: any, b: any) => b.votes - a.votes),
    totals: { valid: parseN(emitidos?.TOTAL_VOTOS) - parseN(nulos?.TOTAL_VOTOS) - parseN(blancos?.TOTAL_VOTOS), blank: parseN(blancos?.TOTAL_VOTOS || "0"), null: parseN(nulos?.TOTAL_VOTOS || "0"), total: parseN(emitidos?.TOTAL_VOTOS || "0") }
  };
}

function processONPEV1Data(data: any) {
  const g = data.generals || data; const results = data.results || [];
  return {
    timestamp: Date.now(), status: "RESULTADOS OFICIALES ONPE (v1)",
    percentCounted: parseFloat(g.porcentajeActasProcesadas || g.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: results.map((c: any, i: number) => ({ id: i, name: c.nombreAgrupacion || c.AGRUPACION, party: c.nombreAgrupacion || c.AGRUPACION, votes: parseN(c.votosTotales || c.TOTAL_VOTOS || "0"), color: getPartyColor(c.nombreAgrupacion || c.AGRUPACION) })).sort((a: any, b: any) => b.votes - a.votes),
    totals: { valid: parseN(g.votosValidos || "0"), blank: parseN(g.votosBlancos || "0"), null: parseN(g.votosNulos || "0"), total: parseN(g.votosEmitidos || "0") }
  };
}

function getPartyColor(party: string) {
  const c: Record<string, string> = {
    "FUERZA POPULAR": "#f97316", "RENOVACION POPULAR": "#3b82f6", "PAIS PARA TODOS": "#a855f7",
    "AHORA NACION": "#84cc16", "ALIANZA PARA EL PROGRESO": "#06b6d4", "AVANZA PAIS": "#34d399",
    "JUNTOS POR EL PERU": "#ec4899", "PERU LIBRE": "#ef4444", "PARTIDO MORADO": "#8b5cf6",
    "PODEMOS PERU": "#f59e0b", "PARTIDO DEL BUEN GOBIERNO": "#6366f1", "PARTIDO CIVICO OBRAS": "#64748b",
    "SOMOS PERU": "#eab308", "COOPERACION POPULAR": "#14b8a6", "PARTIDO APRISTA": "#1e40af",
    "PRIMERO LA GENTE": "#facc15", "FRENTE DE LA ESPERANZA": "#22c55e",
    "VOTOS EN BLANCO": "#52525b", "VOTOS NULOS": "#71717a", "Varios": "#78716c"
  };
  if (c[party]) return c[party];
  let hash = 0; for (let i = 0; i < party.length; i++) hash = party.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}
