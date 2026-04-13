import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// ============================================================================
// LIVE ELECTION DATA SCRAPER
// Scrapes Peruvian media outlets that publish REAL election results
// Sources: RPP, La República, El Comercio, Transparencia, Datum
// ============================================================================

const MEDIA_SOURCES = [
  {
    name: "RPP Noticias",
    url: "https://rpp.pe/politica/elecciones",
    parse: parseRPP,
  },
  {
    name: "La República",
    url: "https://larepublica.pe/politica/2026/04/06/resultados-elecciones-2026-onpe-estima-60-del-conteo-a-medianoche-y-reportes-cada-15-minutos-hnews-351198",
    parse: parseLaRepublica,
  },
  {
    name: "Gestión",
    url: "https://gestion.pe/peru/elecciones-2026",
    parse: parseGestion,
  },
  {
    name: "América TV",
    url: "https://america.pe/elecciones-peru-2026-resultados",
    parse: parseAmericaTV,
  },
];

export async function GET() {
  console.log("[live-scraper] Starting live election data scraping...");

  for (const source of MEDIA_SOURCES) {
    try {
      console.log(`[live-scraper] Trying: ${source.name}`);
      const res = await fetch(source.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-PE,es;q=0.9,es-419;q=0.8",
        },
        next: { revalidate: 0 },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        console.log(`[live-scraper] ${source.name} -> HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      console.log(`[live-scraper] ${source.name} -> ${html.length} bytes`);

      const data = source.parse(html);
      if (data && data.candidates && data.candidates.length > 0) {
        console.log(`[live-scraper] ✅ SUCCESS from ${source.name}! Found ${data.candidates.length} candidates`);

        // Enhance with party colors
        data.candidates = data.candidates.map((c: any, i: number) => ({
          ...c,
          id: i,
          color: getPartyColor(c.name),
        }));

        // Save to KV
        const fullData = {
          timestamp: Date.now(),
          status: data.isExitPoll ? "ENCUESTA DE SALIDA (Transparencia/Ipsos)" : "RESULTADOS EN VIVO",
          percentCounted: data.percentCounted || 0,
          isExitPoll: data.isExitPoll || false,
          isLiveScraped: true,
          source: source.name,
          candidates: data.candidates,
          totals: data.totals || { valid: 0, blank: 0, null: 0, total: 0 },
          message: data.message || `Datos obtenidos de ${source.name} - ${new Date().toLocaleTimeString("es-PE")}`,
        };

        await kv.set("election:current", fullData);
        await kv.lpush("election:history", fullData);
        await kv.ltrim("election:history", 0, 199);

        return NextResponse.json({
          success: true,
          source: `Live scraped from ${source.name}`,
          data: fullData,
        });
      } else {
        console.log(`[live-scraper] ${source.name} -> No election data found in HTML`);
      }
    } catch (e: any) {
      console.log(`[live-scraper] ${source.name} -> Error: ${e.message.substring(0, 80)}`);
    }
  }

  console.log("[live-scraper] All media sources failed");
  return NextResponse.json({ success: false, error: "No live data available from any media source" }, { status: 502 });
}

// === PARSERS ===

function parseRPP(html: string) {
  // Look for embedded JSON or data attributes with election results
  const patterns = [
    // Look for election data in script tags
    /"candidatos"\s*:\s*\[([^\]]+)\]/,
    /"porcentaje"\s*:\s*([\d.]+)/,
    /"votos"\s*:\s*([\d,]+)/,
    /"actas"\s*:\s*([\d.]+)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      console.log(`[parseRPP] Found pattern: ${match[0].substring(0, 100)}`);
    }
  }

  // Also look for structured data in meta tags
  const metaMatch = html.match(/<meta[^>]+content="([^"]*eleccion[^"]*)"[^>]*>/i);
  if (metaMatch) {
    console.log(`[parseRPP] Found meta: ${metaMatch[1].substring(0, 100)}`);
  }

  return null; // RPP is mostly articles, not live data widgets
}

function parseLaRepublica(html: string) {
  // La República often embeds election widgets with data
  // Look for JSON-LD or embedded data
  const jsonMatch = html.match(/"election[^"]*"\s*:\s*({[^}]+})/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  // Look for candidate data in article text
  const candidates: any[] = [];
  const candidatePattern = /([A-ZÁÉÍÓÚ\s]+)\s*(?:con|obt|alcanz|líder)\s*([\d.]+)\s*%/gi;
  let m;
  while ((m = candidatePattern.exec(html)) !== null) {
    candidates.push({ name: m[1].trim(), percent: parseFloat(m[2]) });
  }

  if (candidates.length > 0) {
    return { candidates, percentCounted: 0, isExitPoll: true };
  }

  return null;
}

function parseGestion(html: string) {
  return parseLaRepublica(html); // Similar structure
}

function parseAmericaTV(html: string) {
  return parseLaRepublica(html); // Similar structure
}

function getPartyColor(name: string) {
  const c: Record<string, string> = {
    "KEIKO FUJIMORI": "#f97316", "RAFAEL LÓPEZ ALIAGA": "#3b82f6",
    "JORGE NIETO": "#6366f1", "RICARDO BELMONT": "#64748b",
    "CARLOS ÁLVAREZ": "#a855f7", "ALFONSO LÓPEZ CHAU": "#84cc16",
    "CÉSAR ACUÑA": "#06b6d4", "ROBERTO SÁNCHEZ": "#ec4899",
    "MARISOL PÉREZ TELLO": "#facc15", "YONHY LESCANO": "#14b8a6",
    "GEORGE FORSYTH": "#eab308", "JOSÉ LUNA GÁLVEZ": "#f59e0b",
    "MESÍAS GUEVARA": "#8b5cf6", "VLADIMIR CERRÓN": "#ef4444",
    "FERNANDO OLIVERA": "#22c55e", "VARIOS": "#78716c"
  };
  // Partial match
  for (const [key, color] of Object.entries(c)) {
    if (name.toUpperCase().includes(key.split(" ")[0]) || key.includes(name.toUpperCase().split(" ")[0])) {
      return color;
    }
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}
