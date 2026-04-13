const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  
  // === PARTICIPACION CIUDADANA ===
  console.log('\n=== PARTICIPACION CIUDADANA ===');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/participacion-ciudadana', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(10000);
  const partText = await page.evaluate(() => document.body.innerText);
  const partLines = partText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`Total lines: ${partLines.length}`);
  for (let i = 0; i < Math.min(80, partLines.length); i++) {
    console.log(`${i}: [${partLines[i]}]`);
  }
  require('fs').writeFileSync('c:/Users/Miky/Desktop/ELECCIONES/scripts/participacion-debug.txt', partText);
  
  // === ACTAS ===
  console.log('\n\n=== ACTAS ===');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/actas', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(10000);
  const actasText = await page.evaluate(() => document.body.innerText);
  const actasLines = actasText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`Total lines: ${actasLines.length}`);
  for (let i = 0; i < Math.min(80, actasLines.length); i++) {
    console.log(`${i}: [${actasLines[i]}]`);
  }
  console.log('\n--- Lines 80-160 ---');
  for (let i = 80; i < Math.min(160, actasLines.length); i++) {
    console.log(`${i}: [${actasLines[i]}]`);
  }
  require('fs').writeFileSync('c:/Users/Miky/Desktop/ELECCIONES/scripts/actas-debug.txt', actasText);
  
  await browser.close();
  console.log('\nDone');
  process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
