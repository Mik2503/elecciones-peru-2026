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
    const response = await fetch(ONPE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`ONPE Official Server returned status ${response.status}`);
    }

    const rawData = await response.json();
    
    // VALIDATION: Ensure it's the real official structure
    if (!rawData.generals || !rawData.results) {
      throw new Error("Invalid official JSON structure received from ONPE.");
    }

    const processedData = processOfficialData(rawData);

    // Save to KV
    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    return NextResponse.json({ success: true, source: "ONPE Official API", data: processedData });
  } catch (error: any) {
    console.error("Official Fetch Error:", error.message);
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
    const rawData = await request.json();
    
    // Check if it's the raw official structure and process it
    let processedData;
    if (rawData.generals && rawData.results) {
      processedData = processOfficialData(rawData);
    } else if (rawData.candidates && rawData.totals) {
      processedData = rawData; // Already processed
    } else {
      return NextResponse.json({ success: false, error: "Invalid official JSON structure" }, { status: 400 });
    }
    
    await kv.set("election:current", processedData);
    await kv.lpush("election:history", processedData);
    await kv.ltrim("election:history", 0, 99);

    return NextResponse.json({ success: true, message: "Official data updated successfully." });
  } catch (error) {
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
  const colors: Record<string, string> = {
    "FUERZA POPULAR": "#f97316",
    "RENOVACIÓN POPULAR": "#3b82f6",
    "A.N.T.A.U.R.O.": "#ef4444",
    "AVANZA PAÍS": "#34d399",
    "JUNTOS POR EL PERÚ": "#ec4899",
    "PERÚ LIBRE": "#ef4444",
    "VOTOS NULOS": "#71717a",
    "VOTOS EN BLANCO": "#52525b"
  };
  return colors[party] || "#71717a";
}
