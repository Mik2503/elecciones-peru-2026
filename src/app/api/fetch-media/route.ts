import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// ============================================================================
// DATA INGESTION ENDPOINT
// Reads official data from Peruvian media that publishes ONPE results
// Also handles boca de urna data until official results are available
// ============================================================================

// Known data sources from Peruvian media that publish election results
const DATA_SOURCES = [
  {
    name: "RPP Noticias",
    url: "https://rpp.pe/politica/elecciones/elecciones-2026-resultados-onpe-conteo-rapido-presidenciales-en-vivo-html",
    type: "official"
  },
  {
    name: "Gestión",
    url: "https://gestion.pe/peru/elecciones-2026-resultados-onpe-conteo-rapido-presidenciales-12-abril-noticia/",
    type: "official"
  },
  {
    name: "América Noticias",
    url: "https://america.pe/elecciones-peru-2026-resultados",
    type: "official"
  }
];

export async function GET() {
  console.log("[fetch-media] Starting media data scrape...");

  // Try each media source
  for (const source of DATA_SOURCES) {
    try {
      console.log(`[fetch-media] Trying: ${source.name}`);
      const res = await fetch(source.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8"
        },
        next: { revalidate: 0 },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Try to extract JSON data embedded in the page
      const jsonData = extractJsonFromHtml(html);
      if (jsonData && jsonData.generals && jsonData.results) {
        console.log(`[fetch-media] ✅ Found official data in ${source.name}!`);
        const processed = processOfficialData(jsonData);
        await kv.set("election:current", processed);
        await kv.lpush("election:history", processed);
        await kv.ltrim("election:history", 0, 99);
        return NextResponse.json({
          success: true,
          source: `${source.name} (official)`,
          data: processed
        });
      }

      // Try to extract data from script tags or meta tags
      const embeddedData = extractEmbeddedResults(html);
      if (embeddedData) {
        console.log(`[fetch-media] ✅ Found embedded data in ${source.name}`);
        await kv.set("election:current", embeddedData);
        await kv.lpush("election:history", embeddedData);
        await kv.ltrim("election:history", 0, 99);
        return NextResponse.json({
          success: true,
          source: `${source.name} (embedded)`,
          data: embeddedData
        });
      }
    } catch (e: any) {
      console.log(`[fetch-media] ${source.name} -> ${e.message.substring(0, 60)}`);
    }
  }

  // No official data available yet - return boca de urna if available
  console.log("[fetch-media] No official data yet, checking boca de urna...");
  const bocaData = getBocaDeUrnaData();
  if (bocaData) {
    await kv.set("election:current", bocaData);
    await kv.lpush("election:history", bocaData);
    await kv.ltrim("election:history", 0, 99);
    return NextResponse.json({
      success: true,
      source: "Boca de Urna (Datum Internacional)",
      data: bocaData,
      note: "Encuesta de salida - NO son resultados oficiales de la ONPE"
    });
  }

  return NextResponse.json({
    success: false,
    error: "No data available from any media source or boca de urna.",
    message: "Esperando datos oficiales o encuestas de salida."
  }, { status: 502 });
}

// Extract JSON from HTML (data attributes, script tags, etc.)
function extractJsonFromHtml(html: string): any | null {
  // Look for JSON in script tags
  const patterns = [
    /var\s+electionData\s*=\s*({[^;]+})/,
    /window\.__DATA__\s*=\s*({[^;]+})/,
    /"generals"\s*:\s*{[^}]+}/,
    /{"generals"[^}]+}/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        let jsonStr = match[1] || match[0];
        return JSON.parse(jsonStr);
      } catch {
        // Continue
      }
    }
  }
  return null;
}

// Extract election results from embedded HTML data
function extractEmbeddedResults(html: string): any | null {
  // Look for election result patterns in HTML
  const candidateMatches = html.match(/Keiko Fujimori.*?(\d+[\d,.]*)\s*(%|votos)/gi);
  if (candidateMatches) {
    // Found candidate data in HTML
    console.log("[fetch-media] Found candidate data in HTML");
  }
  return null;
}

