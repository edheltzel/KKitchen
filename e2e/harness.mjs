// A small headless-Chrome harness for the e2e files that come after browse.e2e.mjs (that one still carries
// its own copy). Chrome here quits about 30 s after it starts, so each e2e file is its own launch and has to
// finish well inside that. The server binds 127.0.0.1 only and everything is stopped by finish().
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';

const dist = resolve(new URL('../dist', import.meta.url).pathname);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json' };

/** The phone every e2e emulates (CSS pixels). One place, so a check never hardcodes the screen height. */
export const PHONE_WIDTH = 390;
export const PHONE_HEIGHT = 844;

export async function startHarness({ port = Number(process.env.PORT ?? 4399), debug = 9334, scheme = 'light' } = {}) {
  const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    let file = join(dist, path);
    if (!file.startsWith(dist)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  const profile = mkdtempSync(join(tmpdir(), 'kk-e2e-'));
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  let ws;

  let targets = [];
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(250);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}, ms = 20000) => new Promise((r, rej) => { const i = ++id; pending.set(i, r); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('no answer from Chrome: ' + method)); } }, ms); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 4000);
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description ?? ''));
    return r.result.result.value;
  };
  const waitFor = async (expression, ms = 3000) => {
    const end = Date.now() + ms;
    let v;
    while (Date.now() < end) { try { v = await ev(expression); if (v) return v; } catch {} await sleep(50); }
    return v;
  };

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: PHONE_WIDTH, height: PHONE_HEIGHT, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  // The page believes it is Thursday 29 Oct 2026, 12:00, and the clock keeps running from there.
  const shift = new Date(2026, 9, 29, 12, 0, 0).getTime() - Date.now();
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { const R = Date; const shift = ${shift}; class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + shift); else super(...a); } static now() { return R.now() + shift; } } window.Date = D; })()`,
  });

  return {
    base, send, ev, waitFor, sleep, results,
    goto: async (path) => {
      await send('Page.navigate', { url: base + path });
      await sleep(100);
      await waitFor("document.readyState === 'complete'");
      await sleep(300);
    },
    check: (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); },
    text: (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? null`),
    visible: (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; })()`),
    click: async (sel) => { await ev(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(120); },
    rect: (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`),
    /** A finger or mouse drag from (x0,y0) to (x1,y1) in steps; with hold, stays down at the end. */
    drag: async (x0, y0, x1, y1, { steps = 6, hold = false } = {}) => {
      const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
      await mouse('mousePressed', x0, y0);
      for (let i = 1; i <= steps; i++) await mouse('mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      if (!hold) await mouse('mouseReleased', x1, y1);
      await sleep(250);
      return hold ? () => mouse('mouseReleased', x1, y1).then(() => sleep(250)) : null;
    },
    async finish() {
      try { ws?.close(); } catch {}
      chrome.kill();
      server.close();
      await sleep(500);
      rmSync(profile, { recursive: true, force: true });
      let failed = 0;
      for (const r of results) {
        if (!r.ok) failed++;
        console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`);
      }
      console.log(`\n${results.length - failed}/${results.length} checks passed`);
      process.exit(failed ? 1 : 0);
    },
  };
}
