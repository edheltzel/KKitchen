// Headless-Chrome check of the "Gluten-free per source" filter chip on the FIXTURE build (npm test builds it into ./dist).
// Two fixture examples carry the flag (Overnight Oats, Lemon Rice Bowl), so this checks the positive and the negative case.
// Run: npm test && timeout 40 node e2e/gf-filter.e2e.mjs
import { startHarness } from './harness.mjs';
import { gfFlow } from './gf-filter-flow.mjs';

const h = await startHarness();
try {
  await gfFlow(h, {
    total: 6,
    flagged: ['Overnight Oats', 'Lemon Rice Bowl'], left: 'Tomato Soup',
    time: '15', timeNames: ['Overnight Oats'],
    meal: 'lunch', mealNames: ['Lemon Rice Bowl'],
    search: 'lemon', searchNames: ['Lemon Rice Bowl'],
    zeroSearch: 'tomato', zero: ['meal', 'dinner'],
  });
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
}
await h.finish();
