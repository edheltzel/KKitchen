// Headless-Chrome check of search, filters, URL state, scroll and tab restore against the built site.
// Run: npm run build && npm run e2e   (not part of `npm test`: it needs Chrome and starts a local server)
// Env: CHROME=/path/to/chrome   PORT=4399   (server binds 127.0.0.1 only and is stopped on exit)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';

const dist = resolve(new URL('../dist', import.meta.url).pathname);
const PORT = Number(process.env.PORT ?? 4399);
const DEBUG = 9334;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json' };

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  let file = join(dist, path);
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}`;

const profile = mkdtempSync(join(tmpdir(), 'kk-e2e-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
const results = [];
async function cleanup() {
  try { ws?.close(); } catch {}
  chrome.kill();
  server.close();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
try {
  let targets = [];
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(250);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description ?? ''));
    return r.result.result.value;
  };
  const waitFor = async (expression, ms = 3000) => {
    const end = Date.now() + ms;
    let v;
    while (Date.now() < end) { try { v = await ev(expression); if (v) return v; } catch {} await sleep(50); }
    return v;
  };
  const goto = async (path) => {
    await send('Page.navigate', { url: base + path });
    await sleep(100);
    await waitFor("document.readyState === 'complete'");
    await sleep(300);
  };
  const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); };
  const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? null`);
  const visible = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; })()`);
  const loc = () => ev('location.pathname + location.search');
  const type = async (s) => { await ev("document.querySelector('#search-input').focus()"); await send('Input.insertText', { text: s }); await sleep(120); };
  const clearInput = async () => { await ev("(() => { const i = document.querySelector('#search-input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()"); await sleep(100); };
  const click = async (sel) => { await ev(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(120); };
  const chip = (g, v) => `[data-group="${g}"][data-value="${v}"]`;
  const visibleCards = () => ev("[...document.querySelectorAll('#recipe-grid article')].filter((a) => !a.hidden).map((a) => a.dataset.name)");

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // 0. the whole placeholder fits at 390px with the count badge showing
  await goto('/?meal=lunch&time=30&diet=Meatless');
  const fit = await ev(`(() => {
    const i = document.querySelector('#search-input');
    const cs = getComputedStyle(i);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + cs.font + ';letter-spacing:' + cs.letterSpacing;
    probe.textContent = i.placeholder;
    document.body.append(probe);
    const need = probe.getBoundingClientRect().width;
    probe.remove();
    const room = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { placeholder: i.placeholder, need: Math.round(need), room: Math.round(room), badge: !document.querySelector('#filters-count').hidden, scrolls: document.documentElement.scrollWidth > innerWidth };
  })()`);
  check('placeholder "Search recipes" fits at 390px with the count badge', fit.placeholder === 'Search recipes' && fit.badge && fit.need <= fit.room && !fit.scrolls, JSON.stringify(fit));

  // 1. live search: names and ingredients, case-insensitive, no reload, replaceState (no new history entries)
  await goto('/');
  await ev('window.__marker = 1; window.__len = history.length');
  check('starts at "6 recipes"', (await text('#recipe-count')) === '6 recipes', await text('#recipe-count'));
  await type('TOMATO');
  check('search "TOMATO" matches name + ingredient case-insensitively', (await text('#recipe-count')) === '2 recipes', await text('#recipe-count'));
  check('typing updates the address with replaceState', (await loc()) === '/?q=TOMATO' && (await ev('history.length === window.__len')), await loc());
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(300);
  check('Enter does not reload', (await ev('window.__marker')) === 1 && (await loc()) === '/?q=TOMATO');
  await clearInput();
  await type('rolled');
  check('ingredient-only search ("rolled") finds Overnight Oats', JSON.stringify(await visibleCards()) === '["Overnight Oats"]', JSON.stringify(await visibleCards()));
  await clearInput();
  check('count has aria-live="polite"', (await ev("document.querySelector('#recipe-count').getAttribute('aria-live')")) === 'polite');

  // 2. zero results + Clear
  await type('saffron');
  check("zero result shows No recipe lists 'saffron'", (await text('#empty-message')) === "No recipe lists 'saffron'" && (await visible('#empty')), await text('#empty-message'));
  check('unapproved note is not searchable', (await text('#recipe-count')) === '0 recipes');
  await click('#clear-all');
  check('Clear resets search and URL', (await text('#recipe-count')) === '6 recipes' && (await ev("document.querySelector('#search-input').value")) === '' && (await loc()) === '/' && !(await visible('#empty')), await loc());

  // 3. filters tray: open, AND/OR, chips, count on the button, filters-only empty text
  await ev("document.querySelector('#search-input').focus()");
  check('search input is focused before opening the tray', await ev("document.activeElement === document.querySelector('#search-input')"));
  await ev("window.__blurs = 0; const nativeBlur = HTMLElement.prototype.blur; HTMLElement.prototype.blur = function () { if (this.id === 'search-input') window.__blurs++; return nativeBlur.call(this); }");
  await click('#filters-button');
  await sleep(500); // let the sheet finish sliding up
  const opened = await ev("document.querySelector('#filter-tray').open");
  check('Filters opens the tray dialog', opened);
  check('the tray-open handler explicitly blurs the search input', opened && (await ev('window.__blurs')) >= 1, String(await ev('window.__blurs')));
  check('opening the tray blurs the search input (keyboard goes down)', opened && (await ev("document.activeElement !== document.querySelector('#search-input') && !document.querySelector('#search-input').matches(':focus')")));
  check('Done is on screen with the tray open', opened && (await ev("(() => { const r = document.querySelector('#filter-tray form:not(.modal-backdrop) button').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()")));
  await click(chip('meal', 'dinner'));
  await click(chip('meal', 'lunch'));
  check('OR within a group (dinner + lunch = 4)', (await text('#recipe-count')) === '4 recipes', await text('#recipe-count'));
  await click(chip('time', '30'));
  check('AND across groups (lunch/dinner and 30 min or less = 3)', (await text('#recipe-count')) === '3 recipes', await text('#recipe-count'));
  check('URL carries each group as its own param', (await loc()) === '/?meal=lunch%2Cdinner&time=30', await loc());
  check('every tray target is >= 44px (and the tray really has targets)', opened && await ev("(() => { const bs = [...document.querySelectorAll('#filter-tray button')].filter((b) => b.getBoundingClientRect().width > 0); return bs.length >= 9 && bs.every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5; }); })()"));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 195, y: 60, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 195, y: 60, button: 'left', clickCount: 1 });
  await sleep(300);
  check('backdrop tap closes the tray', opened && (await ev("document.querySelector('#filter-tray').open")) === false);
  check('chips show above the grid, one per filter', (await ev("document.querySelectorAll('#chips button').length")) === 3 && (await visible('#chips')));
  check('Filters button shows the count (3)', (await text('#filters-count')) === '3' && (await visible('#filters-count')));
  check('Filters button label says "Filters, 3 active" when the badge shows', (await ev("document.querySelector('#filters-button').getAttribute('aria-label')")) === 'Filters, 3 active', await ev("document.querySelector('#filters-button').getAttribute('aria-label')"));
  check('chips and Filters button are >= 44px', await ev("(() => { const bs = [...document.querySelectorAll('#chips button, #filters-button')].filter((b) => b.getBoundingClientRect().width > 0); return bs.length >= 4 && bs.every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5; }); })()"));
  await click('#chips button');
  check('removing a chip updates chips, results and URL', (await ev("document.querySelectorAll('#chips button').length")) === 2 && (await text('#recipe-count')) === '1 recipe' && (await loc()) === '/?meal=dinner&time=30', `${await text('#recipe-count')} ${await loc()}`);
  await click('#filters-button');
  await click('#clear-filters');
  check('Clear filters in the tray removes all chips', (await ev("document.querySelectorAll('#chips button').length")) === 0 && (await text('#recipe-count')) === '6 recipes');
  await click(chip('meal', 'dinner'));
  await click(chip('time', '15'));
  await click('#filter-tray form:not(.modal-backdrop) button');
  check('filters-only empty text', (await text('#empty-message')) === 'No recipes match these filters', await text('#empty-message'));
  await click('#clear-all');
  check('Clear also resets filters (count, URL, button badge)', (await text('#recipe-count')) === '6 recipes' && (await loc()) === '/' && !(await visible('#filters-count')), `${await text('#recipe-count')} ${await loc()}`);
  check('Filters button label is plain "Filters" at 0 active', (await ev("document.querySelector('#filters-button').getAttribute('aria-label')")) === 'Filters', await ev("document.querySelector('#filters-button').getAttribute('aria-label')"));

  // 4. shared link and refresh restore the same results
  await goto('/?q=tomato&meal=dinner');
  check('shared link restores search box, results and button count', (await ev("document.querySelector('#search-input').value")) === 'tomato' && (await text('#recipe-count')) === '1 recipe' && (await text('#filters-count')) === '1', await text('#recipe-count'));
  check('shared link restores the label "Filters, 1 active"', (await ev("document.querySelector('#filters-button').getAttribute('aria-label')")) === 'Filters, 1 active', await ev("document.querySelector('#filters-button').getAttribute('aria-label')"));
  await ev('location.reload()');
  await sleep(600);
  await waitFor("document.readyState === 'complete'");
  check('refresh restores the same results', (await text('#recipe-count')) === '1 recipe' && (await loc()) === '/?q=tomato&meal=dinner', await loc());

  // 5. scroll restored after refresh and Back; tab switch returns to same state and scroll
  await goto('/');
  const maxScroll = await ev('document.documentElement.scrollHeight - innerHeight');
  check('page is tall enough to scroll in this test', maxScroll > 40, String(maxScroll));
  await ev('window.scrollTo(0, 120)');
  await sleep(300);
  await ev('location.reload()');
  await sleep(600);
  await waitFor("document.readyState === 'complete'");
  await sleep(400);
  check('scroll restored after refresh', Math.abs((await ev('scrollY')) - 120) <= 2, String(await ev('scrollY')));

  await goto('/');
  await type('a'); // matches all six, so the page stays tall enough to scroll
  await click(chip('time', '45'));
  check('page still scrolls with this search', (await ev('document.documentElement.scrollHeight - innerHeight')) > 80);
  await ev('window.scrollTo(0, 60)');
  await sleep(300);
  const stateUrl = await loc();
  await ev("document.querySelector('nav a[href$=\"/week/\"]').click()");
  await sleep(300);
  await waitFor("location.pathname === '/week/'");
  await sleep(300);
  check('Recipes tab on Week page points at the saved search', (await ev("document.querySelector('nav a:first-child').getAttribute('href')")) === stateUrl, await ev("document.querySelector('nav a:first-child').getAttribute('href')"));
  await ev("document.querySelector('nav a:first-child').click()");
  await sleep(300);
  await waitFor("location.pathname === '/'");
  await sleep(500);
  check('Recipes tab restores search, filters and scroll', (await loc()) === stateUrl && (await ev("document.querySelector('#search-input').value")) === 'a' && Math.abs((await ev('scrollY')) - 60) <= 2, `${await loc()} y=${await ev('scrollY')}`);
  check('Recipes tab still shows as active', await ev("document.querySelector('nav a:first-child').getAttribute('aria-current') === 'page' && document.querySelector('nav a:first-child').classList.contains('dock-active')"));

  await ev("document.querySelector('nav a[href$=\"/favorites/\"]').click()");
  await sleep(500);
  await ev('history.back()');
  await sleep(700);
  await waitFor("location.pathname === '/'");
  await sleep(400);
  check('Back from another tab restores state and scroll', (await loc()) === stateUrl && Math.abs((await ev('scrollY')) - 60) <= 2, `${await loc()} y=${await ev('scrollY')}`);

  // 6. ratings (branch 3a): picker, taps, derived Family favorite, Undo, persistence, filter, failure
  const rb = (cardId, rating) => `article[data-id="${cardId}"] [data-rating="${rating}"]`;
  const pressed = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).getAttribute('aria-pressed')`);
  const badge = (cardId) => visible(`article[data-id="${cardId}"] [data-role="family-badge"]`);
  const status = (cardId, person) => text(`article[data-id="${cardId}"] [data-person="${person}"]`);
  const saved = () => ev("JSON.parse(localStorage.getItem('kk:ratings') ?? 'null')?.entries ?? null");
  const countText = () => text('#recipe-count');

  await goto('/');
  await ev('localStorage.clear()');
  await goto('/');
  check('ratings: nobody picked yet, so rating buttons are disabled and the hint shows', (await visible('#me-hint')) && (await ev("[...document.querySelectorAll('.kk-rate-btn')].every((b) => b.disabled)")));
  await click(rb('example-1', 'loved'));
  check('ratings: a tap with nobody picked saves nothing', (await saved()) === null);
  await click('[data-me="ed"]');
  check('picker: "I\'m Ed" is pressed, remembered on the phone, hint gone, buttons enabled', (await pressed('[data-me="ed"]')) === 'true' && (await ev("localStorage.getItem('kk:me')")) === 'ed' && !(await visible('#me-hint')) && (await ev("[...document.querySelectorAll('.kk-rate-btn')].every((b) => !b.disabled)")));
  await ev('window.__len = history.length');
  await click(rb('example-1', 'loved'));
  check('Ed taps Loved it: pressed, status line says so, no favorite yet', (await pressed(rb('example-1', 'loved'))) === 'true' && (await status('example-1', 'ed')) === 'Ed: Loved it' && (await status('example-1', 'kristina')) === 'Kristina: not rated yet' && !(await badge('example-1')), `${await status('example-1', 'ed')}`);
  check('Family favorite badge is NOT shown with only one Loved it', !(await badge('example-1')));
  await click('[data-me="kristina"]');
  check('picker is changeable: "I\'m Kristina" now pressed, Ed\'s Loved it not shown as hers', (await pressed('[data-me="kristina"]')) === 'true' && (await pressed('[data-me="ed"]')) === 'false' && (await pressed(rb('example-1', 'loved'))) === 'false');
  await click(rb('example-1', 'not-for-us'));
  check('Kristina taps Not for us: no favorite', (await pressed(rb('example-1', 'not-for-us'))) === 'true' && !(await badge('example-1')) && (await status('example-1', 'kristina')) === 'Kristina: Not for us');
  await click(rb('example-1', 'loved'));
  check('Kristina switches to Loved it: both loved, so the Family favorite badge appears', (await badge('example-1')) && (await text('article[data-id="example-1"] [data-role="family-badge"]')).includes('Family favorite') && !(await visible('#undo-bar')), await text('article[data-id="example-1"] [data-role="family-badge"]'));
  const entries = await saved();
  check('saved: both entries stored, nothing stored for the favorite', entries?.['example-1']?.ed?.value === 'loved' && entries['example-1'].kristina?.value === 'loved' && !/favorite/i.test(await ev("localStorage.getItem('kk:ratings')")));
  check('rating taps add no history entries (replaceState rules still hold)', await ev('history.length === window.__len'));

  await ev('location.reload()');
  await sleep(600);
  await waitFor("document.readyState === 'complete'");
  await sleep(300);
  check('persistence: after reload the picker, both ratings and the Family favorite are still there', (await pressed('[data-me="kristina"]')) === 'true' && (await pressed(rb('example-1', 'loved'))) === 'true' && (await status('example-1', 'ed')) === 'Ed: Loved it' && (await badge('example-1')));

  await click(rb('example-1', 'loved')); // same button again = clear
  check('tapping Loved it again clears it and the favorite goes away', (await pressed(rb('example-1', 'loved'))) === 'false' && (await status('example-1', 'kristina')) === 'Kristina: not rated yet' && !(await badge('example-1')));
  check('removing a Family favorite shows the Undo bar', (await visible('#undo-bar')) && (await text('#undo-text')) === 'Family favorite removed' && (await ev("document.querySelector('#undo-bar').getAttribute('role')")) === 'status');
  await click('#undo-button');
  check('Undo puts the rating back, the badge returns, the bar goes, and it is saved', (await pressed(rb('example-1', 'loved'))) === 'true' && (await badge('example-1')) && !(await visible('#undo-bar')) && (await saved())['example-1'].kristina.value === 'loved');
  await click(rb('example-1', 'not-for-us'));
  check('switching away from Loved it also removes the favorite and offers Undo', !(await badge('example-1')) && (await visible('#undo-bar')));
  await click('#undo-button');
  check('Undo after a switch restores Loved it', (await badge('example-1')) && (await pressed(rb('example-1', 'loved'))) === 'true');
  await click(rb('example-4', 'loved'));
  check('an ordinary rating that removes no favorite shows no Undo bar', !(await visible('#undo-bar')) && !(await badge('example-4')));

  await click('[data-me="ed"]');
  await click(rb('example-3', 'loved'));
  check('rating row fits at 390px: no sideways scroll, 44px buttons, text not clipped', await ev(`(() => {
    const bs = [...document.querySelectorAll('.kk-rate-btn')];
    const ok = bs.every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5 && b.scrollWidth <= b.clientWidth; });
    const lines = [...document.querySelectorAll('.kk-rate-status p')].every((p) => p.scrollWidth <= p.clientWidth + 1);
    return bs.length === 12 && ok && lines && document.documentElement.scrollWidth <= innerWidth;
  })()`));
  check('picker chips are >= 44px', await ev("[...document.querySelectorAll('[data-me]')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5; })"));

  // filter: example-1 is a Family favorite, example-3 Ed loved, example-4 Kristina loved
  await click('#filters-button');
  await sleep(400);
  await click(chip('who', 'favorite'));
  check('filter "Family favorites" shows only the recipe both loved', (await countText()) === '1 recipe' && JSON.stringify(await visibleCards()) === '["Weeknight Pasta"]' && (await loc()) === '/?who=favorite', `${await countText()} ${await loc()}`);
  await click(chip('who', 'ed'));
  check('filter Family favorites + Ed loved it = any of them (2)', (await countText()) === '2 recipes' && (await loc()) === '/?who=favorite%2Ced', `${await countText()} ${await loc()}`);
  await click(chip('who', 'favorite'));
  await click(chip('who', 'ed'));
  await click(chip('who', 'kristina'));
  check('filter "Kristina loved it" shows hers (example-1 and example-4)', (await countText()) === '2 recipes' && (await text('#chips button')) === 'Kristina loved it', `${await countText()}`);
  await click(chip('who', 'kristina'));
  await click(chip('who', 'untried'));
  check('filter "Not tried yet" shows recipes nobody rated (3 of 6)', (await countText()) === '3 recipes', await countText());
  await click(chip('meal', 'lunch'));
  check('rating group is AND-ed with other groups (untried + lunch = 1)', (await countText()) === '1 recipe' && (await loc()) === '/?meal=lunch&who=untried', `${await countText()} ${await loc()}`);
  await click('#filter-tray form:not(.modal-backdrop) button');
  await goto('/?who=bogus,kristina&q=');
  check('address: unknown rating values are dropped and the address is tidied', (await loc()) === '/?who=kristina' && (await countText()) === '2 recipes', await loc());
  await ev('location.reload()');
  await sleep(600);
  await waitFor("document.readyState === 'complete'");
  await sleep(300);
  check('a shared "who" link still filters after the ratings load', (await countText()) === '2 recipes' && (await text('#filters-count')) === '1');
  check('only one session entry is kept (no rating data in it)', await ev("JSON.stringify(Object.keys(sessionStorage)) === '[\"kk:recipes\"]'"));

  // failure: save fails -> "Ratings unavailable" + Retry, browsing and search keep working, Retry saves the lost tap
  await goto('/');
  await ev("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'kk:ratings') throw new Error('full'); return window.__realSet.call(this, k, v); }");
  await click(rb('example-2', 'loved'));
  check('failed save: "Ratings unavailable" with a Retry button (role=alert)', (await visible('#ratings-unavailable')) && (await text('#ratings-unavailable p')) === 'Ratings unavailable' && (await text('#ratings-retry')) === 'Retry' && (await ev("document.querySelector('#ratings-unavailable').getAttribute('role')")) === 'alert');
  check('Retry button is >= 44px', await ev("(() => { const r = document.querySelector('#ratings-retry').getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5; })()"));
  check('while unavailable the rating buttons are disabled and the cards say so', (await ev("[...document.querySelectorAll('.kk-rate-btn')].every((b) => b.disabled)")) && (await status('example-2', 'ed')) === 'Ed: unavailable');
  await type('tomato');
  check('while unavailable, search still works', (await countText()) === '2 recipes' && JSON.stringify(await visibleCards()) === '["Weeknight Pasta","Tomato Soup"]', await countText());
  await clearInput();
  await click(chip('meal', 'breakfast'));
  check('while unavailable, filters still work', (await countText()) === '2 recipes', await countText());
  await click(chip('who', 'favorite'));
  check('while unavailable, the rating filter is paused instead of hiding everything', (await countText()) === '2 recipes' && (await text('#who-note')).includes('unavailable'), `${await countText()} ${await text('#who-note')}`);
  await click(chip('who', 'favorite'));
  await click(chip('meal', 'breakfast'));
  await click('#ratings-retry');
  check('Retry while still failing keeps the banner', await visible('#ratings-unavailable'));
  await ev('Storage.prototype.setItem = window.__realSet');
  await click('#ratings-retry');
  check('Retry after the problem clears: banner gone, the failed tap is saved and shown', !(await visible('#ratings-unavailable')) && (await pressed(rb('example-2', 'loved'))) === 'true' && (await status('example-2', 'ed')) === 'Ed: Loved it' && (await saved())['example-2'].ed.value === 'loved', `${await status('example-2', 'ed')}`);
  check('who note is back to normal', !(await text('#who-note')).includes('unavailable'));

  // failure: load fails
  await send('Page.enable');
  const script = await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__breakRatings = true; const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (window.__breakRatings && k === 'kk:ratings') throw new Error('blocked'); return g.call(this, k); };" });
  await goto('/');
  check('failed load: "Ratings unavailable" with Retry, and the page still browses', (await visible('#ratings-unavailable')) && (await countText()) === '6 recipes');
  await type('rolled');
  check('failed load: search works', JSON.stringify(await visibleCards()) === '["Overnight Oats"]');
  await clearInput();
  await ev('window.__breakRatings = false');
  await click('#ratings-retry');
  check('Retry after a failed load shows the saved ratings', !(await visible('#ratings-unavailable')) && (await status('example-2', 'ed')) === 'Ed: Loved it' && (await badge('example-1')));
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.result.identifier });

  // a garbled stored value falls back to empty (no error banner)
  await ev("localStorage.setItem('kk:ratings', '{{{ not json')");
  await goto('/');
  check('garbled ratings value: treated as empty, no banner, no crash', !(await visible('#ratings-unavailable')) && (await status('example-1', 'ed')) === 'Ed: not rated yet' && !(await badge('example-1')));
  await click(rb('example-6', 'loved'));
  check('rating still works after a garbled value (it is overwritten)', (await saved())['example-6'].ed.value === 'loved');
} catch (e) {
  results.push({ name: 'script ran to the end', ok: false, detail: String(e?.message ?? e) });
} finally {
  await cleanup();
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