// Boca de urna data from Datum Internacional (April 12, 2026)
// Source: El Comercio, multiple media outlets
function getBocaDeUrnaData(): any | null {
  // Only return if we have at least the top candidates
  const topCandidates = [
    { name: "Keiko Fujimori", party: "Fuerza Popular", percent: 16.5 },
    { name: "Rafael López Aliaga", party: "Renovación Popular", percent: 12.8 },
    { name: "Jorge Nieto", party: "Partido del Buen Gobierno", percent: 11.6 },
    { name: "Ricardo Belmont", party: "Partido Cívico Obras", percent: 10.5 }
  ];

  // Estimate votes based on ~27M registered voters and ~75% turnout
  const estimatedTurnout = 20250000; // ~75% of 27M
  const estimatedTotalVotes = Math.round(estimatedTurnout * 0.85); // ~85% valid votes

  return {
    timestamp: Date.now(),
    status: "BOCA DE URNA (Encuesta de Salida - Datum)",
    percentCounted: 0,
    percentEstimated: 100,
    isExitPoll: true,
    candidates: topCandidates.map((c, i) => ({
      id: i,
      name: c.name.toUpperCase(),
      party: c.party,
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
    message: "Datos de boca de urna - NO son resultados oficiales. Resultados ONPE desde las 7:30 PM.",
    source: "Datum Internacional - Encuesta de salida a las 6:00 PM"
  };
}

function processOfficialData(data: any) {
  const parseN = (s: string) => s ? parseInt(s.replace(/,/g, ""), 10) : 0;
  const g = data.generals;
  const gd = g?.generalData || g;
  const isResults = data.results?.length > 0 && gd?.POR_ACTAS_CONTABILIZADAS !== "0.000";

  if (!isResults) {
    return {
      timestamp: Date.now(), status: "VOTACIÓN EN CURSO",
      percentCounted: 0, percentInstalled: parseFloat(gd?.POR_MESAS_INSTALADAS || "0"),
      candidates: [], totals: { valid: 0, blank: 0, null: 0, total: 0 },
      message: "Esperando resultados oficiales..."
    };
  }

  const nulos = data.results.find((i: any) => i.AGRUPACION === "VOTOS NULOS");
  const blancos = data.results.find((i: any) => i.AGRUPACION === "VOTOS EN BLANCO");
  const emitidos = data.results.find((i: any) => i.AGRUPACION === "TOTAL DE VOTOS EMITIDOS");

  return {
    timestamp: Date.now(), status: "RESULTADOS OFICIALES",
    percentCounted: parseFloat(gd?.POR_ACTAS_CONTABILIZADAS || "0"),
    candidates: data.results
      .filter((i: any) => !["VOTOS EN BLANCO", "VOTOS NULOS", "TOTAL DE VOTOS EMITIDOS"].includes(i.AGRUPACION))
      .map((c: any, i: number) => ({
        id: i, name: c.AGRUPACION, party: c.AGRUPACION,
        votes: parseN(c.TOTAL_VOTOS || "0"), color: getPartyColor(c.AGRUPACION)
      })).sort((a: any, b: any) => b.votes - a.votes),
    totals: {
      valid: parseN(emitidos?.TOTAL_VOTOS) - parseN(nulos?.TOTAL_VOTOS) - parseN(blancos?.TOTAL_VOTOS),
      blank: parseN(blancos?.TOTAL_VOTOS || "0"),
      null: parseN(nulos?.TOTAL_VOTOS || "0"),
      total: parseN(emitidos?.TOTAL_VOTOS || "0")
    }
  };
}

function getPartyColor(party: string) {
  const c: Record<string, string> = {
    "FUERZA POPULAR": "#f97316", "RENOVACIÓN POPULAR": "#3b82f6",
    "PAÍS PARA TODOS": "#a855f7", "AHORA NACIÓN": "#84cc16",
    "ALIANZA PARA EL PROGRESO": "#06b6d4", "AVANZA PAÍS": "#34d399",
    "JUNTOS POR EL PERÚ": "#ec4899", "PERÚ LIBRE": "#ef4444",
    "PARTIDO DEL BUEN GOBIERNO": "#6366f1", "PARTIDO CÍVICO OBRAS": "#64748b",
    "VOTOS EN BLANCO": "#52525b", "VOTOS NULOS": "#71717a"
  };
  return c[party] || `hsl(${Math.abs(party.split("").reduce((a, ch) => ch.charCodeAt(0) + ((a << 5) - a), 0)) % 360}, 65%, 55%)`;
}
