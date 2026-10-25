// Headless-Chrome check of the Plan button and day picker on the Recipes page (the page thinks it is Thursday 29 Oct 2026).
// Run: npm run build && node e2e/plan.e2e.mjs
import { startHarness, PHONE_HEIGHT } from './harness.mjs';

const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep, rect } = h;
const TUE = '2026-10-27', THU = '2026-10-29';
const saved = async () => JSON.parse((await ev("localStorage.getItem('kk:week')")) ?? 'null');
const card = (id) => `#recipe-grid [data-id="${id}"]`;
const status = (id) => text(`${card(id)} [data-role="plan-status"]`);
const plan = async (id, slot) => {
  await click(`${card(id)} [data-role="plan"]`);
  await sleep(450);
  await click(`#plan-sheet button[data-slot="${slot}"]`);
  await sleep(150);
};
try {
  await goto('/');
  check('every card has a Plan button at least 44px tall', await ev(`[...document.querySelectorAll('#recipe-grid [data-role="plan"]')].length === 6 && [...document.querySelectorAll('#recipe-grid [data-role="plan"]')].every((b) => b.getBoundingClientRect().height >= 44 && b.textContent.trim() === 'Plan')`));
  check('the filter tray is still the first dialog', (await ev("document.querySelector('dialog').id")) === 'filter-tray');
  const historyBefore = await ev('history.length');

  await click(`${card('example-3')} [data-role="plan"]`);
  await sleep(450);
  check('Plan opens the day picker for that recipe', (await ev("document.querySelector('#plan-sheet').open")) && (await text('#plan-title')) === 'Plan Example recipe: Tomato Soup', await text('#plan-title'));
  const labels = await ev("[...document.querySelectorAll('#plan-sheet [data-role=\"day-label\"]')].map((s) => s.textContent)");
  check('seven days with dates from the phone calendar', labels.length === 7 && labels[0] === 'Monday, Oct 26' && labels[3] === 'Thursday, Oct 29' && labels[6] === 'Sunday, Nov 1', JSON.stringify(labels));
  check('every day is a button at least 44px tall', await ev("[...document.querySelectorAll('#plan-sheet button[data-slot]')].every((b) => b.getBoundingClientRect().height >= 44)"));
  check('an empty week says every day is free; today is named', (await ev("[...document.querySelectorAll('#plan-sheet [data-role=\"day-status\"]')].map((s) => s.textContent).join('|')")) === 'Free|Free|Free|Free (today)|Free|Free|Free');
  await click('#plan-sheet button[data-slot="1"]');
  await sleep(150);
  check('picking Tuesday closes the sheet, saves it, and the card says where it is', !(await ev("document.querySelector('#plan-sheet').open")) && (await saved()).entries[TUE].recipeId === 'example-3' && (await status('example-3')) === 'On Tue', await status('example-3'));
  check('planning does not change the address or add a Back step', (await ev('location.search')) === '' && (await ev('history.length')) === historyBefore);

  await click(`${card('example-1')} [data-role="plan"]`);
  await sleep(450);
  check('the picker warns that a taken day is replaced', (await text('#plan-sheet button[data-slot="1"] [data-role="day-status"]')) === 'Replaces Tomato Soup');
  await click('#plan-sheet button[data-slot="1"]');
  await sleep(150);
  check('planning on a taken day replaces it: one dinner per day', (await saved()).entries[TUE].recipeId === 'example-1' && (await status('example-3')) === '' && (await status('example-1')).startsWith('On Tue. Replaced Tomato Soup'), await status('example-1'));

  await click(`${card('example-1')} [data-role="plan"]`);
  await sleep(450);
  check('the picker says planning it on another day moves it', (await text('#plan-sheet button[data-slot="3"] [data-role="day-status"]')) === 'Moves it from Tuesday (today)', await text('#plan-sheet button[data-slot="3"] [data-role="day-status"]'));
  check('the day it is on says "Planned here"', (await text('#plan-sheet button[data-slot="1"] [data-role="day-status"]')) === 'Planned here');
  await click('#plan-sheet button[data-slot="3"]');
  await sleep(150);
  check('moving it says "Moved from Tuesday" and clears Tuesday', (await status('example-1')) === 'On Thu. Moved from Tuesday' && (await saved()).entries[TUE].recipeId === null && (await saved()).entries[THU].recipeId === 'example-1', await status('example-1'));
  check('the live region announces it', (await text('#plan-live')) === 'Moved from Tuesday', await text('#plan-live'));

  await goto('/week/');
  check('the Week page shows the same plan', (await text('#week-list li[data-day="2026-10-29"] [data-role="name"]')) === 'Weeknight Pasta');
  await goto('/');
  check('after closing and reopening, the cards still say where each dinner is', (await status('example-1')) === 'On Thu');

  await ev("window.__fail = true; const set2 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__fail && k === 'kk:week') throw new Error('full'); return set2.call(this, k, v); };");
  await plan('example-4', 5);
  check('a failed save shows the Week plan banner, Plan buttons pause', (await visible('#week-unavailable')) && (await text('#week-unavailable p')) === 'Week plan unavailable. Your changes will save when you tap Retry.' && (await ev("[...document.querySelectorAll('[data-role=\"plan\"]')].every((b) => b.disabled)")));
  check('Retry is at least 44px tall', (await rect('#week-retry')).h >= 44);
  await ev('window.__fail = false');
  await click('#week-retry');
  await sleep(200);
  check('Retry saves the waiting change and the banner goes', !(await visible('#week-unavailable')) && (await saved()).entries['2026-10-31'].recipeId === 'example-4' && (await status('example-4')) === 'On Sat', await status('example-4'));

  // both banners at once (storage blocked for ratings and the week plan): the stack must not cover the last card
  await click('[data-me="ed"]');
  await ev("window.__rfail = true; const set4 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__rfail && k === 'kk:ratings') throw new Error('full'); return set4.call(this, k, v); }; window.__fail = true;");
  await plan('example-5', 4);
  await click(`${card('example-2')} .kk-rate-btn`);
  await sleep(200);
  check('both the Week plan and the Ratings banner show together', (await visible('#week-unavailable')) && (await visible('#ratings-unavailable')));
  await ev('scrollTo(0, document.documentElement.scrollHeight)');
  await sleep(150);
  const stackTop = (await rect('#bottom-stack')).y;
  const lastCard = await ev("(() => { const c = [...document.querySelectorAll('#recipe-grid > *')].filter((e) => e.getBoundingClientRect().height > 0); const r = c[c.length - 1].getBoundingClientRect(); return { bottom: r.bottom }; })()");
  check('scrolled to the bottom, the last card ends above the two banners and the bars', lastCard.bottom <= stackTop, `${lastCard.bottom} vs ${stackTop}`);
  check('the two banners together do not take over the screen (stack under 40% of the height)', (await rect('#bottom-stack')).h < PHONE_HEIGHT * 0.4, String((await rect('#bottom-stack')).h));
  await ev('window.__rfail = false; window.__fail = false');
  await click('#week-retry');
  await click('#ratings-retry');
  await sleep(250);
  check('Retry on both clears both banners', !(await visible('#week-unavailable')) && !(await visible('#ratings-unavailable')));
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await h.finish();
}
