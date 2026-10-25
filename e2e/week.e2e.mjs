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
  // 6. swipe: half way reveals a red Remove, a long swipe stretches to "Release to remove", a tap on Remove removes once
  const card = `${row(THU)} [data-role="card"]`, reveal = `${row(THU)} [data-role="reveal"]`;
  const swipeY = async () => { const r = await rect(card); return r.y + r.h / 2; };
  const left = async () => (await rect(card)).x;
  const base = await left();
  const primary = await ev("(() => { const p = document.createElement('i'); p.style.background = 'var(--color-primary)'; document.body.append(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; })()");
  let y = await swipeY();
  await h.drag(300, y, 300, y + 90);
  check('a vertical drag does not open anything', Math.abs((await left()) - base) < 2 && (await rect(reveal)).w < 2);
  await h.drag(340, y, 255, y); // 85px to the left, then let go
  const open = await left();
  check('a half swipe slides the card left and the red Remove shows', base - open >= 70 && (await rect(reveal)).w >= 70 && (await text(reveal)) === 'Remove', `${base - open}px, "${await text(reveal)}"`);
  check('the revealed area is the primary red, with a Remove target at least 44px tall', (await ev(`getComputedStyle(document.querySelector('${reveal}')).backgroundColor`)) === primary && (await rect(reveal)).h >= 44);
  check('letting go there keeps it open and removes nothing', (await name(THU)) === 'Weeknight Pasta' && (await saved()).entries[THU].recipeId === 'example-1');
  await h.drag(255, y, 330, y); // a nudge to the right closes it
  y = await swipeY();
  const w = (await rect(`${row(THU)} .kk-week-swipe`)).w;
  const release = await h.drag(340, y, 340 - w * 0.75, y, { steps: 10, hold: true });
  check('a long swipe stretches the red area to "Release to remove"', (await text(reveal)) === 'Release to remove' && (await rect(reveal)).w > w * 0.55, `"${await text(reveal)}" ${(await rect(reveal)).w}`);
  check('nothing is removed until the finger lifts', (await name(THU)) === 'Weeknight Pasta');
  await release();
  check('lifting a long swipe removes the dinner', (await visible(`${row(THU)} [data-role="add"]`)) && !(await ev(`!!document.querySelector('${row(THU)} [data-role="name"]')`)));
  check('and Thursday is kept as a timestamped empty entry', (await saved()).entries[THU].recipeId === null);
  await addFor(THU, 'example-1');
  y = await swipeY();
  await h.drag(340, y, 255, y);
  await click(reveal);
  check('tapping the red Remove removes it', !(await ev(`!!document.querySelector('${row(THU)} [data-role="name"]')`)));
  await addFor(THU, 'example-1');
  await ev("window.__writes = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'kk:week') window.__writes++; return set.call(this, k, v); };");
  await ev(`(() => { const b = document.querySelector('${row(THU)} [data-role="remove"]'); b.click(); b.click(); b.click(); })()`);
  await sleep(300);
  check('three quick taps on Remove remove it once (one save)', (await ev('window.__writes')) === 1, String(await ev('window.__writes')));
  // 7. the Undo bar takes the tab bar's place; Undo, a tap on nothing else, or 10 seconds, and the tab bar is back
  await addFor(THU, 'example-1');
  const dock = await rect('.kk-dock');
  const tabs = () => ev("[...document.querySelectorAll('.kk-dock a')].map((a) => a.getAttribute('aria-current') === 'page' ? a.textContent.trim() : '').join('')");
  check('before anything is removed the tab bar shows and the Undo bar is hidden', (await visible('.kk-dock')) && !(await visible('#undo-bar')) && (await tabs()) === 'Week');
  await click(`${row(THU)} [data-role="remove"]`);
  check('removing swaps the tab bar for the Undo bar', (await visible('#undo-bar')) && !(await visible('.kk-dock')));
  check('the Undo bar says what came off which day', (await text('#undo-text')) === 'Took Weeknight Pasta off Thu', await text('#undo-text'));
  const bar = await rect('#undo-bar');
  check('the Undo bar is exactly the tab bar\'s height and sits where it was', Math.abs(bar.h - dock.h) < 1 && Math.abs(bar.y - dock.y) < 1, `${bar.h} vs ${dock.h}, y ${bar.y} vs ${dock.y}`);
  check('the Undo button is at least 44px tall', (await rect('#undo-button')).h >= 44);
  await click('#undo-button');
  check('Undo puts the dinner back on the same day and the tab bar returns with Week still active', (await name(THU)) === 'Weeknight Pasta' && (await visible('.kk-dock')) && !(await visible('#undo-bar')) && (await tabs()) === 'Week');
  check('the restored dinner is saved, not just drawn', (await saved()).entries[THU].recipeId === 'example-1');
  await ev("window.__delays = []; const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => { window.__delays.push(ms); return st(fn, ms === 10000 ? 400 : ms, ...a); };");
  await click(`${row(THU)} [data-role="remove"]`);
  check('the Undo offer is set to last 10 seconds', (await ev('window.__delays.includes(10000)')) === true);
  await sleep(800);
  check('after the time runs out the tab bar is back, Week still active, and the dinner stays removed', (await visible('.kk-dock')) && !(await visible('#undo-bar')) && (await tabs()) === 'Week' && (await visible(`${row(THU)} [data-role="add"]`)));
  await addFor(THU, 'example-1');
  await click(`${row(THU)} [data-role="remove"]`);
  await addFor(SAT, 'example-2');
  check('planning something else ends the Undo offer', !(await visible('#undo-bar')) && (await visible('.kk-dock')));
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await h.finish();
}
