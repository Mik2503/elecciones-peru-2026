const { chromium } = require('playwright');
(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  
  console.log('Loading presidenciales page...');
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/presidenciales', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(10000);
  
  // Get raw text
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log(`\n=== TOTAL LINES: ${lines.length} ===`);
  console.log('\n--- First 100 lines ---');
  for (let i = 0; i < 100 && i < lines.length; i++) {
    console.log(`${i}: [${lines[i]}]`);
  }
  console.log('\n--- Lines 100-200 ---');
  for (let i = 100; i < 200 && i < lines.length; i++) {
    console.log(`${i}: [${lines[i]}]`);
  }
  console.log('\n--- Lines 200-300 ---');
  for (let i = 200; i < 300 && i < lines.length; i++) {
    console.log(`${i}: [${lines[i]}]`);
  }
  
  // Save full text for analysis
  require('fs').writeFileSync('c:/Users/Miky/Desktop/ELECCIONES/scripts/debug-text.txt', text);
  console.log('\nFull text saved to debug-text.txt');
  
  // Also try to get HTML structure around candidate data
  const html = await page.evaluate(() => {
    const el = document.querySelector('app-root');
    return el ? el.innerHTML.substring(0, 3000) : 'No app-root content';
  });
  console.log('\n--- app-root HTML (first 3000 chars) ---');
  console.log(html);
  
  await browser.close();
  console.log('\nDone');
  process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
