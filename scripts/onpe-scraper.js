const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
const LOG_FILE = path.join(__dirname, 'onpe-scraper.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function scrapeONPE() {
  log('===========================================');
  log('ONPE Results Scraper - Getting fresh data');
  log('===========================================');
  
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  
  try {
    // Scrape Presidenciales
    log('Scraping presidenciales...');
    await page.goto('https://resultadoelectoral.onpe.gob.pe/main/presidenciales', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);
    
    const presidenciales = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Extract actas info
      const actasMatch = text.match(/Actas contabilizadas\s*([\d.]+)%/);
      const totalActasMatch = text.match(/Total de actas:\s*([\d,]+)/);
      const contabilizadasMatch = text.match(/Contabilizadas\s*\(([\d,]+)\)/);
      const pendientesMatch = text.match(/Pendientes\s*\(([\d,]+)\)/);
      const jeeMatch = text.match(/Para envio al JEE\s*\(([\d,]+)\)/);
      
      let percent = 0, totalActas = 92766, processedActas = 0, jeePending = 0, pendingActas = 0;
      if (actasMatch) percent = parseFloat(actasMatch[1]);
      if (totalActasMatch) totalActas = parseInt(totalActasMatch[1].replace(/,/g, ''));
      if (contabilizadasMatch) processedActas = parseInt(contabilizadasMatch[1].replace(/,/g, ''));
      if (jeeMatch) jeePending = parseInt(jeeMatch[1].replace(/,/g, ''));
      if (pendientesMatch) pendingActas = parseInt(pendientesMatch[1].replace(/,/g, ''));
      
      // Calculate percent if not found
      if (percent === 0 && processedActas > 0) {
        percent = Math.round((processedActas / totalActas) * 10000) / 100;
      }
      
      // Extract candidates - format is:
      // Number
      // Candidate Name
      // Party
      // Valid %
      // Emitted %
      // Cantidad de votos:X'XXX,XXX
      
      const candidates = [];
      const knownParties = [
        'FUERZA POPULAR', 'RENOVACION POPULAR', 'PARTIDO DEL BUEN GOBIERNO',
        'PARTIDO PAIS PARA TODOS', 'PARTIDO CIVICO OBRAS', 'AHORA NACION',
        'PRIMERO LA GENTE', 'PARTIDO SICREO', 'JUNTOS POR EL PERU',
        'PARTIDO MORADO', 'COOPERACION POPULAR', 'SOMOS PERU',
        'FRENTE DE LA ESPERANZA', 'PARTIDO PATRIOTICO', 'PERU PRIMERO',
        'INTEGRIDAD DEMOCRATICA', 'PARTIDO APRISTA', 'ALIANZA PARA EL PROGRESO',
        'ALIANZA ELECTORAL VENCEREMOS', 'PARTIDO DEMOCRATA UNIDO',
        'LIBERTAD POPULAR', 'PARTIDO POLITICO NACIONAL PERU LIBRE',
        'PODEMOS PERU', 'PROGRESEMOS', 'PARTIDO DEMOCRATA VERDE',
        'AVANZA PAIS', 'PARTIDO POLITICO PERU ACCION', 'FUERZA Y LIBERTAD',
        'FE EN EL PERU', 'PARTIDO DEMOCRATICO FEDERAL', 'PARTIDO POLITICO PRIN',
        'PERU MODERNO', 'SALVEMOS AL PERU', 'UN CAMINO DIFERENTE', 'UNIDAD NACIONAL'
      ];
      
      for (let i = 0; i < lines.length - 4; i++) {
        const numMatch = lines[i].match(/^(\d+)$/);
        if (numMatch && i + 4 < lines.length) {
          const name = lines[i + 1];
          const partyLine = lines[i + 2];
          const validMatch = lines[i + 3]?.match(/^([\d.]+)\s*%$/);
          const emitMatch = lines[i + 4]?.match(/^([\d.]+)\s*%$/);
          const votesMatch = lines[i + 5]?.match(/Cantidad de votos:([\d',]+)/);
          
          // Verify it's a real candidate (not a header)
          const matchingParty = knownParties.find(p => 
            partyLine.toUpperCase().includes(p.toUpperCase().replace('Ó', 'O').replace('É', 'E'))
          );
          
          if (validMatch && votesMatch && name.length > 10 && name.length < 70 && !name.includes('%')) {
            // Check if this is a presidential candidate (look ahead for PRESIDENTE)
            const cargoCheck = lines.slice(i, i + 10).join(' ').includes('PRESIDENTE');
            
            candidates.push({
              id: parseInt(numMatch[1]),
              name: name,
              party: matchingParty || partyLine,
              validPercent: parseFloat(validMatch[1]),
              emitPercent: emitMatch ? parseFloat(emitMatch[1]) : 0,
              votes: parseInt(votesMatch[1].replace(/'/g, '').replace(/,/g, '')),
              isPresident: cargoCheck
            });
          }
        }
      }
      
      // Filter only presidential candidates
      const presidents = candidates.filter(c => c.isPresident);
      
      // Extract totals
      let validVotes = 0, blankVotes = 0, nullVotes = 0, totalVotes = 0;
      for (let j = 0; j < lines.length - 1; j++) {
        if (lines[j] === 'VOTOS EN BLANCO' && lines[j+1]?.match(/Cantidad de votos:([\d',]+)/))
          blankVotes = parseInt(lines[j+1].match(/Cantidad de votos:([\d',]+)/)[1].replace(/'/g, '').replace(/,/g, ''));
        if (lines[j] === 'VOTOS NULOS' && lines[j+1]?.match(/Cantidad de votos:([\d',]+)/))
          nullVotes = parseInt(lines[j+1].match(/Cantidad de votos:([\d',]+)/)[1].replace(/'/g, '').replace(/,/g, ''));
        if (lines[j] === 'TOTAL DE VOTOS' && lines[j+1]?.match(/Cantidad de votos:([\d',]+)/))
          totalVotes = parseInt(lines[j+1].match(/Cantidad de votos:([\d',]+)/)[1].replace(/'/g, '').replace(/,/g, ''));
      }
      
      // Calculate valid votes
      validVotes = presidents.reduce((sum, c) => sum + c.votes, 0);
      
      return {
        totalActas, processedActas, jeePending, pendingActas, percent,
        candidates: presidents.sort((a, b) => b.votes - a.votes),
        totals: { validVotes, blankVotes, nullVotes, totalVotes }
      };
    });
    
    log(`Presidenciales: ${presidenciales.percent}% actas, ${presidenciales.candidates.length} candidates`);
    log(`Top 3: ${presidenciales.candidates.slice(0, 3).map(c => c.name.substring(0, 20) + ' ' + c.votes).join(' | ')}`);
    
    // Now scrape Participacion
    log('Scraping participacion...');
    await page.goto('https://resultadoelectoral.onpe.gob.pe/main/participacion-ciudadana', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(10000);
    
    const participacion = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      let electoresHabiles = 0, totalAsistentes = 0, totalAusentes = 0;
      let asistentesPercent = 0, ausentesPercent = 0, pendientesPercent = 0;
      let exteriorAsistentes = 0, peruAsistentes = 0;
      
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i] === 'Electores hábiles' && lines[i+1]?.match(/^[\d',]+$/))
          electoresHabiles = parseInt(lines[i+1].replace(/'/g, '').replace(/,/g, ''));
        if (lines[i].includes('Total de asistentes')) {
          const match = lines[i].match(/([\d',]+)\s*Total de ausentes/);
          if (match) totalAsistentes = parseInt(match[1].replace(/'/g, '').replace(/,/g, ''));
          else if (lines[i+1]?.match(/^[\d',]+$/)) totalAsistentes = parseInt(lines[i+1].replace(/'/g, '').replace(/,/g, ''));
        }
        if (lines[i].includes('Total de ausentes') && totalAusentes === 0) {
          const match = lines[i].match(/Total de ausentes\s*([\d',]+)/);
          if (match) totalAusentes = parseInt(match[1].replace(/'/g, '').replace(/,/g, ''));
          else if (lines[i+1]?.match(/^[\d',]+$/)) totalAusentes = parseInt(lines[i+1].replace(/'/g, '').replace(/,/g, ''));
        }
        if (lines[i].includes('Ciudadanos asistentes:')) {
          const m = lines[i].match(/([\d.]+)\s*%/);
          if (m) asistentesPercent = parseFloat(m[1]);
        }
        if (lines[i].includes('Ciudadanos ausentes:')) {
          const m = lines[i].match(/([\d.]+)\s*%/);
          if (m) ausentesPercent = parseFloat(m[1]);
        }
        if (lines[i].includes('Ciudadanos pendientes:')) {
          const m = lines[i].match(/([\d.]+)\s*%/);
          if (m) pendientesPercent = parseFloat(m[1]);
        }
        if (lines[i] === 'EXTRANJERO' && lines[i+1]?.includes('asistieron')) {
          const m = lines[i+1].match(/([\d.]+)\s*%/);
          if (m) exteriorAsistentes = parseFloat(m[1]);
        }
        if (lines[i] === 'PERÚ' && lines[i+1]?.includes('asistieron')) {
          const m = lines[i+1].match(/([\d.]+)\s*%/);
          if (m) peruAsistentes = parseFloat(m[1]);
        }
      }
      
      return {
        electoresHabiles, totalAsistentes, totalAusentes,
        asistentesPercent, ausentesPercent, pendientesPercent,
        exteriorAsistentes, peruAsistentes
      };
    });
    
    log(`Participacion: ${participacion.totalAsistentes.toLocaleString()} asistentes (${participacion.asistentesPercent}%)`);
    
    // Now scrape Actas
    log('Scraping actas...');
    await page.goto('https://resultadoelectoral.onpe.gob.pe/main/actas', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(10000);
    
    const actas = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const result = {};
      
      const types = ['PRESIDENCIAL', 'SENADORES DISTRITO ELECTORAL ÚNICO', 'SENADORES DISTRITO ELECTORAL MÚLTIPLE', 'DIPUTADOS', 'PARLAMENTO ANDINO'];
      
      for (const typeName of types) {
        const idx = lines.findIndex(l => l === typeName);
        if (idx === -1 || idx + 12 >= lines.length) continue;
        
        const contabPct = lines[idx + 2]?.match(/^([\d.]+)\s*%$/);
        const contabCount = lines[idx + 5]?.match(/^([\d,]+)$/);
        const jeePct = lines[idx + 7]?.match(/^([\d.]+)\s*%$/);
        const jeeCount = lines[idx + 8]?.match(/^([\d,]+)$/);
        const pendPct = lines[idx + 10]?.match(/^([\d.]+)\s*%$/);
        const pendCount = lines[idx + 11]?.match(/^([\d,]+)$/);
        const totalMatch = lines[idx + 12]?.match(/TOTAL([\d,]+)/);
        
        if (contabPct && contabCount && pendCount) {
          let key = typeName.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '');
          
          if (key.includes('presidencial')) key = 'presidencial';
          else if (key.includes('senadores') && key.includes('unico')) key = 'senadoresUnico';
          else if (key.includes('senadores') && key.includes('multiple')) key = 'senadoresMultiple';
          else if (key.includes('diputados')) key = 'diputados';
          else if (key.includes('parlamento')) key = 'parlamentoAndino';
          
          result[key] = {
            total: totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : 92766,
            percent: parseFloat(contabPct[1]),
            processed: parseInt(contabCount[1].replace(/,/g, '')),
            jeePercent: jeePct ? parseFloat(jeePct[1]) : 0,
            jeeCount: jeeCount ? parseInt(jeeCount[1].replace(/,/g, '')) : 0,
            pending: parseInt(pendCount[1].replace(/,/g, '')),
            pendingPercent: pendPct ? parseFloat(pendPct[1]) : 0
          };
        }
      }
      
      return result;
    });
    
    log(`Actas scraped: ${Object.keys(actas).length} types`);
    Object.entries(actas).forEach(([k, v]) => {
      log(`  ${k}: ${v.percent}% (${v.processed}/${v.total})`);
    });
    
    // Build complete data object
    const allData = {
      timestamp: Date.now(),
      lastUpdate: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      presidenciales,
      participacion,
      actas
    };
    
    log('===========================================');
    log('Scrape complete - pushing to dashboard');
    log('===========================================');
    
    // Push to dashboard
    try {
      const res = await fetch(`${DASHBOARD_URL}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allData)
      });
      const result = await res.json();
      log(`Push result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.source || result.error}`);
    } catch(e) {
      log(`Push error: ${e.message}`);
    }
    
    // Save local cache
    fs.writeFileSync(path.join(__dirname, 'onpe-fresh-data.json'), JSON.stringify(allData, null, 2));
    log('Local cache saved');
    
    return allData;
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

// Main
async function main() {
  const data = await scrapeONPE();
  if (data) {
    console.log('SUCCESS - Data pushed to dashboard');
  } else {
    console.log('FAILED - Check scraper.log for details');
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
