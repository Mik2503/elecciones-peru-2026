// ============================================================================
// ONPE Results Scraper - Run locally from a machine that CAN access ONPE
// This script:
//   1. Opens the ONPE results page in a real browser (Playwright)
//   2. Extracts ALL election data (presidential, senators, deputies, etc.)
//   3. Pushes it to the Vercel dashboard via POST /api/data
// ============================================================================

// Install: npm install playwright
// Run: node scrape-onpe.js
// Or: npx node scrape-onpe.js

const { chromium } = require('playwright');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
const ONPE_URL = 'https://resultadoelectoral.onpe.gob.pe/main/resumen';

async function scrapeAndPush() {
  console.log('[ONPE Scraper] Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('[ONPE Scraper] Loading ONPE results page...');
    await page.goto(ONPE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for Angular to load data
    await page.waitForTimeout(5000);

    // Extract all data from the page
    const data = await page.evaluate(() => {
      // Try to find data in Angular's state
      const bodyText = document.body.innerText;
      const scripts = Array.from(document.querySelectorAll('script'));

      // Look for embedded data in scripts
      let embeddedData = null;
      for (const script of scripts) {
        if (script.textContent.includes('presidencial') || script.textContent.includes('actas')) {
          try {
            const match = script.textContent.match(/\{[^{}]*"presidencial"[^{}]*\}/);
            if (match) embeddedData = JSON.parse(match[0]);
          } catch {}
        }
      }

      // Extract visible text data
      const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // Find numbers and percentages
      const numbers = bodyText.match(/[\d,]+/g) || [];
      const percentages = bodyText.match(/\d+\.?\d*\s*%/g) || [];

      return {
        embeddedData,
        visibleText: lines.slice(0, 100),
        numbers: numbers.slice(0, 50),
        percentages: percentages.slice(0, 50),
        fullText: bodyText.substring(0, 5000),
        url: window.location.href,
        timestamp: Date.now()
      };
    });

    console.log('[ONPE Scraper] Extracted data:', JSON.stringify(data, null, 2).substring(0, 500));

    // Check if we got meaningful data
    if (!data.embeddedData && data.percentages.length === 0) {
      console.log('[ONPE Scraper] No election data found yet. The ONPE may not have published results.');
      await browser.close();
      return;
    }

    // Push to dashboard
    console.log('[ONPE Scraper] Pushing data to dashboard...');
    const response = await fetch(`${DASHBOARD_URL}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        status: 'RESULTADOS EN VIVO - ONPE',
        percentCounted: 0,
        isExitPoll: false,
        isLiveScraped: true,
        source: 'ONPE Official (scraped via Playwright)',
        candidates: [], // Will be populated when we parse the data
        totals: { valid: 0, blank: 0, null: 0, total: 0 },
        message: `Datos scrapeados de ONPE a ${new Date().toLocaleTimeString('es-PE')}`,
        rawData: data
      })
    });

    const result = await response.json();
    console.log('[ONPE Scraper] Push result:', result);

  } catch (error) {
    console.error('[ONPE Scraper] Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run every 60 seconds
async function main() {
  console.log('[ONPE Scraper] Starting scraper - will run every 60 seconds');
  console.log(`[ONPE Scraper] Dashboard: ${DASHBOARD_URL}`);
  console.log(`[ONPE Scraper] Source: ${ONPE_URL}`);

  while (true) {
    try {
      await scrapeAndPush();
    } catch (e) {
      console.error('[ONPE Scraper] Loop error:', e.message);
    }
    await new Promise(r => setTimeout(r, 60000));
  }
}

main().catch(console.error);
