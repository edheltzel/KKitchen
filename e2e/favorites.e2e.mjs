// Headless-Chrome check of the Favorites page, against the built site.
// A Family favorite is a recipe both people rated Loved it. Ratings live on the phone.
// Run: npm run e2e, or npm test && node e2e/favorites.e2e.mjs
import { startHarness } from './harness.mjs';

const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep } = h;
const card = (id) => `article[data-id="${id}"]`;
const loved = (id) => `${card(id)} [data-rating="loved"]`;
const shown = () => ev("[...document.querySelectorAll('#recipe-grid article')].filter((a) => !a.hidden).map((a) => a.dataset.id)");

/** Rate one recipe Loved it as Ed, then as Kristina, on the Recipes page. */
const loveBoth = async (id) => {
  await goto('/');
  await click('[data-me="ed"]');
  await click(loved(id));
  await click('[data-me="kristina"]');
  await click(loved(id));
  await sleep(150);
};

try {
  await goto('/favorites/');
  check('with no ratings the empty line shows and no card is visible', (await visible('#empty')) && (await shown()).length === 0, JSON.stringify(await shown()));
  check('the empty line says a Family favorite is a recipe both loved', (await text('#empty-message')) === 'A Family favorite is a recipe both Ed and Kristina loved.', await text('#empty-message'));
  check('the empty state links to Recipes', (await ev("document.querySelector('#empty a')?.getAttribute('href')")) === '/' && (await text('#empty a')) === 'Recipes');

  await loveBoth('example-1');
  await loveBoth('example-3');
  await goto('/favorites/');
  const ids = await shown();
  check('only the two recipes both people loved are shown', JSON.stringify(ids) === JSON.stringify(['example-1', 'example-3']), JSON.stringify(ids));
  check('the empty line is hidden once a favorite exists', !(await visible('#empty')));
  check('each shown card wears the Family favorite badge', await ev("[...document.querySelectorAll('#recipe-grid article')].filter((a) => !a.hidden).every((a) => { const b = a.querySelector('[data-role=\"family-badge\"]'); return !!b && !b.hidden && b.textContent.includes('Family favorite'); })"));
  check('a recipe only one person loved stays hidden', !(await visible(card('example-2'))));

  await goto('/');
  await click('[data-me="kristina"]');
  await click(loved('example-1'));
  await sleep(150);
  await goto('/favorites/');
  const left = await shown();
  check('clearing one Loved it drops that recipe from Favorites', JSON.stringify(left) === JSON.stringify(['example-3']), JSON.stringify(left));
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await h.finish();
}
