// Headless-Chrome check of the Week page and the Plan sheet on recipe cards, against the built site.
// Run: npm run e2e, or npm test && node e2e/week.e2e.mjs   (the page believes it is Thursday 29 Oct 2026)
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
  check('the Remove button is an icon: named "Remove <dish> from <day>", no visible word, no title, a hidden svg, outlined, a box of at least 44 by 44', await ev(`(() => { const b = document.querySelector('${row(TUE)} button[aria-label^="Remove "]'); const r = b.getBoundingClientRect(); const v = b.querySelector('svg'); return b.getAttribute('aria-label') === 'Remove Tomato Soup from Tuesday' && !b.hasAttribute('title') && b.textContent.trim() === '' && !!v && v.getAttribute('aria-hidden') === 'true' && r.height >= 44 && r.width >= 44 && getComputedStyle(b).borderTopWidth !== '0px'; })()`), JSON.stringify(await rect(`${row(TUE)} button[aria-label^="Remove "]`)));

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
  check('the Remove icon button is still on screen after the swipe, left of the red area', await ev(`(() => { const b = document.querySelector('${card} button[aria-label^="Remove "]').getBoundingClientRect(); const v = document.querySelector('${reveal}').getBoundingClientRect(); return b.width >= 44 && b.height >= 44 && b.left >= 0 && b.right <= v.left + 0.5; })()`));
  check('the open row\'s icon button is named for its dish and day', (await ev(`document.querySelector('${card} button[aria-label^="Remove "]').getAttribute('aria-label')`)) === 'Remove Weeknight Pasta from Thursday');
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
  await ev(`(() => { const b = document.querySelector('${row(THU)} button[aria-label^="Remove "]'); b.click(); b.click(); b.click(); })()`);
  await sleep(300);
  check('three quick taps on Remove remove it once (one save)', (await ev('window.__writes')) === 1, String(await ev('window.__writes')));
  // 7. the Undo bar takes the tab bar's place; Undo, a tap on nothing else, or 10 seconds, and the tab bar is back
  await addFor(THU, 'example-1');
  const dock = await rect('.kk-dock');
  const tabs = () => ev("[...document.querySelectorAll('.kk-dock a')].map((a) => a.getAttribute('aria-current') === 'page' ? a.textContent.trim() : '').join('')");
  check('before anything is removed the tab bar shows and the Undo bar is hidden', (await visible('.kk-dock')) && !(await visible('#undo-bar')) && (await tabs()) === 'Week');
  await click(`${row(THU)} button[aria-label^="Remove "]`);
  check('removing swaps the tab bar for the Undo bar', (await visible('#undo-bar')) && !(await visible('.kk-dock')));
  check('the Undo bar says what came off which day', (await text('#undo-text')) === 'Took Weeknight Pasta off Thu', await text('#undo-text'));
  const bar = await rect('#undo-bar');
  check('the Undo bar is exactly the tab bar\'s height and sits where it was', Math.abs(bar.h - dock.h) < 1 && Math.abs(bar.y - dock.y) < 1, `${bar.h} vs ${dock.h}, y ${bar.y} vs ${dock.y}`);
  check('the Undo button is at least 44px tall', (await rect('#undo-button')).h >= 44);
  await click('#undo-button');
  check('Undo puts the dinner back on the same day and the tab bar returns with Week still active', (await name(THU)) === 'Weeknight Pasta' && (await visible('.kk-dock')) && !(await visible('#undo-bar')) && (await tabs()) === 'Week');
  check('the restored dinner is saved, not just drawn', (await saved()).entries[THU].recipeId === 'example-1');
  await ev("window.__delays = []; const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => { window.__delays.push(ms); return st(fn, ms === 10000 ? 400 : ms, ...a); };");
  await click(`${row(THU)} button[aria-label^="Remove "]`);
  check('the Undo offer is set to last 10 seconds', (await ev('window.__delays.includes(10000)')) === true);
  await sleep(800);
  check('after the time runs out the tab bar is back, Week still active, and the dinner stays removed', (await visible('.kk-dock')) && !(await visible('#undo-bar')) && (await tabs()) === 'Week' && (await visible(`${row(THU)} [data-role="add"]`)));
  await addFor(THU, 'example-1');
  await click(`${row(THU)} button[aria-label^="Remove "]`);
  await addFor(SAT, 'example-2');
  check('planning something else ends the Undo offer', !(await visible('#undo-bar')) && (await visible('.kk-dock')));
  // 8. when saving fails: banner, controls paused, the change waits for Retry
  await addFor(THU, 'example-1');
  await ev("window.__fail = true; const set2 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__fail && k === 'kk:week') throw new Error('full'); return set2.call(this, k, v); };");
  await click(`${row(THU)} button[aria-label^="Remove "]`); // fails: the dinner is not removed, no Undo is offered
  check('a failed save shows "Week plan unavailable. Your changes will save when you tap Retry."', (await visible('#week-unavailable')) && (await text('#week-unavailable p')) === 'Week plan unavailable. Your changes will save when you tap Retry.', await text('#week-unavailable p'));
  check('a failed removal offers no Undo and the dinner is still shown', !(await visible('#undo-bar')) && (await visible('.kk-dock')) && (await name(THU)) === 'Weeknight Pasta');
  check('Retry is at least 44px tall', (await rect('#week-retry')).h >= 44);
  check('Add, change and Remove are paused while it is unavailable', await ev("[...document.querySelectorAll('#week-list button')].every((b) => b.disabled)"));
  await ev(`document.querySelector('${row(THU)} button[aria-label^="Remove "]').click()`);
  check('a paused Remove does nothing', (await name(THU)) === 'Weeknight Pasta');
  await ev('window.__fail = false');
  await click('#week-retry');
  await sleep(200);
  check('Retry saves the waiting removal, the banner goes and the controls come back', !(await visible('#week-unavailable')) && (await visible(`${row(THU)} [data-role="add"]`)) && (await saved()).entries[THU].recipeId === null && !(await ev("[...document.querySelectorAll('#week-list button')].some((b) => b.disabled)")));

  // 9. room at the bottom: with every day filled, the last day and the hint clear the tab bar and the Undo bar
  const seedAll = () => ev(`(() => { const at = Date.now(); const ids = ['example-1', 'example-2', 'example-3', 'example-4', 'example-5', 'example-6', 'example-1']; const days = ['${MON}', '${TUE}', '${WED}', '${THU}', '${FRI}', '${SAT}', '${SUN}']; localStorage.setItem('kk:week', JSON.stringify({ v: 1, entries: Object.fromEntries(days.map((d, i) => [d, { recipeId: ids[i], at }])) })); })()`);
  await seedAll();
  await goto('/week/');
  const clearance = async (barSel) => {
    await ev('scrollTo(0, document.documentElement.scrollHeight)');
    await sleep(150);
    const bar = await rect(barSel), last = await rect(`${row(SUN)}`), hint = await rect('#week-list + p');
    return { gapRow: bar.y - (last.y + last.h), gapHint: bar.y - (hint.y + hint.h) };
  };
  const tabGap = await clearance('.kk-dock');
  const roomVar = await ev("document.documentElement.style.getPropertyValue('--kk-stack-height')");
  check('after load the stack-height variable is set to a non-zero value', /^[\d.]+px$/.test(roomVar) && parseFloat(roomVar) > 0, roomVar);
  check('and it matches the real bottom stack', Math.abs(parseFloat(roomVar) - (await rect('#bottom-stack')).h) <= 1, roomVar);
  check('all seven days are filled for the room check', (await ev(`document.querySelectorAll('#week-list [data-role="name"]').length`)) === 7);
  check('scrolled to the bottom, Sunday ends at least 8px above the tab bar', tabGap.gapRow >= 8, JSON.stringify(tabGap));
  check('and the hint line ends above the tab bar too', tabGap.gapHint >= 0, JSON.stringify(tabGap));
  await click(`${row(MON)} button[aria-label^="Remove "]`);
  const undoGap = await clearance('#undo-bar');
  check('with the Undo bar showing, Sunday ends at least 8px above it and the hint clears it', (await visible('#undo-bar')) && undoGap.gapRow >= 8 && undoGap.gapHint >= 0, JSON.stringify(undoGap));

  await seedAll();
  await goto('/week/');
  await ev("const set3 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'kk:week') throw new Error('full'); return set3.call(this, k, v); };");
  await click(`${row(MON)} button[aria-label^="Remove "]`);
  const bannerGap = await clearance('#bottom-stack');
  check('with the Week plan unavailable banner on top of the tab bar, Sunday and the hint still clear the whole bottom stack', (await visible('#week-unavailable')) && bannerGap.gapRow >= 8 && bannerGap.gapHint >= 0, JSON.stringify(bannerGap));

  // 10. empty days are one compact row: at least 44px tall and clearly shorter than a day with a dinner
  await goto('/week/');
  await ev(`localStorage.setItem('kk:week', JSON.stringify({ v: 1, entries: { '${TUE}': { recipeId: 'example-3', at: Date.now() } } }))`);
  await goto('/week/');
  const filledH = (await rect(`${row(TUE)} [data-role="card"]`)).h, emptyH = (await rect(`${row(MON)} [data-role="add"]`)).h;
  check('an empty day is at least 44px tall', emptyH >= 44, String(emptyH));
  check('and clearly shorter than a day with a dinner (under 80% of it)', emptyH < filledH * 0.8, `${emptyH} vs ${filledH}`);
  // 11. desktop width: the icon button keeps its 44 by 44 box, sits at the right end of the card and shows a focus ring from the keyboard
  await h.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await goto('/week/');
  const rm = `${row(TUE)} button[aria-label^="Remove "]`;
  const box = await rect(rm), cardBox = await rect(`${row(TUE)} [data-role="card"]`);
  check('on desktop the Remove icon button is at least 44 by 44 and the page does not scroll sideways', box.w >= 44 && box.h >= 44 && (await ev('document.documentElement.scrollWidth <= innerWidth')), JSON.stringify(box));
  check('and it sits at the right end of its card, inside it', box.x + box.w <= cardBox.x + cardBox.w && box.x + box.w >= cardBox.x + cardBox.w - 24, JSON.stringify({ box, cardBox }));
  await ev(`document.querySelector('${row(TUE)} [data-role="change"]').focus()`);
  for (let i = 0; i < 4 && !(await ev(`document.activeElement === document.querySelector('${rm}')`)); i++) {
    await h.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await h.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await sleep(80);
  }
  check('Tab from the dinner name reaches the Remove icon button, and it shows a visible focus ring', await ev(`(() => { const b = document.querySelector('${rm}'); const c = getComputedStyle(b); return document.activeElement === b && b.matches(':focus-visible') && c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; })()`));
} catch (e) {
  h.results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await h.finish();
}
