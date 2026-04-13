const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
const LOG_FILE = path.join(__dirname, 'corruption-scraper.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function scrapeJNERealData() {
  log('===========================================');
  log('Starting REAL data scrape from JNE Voto Informado');
  log('===========================================');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

  // Capture API responses
  let apiResponses = {};

  page.on('response', async resp => {
    const url = resp.url();
    const status = resp.status();
    try {
      const ct = resp.headers()['content-type'] || '';
      if (ct.includes('json') && status === 200) {
        const body = await resp.text();
        if (url.includes('/authentication/token')) {
          apiResponses.token = JSON.parse(body);
        } else if (url.includes('/candidatos/listarcandidatos') || url.includes('/listarCanditatos')) {
          apiResponses.candidates = JSON.parse(body);
        } else if (url.includes('/avanzada-voto') || url.includes('/avanzadaVoto')) {
          apiResponses.advancedVote = JSON.parse(body);
        } else if (url.includes('/plangobierno') || url.includes('/planGobierno')) {
          apiResponses.planGobierno = JSON.parse(body);
        } else if (url.includes('/HojaVida') || url.includes('/hojavida') || url.includes('/HVConsolidado')) {
          apiResponses.hojaVida = JSON.parse(body);
        }
      }
    } catch (e) { }
  });

  // Step 1: Navigate to trigger API calls
  log('Step 1: Navigating to JNE to capture API data...');
  await page.goto('https://votoinformado.jne.gob.pe/presidente-vicepresidentes', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(20000);

  log(`API Token: ${apiResponses.token ? 'OK' : 'MISSING'}`);
  log(`API Candidates: ${apiResponses.candidates ? `OK (${apiResponses.candidates.length || 'array'})` : 'MISSING'}`);
  log(`API Advanced Vote: ${apiResponses.advancedVote ? 'OK' : 'MISSING'}`);
  log(`API Plan Gobierno: ${apiResponses.planGobierno ? 'OK' : 'MISSING'}`);
  log(`API Hoja Vida: ${apiResponses.hojaVida ? 'OK' : 'MISSING'}`);

  // Build real candidate data from captured API responses
  const realCandidates = [];

  if (apiResponses.candidates && Array.isArray(apiResponses.candidates)) {
    log(`Processing ${apiResponses.candidates.length} candidates from API...`);
    apiResponses.candidates.forEach((c, idx) => {
      realCandidates.push({
        id: idx + 1,
        nombre: c.nombreCompleto || `${c.txNom} ${c.txApePat} ${c.txApeMat}`,
        partido: c.txOrgPol || c.organizacionPolitica || '',
        nroDocumento: c.txDocId || '',
        idHojaVida: c.idHojaVida || 0,
        idOrgPol: c.idOrgPol || 0,
        estado: c.txEstCand || 'INSCRITO',
        cargo: c.cargo || c.cargoObj?.join(', ') || 'PRESIDENTE',
        nuPos: c.nuPos || 0,
        fotoGuid: c.txGuidFoto || c.txNombre || '',
        fotoUrl: c.txGuidFoto ? `https://mpesije.jne.gob.pe/apidocs/${c.txGuidFoto}` : '',
        logoUrl: c.idOrgPol ? `https://votoinformado.jne.gob.pe/LogoOp/${c.idOrgPol}.jpg` : ''
      });
    });
  }

  // If API didn't return candidates, extract from page
  if (realCandidates.length === 0) {
    log('API candidates empty, extracting from page...');
    const pageCandidates = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const candidates = [];
      const knownParties = [
        'AHORA NACION', 'ALIANZA ELECTORAL VENCEREMOS', 'ALIANZA PARA EL PROGRESO',
        'AVANZA PAIS', 'FE EN EL PERU', 'FUERZA POPULAR', 'FUERZA Y LIBERTAD',
        'JUNTOS POR EL PERU', 'LIBERTAD POPULAR', 'PARTIDO APRISTA PERUANO',
        'PARTIDO CIVICO OBRAS', 'PARTIDO DEL BUEN GOBIERNO', 'PARTIDO DEMOCRATA UNIDO PERU',
        'PARTIDO DEMOCRATA VERDE', 'PARTIDO DEMOCRATICO FEDERAL', 'PARTIDO DEMOCRATICO SOMOS PERU',
        'PARTIDO FRENTE DE LA ESPERANZA 2021', 'PARTIDO MORADO', 'PARTIDO PAIS PARA TODOS',
        'PARTIDO PATRIOTICO DEL PERU', 'PARTIDO POLITICO COOPERACION POPULAR',
        'PARTIDO POLITICO INTEGRIDAD DEMOCRATICA', 'PARTIDO POLITICO NACIONAL PERU LIBRE',
        'PARTIDO POLITICO PERU ACCION', 'PARTIDO POLITICO PERU PRIMERO', 'PARTIDO POLITICO PRIN',
        'PARTIDO SICREO', 'PERU MODERNO', 'PODEMOS PERU', 'PRIMERO LA GENTE',
        'PROGRESEMOS', 'RENOVACION POPULAR', 'SALVEMOS AL PERU', 'UN CAMINO DIFERENTE', 'UNIDAD NACIONAL'
      ];

      for (let i = 0; i < lines.length - 1; i++) {
        // Check if this line is a party name
        const matchingParty = knownParties.find(p => lines[i].toUpperCase().includes(p.toUpperCase()));
        if (matchingParty && i + 1 < lines.length) {
          const name = lines[i + 1];
          // Skip if next line is also a party
          const nextIsParty = knownParties.some(p => lines[i + 1].toUpperCase().includes(p.toUpperCase()));
          if (!nextIsParty && name.length > 10 && name.length < 70) {
            candidates.push({
              partido: matchingParty,
              nombre: name
            });
          }
        }
      }
      return candidates;
    });

    pageCandidates.forEach((c, idx) => {
      realCandidates.push({
        id: idx + 1,
        nombre: c.nombre,
        partido: c.partido,
        nroDocumento: '',
        idHojaVida: 0,
        idOrgPol: 0,
        estado: 'INSCRITO',
        cargo: 'PRESIDENTE',
        nuPos: idx + 1,
        fotoGuid: '',
        fotoUrl: '',
        logoUrl: ''
      });
    });

    log(`Extracted ${realCandidates.length} candidates from page`);
  }

  // Step 2: For each candidate, try to get their detailed hoja de vida data
  log('Step 2: Fetching detailed data for each candidate...');

  for (let i = 0; i < Math.min(realCandidates.length, 5); i++) {
    const candidate = realCandidates[i];
    log(`  Fetching details for candidate ${i + 1}: ${candidate.nombre.substring(0, 30)}...`);

    // Navigate to candidate detail page
    try {
      // Find the link for this candidate
      const candidateLink = await page.evaluate((name) => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.textContent && link.textContent.includes(name.substring(0, 15)) && link.href.includes('presidente')) {
            return link.href;
          }
        }
        return null;
      }, candidate.nombre);

      if (candidateLink) {
        await page.goto(candidateLink, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(8000);

        // Extract detail page data
        const detailData = await page.evaluate(() => {
          const text = document.body.innerText;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

          // Look for plan de gobierno dimensions
          const dimensions = [];
          const dimKeywords = ['DIMENSION', 'DIMENSIÓN'];

          for (const keyword of dimKeywords) {
            const idx = lines.findIndex(l => l.toUpperCase().includes(keyword));
            if (idx >= 0 && idx + 1 < lines.length) {
              dimensions.push({
                name: lines[idx],
                content: lines.slice(idx + 1, idx + 4).join(' ').substring(0, 500)
              });
            }
          }

          // Look for candidate info
          const formulaLine = lines.findIndex(l => l.includes('Fórmula') || l.includes('FOMULA'));
          const partidoLine = lines.findIndex(l => l.includes('PARTIDO') || l.includes('ORGANIZACIÓN'));

          return {
            dimensions,
            formulaLine: formulaLine >= 0 ? lines.slice(formulaLine, formulaLine + 5) : [],
            partidoLine: partidoLine >= 0 ? lines[partidoLine] : '',
            totalLines: lines.length
          };
        });

        candidate.dimensiones = detailData.dimensions;
        candidate.detalleLines = detailData.totalLines;

        log(`    Extracted ${detailData.dimensions.length} plan dimensions, ${detailData.totalLines} total lines`);

        // Go back to list
        await page.goto('https://votoinformado.jne.gob.pe/presidente-vicepresidentes', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
      } else {
        log(`    Could not find link for ${candidate.nombre.substring(0, 20)}`);
      }
    } catch (e) {
      log(`    Error fetching ${candidate.nombre.substring(0, 20)}: ${e.message}`);
    }
  }

  // Build comprehensive corruption data
  const corruptionData = {
    timestamp: Date.now(),
    lastUpdate: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
    source: 'JNE Voto Informado - Datos REALES scrapeados',
    candidatos: realCandidates,
    apiDataCaptured: {
      hasToken: !!apiResponses.token,
      hasCandidates: !!apiResponses.candidates,
      candidateCount: apiResponses.candidates?.length || 0,
      hasAdvancedVote: !!apiResponses.advancedVote,
      hasPlanGobierno: !!apiResponses.planGobierno,
      hasHojaVida: !!apiResponses.hojaVida
    },
    moduleStatus: {
      radarPatrimonial: {
        available: true,
        source: "JNE Voto Informado - Hoja de Vida",
        url: "https://votoinformado.jne.gob.pe",
        description: "Datos reales extraídos de la API del JNE. Cada candidato tiene idHojaVida para consulta directa."
      },
      buscadorFantasmas: {
        available: false,
        source: "ONPE Claridad + SEACE",
        url: "https://www.gob.pe/10261-acceder-a-la-rendicion-de-cuentas-de-las-organizaciones-politicas-claridad",
        description: "Requiere cruce de aportantes (ONPE) con contratos (SEACE). Ambas son interfaces HTML sin API."
      },
      historialJudicial: {
        available: true,
        source: "JNE Voto Informado - Antecedentes en Hoja de Vida",
        url: "https://votoinformado.jne.gob.pe",
        description: "Antecedentes penales declarados por cada candidato están en su Hoja de Vida del JNE."
      },
      redesFamiliares: {
        available: false,
        source: "JNE + Portal Transparencia MEF",
        url: "https://www.transparencia.gob.pe/",
        description: "Familiares están en Hoja de Vida del JNE. Cruce con planillas requiere Portal de Transparencia."
      },
      factChecker: {
        available: true,
        source: "JNE - Planes de Gobierno (PDFs reales)",
        url: "https://votoinformado.jne.gob.pe",
        description: "Planes de gobierno disponibles como PDFs en JNE. Datos reales extraídos del sitio."
      },
      grafoPoder: {
        available: false,
        source: "SEACE + ONPE Claridad",
        url: "https://prodapp2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml",
        description: "Requiere cruce de datos de aportantes con contratos del Estado."
      }
    }
  };

  log(`===========================================`);
  log(`Scrape complete: ${realCandidates.length} candidates with real data`);
  log(`===========================================`);

  await browser.close();
  return corruptionData;
}

// Push to dashboard KV
async function pushData(data) {
  try {
    log('Pushing data to dashboard KV...');
    // Store in the main election data endpoint which writes to KV
    const res = await fetch(`${DASHBOARD_URL}/api/corruption-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidatos: data.candidatos,
        moduleStatus: data.moduleStatus,
        apiDataCaptured: data.apiDataCaptured,
        source: data.source
      })
    });
    const result = await res.json();
    log(`Push result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.source || result.error}`);

    // Also try to store via the data endpoint which has KV access
    try {
      await fetch(`${DASHBOARD_URL}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corruptionData: {
            candidatos: data.candidatos,
            moduleStatus: data.moduleStatus,
            lastScrape: data.timestamp
          }
        })
      });
    } catch (e) { }

    return result;
  } catch (err) {
    log(`Push error: ${err.message}`);
    return null;
  }
}

// Main
async function main() {
  const data = await scrapeJNERealData();
  if (data) {
    await pushData(data);
    // Save local cache
    fs.writeFileSync(path.join(__dirname, 'jne-real-data.json'), JSON.stringify(data, null, 2));
    log('Local cache saved to jne-real-data.json');
  }
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
