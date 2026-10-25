// Headless-Chrome check of the recipe page: ticks that survive a reload, Reset with Undo, Back keeping the filters and the
// scroll, ratings and Plan reused from the Recipes page, and the two-column desktop layout (the page thinks it is Thu 29 Oct 2026).
// Run: npm run build && timeout 60 node e2e/recipe.e2e.mjs
import { startHarness, PHONE_WIDTH, PHONE_HEIGHT } from './harness.mjs';

const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep, rect, waitFor, send } = h;
const ticksSaved = async () => JSON.parse((await ev("localStorage.getItem('kk:ticks')")) ?? 'null');
const ticked = () => ev("[...document.querySelectorAll('input[data-item]')].filter((b) => b.checked).map((b) => b.dataset.item)");
const tick = (item) => click(`input[data-item="${item}"]`);
const loaded = async () => { await sleep(500); await waitFor("document.readyState === 'complete'"); await sleep(400); };
const reload = async () => { await ev('location.reload()'); await loaded(); };
try {
  // --- Back keeps the filters and the scroll --------------------------------------------------------------------
  await goto('/?q=a');
  await ev('window.scrollTo(0, 80)');
  await sleep(350);
  const listY = await ev('scrollY');
  check('(setup) the filtered list is scrolled', listY > 40, String(listY));
  const href = await ev("document.querySelector('#recipe-grid [data-id=\"example-4\"] a.kk-card-link').getAttribute('href')");
  check('a card title is a link to its recipe page', href === '/recipe/example-4/', href);
  await click('#recipe-grid [data-id="example-4"] a.kk-card-link');
  await loaded();
  check('the link opens the recipe page', (await ev('location.pathname')) === '/recipe/example-4/' && (await text('h1')) === 'Example recipe: Overnight Oats', await text('h1'));
  check('the Back link is at least 44px tall and the Recipes tab is current', (await rect('#back')).h >= 44 && (await ev("document.querySelector('nav a[data-tab=\"recipes\"]').getAttribute('aria-current')")) === 'page');
  check('Back points at the saved list URL with its filters', (await ev("document.querySelector('#back').getAttribute('href')")) === '/?q=a');
  const entries = await ev('history.length');
  await click('#back');
  await loaded();
  check('Back returns to the same filters', (await ev('location.pathname + location.search')) === '/?q=a' && (await ev("document.querySelector('#search-input').value")) === 'a', await ev('location.href'));
  check('Back returns to the same scroll', Math.abs((await ev('scrollY')) - listY) <= 2, `${await ev('scrollY')} vs ${listY}`);
  check('Back did not stack another Recipes entry', (await ev('history.length')) <= entries, `${await ev('history.length')} vs ${entries}`);

  // --- opened directly (no list before it): Back is a plain link ---------------------------------------------------
  await goto('/recipe/example-1/');
  await ev("sessionStorage.removeItem('kk:recipes')");
  await reload();
  check('opened directly, Back links to Recipes', (await ev("document.querySelector('#back').getAttribute('href')")) === '/');
  await click('#back');
  await loaded();
  check('and goes there', (await ev('location.pathname')) === '/');

  // --- content ------------------------------------------------------------------------------------------------------
  await goto('/recipe/example-1/');
  check('title, meta line and tag', (await text('h1')) === 'Example recipe: Weeknight Pasta' && (await ev("document.querySelector('header p.font-mono').textContent")) === 'Prep 10 min · Cook 15 min · Serves 4' && (await text('ul[aria-label="Tags"]')) === 'Meatless');
  check('ingredient groups and numbered steps', (await ev("[...document.querySelectorAll('h3')].map((e) => e.textContent).join('|')")) === 'Pasta|Sauce' && (await ev("document.querySelectorAll('#steps li').length")) === 4);
  check('original recipe link: new tab, noopener noreferrer', await ev("(() => { const a = document.querySelector('a.kk-source'); return a.target === '_blank' && a.rel === 'noopener noreferrer' && a.href === 'https://example.com/example-pasta'; })()"));
  check('every tick row and the reset button are at least 44px tall', await ev("[...document.querySelectorAll('.kk-tick')].every((l) => l.getBoundingClientRect().height >= 44) && document.querySelector('#reset-ticks').getBoundingClientRect().height >= 44"));
  check('nothing scrolls sideways at 390px', await ev('document.documentElement.scrollWidth <= innerWidth'));
  check('Reset checks is off while nothing is ticked', await ev("document.querySelector('#reset-ticks').disabled"));

  // --- ticks: tick, reload, still ticked --------------------------------------------------------------------------
  await tick('garlic');
  await tick('tomato');
  check('ticking shows ticked rows and saves under one key for this recipe only', (await ticked()).sort().join() === 'garlic,tomato', JSON.stringify(await ticked()));
  const saved = await ticksSaved();
  check('saved as { v: 1, ticks: { "example-1": [...] } }', saved.v === 1 && Object.keys(saved.ticks).join() === 'example-1' && saved.ticks['example-1'].slice().sort().join() === 'garlic,tomato', JSON.stringify(saved));
  await reload();
  check('after a reload they are still ticked', (await ticked()).sort().join() === 'garlic,tomato', JSON.stringify(await ticked()));
  check('a ticked row is struck through and Reset checks is on', (await ev("getComputedStyle(document.querySelector('input[data-item=\"garlic\"] + span')).textDecorationLine")) === 'line-through' && !(await ev("document.querySelector('#reset-ticks').disabled")));
  await goto('/recipe/example-2/');
  check('another recipe has its own checks (nothing ticked there)', (await ticked()).length === 0);
  await tick('olive-oil');
  await goto('/recipe/example-1/');
  check('and ticking there did not touch this one', (await ticked()).sort().join() === 'garlic,tomato');

  // --- Reset checks and Undo ---------------------------------------------------------------------------------------
  await click('#reset-ticks');
  await sleep(150);
  check('Reset checks unticks everything straight away, with no confirm dialog', (await ticked()).length === 0 && !(await ev("document.querySelector('dialog[open]')")));
  check('the shared Undo bar says "Checks cleared" and replaces the tab bar', (await visible('#undo-bar')) && (await text('#undo-text')) === 'Checks cleared' && !(await visible('nav[aria-label="Main"]')));
  check('Undo is at least 44px tall', (await rect('#undo-button')).h >= 44);
  await reload();
  check('the reset is saved: after a reload nothing is ticked', (await ticked()).length === 0 && (await ticksSaved()).ticks['example-1'] === undefined);
  await goto('/recipe/example-1/');
  await tick('garlic');
  await click('#reset-ticks');
  await click('#undo-button');
  await sleep(150);
  check('Undo ticks the same items back', (await ticked()).join() === 'garlic' && !(await visible('#undo-bar')));
  await reload();
  check('and the undo is saved', (await ticked()).join() === 'garlic');
  check('Undo brings the tab bar back', await visible('nav[aria-label="Main"]'));

  // --- ticks blocked: the banner, Retry ---------------------------------------------------------------------------
  await ev("window.__tfail = true; const setT = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__tfail && k === 'kk:ticks') throw new Error('full'); return setT.call(this, k, v); };");
  await tick('tomato');
  check('blocked storage: the tick still shows, and the banner says so', (await ticked()).sort().join() === 'garlic,tomato' && (await visible('#ticks-unavailable')) && (await text('#ticks-unavailable p')) === "Can't save your checks on this phone. They last until you close this page.");
  check('Retry is at least 44px tall', (await rect('#ticks-retry')).h >= 44);
  await click('#ticks-retry');
  check('Retry while still blocked keeps the banner', await visible('#ticks-unavailable'));
  await ev('window.__tfail = false');
  await click('#ticks-retry');
  check('Retry saves what is on screen and the banner goes', !(await visible('#ticks-unavailable')) && (await ticksSaved()).ticks['example-1'].slice().sort().join() === 'garlic,tomato');

  // --- ratings and Plan are the same controls as on the list --------------------------------------------------------
  await goto('/recipe/example-1/');
  check('the rating buttons are the list\'s: Loved it / Not for us, 44px tall', (await ev("[...document.querySelectorAll('.kk-rate-btn')].map((b) => b.textContent).join('|')")) === 'Loved it|Not for us' && (await ev("[...document.querySelectorAll('.kk-rate-btn')].every((b) => b.getBoundingClientRect().height >= 44)")));
  await click('.kk-rate-btn[data-rating="loved"]');
  check('rating with nobody picked asks who you are and saves nothing', (await ev("localStorage.getItem('kk:ratings')")) === null && (await visible('#me-hint')));
  await click('[data-me="ed"]');
  await click('.kk-rate-btn[data-rating="loved"]');
  check('Ed rates Loved it: status line and pressed button', (await text('[data-person="ed"]')) === 'Ed: Loved it' && (await ev("document.querySelector('.kk-rate-btn[data-rating=\"loved\"]').getAttribute('aria-pressed')")) === 'true');
  check('no Family favorite with one person', !(await visible('[data-role="family-badge"]')));
  await click('[data-me="kristina"]');
  await click('.kk-rate-btn[data-rating="loved"]');
  check('both loved: derived Family favorite badge', await visible('[data-role="family-badge"]'));
  await goto('/');
  check('the list shows the same ratings and badge', (await visible('#recipe-grid [data-id="example-1"] [data-role="family-badge"]')) && (await text('#recipe-grid [data-id="example-1"] [data-person="kristina"]')) === 'Kristina: Loved it');
  await goto('/recipe/example-1/');
  await click('.kk-rate-btn[data-rating="loved"]'); // Kristina takes it back: the badge goes and Undo is offered on the shared bar
  await sleep(150);
  check('removing a Family favorite offers the same Undo bar', (await text('#undo-text')) === 'Family favorite removed' && (await visible('#undo-bar')));
  await click('#undo-button');
  await sleep(150);
  check('Undo brings the badge back', await visible('[data-role="family-badge"]'));

  await click('[data-role="plan"]');
  await sleep(450);
  check('Plan opens the same day picker, titled for this recipe', (await ev("document.querySelector('#plan-sheet').open")) && (await text('#plan-title')) === 'Plan Example recipe: Weeknight Pasta', await text('#plan-title'));
  await click('#plan-sheet button[data-slot="1"]');
  await sleep(200);
  const week = JSON.parse(await ev("localStorage.getItem('kk:week')"));
  check('picking Tuesday saves it and the page says where it is', week.entries['2026-10-27'].recipeId === 'example-1' && (await text('[data-role="plan-status"]')) === 'On Tue', await text('[data-role="plan-status"]'));
  await goto('/week/');
  check('the Week page shows the same plan', (await text('#week-list li[data-day="2026-10-27"] [data-role="name"]')) === 'Weeknight Pasta');

  // --- no source, no link ---------------------------------------------------------------------------------------------
  await goto('/recipe/example-2/');
  check('a recipe without a source has no original recipe link', (await ev("document.querySelectorAll('a[href^=\"http\"]').length")) === 0 && (await ev("document.querySelector('.kk-source')")) === null);

  // --- desktop: two columns -----------------------------------------------------------------------------------------------
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await goto('/recipe/example-1/');
  const cols = await ev("(() => { const i = document.querySelector('#ingredients-title').getBoundingClientRect(); const s = document.querySelector('#steps-title').getBoundingClientRect(); return { iX: i.x, sX: s.x, iY: i.y, sY: s.y }; })()");
  check('desktop: ingredients on the left, steps on the right, side by side', cols.iX < cols.sX && Math.abs(cols.iY - cols.sY) < 20, JSON.stringify(cols));
  const tops = await ev("[document.querySelector('#ingredients-title').getBoundingClientRect().top, document.querySelector('#steps-title').getBoundingClientRect().top]");
  check('desktop: the Steps heading is level with the Ingredients heading (within 1px)', Math.abs(tops[0] - tops[1]) <= 1, JSON.stringify(tops));
  check('desktop: the photo is not shortened (taller than 180px)', (await rect('.kk-hero')).h > 180, String((await rect('.kk-hero')).h));
  check('desktop: nothing scrolls sideways', await ev('document.documentElement.scrollWidth <= innerWidth'));
  await send('Emulation.setDeviceMetricsOverride', { width: PHONE_WIDTH, height: PHONE_HEIGHT, deviceScaleFactor: 2, mobile: true });
  await goto('/recipe/example-1/');
  const stacked = await ev("(() => { const i = document.querySelector('#ingredients-title').getBoundingClientRect(); const s = document.querySelector('#steps-title').getBoundingClientRect(); return s.y > i.y + 50 && Math.abs(s.x - i.x) < 4; })()");
  check('phone: one column, steps under the ingredients', stacked);
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await h.finish();
}
