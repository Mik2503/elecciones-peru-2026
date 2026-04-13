const { chromium } = require('playwright');
(async () => {
  console.log('Loading JNE candidates with network monitoring...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

  // Monitor all network requests
  page.on('request', req => {
    const url = req.url();
    if (url.includes('api') || url.includes('graphql') || url.includes('candidato') || url.includes('presidente') || url.includes('jne')) {
      console.log(`>>> REQ: ${req.method()} ${url.substring(0, 80)}`);
    }
  });

  page.on('response', async resp => {
    const url = resp.url();
    const status = resp.status();
    if (url.includes('api') || url.includes('graphql') || url.includes('candidato') || url.includes('presidente') || url.includes('.json') || (status >= 200 && status < 300 && url.includes('jne'))) {
      try {
        const ct = resp.headers()['content-type'] || '';
        if (ct.includes('json') || ct.includes('application')) {
          const body = await resp.text();
          console.log(`>>> JSON [${status}]: ${url.substring(0, 80)}`);
          console.log(`>>> DATA: ${body.substring(0, 1000)}`);
        }
      } catch (e) { }
    }
  });

  await page.goto('https://votoinformado.jne.gob.pe/presidente-vicepresidentes', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(15000);

  // Get all clickable elements
  const clickableElements = await page.evaluate(() => {
    const elements = [];
    const allClickable = document.querySelectorAll('a, button, [role="button"], [onclick], [ng-click], .card, .candidate-card, .item, [class*="card"], [class*="item"], [class*="candidate"]');
    allClickable.forEach(el => {
      const text = el.textContent?.trim().substring(0, 50);
      const tag = el.tagName;
      const cls = el.className?.substring(0, 50);
      const href = el.href || el.getAttribute('href') || '';
      if (text && text.length > 3) {
        elements.push({ tag, cls: cls || '', text, href: href.substring(0, 80) });
      }
    });
    return elements.slice(0, 50);
  });

  console.log('\n--- Clickable elements ---');
  clickableElements.forEach((el, i) => console.log(`${i}: <${el.tag}> class="${el.cls}" text="${el.text}" href="${el.href}"`));

  // Try to click on first candidate card
  console.log('\nTrying to click on first candidate...');
  try {
    // Try clicking on any element that contains a candidate name
    const candidateElement = await page.$('text=KEIKO SOFIA');
    if (candidateElement) {
      await candidateElement.click();
      await page.waitForTimeout(10000);

      const text = await page.evaluate(() => document.body.innerText);
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      console.log(`\nAfter click - ${lines.length} lines`);
      for (let i = 0; i < 100 && i < lines.length; i++) {
        console.log(`${i}: [${lines[i]}]`);
      }
      require('fs').writeFileSync('c:/Users/Miky/Desktop/ELECCIONES/scripts/jne-detail-click.txt', text);
    } else {
      console.log('Could not find candidate element to click');
      // Save current page HTML
      const html = await page.content();
      require('fs').writeFileSync('c:/Users/Miky/Desktop/ELECCIONES/scripts/jne-html.html', html);
      console.log('Saved HTML to jne-html.html');
    }
  } catch (e) {
    console.log('Click error:', e.message);
  }

  await browser.close();
  console.log('\nDone');
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
