// Walks every tab and overlay in Marathi and prints UI strings that fell back to English.
// Needs the Vite dev server (translate() records misses only in dev builds). Read-only.
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] || 'http://localhost:3000/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('mitra-language', 'mr'); } catch {} });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('.stage-card').first().waitFor();
const tabs = await page.getByRole('tab').all();
for (const tab of tabs) { await tab.click(); await page.waitForTimeout(400); }
await tabs[0].click();
await page.locator('.glossary-dialog').evaluate(d => d.showModal?.());
await page.keyboard.press('Escape');
for (const button of await page.locator('.saved-views button:not([disabled])').all()) { await button.click(); await page.waitForTimeout(100); }
await page.locator('.segmented button').nth(1).click();
await page.locator('.chart-controls .link-btn').click();
await page.locator('#bill-search').fill('zzzz');
await page.waitForTimeout(200);
await page.locator('#bill-search').fill('');
await page.locator('.row-open').first().click();
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.locator('.aging-bucket').first().click();
// Composites built from already-translated parts (they contain Devanagari) or from budget-head codes are not gaps.
const missing = (await page.evaluate(() => [...(window.__missingMr ?? [])].sort()))
  .filter(text => !/[ऀ-ॿ]/.test(text) && !/^A2\d\d -\n/.test(text));
console.log(`${missing.length} untranslated string(s):`);
for (const text of missing) console.log(`  ${JSON.stringify(text)}`);
await browser.close();
