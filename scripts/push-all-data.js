// ONPE Live Data Scraper - Automatically extracts real data every 30s
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
const SCRAPE_INTERVAL = 30000;
const LOG_FILE = path.join(__dirname, 'scraper.log');
const CACHE_FILE = path.join(__dirname, 'data-cache.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const getPartyColor = (name) => {
  const colors = {
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
  for (const [key, color] of Object.entries(colors)) {
    if (name.toUpperCase().includes(key.split(' ')[0]) || key.includes(name.toUpperCase().split(' ')[0])) return color;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
};

function parseVotes(str) {
  if (!str) return 0;
  // Format: "1'408,596" or "1,408,596" or "408,596"
  return parseInt(str.replace(/'/g, '').replace(/,/g, '').trim(), 10);
}

async function scrapePresidenciales(page) {
  log('[PRESIDENCIALES] Loading...');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/presidenciales', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  return page.evaluate(() => {
    function parseNum(s) { return s ? parseInt(s.replace(/,/g, '').replace(/'/g, '').trim(), 10) : 0; }
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Extract actas info from top section
    const actasPctLine = lines.findIndex(l => l.match(/^\d+\.\d+\s*%$/) && l.length < 15);
    const totalActasLine = lines.findIndex(l => l.includes('Total de actas:'));
    const contabLine = lines.findIndex(l => l.includes('Contabilizadas ('));

    let percent = 0, totalActas = 92766, processedActas = 0, jeePending = 0, pendingActas = 0;

    if (actasPctLine >= 0) {
      const m = lines[actasPctLine].match(/([\d.]+)\s*%/);
      if (m) percent = parseFloat(m[1]);
    }
    if (totalActasLine >= 0) {
      const m = lines[totalActasLine].match(/([\d,]+)/);
      if (m) totalActas = parseNum(m[1]);
    }
    if (contabLine >= 0) {
      const m = lines[contabLine].match(/Contabilizadas\s*\(([\d,]+)\)/);
      if (m) processedActas = parseNum(m[1]);
      const jee = lines[contabLine].match(/Para envio al JEE\s*\(([\d,]+)\)/);
      if (jee) jeePending = parseNum(jee[1]);
      const pend = lines[contabLine].match(/Pendientes\s*\(([\d,]+)\)/);
      if (pend) pendingActas = parseNum(pend[1]);
    }

    // Calculate percent if not found directly
    if (percent === 0 && processedActas > 0 && totalActas > 0) {
      percent = Math.round((processedActas / totalActas) * 10000) / 100;
    }

    // Extract candidates - format is:
    // Name
    // Party
    // XX.XXX %
    // YY.YYY %
    // Cantidad de votos:1'234,567

    const candidates = [];
    let i = 0;
    while (i < lines.length - 4) {
      // Skip non-candidate lines
      if (lines[i].includes('Actas') || lines[i].includes('Total') || lines[i].includes('VOTOS') ||
        lines[i].includes('Candidatos') || lines[i].includes('Contabilizadas') ||
        lines[i].includes('%') || lines[i].includes('Resultado') || lines[i].includes('cantidad') ||
        lines[i].includes('Oficina') || lines[i].includes('Central') || lines[i].includes('Jr.') ||
        lines[i].includes('Electoral') || lines[i].includes('Escríbenos') || lines[i].includes('Navegador')) {
        i++;
        continue;
      }

      // Look for candidate name (long text, no %, no numbers only)
      const nameLine = lines[i];
      if (nameLine.length < 10 || nameLine.length > 70 || nameLine.match(/^\d+$/) || nameLine.includes('%')) {
        i++;
        continue;
      }

      // Next line should be party
      const partyLine = lines[i + 1];
      if (!partyLine || partyLine.length < 3 || partyLine.includes('%') || partyLine.match(/^\d+$/)) {
        i++;
        continue;
      }

      // Next two lines should be percentages
      const validMatch = lines[i + 2]?.match(/^([\d.]+)\s*%$/);
      const emitMatch = lines[i + 3]?.match(/^([\d.]+)\s*%$/);
      if (!validMatch || !emitMatch) {
        i++;
        continue;
      }

      // Next line should be votes
      const votesMatch = lines[i + 4]?.match(/Cantidad de votos:([\d',]+)/);
      if (!votesMatch) {
        i++;
        continue;
      }

      candidates.push({
        id: candidates.length + 1,
        name: nameLine,
        party: partyLine,
        validPercent: parseFloat(validMatch[1]),
        emitPercent: parseFloat(emitMatch[1]),
        votes: parseNum(votesMatch[1])
      });

      i += 5;
    }

    // Extract totals from bottom
    let validVotes = 0, blankVotes = 0, nullVotes = 0, totalVotes = 0;
    for (let j = 0; j < lines.length - 1; j++) {
      if (lines[j] === 'VOTOS EN BLANCO' && lines[j + 1]?.match(/Cantidad de votos:([\d',]+)/))
        blankVotes = parseNum(lines[j + 1].match(/Cantidad de votos:([\d',]+)/)[1]);
      if (lines[j] === 'VOTOS NULOS' && lines[j + 1]?.match(/Cantidad de votos:([\d',]+)/))
        nullVotes = parseNum(lines[j + 1].match(/Cantidad de votos:([\d',]+)/)[1]);
      if (lines[j].includes('Votos válidos:') && lines[j].match(/([\d',]+)/))
        validVotes = parseNum(lines[j].match(/([\d',]+)/)[1]);
      if (lines[j].includes('Votos emitidos:') && lines[j].match(/([\d',]+)/))
        totalVotes = parseNum(lines[j].match(/([\d',]+)/)[1]);
    }

    return {
      totalActas, processedActas, jeePending, pendingActas, percent, candidates,
      totals: { validVotes, blankVotes, nullVotes, totalVotes }
    };
  });
}

async function scrapeSenate(page, url, sectionName) {
  log(`[${sectionName}] Loading...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  return page.evaluate(() => {
    function parseNum(s) { return s ? parseInt(s.replace(/,/g, '').replace(/'/g, '').trim(), 10) : 0; }
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const actasPctLine = lines.findIndex(l => l.match(/^\d+\.\d+%$/) && l.length < 10);
    const totalActasLine = lines.findIndex(l => l.includes('Total de actas:'));

    let percent = 0, totalActas = 92766;
    if (actasPctLine >= 0) { const m = lines[actasPctLine].match(/([\d.]+)%/); if (m) percent = parseFloat(m[1]); }
    if (totalActasLine >= 0) { const m = lines[totalActasLine].match(/([\d,]+)/); if (m) totalActas = parseNum(m[1]); }

    const parties = [];
    let i = 0;
    while (i < lines.length - 4) {
      if (lines[i].includes('Actas') || lines[i].includes('Total') || lines[i].includes('Candidatos') ||
        lines[i].includes('Contabilizadas') || lines[i].includes('Resultado') || lines[i].includes('Oficina') ||
        lines[i].includes('Electoral') || lines[i].includes('%') || lines[i].includes('Organización') ||
        lines[i].includes('votos') || lines[i].includes('votos')) {
        i++;
        continue;
      }

      const nameLine = lines[i];
      if (nameLine.length < 10 || nameLine.length > 70 || nameLine.match(/^\d+$/)) { i++; continue; }

      const candMatch = lines[i + 1]?.match(/Total de Candidatos:\s*(\d+)/);
      const validMatch = lines[i + 2]?.match(/^([\d.]+)\s*%$/);
      const emitMatch = lines[i + 3]?.match(/^([\d.]+)\s*%$/);
      const votesMatch = lines[i + 4]?.match(/Cantidad de votos:([\d',]+)/);

      if (candMatch && validMatch && votesMatch) {
        parties.push({
          name: nameLine,
          candidates: parseInt(candMatch[1]),
          validPercent: parseFloat(validMatch[1]),
          emitPercent: emitMatch ? parseFloat(emitMatch[1]) : 0,
          votes: parseNum(votesMatch[1])
        });
        i += 5;
      } else { i++; }
    }

    return { totalActas, percent, parties: parties.filter(p => p.votes > 0).sort((a, b) => b.votes - a.votes) };
  });
}

async function scrapeDeputies(page) {
  log('[DIPUTADOS] Loading...');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/diputados', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  return page.evaluate(() => {
    function parseNum(s) { return s ? parseInt(s.replace(/,/g, '').replace(/'/g, '').trim(), 10) : 0; }
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const actasPctLine = lines.findIndex(l => l.match(/^\d+\.\d+%$/) && l.length < 10);
    const totalActasLine = lines.findIndex(l => l.includes('Total de actas:'));

    let percent = 0, totalActas = 92766;
    if (actasPctLine >= 0) { const m = lines[actasPctLine].match(/([\d.]+)%/); if (m) percent = parseFloat(m[1]); }
    if (totalActasLine >= 0) { const m = lines[totalActasLine].match(/([\d,]+)/); if (m) totalActas = parseNum(m[1]); }

    const parties = [];
    let i = 0;
    while (i < lines.length - 4) {
      if (lines[i].includes('Actas') || lines[i].includes('Total') || lines[i].includes('Candidatos') ||
        lines[i].includes('Contabilizadas') || lines[i].includes('Resultado') || lines[i].includes('Oficina') ||
        lines[i].includes('Electoral') || lines[i].includes('%') || lines[i].includes('Organización') ||
        lines[i].includes('votos') || lines[i].includes('votos')) {
        i++;
        continue;
      }

      const nameLine = lines[i];
      if (nameLine.length < 10 || nameLine.length > 70 || nameLine.match(/^\d+$/)) { i++; continue; }

      const candMatch = lines[i + 1]?.match(/Total de Candidatos:\s*(\d+)/);
      const validMatch = lines[i + 2]?.match(/^([\d.]+)\s*%$/);
      const emitMatch = lines[i + 3]?.match(/^([\d.]+)\s*%$/);
      const votesMatch = lines[i + 4]?.match(/Cantidad de votos:([\d',]+)/);

      if (candMatch && validMatch && votesMatch) {
        parties.push({
          name: nameLine,
          candidates: parseInt(candMatch[1]),
          validPercent: parseFloat(validMatch[1]),
          emitPercent: emitMatch ? parseFloat(emitMatch[1]) : 0,
          votes: parseNum(votesMatch[1])
        });
        i += 5;
      } else { i++; }
    }

    return { totalActas, percent, parties: parties.filter(p => p.votes > 0).sort((a, b) => b.votes - a.votes) };
  });
}

async function scrapeParlamento(page) {
  log('[PARLAMENTO ANDINO] Loading...');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/parlamento-andino', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  return page.evaluate(() => {
    function parseNum(s) { return s ? parseInt(s.replace(/,/g, '').replace(/'/g, '').trim(), 10) : 0; }
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const actasPctLine = lines.findIndex(l => l.match(/^\d+\.\d+%$/) && l.length < 10);
    let percent = 0;
    if (actasPctLine >= 0) { const m = lines[actasPctLine].match(/([\d.]+)%/); if (m) percent = parseFloat(m[1]); }

    const parties = [];
    let i = 0;
    while (i < lines.length - 4) {
      if (lines[i].includes('Actas') || lines[i].includes('Total') || lines[i].includes('Candidatos') ||
        lines[i].includes('Contabilizadas') || lines[i].includes('Resultado') || lines[i].includes('Oficina') ||
        lines[i].includes('Electoral') || lines[i].includes('%') || lines[i].includes('Organización') ||
        lines[i].includes('votos') || lines[i].includes('votos')) {
        i++;
        continue;
      }

      const nameLine = lines[i];
      if (nameLine.length < 10 || nameLine.length > 70 || nameLine.match(/^\d+$/)) { i++; continue; }

      const candMatch = lines[i + 1]?.match(/Total de Candidatos:\s*(\d+)/);
      const validMatch = lines[i + 2]?.match(/^([\d.]+)\s*%$/);
      const emitMatch = lines[i + 3]?.match(/^([\d.]+)\s*%$/);
      const votesMatch = lines[i + 4]?.match(/Cantidad de votos:([\d',]+)/);

      if (candMatch && validMatch && votesMatch) {
        parties.push({
          name: nameLine,
          candidates: parseInt(candMatch[1]),
          validPercent: parseFloat(validMatch[1]),
          emitPercent: emitMatch ? parseFloat(emitMatch[1]) : 0,
          votes: parseNum(votesMatch[1])
        });
        i += 5;
      } else { i++; }
    }

    let validVotes = 0, blankVotes = 0, nullVotes = 0, totalVotes = 0;
    for (let j = 0; j < lines.length - 1; j++) {
      if (lines[j] === 'VOTOS EN BLANCO' && lines[j + 1]?.match(/Cantidad de votos:([\d',]+)/))
        blankVotes = parseNum(lines[j + 1].match(/Cantidad de votos:([\d',]+)/)[1]);
      if (lines[j] === 'VOTOS NULOS' && lines[j + 1]?.match(/Cantidad de votos:([\d',]+)/))
        nullVotes = parseNum(lines[j + 1].match(/Cantidad de votos:([\d',]+)/)[1]);
      if (lines[j].includes('Votos válidos:') && lines[j].match(/([\d',]+)/))
        validVotes = parseNum(lines[j].match(/([\d',]+)/)[1]);
      if (lines[j].includes('Votos emitidos:') && lines[j].match(/([\d',]+)/))
        totalVotes = parseNum(lines[j].match(/([\d',]+)/)[1]);
    }

    return {
      percent,
      parties: parties.filter(p => p.votes > 0).sort((a, b) => b.votes - a.votes),
      totals: { validVotes, blankVotes, nullVotes, totalVotes }
    };
  });
}

async function scrapeParticipacion(page) {
  log('[PARTICIPACION] Loading...');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/participacion-ciudadana', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  return page.evaluate(() => {
    function parseNum(s) { return s ? parseInt(s.replace(/,/g, '').replace(/'/g, '').trim(), 10) : 0; }
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Find values by looking for labels
    let electoresHabiles = 0, totalAsistentes = 0, totalAusentes = 0;
    let asistentesPercent = 0, ausentesPercent = 0, pendientesPercent = 0;
    let exteriorAsistentes = 0, peruAsistentes = 0;
    let actasPct = 0, totalActas = 0;

    for (let i = 0; i < lines.length - 1; i++) {
      // Electores hábiles
      if (lines[i] === 'Electores hábiles' && lines[i + 1]?.match(/^[\d',]+$/)) {
        electoresHabiles = parseNum(lines[i + 1]);
      }
      // Total de asistentes - the number may be on next line concatenated with "Total de ausentes"
      // Format:
      // Line i: "Total de asistentes"
      // Line i+1: "9'677,692Total de ausentes"
      // Line i+2: "2'657,995"
      if (lines[i] === 'Total de asistentes') {
        // Check next line for concatenated format: "9'677,692Total de ausentes"
        if (lines[i + 1]?.match(/[\d',]+Total de ausentes/)) {
          const concatMatch = lines[i + 1].match(/([\d',]+)Total de ausentes/);
          if (concatMatch) {
            totalAsistentes = parseNum(concatMatch[1]);
          }
          // Ausentes number is on line i+2
          if (lines[i + 2]?.match(/^[\d',]+$/)) {
            totalAusentes = parseNum(lines[i + 2]);
          }
        } else {
          // Try standard format
          const match = lines[i].match(/Total de asistentes\s*:?[\s]*([\d',]+)/);
          if (match) totalAsistentes = parseNum(match[1]);
          if (!match && lines[i + 1]?.match(/^[\d',]+$/)) {
            totalAsistentes = parseNum(lines[i + 1]);
          }
        }
      }
      // Total de ausentes - check if already captured from concatenation
      if (lines[i].includes('Total de ausentes') && totalAusentes === 0) {
        const match = lines[i].match(/Total de ausentes\s*:?[\s]*([\d',]+)/);
        if (match) totalAusentes = parseNum(match[1]);
        if (!match && lines[i + 1]?.match(/^[\d',]+$/)) {
          totalAusentes = parseNum(lines[i + 1]);
        }
      }
      // Ciudadanos asistentes %
      if (lines[i].includes('Ciudadanos asistentes:')) {
        const m = lines[i].match(/([\d.]+)\s*%/);
        if (m) asistentesPercent = parseFloat(m[1]);
      }
      // Ciudadanos ausentes %
      if (lines[i].includes('Ciudadanos ausentes:')) {
        const m = lines[i].match(/([\d.]+)\s*%/);
        if (m) ausentesPercent = parseFloat(m[1]);
      }
      // Ciudadanos pendientes % (has * at end: "Ciudadanos pendientes: 54.857 % *")
      if (lines[i].startsWith('Ciudadanos pendientes:') && pendientesPercent === 0) {
        const m = lines[i].match(/Ciudadanos pendientes:\s*([\d.]+)\s*%/);
        if (m) pendientesPercent = parseFloat(m[1]);
      }
      // EXTRANJERO
      if (lines[i] === 'EXTRANJERO' && lines[i + 1]?.includes('asistieron')) {
        const m = lines[i + 1].match(/([\d.]+)\s*%/);
        if (m) exteriorAsistentes = parseFloat(m[1]);
      }
      // PERÚ
      if (lines[i] === 'PERÚ' && lines[i + 1]?.includes('asistieron')) {
        const m = lines[i + 1].match(/([\d.]+)\s*%/);
        if (m) peruAsistentes = parseFloat(m[1]);
      }
      // Actas contabilizadas %
      if (lines[i] === 'Actas contabilizadas' && lines[i + 1]?.match(/^[\d.]+\s*%$/)) {
        actasPct = parseFloat(lines[i + 1]);
      }
      // Total de actas
      if (lines[i].includes('Total de actas:')) {
        const m = lines[i].match(/([\d,]+)/);
        if (m) totalActas = parseNum(m[1]);
      }
    }

    return {
      electoresHabiles: electoresHabiles || 27325432,
      totalAsistentes,
      totalAusentes,
      asistentesPercent,
      ausentesPercent,
      pendientesPercent,
      exteriorAsistentes,
      peruAsistentes,
      actasPct,
      totalActas
    };
  });
}

async function scrapeActas(page) {
  log('[ACTAS] Loading...');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/actas', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  return page.evaluate(() => {
    function parseNum(s) { return s ? parseInt(s.replace(/,/g, '').replace(/'/g, '').trim(), 10) : 0; }
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const result = {};

    // Election type names to look for
    const typeNames = ['PRESIDENCIAL', 'SENADORES DISTRITO ELECTORAL ÚNICO', 'SENADORES DISTRITO ELECTORAL MÚLTIPLE', 'DIPUTADOS', 'PARLAMENTO ANDINO'];

    for (const typeName of typeNames) {
      const idx = lines.findIndex(l => l === typeName);
      if (idx === -1 || idx + 12 >= lines.length) continue;

      // Format:
      // PRESIDENCIAL
      // Actas contabilizadas
      // XX.XXX %
      // Contabilizadas
      // XX.XXX %
      // XX,XXX
      // Para envío al JEE
      // X.XXX %
      // XXX
      // Pendientes
      // XX.XXX %
      // XX,XXX
      // TOTALXX,XXX

      const contabPct = lines[idx + 2]?.match(/^([\d.]+)\s*%$/);
      const contabCount = lines[idx + 5]?.match(/^([\d,]+)$/);
      const jeePct = lines[idx + 7]?.match(/^([\d.]+)\s*%$/);
      const jeeCount = lines[idx + 8]?.match(/^([\d,]+)$/);
      const pendPct = lines[idx + 10]?.match(/^([\d.]+)\s*%$/);
      const pendCount = lines[idx + 11]?.match(/^([\d,]+)$/);
      const totalMatch = lines[idx + 12]?.match(/TOTAL([\d,]+)/);

      if (contabPct && contabCount && pendCount) {
        // Normalize key name - remove accents and special chars
        let key = typeName.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '');

        // Map to expected keys
        if (key.includes('presidencial')) key = 'presidencial';
        else if (key.includes('senadores') && key.includes('unico')) key = 'senadoresUnico';
        else if (key.includes('senadores') && key.includes('multiple')) key = 'senadoresMultiple';
        else if (key.includes('diputados')) key = 'diputados';
        else if (key.includes('parlamento')) key = 'parlamentoAndino';

        result[key] = {
          total: totalMatch ? parseNum(totalMatch[1]) : 92766,
          percent: parseFloat(contabPct[1]),
          processed: parseNum(contabCount[1]),
          jeePercent: jeePct ? parseFloat(jeePct[1]) : 0,
          jeeCount: jeeCount ? parseNum(jeeCount[1]) : 0,
          pending: parseNum(pendCount[1]),
          pendingPercent: pendPct ? parseFloat(pendPct[1]) : 0
        };
      }
    }

    return result;
  });
}

async function scrapeAll() {
  log('===========================================');
  log('Starting ONPE data scrape cycle...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  try {
    const presidenciales = await scrapePresidenciales(page);
    const senadoresUnico = await scrapeSenate(page, 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-nacional-unico', 'SENADORES DEU');
    const senadoresMultiple = await scrapeSenate(page, 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-electoral-multiple', 'SENADORES DEM');
    const diputados = await scrapeDeputies(page);
    const parlamentoAndino = await scrapeParlamento(page);
    const participacion = await scrapeParticipacion(page);
    const actas = await scrapeActas(page);

    // Build final data object with colors
    const allData = {
      timestamp: Date.now(),
      lastUpdate: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      presidenciales,
      senadoresUnico,
      senadoresMultiple,
      diputados,
      parlamentoAndino,
      participacion,
      actas
    };

    // Add colors
    if (allData.presidenciales?.candidates) {
      allData.presidenciales.candidates = allData.presidenciales.candidates.map((c, i) => ({
        ...c, id: c.id || i, color: getPartyColor(c.party)
      }));
    }
    ['senadoresUnico', 'senadoresMultiple', 'diputados', 'parlamentoAndino'].forEach(key => {
      if (allData[key]?.parties) {
        allData[key].parties = allData[key].parties.map(p => ({ ...p, color: getPartyColor(p.name) }));
      }
    });

    // Save cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(allData, null, 2));

    const candCount = allData.presidenciales?.candidates?.length || 0;
    const pct = allData.presidenciales?.percent || 0;
    log(`Scrape complete: ${candCount} candidates, ${pct}% actas`);

    // Push to dashboard
    log('Pushing to dashboard...');
    const response = await fetch(`${DASHBOARD_URL}/api/data`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allData)
    });
    const result = await response.json();
    log(`Push ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.source || result.error}`);

    return allData;

  } catch (error) {
    log(`CRITICAL ERROR: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  log('===========================================');
  log('ONPE Live Scraper Service STARTED');
  log(`Dashboard: ${DASHBOARD_URL}`);
  log(`Scrape interval: ${SCRAPE_INTERVAL / 1000}s`);
  log('===========================================');

  await scrapeAll();
  setInterval(async () => { await scrapeAll(); }, SCRAPE_INTERVAL);
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
