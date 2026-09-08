// Headless screenshot harness: serves the production build, plays the real
// boot flow (CREATE -> Jackson -> START, solo over LocalTransport), captures
// the Treehouse, and reports console/page errors.
// Usage: npm run shot [-- out=shots/treehouse.png wait=3500 port=4173]
// Requires: npm run build first. Needs Edge installed (no browser download).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true'];
  })
);
const PORT = Number(args.port ?? 4173);
const OUT = String(args.out ?? 'shots/treehouse.png');
const WAIT = Number(args.wait ?? 3500);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`server never came up: ${url}`);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
});
let failed = false;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text()}`);
    });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.click('#btn-create', { timeout: 20000 });
    await page.click('#btn-jackson', { timeout: 20000 });
    await page.click('#btn-start', { timeout: 20000 });
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: OUT });
    const webgl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    });
    console.log(`shot -> ${OUT} (webgl: ${webgl})`);
    const real = problems.filter((p) => !/favicon|net::|Failed to load resource|Failed to process file/i.test(p));
    const missing = problems.filter((p) => /Failed to process file/i.test(p));
    if (real.length) {
      failed = true;
      console.log('PAGE PROBLEMS:');
      for (const p of real.slice(0, 12)) console.log('  ' + p);
    } else {
      console.log('no page errors');
    }
    if (missing.length) console.log(`asset fallback (by design): ${missing.length} missing PNGs`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
