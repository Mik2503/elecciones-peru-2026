import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// ============================================================================
// CORRUPTION DATA API - Real data from JNE Voto Informado
// Provides structured corruption analysis data for all 6 corruption modules
// ============================================================================

// Real data sources for corruption analysis
const DATA_SOURCES = {
  jneVotoInformado: "https://votoinformado.jne.gob.pe",
  jneAPI: "https://web.jne.gob.pe/serviciovotoinformado/api",
  onpeClaridad: "https://www.gob.pe/10261-acceder-a-la-rendicion-de-cuentas-de-las-organizaciones-politicas-claridad",
  seace: "https://prodapp2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml",
  sunat: "https://e-consultaruc.sunat.gob.pe/clfront-end/",
  mefDatosAbiertos: "https://datosabiertos.mef.gob.pe/",
  poderJudicial: "https://www.pj.gob.pe/pj",
  transparencia: "https://www.transparencia.gob.pe/"
};

// Module availability status based on data source accessibility
const MODULE_STATUS = {
  radarPatrimonial: {
    available: true,
    source: "JNE Voto Informado - Declaración Jurada de Hoja de Vida",
    url: DATA_SOURCES.jneVotoInformado,
    description: "Datos de bienes inmuebles, muebles e ingresos autodeclarados disponibles en la Hoja de Vida de cada candidato en JNE Voto Informado."
  },
  buscadorFantasmas: {
    available: false,
    source: "ONPE Claridad + SEACE + SUNAT",
    url: DATA_SOURCES.onpeClaridad,
    description: "Los datos de aportantes de campaña están en ONPE Claridad (interfaz HTML). El cruce con SEACE requiere scraping manual. SUNAT tiene CAPTCHA que bloquea automatización."
  },
  historialJudicial: {
    available: true,
    source: "JNE Voto Informado - Antecedentes penales declarados",
    url: DATA_SOURCES.jneVotoInformado,
    description: "Los antecedentes penales declarados por cada candidato están en su Hoja de Vida en JNE Voto Informado. Datos de REDAM requieren consulta individual en Poder Judicial."
  },
  redesFamiliares: {
    available: false,
    source: "JNE Voto Informado + Portal Transparencia MEF",
    url: DATA_SOURCES.transparencia,
    description: "Los nombres de familiares están en la Hoja de Vida del JNE. El cruce con planillas del Estado requiere acceso al Portal de Transparencia (datos por entidad)."
  },
  factChecker: {
    available: true,
    source: "JNE - Planes de Gobierno (PDFs)",
    url: DATA_SOURCES.jneVotoInformado,
    description: "Los planes de gobierno están disponibles como PDFs en JNE Voto Informado. El cruce con presupuesto MEF requiere análisis manual de los PDFs."
  },
  grafoPoder: {
    available: false,
    source: "SEACE + ONPE Claridad",
    url: DATA_SOURCES.seace,
    description: "Requiere cruce de datos de aportantes (ONPE Claridad) con contratos del Estado (SEACE). Ambos son interfaces HTML sin API."
  }
};

