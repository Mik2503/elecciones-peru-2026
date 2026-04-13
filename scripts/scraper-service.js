const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
const SCRAPE_INTERVAL = 30000;
const LOG_FILE = path.join(__dirname, 'scraper.log');
const CACHE_FILE = path.join(__dirname, 'cache.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function scrapeAll() {
  log('[Scrape] Launching browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  try {
    // Navigate to each section and extract raw text
    const sections = {
      presidenciales: 'https://resultadoelectoral.onpe.gob.pe/main/presidenciales',
      senadoresUnico: 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-nacional-unico',
      senadoresMultiple: 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-electoral-multiple',
      diputados: 'https://resultadoelectoral.onpe.gob.pe/main/diputados',
      parlamentoAndino: 'https://resultadoelectoral.onpe.gob.pe/main/parlamento-andino',
      participacion: 'https://resultadoelectoral.onpe.gob.pe/main/participacion-ciudadana',
      actas: 'https://resultadoelectoral.onpe.gob.pe/main/actas'
    };

    const rawTexts = {};
    for (const [key, url] of Object.entries(sections)) {
      log(`[Scrape] ${key}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(8000);
      rawTexts[key] = await page.evaluate(() => document.body.innerText);
    }

    log('[Scrape] Parsing data...');
    const allData = parseAllData(rawTexts);

    // Save cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(allData, null, 2));
    log(`[Scrape] Parsed: ${allData.presidenciales.candidates.length} candidates, ${allData.presidenciales.percent}% actas`);

    // Push to dashboard
    log('[Push] Sending to dashboard...');
    const response = await fetch(`${DASHBOARD_URL}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allData)
    });
    const result = await response.json();
    log(`[Push] ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.source || result.error}`);

    return allData;
  } catch (error) {
    log(`[Scrape] ERROR: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

function parseAllData(texts) {
  return {
    timestamp: Date.now(),
    lastUpdate: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
    presidenciales: parsePresidenciales(texts.presidenciales),
    senadoresUnico: parseSenate(texts.senadoresUnico),
    senadoresMultiple: parseSenate(texts.senadoresMultiple),
    diputados: parseSenate(texts.diputados),
    parlamentoAndino: parseParlamento(texts.parlamentoAndino),
    participacion: parseParticipacion(texts.participacion),
    actas: parseActas(texts.actas)
  };
}

function parseLines(text) {
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

function parsePresidenciales(text) {
  const lines = parseLines(text);

  // Find actas info
  let totalActas = 0, processedActas = 0, pendingActas = 0, percent = 0;
  for (const line of lines) {
    const m1 = line.match(/Total de actas:\s*([\d,]+)/);
    if (m1) totalActas = parseInt(m1[1].replace(/,/g, ''));
    const m2 = line.match(/Actas contabilizadas:\s*([\d.]+)%/);
    if (m2) percent = parseFloat(m2[1]);
    const m3 = line.match(/Contabilizadas:\s*([\d,]+)/);
    if (m3) processedActas = parseInt(m3[1].replace(/,/g, ''));
    const m4 = line.match(/Pendientes:\s*([\d,]+)/);
    if (m4) pendingActas = parseInt(m4[1].replace(/,/g, ''));
  }

  // Find candidates: look for numbered entries with party and percentage
  const candidates = [];
  let i = 0;
  while (i < lines.length) {
    const numMatch = lines[i].match(/^(\d+)$/);
    if (numMatch && i + 3 < lines.length) {
      const num = parseInt(numMatch[1]);
      const name = lines[i + 1];
      const party = lines[i + 2];
      const validMatch = lines[i + 3]?.match(/^([\d.]+)%$/);
      const emitMatch = lines[i + 4]?.match(/^([\d.]+)%$/);
      const votesMatch = lines[i + 5]?.match(/^([\d,]+)$/);

      if (validMatch && emitMatch && votesMatch && party.length > 3 && name.length > 5) {
        candidates.push({
          id: num,
          name: name,
          party: party,
          validPercent: parseFloat(validMatch[1]),
          emitPercent: parseFloat(emitMatch[1]),
          votes: parseInt(votesMatch[1].replace(/,/g, '')),
          color: getPartyColor(party)
        });
        i += 6;
        continue;
      }
    }
    i++;
  }

  // Find totals
  let validVotes = 0, blankVotes = 0, nullVotes = 0, totalVotes = 0;
  for (let j = 0; j < lines.length - 1; j++) {
    if (lines[j] === 'TOTAL VOTOS VALIDOS' && lines[j + 1]?.match(/^[\d,]+$/))
      validVotes = parseInt(lines[j + 1].replace(/,/g, ''));
    if (lines[j] === 'VOTOS EN BLANCO' && lines[j + 2]?.match(/^[\d,]+$/))
      blankVotes = parseInt(lines[j + 2].replace(/,/g, ''));
    if (lines[j] === 'VOTOS NULOS' && lines[j + 2]?.match(/^[\d,]+$/))
      nullVotes = parseInt(lines[j + 2].replace(/,/g, ''));
    if (lines[j] === 'TOTAL VOTOS EMITIDOS' && lines[j + 1]?.match(/^[\d,]+$/))
      totalVotes = parseInt(lines[j + 1].replace(/,/g, ''));
  }

  return { totalActas, processedActas, pendingActas, percent, candidates: candidates.sort((a, b) => b.votes - a.votes), totals: { validVotes, blankVotes, nullVotes, totalVotes } };
}

function parseSenate(text) {
  const lines = parseLines(text);

  let totalActas = 0, percent = 0;
  for (const line of lines) {
    const m1 = line.match(/Total de actas:\s*([\d,]+)/);
    if (m1) totalActas = parseInt(m1[1].replace(/,/g, ''));
    const m2 = line.match(/Actas contabilizadas:\s*([\d.]+)%/);
    if (m2) percent = parseFloat(m2[1]);
  }

  const parties = [];
  let i = 0;
  while (i < lines.length) {
    const numMatch = lines[i].match(/^(\d+)$/);
    if (numMatch && i + 4 < lines.length) {
      const name = lines[i + 1];
      const candMatch = lines[i + 2]?.match(/Total de Candidatos:\s*(\d+)/);
      const validMatch = lines[i + 3]?.match(/^([\d.]+)%$/);
      const emitMatch = lines[i + 4]?.match(/^([\d.]+)%$/);

      if (candMatch && validMatch && emitMatch && name.length > 5) {
        const votesMatch = lines[i + 5]?.match(/^([\d,]+)$/);
        parties.push({
          name: name,
          candidates: parseInt(candMatch[1]),
          validPercent: parseFloat(validMatch[1]),
          emitPercent: parseFloat(emitMatch[1]),
          votes: votesMatch ? parseInt(votesMatch[1].replace(/,/g, '')) : 0,
          color: getPartyColor(name)
        });
        i += votesMatch ? 6 : 5;
        continue;
      }
    }
    i++;
  }

  return { totalActas, percent, parties: parties.filter(p => p.votes > 0).sort((a, b) => b.votes - a.votes) };
}

function parseParlamento(text) {
  const lines = parseLines(text);
  let percent = 0;
  for (const line of lines) {
    const m = line.match(/Actas contabilizadas:\s*([\d.]+)%/);
    if (m) percent = parseFloat(m[1]);
  }

  const parties = [];
  let i = 0;
  while (i < lines.length) {
    const numMatch = lines[i].match(/^(\d+)$/);
    if (numMatch && i + 4 < lines.length) {
      const name = lines[i + 1];
      const candMatch = lines[i + 2]?.match(/Total de Candidatos:\s*(\d+)/);
      const validMatch = lines[i + 3]?.match(/^([\d.]+)%$/);
      const emitMatch = lines[i + 4]?.match(/^([\d.]+)%$/);

      if (candMatch && validMatch && emitMatch && name.length > 3) {
        const votesMatch = lines[i + 5]?.match(/^([\d,]+)$/);
        parties.push({
          name: name,
          candidates: parseInt(candMatch[1]),
          validPercent: parseFloat(validMatch[1]),
          emitPercent: parseFloat(emitMatch[1]),
          votes: votesMatch ? parseInt(votesMatch[1].replace(/,/g, '')) : 0,
          color: getPartyColor(name)
        });
        i += votesMatch ? 6 : 5;
        continue;
      }
    }
    i++;
  }

  let validVotes = 0, blankVotes = 0, nullVotes = 0, totalVotes = 0;
  for (let j = 0; j < lines.length - 1; j++) {
    if (lines[j] === 'TOTAL VOTOS VALIDOS' && lines[j + 1]?.match(/^[\d,]+$/))
      validVotes = parseInt(lines[j + 1].replace(/,/g, ''));
    if (lines[j] === 'VOTOS EN BLANCO' && lines[j + 2]?.match(/^[\d,]+$/))
      blankVotes = parseInt(lines[j + 2].replace(/,/g, ''));
    if (lines[j] === 'VOTOS NULOS' && lines[j + 2]?.match(/^[\d,]+$/))
      nullVotes = parseInt(lines[j + 2].replace(/,/g, ''));
    if (lines[j] === 'TOTAL VOTOS EMITIDOS' && lines[j + 1]?.match(/^[\d,]+$/))
      totalVotes = parseInt(lines[j + 1].replace(/,/g, ''));
  }

  return { percent, parties: parties.filter(p => p.votes > 0).sort((a, b) => b.votes - a.votes), totals: { validVotes, blankVotes, nullVotes, totalVotes } };
}

function parseParticipacion(text) {
  const lines = parseLines(text);
  let electoresHabiles = 0, totalAsistentes = 0, totalAusentes = 0;
  let asistentesPercent = 0, ausentesPercent = 0, pendientesPercent = 0;
  let exteriorAsistentes = 0, peruAsistentes = 0;

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    const m1 = line.match(/Electores habiles:\s*([\d,]+)/);
    if (m1) electoresHabiles = parseInt(m1[1].replace(/,/g, ''));
    const m2 = line.match(/Total de asistentes:\s*([\d,]+)/);
    if (m2) totalAsistentes = parseInt(m2[1].replace(/,/g, ''));
    const m3 = line.match(/Total de ausentes:\s*([\d,]+)/);
    if (m3) totalAusentes = parseInt(m3[1].replace(/,/g, ''));
    const m4 = line.match(/Ciudadanos asistentes:\s*([\d.]+)%/);
    if (m4) asistentesPercent = parseFloat(m4[1]);
    const m5 = line.match(/Ciudadanos ausentes:\s*([\d.]+)%/);
    if (m5) ausentesPercent = parseFloat(m5[1]);
    const m6 = line.match(/Ciudadanos pendientes:\s*([\d.]+)%/);
    if (m6) pendientesPercent = parseFloat(m6[1]);
    if (line === 'EXTRANJERO' && lines[j + 1]?.match(/^[\d.]+%/))
      exteriorAsistentes = parseFloat(lines[j + 1]);
    if (line === 'PERU' && lines[j + 1]?.match(/^[\d.]+%/))
      peruAsistentes = parseFloat(lines[j + 1]);
  }

  return { electoresHabiles, totalAsistentes, totalAusentes, asistentesPercent, ausentesPercent, pendientesPercent, exteriorAsistentes, peruAsistentes };
}

function parseActas(text) {
  const lines = parseLines(text);
  const result = {};

  const types = ['PRESIDENCIAL', 'SENADORES D.E. UNICO', 'SENADORES D.E. MULTIPLE', 'DIPUTADOS', 'PARLAMENTO ANDINO'];
  for (const type of types) {
    const idx = lines.findIndex(l => l === type);
    if (idx === -1 || idx + 4 >= lines.length) continue;

    const total = lines[idx + 1]?.match(/^[\d,]+$/) ? parseInt(lines[idx + 1].replace(/,/g, '')) : 0;
    const percent = lines[idx + 2]?.match(/^([\d.]+)%$/) ? parseFloat(lines[idx + 2]) : 0;
    const processed = lines[idx + 3]?.match(/^[\d,]+$/) ? parseInt(lines[idx + 3].replace(/,/g, '')) : 0;
    const pending = lines[idx + 4]?.match(/^[\d,]+$/) ? parseInt(lines[idx + 4].replace(/,/g, '')) : 0;
    const pendingPercent = lines[idx + 5]?.match(/^([\d.]+)%$/) ? parseFloat(lines[idx + 5]) : 0;

    const key = type.toLowerCase().replace(/[^a-z]/g, '').replace('senadoresunico', 'senadoresUnico').replace('senadoresmultiple', 'senadoresMultiple');
    result[key] = { total, percent, processed, pending, pendingPercent };
  }

  return result;
}

function getPartyColor(party) {
  const c = {
    'FUERZA POPULAR': '#f97316', 'RENOVACION POPULAR': '#3b82f6',
    'PAIS PARA TODOS': '#a855f7', 'AHORA NACION': '#84cc16',
    'ALIANZA PARA EL PROGRESO': '#06b6d4', 'AVANZA PAIS': '#34d399',
    'JUNTOS POR EL PERU': '#ec4899', 'PERU LIBRE': '#ef4444',
    'PARTIDO MORADO': '#8b5cf6', 'PODEMOS PERU': '#f59e0b',
    'PARTIDO DEL BUEN GOBIERNO': '#6366f1', 'PARTIDO CIVICO OBRAS': '#64748b',
    'SOMOS PERU': '#eab308', 'COOPERACION POPULAR': '#14b8a6',
    'PARTIDO APRISTA': '#1e40af', 'PRIMERO LA GENTE': '#facc15',
    'FRENTE DE LA ESPERANZA': '#22c55e', 'PARTIDO SICREO': '#e879f9',
    'UNIDAD NACIONAL': '#1d4ed8', 'UN CAMINO DIFERENTE': '#94a3b8',
    'LIBERTAD POPULAR': '#0ea5e9', 'PROGRESEMOS': '#a78bfa',
    'PARTIDO PATRIOTICO DEL PERU': '#78716c', 'ALIANZA ELECTORAL VENCEREMOS': '#0d9488',
    'FUERZA Y LIBERTAD': '#f43f5e', 'PARTIDO DEMOCRATA VERDE': '#4ade80',
    'PARTIDO DEMOCRATA UNIDO PERU': '#a3e635', 'PARTIDO POLITICO PRIN': '#38bdf8',
    'PERU MODERNO': '#22d3ee', 'FE EN EL PERU': '#c2410c',
    'PARTIDO DEMOCRATICO FEDERAL': '#2dd4bf', 'PARTIDO POLITICO PERU ACCION': '#fb923c',
    'PARTIDO POLITICO PERU PRIMERO': '#fbbf24', 'PARTIDO POLITICO INTEGRIDAD DEMOCRATICA': '#c084fc',
    'SALVEMOS AL PERU': '#fb7185', 'PARTIDO DE LOS TRABAJADORES': '#dc2626',
    'VARIOS': '#78716c', 'VOTOS EN BLANCO': '#52525b', 'VOTOS NULOS': '#71717a'
  };
  for (const [key, color] of Object.entries(c)) {
    if (party.toUpperCase().includes(key.split(' ')[0]) || key.includes(party.toUpperCase().split(' ')[0])) return color;
  }
  let hash = 0;
  for (let i = 0; i < party.length; i++) hash = party.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

// Auto-start
async function main() {
  log('===========================================');
  log('ONPE Auto-Scraper Service STARTED');
  log(`Dashboard: ${DASHBOARD_URL}`);
  log(`Interval: ${SCRAPE_INTERVAL / 1000}s`);
  log('===========================================');

  await scrapeAll();
  setInterval(async () => { await scrapeAll(); }, SCRAPE_INTERVAL);
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
