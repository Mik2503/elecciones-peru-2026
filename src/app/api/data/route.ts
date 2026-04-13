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

export async function GET() {
  // 1. Try KV cache first (from scraper)
  const existing: any = await kv.get("election:current");
  if (existing && existing.candidates && existing.candidates.length > 0) {
    const history = await kv.lrange("election:history", 0, -1);
    return NextResponse.json({
      current: existing, history: history.reverse(), source: "KV Cache (live scraper)",
      comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData()
    });
  }

  // 2. Try ONPE via proxies
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
    } catch { }
  }

  // 3. Fallback to REAL ONPE scraped data
  const realData = getRealONPEData();
  await saveToKV(realData);
  return NextResponse.json({
    current: realData, history: [realData], source: "ONPE Oficial (scraped)",
    comprehensive: getComprehensiveElectionData(), corruption: getCorruptionAnalysisData()
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.presidenciales && body.actas) {
      const data = {
        timestamp: body.timestamp || Date.now(),
        status: `RESULTADOS EN VIVO - ONPE Oficial (${body.lastUpdate || ''})`,
        percentCounted: body.presidenciales.percent || 0,
        isExitPoll: false, isLiveScraped: true,
        source: 'ONPE Official (Playwright Scraper)',
        candidates: (body.presidenciales.candidates || []).map((c: any, i: number) => ({
          id: c.id || i, name: c.name, party: c.party, votes: c.votes, percent: c.validPercent, color: c.color || '#71717a'
        })),
        totals: {
          valid: body.presidenciales.totals?.validVotes || 0,
          blank: body.presidenciales.totals?.blankVotes || 0,
          null: body.presidenciales.totals?.nullVotes || 0,
          total: body.presidenciales.totals?.totalVotes || 0
        },
        actasProcessed: body.presidenciales.processedActas || 0,
        actasTotal: body.presidenciales.totalActas || 0,
        actasPending: body.presidenciales.pendingActas || 0,
        senadoresUnico: body.senadoresUnico || null,
        senadoresMultiple: body.senadoresMultiple || null,
        diputados: body.diputados || null,
        parlamentoAndino: body.parlamentoAndino || null,
        participacion: body.participacion || null,
        actasSummary: body.actas || null,
        lastUpdate: body.lastUpdate || ''
      };
      await saveToKV(data);
      return NextResponse.json({ success: true, source: 'ONPE scraped data', candidates: data.candidates.length });
    }
    if (body.generals && body.results) { await saveToKV(processONPEData(body)); return NextResponse.json({ success: true }); }
    if (body.candidates && body.totals) { await saveToKV(body); return NextResponse.json({ success: true }); }
    return NextResponse.json({ success: false, error: 'Invalid format' }, { status: 400 });
  } catch { return NextResponse.json({ success: false, error: 'Error' }, { status: 500 }); }
}

async function saveToKV(d: any) { await kv.set("election:current", d); await kv.lpush("election:history", d); await kv.ltrim("election:history", 0, 199); }

function processONPEData(data: any) {
  const gd = data.generals?.generalData || data.generals || {};
  const isResults = data.results?.length > 0 && gd.POR_ACTAS_CONTABILIZADAS !== "0.000";
  if (!isResults) return { timestamp: Date.now(), status: "VOTACION EN CURSO", percentCounted: 0, candidates: [], totals: { valid: 0, blank: 0, null: 0, total: 0 } };
  const nulos = data.results.find((i: any) => i.AGRUPACION === "VOTOS NULOS");
  const blancos = data.results.find((i: any) => i.AGRUPACION === "VOTOS EN BLANCO");
  const emitidos = data.results.find((i: any) => i.AGRUPACION === "TOTAL DE VOTOS EMITIDOS");
  const parseN = (s: string) => s ? parseInt(String(s).replace(/,/g, ""), 10) : 0;
  return {
    timestamp: Date.now(), status: "RESULTADOS OFICIALES ONPE",
    percentCounted: parseFloat(gd.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: data.results.filter((i: any) => !["VOTOS EN BLANCO", "VOTOS NULOS", "TOTAL DE VOTOS EMITIDOS"].includes(i.AGRUPACION)).map((c: any, i: number) => ({ id: i, name: c.AGRUPACION, party: c.AGRUPACION, votes: parseN(c.TOTAL_VOTOS || "0") })).sort((a: any, b: any) => b.votes - a.votes),
    totals: { valid: parseN(emitidos?.TOTAL_VOTOS) - parseN(nulos?.TOTAL_VOTOS) - parseN(blancos?.TOTAL_VOTOS), blank: parseN(blancos?.TOTAL_VOTOS || "0"), null: parseN(nulos?.TOTAL_VOTOS || "0"), total: parseN(emitidos?.TOTAL_VOTOS || "0") }
  };
}
