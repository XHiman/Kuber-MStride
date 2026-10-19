// Accessibility audit: axe-core (WCAG 2.0/2.1 A + AA) on every tab, light and dark, plus reflow checks
// at 360 px and at 200 % zoom (a 1280 px window at 200 % behaves like a 640 px viewport).
// Usage: node e2e/a11y-audit.mjs [baseUrl] [--json out.json]
// Read-only: it only navigates, clicks tabs and opens/closes the glossary and bill drawer.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.argv.find(a => a.startsWith('http')) || 'http://localhost:3000/';
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const tabs = ['Bills pipeline', 'Budget by FY', 'Fund transfers', 'Dashboard'];
const results = [];

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  await context.addInitScript(value => { try { localStorage.setItem('mitra-theme', value); } catch {} }, theme);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.stage-card').first().waitFor();
  for (const tab of tabs) {
    await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    results.push({ theme, view: tab, violations: scan.violations });
  }
  // Overlays
  await page.getByRole('tab', { name: /Bills pipeline/i }).click();
  await page.getByRole('button', { name: /What do these mean/ }).click();
  results.push({ theme, view: 'Glossary dialog', violations: (await new AxeBuilder({ page }).include('dialog[open]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations });
  await page.keyboard.press('Escape');
  await page.locator('.row-open').first().click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(300);
  results.push({ theme, view: 'Bill drawer', violations: (await new AxeBuilder({ page }).include('.bill-drawer').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations });
  await page.keyboard.press('Escape');
  await context.close();
}

const reflow = [];
for (const [label, viewport] of [['360 px phone', { width: 360, height: 800 }], ['200 % zoom (1280 px)', { width: 640, height: 450 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.stage-card').first().waitFor();
  for (const tab of tabs) {
    await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= width + 1) continue;
        let clipped = false;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const o = getComputedStyle(a).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; }
        }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      }
      return { scroll: document.documentElement.scrollWidth > width, offenders: [...new Set(offenders)].slice(0, 6) };
    });
    reflow.push({ label, tab, ...overflow });
  }
  await page.close();
}
await browser.close();

let total = 0;
for (const r of results) {
  for (const v of r.violations) {
    total += v.nodes.length;
    console.log(`[${r.theme}] ${r.view}: ${v.id} (${v.impact}) × ${v.nodes.length} — ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(' ')} :: ${(n.any[0]?.message || n.failureSummary || '').split('\n')[0].slice(0, 160)}`);
  }
}
console.log(`axe: ${total} failing node(s) across ${results.length} scans`);
for (const r of reflow) console.log(`reflow ${r.label} · ${r.tab}: ${r.scroll ? 'HORIZONTAL SCROLL ' + r.offenders.join(', ') : 'ok'}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ results, reflow }, null, 2));
