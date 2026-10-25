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
  check('AND across groups (lunch/dinner and under 30 min = 3)', (await text('#recipe-count')) === '3 recipes', await text('#recipe-count'));
  check('URL carries each group as its own param', (await loc()) === '/?meal=lunch%2Cdinner&time=30', await loc());
  check('every tray target is >= 44px (and the tray really has targets)', opened && await ev("(() => { const bs = [...document.querySelectorAll('#filter-tray button')].filter((b) => b.getBoundingClientRect().width > 0); return bs.length >= 9 && bs.every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5; }); })()"));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 195, y: 60, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 195, y: 60, button: 'left', clickCount: 1 });
  await sleep(300);
  check('backdrop tap closes the tray', opened && (await ev("document.querySelector('#filter-tray').open")) === false);
  check('chips show above the grid, one per filter', (await ev("document.querySelectorAll('#chips button').length")) === 3 && (await visible('#chips')));
  check('Filters button shows the count (3)', (await text('#filters-count')) === '3' && (await visible('#filters-count')));
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

  // 4. shared link and refresh restore the same results
  await goto('/?q=tomato&meal=dinner');
  check('shared link restores search box, results and button count', (await ev("document.querySelector('#search-input').value")) === 'tomato' && (await text('#recipe-count')) === '1 recipe' && (await text('#filters-count')) === '1', await text('#recipe-count'));
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