export async function GET() {
  // Try to get real scraped data from KV first
  let realCandidates: any[] = [];
  try {
    const scrapedData: any = await kv.get("corruption:jne-data");
    if (scrapedData && scrapedData.candidatos) {
      realCandidates = scrapedData.candidatos;
    }
  } catch (e) { }

  // If no scraped data, extract from election data
  if (realCandidates.length === 0) {
    try {
      const electionData: any = await kv.get("election:current");
      if (electionData && electionData.candidates) {
        realCandidates = electionData.candidates.map((c: any, i: number) => ({
          id: i + 1,
          nombre: c.name,
          partido: c.party,
          nroDocumento: '',
          idHojaVida: 0,
          estado: 'INSCRITO',
          cargo: 'PRESIDENTE'
        }));
      }
    } catch (e) { }
  }

  // Module availability status based on data source accessibility
  const MODULE_STATUS = {
    radarPatrimonial: {
      available: true,
      source: "JNE Voto Informado - Declaración Jurada de Hoja de Vida",
      url: DATA_SOURCES.jneVotoInformado,
      description: "Datos de bienes inmuebles, muebles e ingresos autodeclarados disponibles en la Hoja de Vida de cada candidato en JNE Voto Informado."
    },
    buscadorFantasmas: {
      available: false,
      source: "ONPE Claridad + SEACE + SUNAT",
      url: DATA_SOURCES.onpeClaridad,
      description: "Los datos de aportantes de campaña están en ONPE Claridad (interfaz HTML). El cruce con SEACE requiere scraping manual. SUNAT tiene CAPTCHA que bloquea automatización."
    },
    historialJudicial: {
      available: true,
      source: "JNE Voto Informado - Antecedentes penales declarados",
      url: DATA_SOURCES.jneVotoInformado,
      description: "Los antecedentes penales declarados por cada candidato están en su Hoja de Vida en JNE Voto Informado. Datos de REDAM requieren consulta individual en Poder Judicial."
    },
    redesFamiliares: {
      available: false,
      source: "JNE Voto Informado + Portal Transparencia MEF",
      url: DATA_SOURCES.transparencia,
      description: "Los nombres de familiares están en la Hoja de Vida del JNE. El cruce con planillas del Estado requiere acceso al Portal de Transparencia (datos por entidad)."
    },
    factChecker: {
      available: true,
      source: "JNE - Planes de Gobierno (PDFs)",
      url: DATA_SOURCES.jneVotoInformado,
      description: "Los planes de gobierno están disponibles como PDFs en JNE Voto Informado. El cruce con presupuesto MEF requiere análisis manual de los PDFs."
    },
    grafoPoder: {
      available: false,
      source: "SEACE + ONPE Claridad",
      url: DATA_SOURCES.seace,
      description: "Requiere cruce de datos de aportantes (ONPE Claridad) con contratos del Estado (SEACE). Ambos son interfaces HTML sin API."
    }
  };

  return NextResponse.json({
    success: true,
    source: realCandidates.length > 0 ? "JNE Voto Informado - Datos REALES scrapeados" : "JNE Voto Informado - Datos reales 2026",
    timestamp: new Date().toISOString(),
    dataSources: DATA_SOURCES,
    moduleStatus: MODULE_STATUS,
    candidatos: realCandidates.length > 0 ? realCandidates.map((c: any, i: number) => ({
      id: c.id || i + 1,
      nombre: c.nombre || c.name || '',
      partido: c.partido || c.party || '',
      nroDocumento: c.nroDocumento || c.numeroDocumento || '',
      idHojaVida: c.idHojaVida || 0,
      estado: c.estado || 'INSCRITO',
      cargo: c.cargo || 'PRESIDENTE',
      hojaVidaUrl: c.idHojaVida ? `${DATA_SOURCES.jneVotoInformado}/hoja-vida/${c.idHojaVida}` : DATA_SOURCES.jneVotoInformado,
      planGobiernoUrl: c.idHojaVida ? `${DATA_SOURCES.jneVotoInformado}/plan-gobierno/${c.idHojaVida}` : DATA_SOURCES.jneVotoInformado
    })) : [],
    candidateCount: realCandidates.length
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Accept scraped data with candidatos array and store in KV
    if (body.candidatos && Array.isArray(body.candidatos)) {
      // Store real data in KV for GET to retrieve
      await kv.set("corruption:jne-data", {
        candidatos: body.candidatos,
        moduleStatus: body.moduleStatus,
        apiDataCaptured: body.apiDataCaptured,
        source: body.source || "JNE Voto Informado - Scraped",
        timestamp: Date.now()
      });

      return NextResponse.json({
        success: true,
        source: "POST: Real JNE data stored in KV",
        candidates: body.candidatos.length,
        hasModuleStatus: !!body.moduleStatus,
        hasApiData: !!body.apiDataCaptured
      });
    }

    // Accept corruption data with redFlags
    if (body.candidatos && body.redFlags) {
      await kv.set("corruption:jne-data", {
        candidatos: body.candidatos,
        redFlags: body.redFlags,
        timestamp: Date.now()
      });

      return NextResponse.json({
        success: true,
        source: "POST: Corruption data stored in KV",
        candidates: body.candidatos.length,
        redFlags: body.redFlags.length
      });
    }

    return NextResponse.json({ success: false, error: "Invalid format" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Processing error" }, { status: 500 });
  }
}
