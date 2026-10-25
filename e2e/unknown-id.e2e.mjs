// Headless-Chrome check that saved data for a recipe that no longer exists (the old id left behind by a rename)
// is ignored everywhere: the Week page, the Recipes page ratings and filters, the recipe and cooking pages' ticks.
// Run: rm -rf dist && npm test && timeout 40 node e2e/unknown-id.e2e.mjs   (the page believes it is Thu 29 Oct 2026)
import { startHarness } from './harness.mjs';

const GONE = 'gluten-free-fried-chicken';
const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep, waitFor, send } = h;
const THU = '2026-10-29', FRI = '2026-10-30';
const row = (day) => `#week-list li[data-day="${day}"]`;
const errors = () => ev('window.__errs.slice()');
const seed = (key, value) => ev(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(value))})`);
try {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message))); addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))); const ce = console.error; console.error = (...a) => { window.__errs.push(a.join(' ')); ce(...a); };`,
  });
  await goto('/week/');
  const at = Date.now();
  await seed('kk:week', { v: 1, entries: { [THU]: { recipeId: GONE, at }, [FRI]: { recipeId: 'example-1', at } } });
  await seed('kk:ratings', { v: 1, entries: { [GONE]: { ed: { value: 'loved', at }, kristina: { value: 'loved', at } }, 'example-2': { ed: { value: 'loved', at } } } });
  await seed('kk:ticks', { v: 1, ticks: { [GONE]: ['milk', 'flour'] } });

  // --- Week page: the planned day that points at the old id ----------------------------------------------------
  await goto('/week/');
  const thu = await ev(`document.querySelector(${JSON.stringify(row(THU))}).textContent.replace(/\\s+/g, ' ').trim()`);
  const cards = await ev('document.querySelectorAll("#week-list [data-role=card]").length');
  console.log('PROBE week Thursday text:', JSON.stringify(thu), 'dinner cards on the page:', cards, 'errors:', JSON.stringify(await errors()));
  check('Week: the day planned with a recipe that is gone shows as an empty day with "+ Add a dinner", not a card', (await visible(`${row(THU)} [data-role="add"]`)) && !(await visible(`${row(THU)} [data-role="card"]`)), thu);
  check('Week: no card is named "a recipe"', !/a recipe/i.test(await ev('document.querySelector("#week-list").textContent')));
  check('Week: a day planned with a real recipe still shows it', (await text(`${row(FRI)} [data-role="name"]`)) === 'Weeknight Pasta', await text(`${row(FRI)} [data-role="name"]`));
  check('Week: exactly one dinner card (the real one)', cards === 1, String(cards));
  check('Week: no console error or exception', (await errors()).length === 0, JSON.stringify(await errors()));
  const stored = JSON.parse(await ev("localStorage.getItem('kk:week')"));
  check('Week: showing the page does not erase the saved entry (it is only ignored)', stored.entries[THU]?.recipeId === GONE);

  // --- Recipes page: ratings and filters ------------------------------------------------------------------------
  await goto('/');
  const total = await text('#recipe-count');
  const favBadges = await ev('[...document.querySelectorAll("#recipe-grid [data-role=family-badge]")].filter((b) => !b.hidden).length');
  console.log('PROBE home count:', total, 'family favorite badges shown:', favBadges, 'errors:', JSON.stringify(await errors()));
  check('Recipes: the count is the real number of cards, the old id adds nothing', total === `${await ev('document.querySelectorAll("#recipe-grid [data-id]").length')} recipes`, total);
  check('Recipes: no Family favorite badge from a rating for a recipe that is gone', favBadges === 0, String(favBadges));
  await click('#filters-open, [data-open-filters], button[aria-controls="filter-tray"]').catch(() => {});
  await sleep(300);
  await ev(`document.querySelector('.kk-chip[data-group="who"][data-value="favorite"]').click()`);
  await sleep(300);
  const fav = await text('#recipe-count');
  console.log('PROBE Family favorites filter count:', fav);
  check('Recipes: the Family favorites filter finds nothing (the only both-loved id is gone)', /^0 recipes|No recipe/i.test(fav ?? '') || (await visible('#empty')), fav);
  await ev(`document.querySelector('.kk-chip[data-group="who"][data-value="favorite"]').click()`);
  await ev(`document.querySelector('.kk-chip[data-group="who"][data-value="ed"]').click()`);
  await sleep(300);
  const ed = await text('#recipe-count');
  console.log('PROBE Ed loved it count:', ed);
  check('Recipes: "Ed loved it" counts only the real recipe', ed === '1 recipe', ed);
  check('Recipes: no console error or exception', (await errors()).length === 0, JSON.stringify(await errors()));

  // --- Recipe and cooking pages: ticks ---------------------------------------------------------------------------
  await goto('/recipe/example-1/');
  const ticked = await ev('[...document.querySelectorAll("input[data-item]")].filter((b) => b.checked).length');
  console.log('PROBE recipe page ticked boxes:', ticked, 'errors:', JSON.stringify(await errors()));
  check('Recipe page: ticks saved for the old id tick nothing', ticked === 0, String(ticked));
  check('Recipe page: no console error or exception', (await errors()).length === 0, JSON.stringify(await errors()));
  await goto('/cook/example-1/');
  check('Cooking page: loads normally and has no console error or exception', (await visible('h1, h2')) && (await errors()).length === 0, JSON.stringify(await errors()));
  const ticks = JSON.parse(await ev("localStorage.getItem('kk:ticks')"));
  check('Ticks: the old id entry is left in storage, only ignored', ticks.ticks[GONE]?.length === 2);
} catch (e) {
  h.check('e2e did not crash: ' + e.message, false);
}
await h.finish();
