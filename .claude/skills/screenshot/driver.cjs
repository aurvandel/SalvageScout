// Runs INSIDE the salvagescout-screenshot container (has playwright installed
// at /tools/node_modules). Navigates to a URL served by the container's own
// vite dev server and writes a full-page screenshot.
//
// Usage: node driver.cjs <url> <outFile> [waitForSelector]
const { chromium } = require('/tools/node_modules/playwright');

const url = process.argv[2];
const outFile = process.argv[3];
const waitForSelector = process.argv[4];

if (!url || !outFile) {
  console.error('usage: node driver.cjs <url> <outFile> [waitForSelector]');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch((e) => errors.push(`waitForSelector timeout: ${e.message}`));
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: outFile, fullPage: true });

  console.log('TITLE:', await page.title());
  console.log('BODY_TEXT_SNIPPET:', (await page.innerText('body')).slice(0, 300).replace(/\n+/g, ' | '));
  console.log('CONSOLE_ERRORS:', errors.length ? errors.join(' ;; ') : '(none)');
  await browser.close();
})().catch((e) => { console.error('DRIVER_FAIL', e); process.exit(1); });
