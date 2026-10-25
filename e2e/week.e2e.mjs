// Headless-Chrome check of the Week page and the Plan sheet on recipe cards, against the built site.
// Run: npm run build && node e2e/week.e2e.mjs   (the page believes it is Thursday 29 Oct 2026)
import { startHarness } from './harness.mjs';

const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep, waitFor, rect } = h;
const MON = '2026-10-26', TUE = '2026-10-27', WED = '2026-10-28', THU = '2026-10-29', FRI = '2026-10-30', SAT = '2026-10-31', SUN = '2026-11-01';
const row = (day) => `#week-list li[data-day="${day}"]`;
const name = (day) => text(`${row(day)} [data-role="name"]`);
const saved = async () => JSON.parse((await ev("localStorage.getItem('kk:week')")) ?? 'null');
const addFor = async (day, recipe) => {
  // an empty day has "+ Add a dinner"; tapping a dinner's name opens the same sheet to change it
  await click(`${row(day)} [data-role="add"], ${row(day)} [data-role="change"]`);
  await sleep(450); // the sheet slides up
  await click(`#add-sheet button[data-id="${recipe}"]`);
  await sleep(150);
};
try {
  // 1. the week view: Monday to Sunday of the phone's week, today marked, every day empty to start
  await goto('/week/');
  check('header shows the week range "Oct 26 – Nov 1"', (await text('#week-range')) === 'Oct 26 – Nov 1', await text('#week-range'));
  const days = await ev("[...document.querySelectorAll('#week-list li')].map((li) => li.dataset.day)");
  check('seven rows, Monday 26 Oct to Sunday 1 Nov', JSON.stringify(days) === JSON.stringify([MON, TUE, WED, THU, FRI, SAT, SUN]), JSON.stringify(days));
  check('only Thursday is marked as today', (await ev("[...document.querySelectorAll('#week-list li[data-today]')].map((li) => li.dataset.day).join()")) === THU);
  check('every empty day offers "+ Add a dinner" with a target at least 44px tall', await ev(`[...document.querySelectorAll('#week-list [data-role="add"]')].length === 7 && [...document.querySelectorAll('#week-list [data-role="add"]')].every((b) => b.textContent.trim() === '+ Add a dinner' && b.getBoundingClientRect().height >= 44)`));
  check('the page does not scroll sideways at 390px', await ev('document.documentElement.scrollWidth <= innerWidth'));

  // 2. planning from the week: Add a dinner opens the recipe sheet for that day
  await click(`${row(TUE)} [data-role="add"]`);
  await sleep(450);
  check('Add a dinner on Tuesday opens the sheet titled for Tuesday', (await ev("document.querySelector('#add-sheet').open")) && (await text('#add-title')) === 'Dinner for Tuesday', await text('#add-title'));
  check('every recipe row in the sheet is at least 44px tall', await ev("[...document.querySelectorAll('#add-sheet [data-id]')].every((b) => b.getBoundingClientRect().height >= 44)"));
  await click('#add-sheet button[data-id="example-3"]');
  await sleep(200);
  check('picking a recipe closes the sheet and the dinner shows on Tuesday', !(await ev("document.querySelector('#add-sheet').open")) && (await name(TUE)) === 'Tomato Soup', await name(TUE));
  const s1 = await saved();
  check('it is saved under the one key kk:week with a time', s1?.v === 1 && s1.entries[TUE]?.recipeId === 'example-3' && typeof s1.entries[TUE].at === 'number', JSON.stringify(s1));
  check('the Remove button is outlined text "Remove", at least 44px tall and wide', await ev(`(() => { const b = document.querySelector('${row(TUE)} [data-role="remove"]'); const r = b.getBoundingClientRect(); return b.textContent.trim() === 'Remove' && r.height >= 44 && r.width >= 44 && getComputedStyle(b).borderTopWidth !== '0px'; })()`));

  // 3. moving: planning a recipe that is on another day moves it and says so
  await addFor(THU, 'example-3');
  check('planning it on Thursday moves it: Thursday has it, Tuesday is empty again', (await name(THU)) === 'Tomato Soup' && (await visible(`${row(TUE)} [data-role="add"]`)) && !(await ev(`!!document.querySelector('${row(TUE)} [data-role="name"]')`)));
  check('the row says "Moved from Tuesday"', (await text(`${row(THU)} [data-role="note"]`)) === 'Moved from Tuesday', await text(`${row(THU)} [data-role="note"]`));
  check('the live region says it too', (await text('#week-live')) === 'Moved from Tuesday', await text('#week-live'));
  const s2 = await saved();
  check('Tuesday is kept as a timestamped empty entry', s2.entries[TUE]?.recipeId === null && s2.entries[TUE].at > s1.entries[TUE].at, JSON.stringify(s2.entries[TUE]));

  // 4. replacing: planning another recipe on a day that has a dinner replaces it
  await addFor(THU, 'example-1');
  check('a day that has a dinner is replaced (one dinner per day)', (await name(THU)) === 'Weeknight Pasta' && (await ev(`document.querySelectorAll('${row(THU)} [data-role="name"]').length`)) === 1);
  check('the row says "Replaced Tomato Soup"', (await text(`${row(THU)} [data-role="note"]`)) === 'Replaced Tomato Soup', await text(`${row(THU)} [data-role="note"]`));

  check('tapping a dinner is a 44px-tall button that opens the sheet to change it', await ev(`(() => { const b = document.querySelector('${row(THU)} [data-role="change"]'); return !!b && b.getBoundingClientRect().height >= 44 && b.getAttribute('aria-label') === 'Change the dinner on Thursday'; })()`));

  // 5. planned dinners survive closing and reopening; the notes do not
  await goto('/week/');
  check('after a reload Thursday still has its dinner and the note is gone', (await name(THU)) === 'Weeknight Pasta' && !(await ev(`!!document.querySelector('${row(THU)} [data-role="note"]')`)));
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await h.finish();
}
