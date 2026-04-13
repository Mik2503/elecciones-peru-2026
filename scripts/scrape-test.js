const { chromium } = require('playwright');
(async () => {
  console.log('Launching...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0' });

  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('response', async resp => {
    if (resp.status() >= 400) {
      console.log('HTTP ' + resp.status() + ' ' + resp.url());
    }
  });

  console.log('Loading resumen...');
  const resp = await page.goto('https://resultadoelectoral.onpe.gob.pe/main/resumen', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Response status:', resp.status());
  console.log('Response headers:', resp.headers()['content-type']);

  await page.waitForTimeout(5000);

  const title = await page.title();
  console.log('Title:', title);

  const html = await page.content();
  console.log('HTML length:', html.length);
  console.log('First 500 chars:', html.substring(0, 500));

  // Try to get text
  const text = await page.evaluate(() => {
    const el = document.querySelector('app-root');
    return {
      appRootLength: el ? el.innerHTML.length : 0,
      bodyText: document.body.innerText.length,
      bodyHTML: document.body.innerHTML.substring(0, 500)
    };
  });
  console.log('App:', text);

  await browser.close();
  console.log('Done');
  process.exit(0);
})();
