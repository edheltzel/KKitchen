// Headless-Chrome check of the "Gluten-free per source" filter chip on the REAL build (the three real recipes, no KK_DATA).
// It builds into a temp folder first, so it works whatever ./dist holds (npm test leaves the fixture build there), and
// it only reads: no deploy, no upload. Chrome quits about 30 s after launch, so the build is done before Chrome starts.
// Run: timeout 120 node e2e/gf-filter-real.e2e.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startHarness } from './harness.mjs';
import { gfFlow } from './gf-filter-flow.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'kk-gf-real-'));
const env = { ...process.env };
delete env.KK_DATA;
execFileSync(join(root, 'node_modules/.bin/astro'), ['build', '--outDir', out], { cwd: root, env, stdio: 'pipe' });
const h = await startHarness({ dist: out });
try {
  await gfFlow(h, {
    total: 3,
    flagged: ['Fried Chicken', 'High Protein Brownies'], left: 'Slow Cooker Roast',
    time: '30', timeNames: ['High Protein Brownies'],
    meal: 'dinner', mealNames: ['Fried Chicken'],
    search: 'chicken', searchNames: ['Fried Chicken'],
    zeroSearch: 'pork', zero: ['time', '15'],
  });
  // The real build only: the flag-less roast never appears under the chip, and the Roast page has no label.
  h.check('real build: the roast is the one recipe the chip leaves out', (await h.text('#recipe-count')) === '3 recipes');
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
}
rmSync(out, { recursive: true, force: true });
await h.finish();
