import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getComprehensiveElectionData } from "../comprehensive-data/route";
import { getCorruptionAnalysisData } from "../corruption-analysis/route";

export async function GET() {
  // ============================================================
  // STEP 1: KV cache (fast, persisted across deploys)
  // ============================================================
  let kvData: any = null;
  try {
    kvData = await kv.get("election:current");
  } catch { /* KV unavailable */ }

  if (kvData && kvData.candidates && kvData.candidates.length > 0) {
    let history: any[] = [];
    try { history = await kv.lrange("election:history", 0, -1); } catch { }
    return NextResponse.json({
      current: kvData,
      history: history.reverse(),
      source: "KV Cache (live data)",
      comprehensive: getComprehensiveElectionData(),
      corruption: getCorruptionAnalysisData(),
    });
  }

  // ============================================================
  // STEP 2: No KV data - return comprehensive poll data
  // ============================================================
  const comp = getComprehensiveElectionData();
  const bocaData = comp.bocaDeUrna;

  return NextResponse.json({
    current: {
      timestamp: Date.now(),
      status: `ENCUESTA DE SALIDA - ${bocaData.source} (${bocaData.time})`,
      percentCounted: 0,
      isExitPoll: true,
      isLiveScraped: false,
      source: bocaData.source,
      candidates: (bocaData.candidates || []).map((c: any, i: number) => ({
        id: i, name: c.name, party: c.party, votes: c.votes,
        percent: c.percent, color: c.color,
      })),
      totals: {
        valid: comp.totals.validVotes,
        blank: comp.totals.blankVotes,
        null: comp.totals.nullVotes,
        total: comp.totals.totalVotes,
      },
      message: `${bocaData.type}: ${bocaData.time}. Datos oficiales ONPE en proceso de carga.`,
    },
    source: "Boca de Urna - Datum",
    comprehensive: comp,
    corruption: getCorruptionAnalysisData(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.presidenciales && body.actas) {
      const data = {
        timestamp: body.timestamp || Date.now(),
        status: `RESULTADOS EN VIVO - ONPE Oficial (${body.lastUpdate || ""})`,
        percentCounted: body.presidenciales.percent || 0,
        isExitPoll: false,
        isLiveScraped: true,
        source: "ONPE Official (Playwright Scraper)",
        candidates: (body.presidenciales.candidates || []).map((c: any, i: number) => ({
          id: c.id || i, name: c.name, party: c.party, votes: c.votes,
          percent: c.validPercent, color: c.color || "#71717a",
        })),
        totals: {
          valid: body.presidenciales.totals?.validVotes || 0,
          blank: body.presidenciales.totals?.blankVotes || 0,
          null: body.presidenciales.totals?.nullVotes || 0,
          total: body.presidenciales.totals?.totalVotes || 0,
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
        lastUpdate: body.lastUpdate || "",
      };
      await kv.set("election:current", data);
      await kv.lpush("election:history", data);
      await kv.ltrim("election:history", 0, 199);
      return NextResponse.json({ success: true, source: "ONPE scraped data", candidates: data.candidates.length });
    }

    if (body.generals && body.results) {
      await kv.set("election:current", processONPEData(body));
      return NextResponse.json({ success: true });
    }

    if (body.candidates && body.totals) {
      await kv.set("election:current", body);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid format" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Error processing data" }, { status: 500 });
  }
}

function processONPEData(data: any) {
  const gd = data.generals?.generalData || data.generals || {};
  const isResults = data.results?.length > 0 && gd.POR_ACTAS_CONTABILIZADAS !== "0.000" && gd.POR_ACTAS_CONTABILIZADAS !== "0";

  if (!isResults) {
    return {
      timestamp: Date.now(), status: "VOTACION EN CURSO", percentCounted: 0,
      isExitPoll: false, source: "ONPE - Mesas instalándose",
      candidates: [], totals: { valid: 0, blank: 0, null: 0, total: 0 },
    };
  }

  const nulos = data.results.find((i: any) => i.AGRUPACION === "VOTOS NULOS");
  const blancos = data.results.find((i: any) => i.AGRUPACION === "VOTOS EN BLANCO");
  const emitidos = data.results.find((i: any) => i.AGRUPACION === "TOTAL DE VOTOS EMITIDOS");
  const parseN = (s: string) => (s ? parseInt(String(s).replace(/,/g, ""), 10) : 0);

  const candidates = data.results
    .filter((i: any) => !["VOTOS EN BLANCO", "VOTOS NULOS", "TOTAL DE VOTOS EMITIDOS"].includes(i.AGRUPACION))
    .map((c: any, i: number) => ({
      id: i, name: c.AGRUPACION, party: c.AGRUPACION,
      votes: parseN(c.TOTAL_VOTOS || "0"), percent: 0,
      color: getPartyColor(c.AGRUPACION),
    }))
    .sort((a: any, b: any) => b.votes - a.votes);

  const totalValidVotes = candidates.reduce((sum: number, c: any) => sum + c.votes, 0);
  candidates.forEach((c: any) => {
    c.percent = totalValidVotes > 0 ? Math.round((c.votes / totalValidVotes) * 1000) / 10 : 0;
  });

  return {
    timestamp: Date.now(), status: "RESULTADOS OFICIALES ONPE",
    percentCounted: parseFloat(gd.POR_ACTAS_CONTABILIZADAS || "0"),
    isExitPoll: false, source: "ONPE Oficial", candidates,
    totals: {
      valid: parseN(emitidos?.TOTAL_VOTOS) - parseN(nulos?.TOTAL_VOTOS) - parseN(blancos?.TOTAL_VOTOS),
      blank: parseN(blancos?.TOTAL_VOTOS || "0"),
      null: parseN(nulos?.TOTAL_VOTOS || "0"),
      total: parseN(emitidos?.TOTAL_VOTOS || "0"),
    },
  };
}

function getPartyColor(party: string) {
  const colors: Record<string, string> = {
    "FUERZA POPULAR": "#f97316", "RENOVACIÓN POPULAR": "#3b82f6", "RENOVACION POPULAR": "#3b82f6",
    "PAÍS PARA TODOS": "#a855f7", "PAIS PARA TODOS": "#a855f7",
    "AHORA NACIÓN": "#84cc16", "AHORA NACION": "#84cc16", "AHORA NACION - AN": "#84cc16",
    "ALIANZA PARA EL PROGRESO": "#06b6d4", "AVANZA PAÍS": "#34d399", "AVANZA PAIS": "#34d399",
    "JUNTOS POR EL PERÚ": "#ec4899", "JUNTOS POR EL PERU": "#ec4899",
    "PERÚ LIBRE": "#ef4444", "PERU LIBRE": "#ef4444",
    "SOMOS PERÚ": "#eab308", "SOMOS PERU": "#eab308",
    "PARTIDO MORADO": "#8b5cf6", "PODEMOS PERÚ": "#f59e0b", "PODEMOS PERU": "#f59e0b",
    "COOPERACIÓN POPULAR": "#14b8a6", "COOPERACION POPULAR": "#14b8a6",
    "PARTIDO APRISTA": "#1e40af", "PARTIDO APRISTA PERUANO": "#1e40af",
    "PARTIDO DEL BUEN GOBIERNO": "#6366f1", "PARTIDO CÍVICO OBRAS": "#64748b", "PARTIDO CIVICO OBRAS": "#64748b",
    "PARTIDO FRENTE DE LA ESPERANZA 2021": "#22c55e", "LIBERTAD POPULAR": "#0ea5e9",
    "FUERZA Y LIBERTAD": "#f43f5e", "PARTIDO PATRIÓTICO DEL PERÚ": "#78716c", "PARTIDO PATRIOTICO DEL PERU": "#78716c",
    "PARTIDO DEMÓCRATA UNIDO PERÚ": "#a3e635", "PARTIDO DEMOCRATA UNIDO PERU": "#a3e635",
    "PARTIDO DEMÓCRATA VERDE": "#4ade80", "PARTIDO DEMOCRATA VERDE": "#4ade80",
    "PARTIDO DEMOCRÁTICO FEDERAL": "#2dd4bf", "PARTIDO DEMOCRATICO FEDERAL": "#2dd4bf",
    "PARTIDO POLÍTICO INTEGRIDAD DEMOCRÁTICA": "#c084fc", "PARTIDO POLITICO INTEGRIDAD DEMOCRATICA": "#c084fc",
    "PARTIDO POLÍTICO PERÚ ACCIÓN": "#fb923c", "PARTIDO POLITICO PERU ACCION": "#fb923c",
    "PERÚ PRIMERO": "#fbbf24", "PERU PRIMERO": "#fbbf24",
    "PARTIDO POLÍTICO PRIN": "#38bdf8", "PARTIDO POLITICO PRIN": "#38bdf8",
    "PARTIDO SÍ CREO": "#e879f9", "PARTIDO SICREO": "#e879f9",
    "PERÚ MODERNO": "#22d3ee", "PERU MODERNO": "#22d3ee",
    "PRIMERO LA GENTE": "#facc15", "PROGRESEMOS": "#a78bfa",
    "SALVEMOS AL PERÚ": "#fb7185", "SALVEMOS AL PERU": "#fb7185",
    "UN CAMINO DIFERENTE": "#94a3b8", "UNIDAD NACIONAL": "#1d4ed8",
    "ALIANZA VENCEREMOS": "#0d9488", "ALIANZA ELECTORAL VENCEREMOS": "#0d9488",
    "FE EN EL PERÚ": "#c2410c", "FE EN EL PERU": "#c2410c",
    "PARTIDO DEMOCRATICO SOMOS PERU": "#eab308",
    "VOTOS EN BLANCO": "#52525b", "VOTOS NULOS": "#71717a", "TOTAL DE VOTOS EMITIDOS": "#3f3f46",
  };
  if (colors[party]) return colors[party];
  let hash = 0;
  for (let i = 0; i < party.length; i++) hash = party.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}
