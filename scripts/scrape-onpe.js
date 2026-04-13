const { chromium } = require('playwright');
const fs = require('fs');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
const ONPE_URL = 'https://resultadoelectoral.onpe.gob.pe/main/resumen';
const DATA_FILE = './onpe-data.json';

async function scrapeSection(page, url, sectionName) {
  console.log(`  [Scraping] ${sectionName}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000); // Wait for Angular to load data

  const data = await page.evaluate(() => {
    // Extract all visible text and table data
    const tables = Array.from(document.querySelectorAll('table, .mat-mdc-table, mat-table, [class*="table"]'));
    const tableData = tables.map(t => t.innerText.substring(0, 500));

    // Extract all number/percentage patterns from the page
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Extract any JSON-like data from script tags
    const scripts = Array.from(document.querySelectorAll('script'));
    let scriptData = null;
    for (const s of scripts) {
      if (s.textContent.length > 500) {
        scriptData = s.textContent.substring(0, 2000);
        break;
      }
    }

    return {
      title: document.title,
      url: window.location.href,
      bodyLines: lines.slice(0, 80),
      tables: tableData.slice(0, 10),
      scriptData,
      fullText: bodyText.substring(0, 8000),
      timestamp: Date.now()
    };
  });

  console.log(`  [Scraped] ${sectionName}: ${data.bodyLines.length} lines, ${data.tables.length} tables`);
  return data;
}

async function scrapeAll() {
  console.log('[ONPE Scraper] Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const results = {};

  try {
    // 1. Resumen General
    results.resumenGeneral = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/resumen', 'Resumen General');

    // 2. Presidenciales
    results.presidenciales = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/presidenciales', 'Presidenciales');

    // 3. Diputados
    results.diputados = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/diputados', 'Diputados');

    // 4. Senadores
    results.senadores = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-electoral-multiple', 'Senadores');

    // 5. Parlamento Andino
    results.parlamentoAndino = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/parlamento-andino', 'Parlamento Andino');

    // 6. Participación Ciudadana
    results.participacion = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/participacion-ciudadana', 'Participación Ciudadana');

    // 7. Actas
    results.actas = await scrapeSection(page, 'https://resultadoelectoral.onpe.gob.pe/main/actas', 'Actas');

    // Save locally
    fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2));
    console.log(`[ONPE Scraper] Data saved to ${DATA_FILE}`);

    // Push to dashboard
    console.log('[ONPE Scraper] Pushing to dashboard...');
    const response = await fetch(`${DASHBOARD_URL}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        status: 'RESULTADOS EN VIVO - ONPE Oficial',
        percentCounted: 0,
        isExitPoll: false,
        isLiveScraped: true,
        source: 'ONPE Official (Playwright Scraper)',
        candidates: [],
        totals: { valid: 0, blank: 0, null: 0, total: 0 },
        message: `Datos scrapeados de ONPE a ${new Date().toLocaleTimeString('es-PE')}`,
        scrapedData: results
      })
    });

    const result = await response.json();
    console.log('[ONPE Scraper] Push result:', result.success ? 'SUCCESS' : 'FAILED', result.source || result.error);

  } catch (error) {
    console.error('[ONPE Scraper] Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run
scrapeAll().catch(console.error);
