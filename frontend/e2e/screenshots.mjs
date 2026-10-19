// Captures the screenshot matrix (theme × viewport × tab) for the case study.
// Usage: node e2e/screenshots.mjs <before|after> [baseUrl]
// Requires: npx playwright install chromium
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const label = process.argv[2] || 'after';
const baseUrl = process.argv[3] || 'http://localhost:3000/';
const outDir = resolve(import.meta.dirname, '..', '..', 'SCREENSHOTS', label);
mkdirSync(outDir, { recursive: true });

const themes = ['light', 'dark'];
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 360, height: 800 } };
const tabs = [
  { id: 'bills', name: 'Bills pipeline' },
  { id: 'budget', name: 'Budget by FY' },
  { id: 'transfers', name: 'Fund transfers' },
  { id: 'dashboard', name: 'Dashboard' },
];

const browser = await chromium.launch();
for (const theme of themes) {
  for (const [device, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript(([value]) => {
      try { localStorage.setItem('mitra-theme', value); localStorage.setItem('mitra-language', 'en'); } catch {}
    }, [theme]);
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('.stage-card .scount').first().waitFor();
    for (const tab of tabs) {
      await page.getByRole('tab', { name: new RegExp(tab.name, 'i') }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      const file = resolve(outDir, `${tab.id}-${theme}-${device}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await context.close();
  }
}
await browser.close();
