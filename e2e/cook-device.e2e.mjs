// Headless-Chrome check of what cooking mode asks of the phone: the wake lock (granted, denied, missing, released, re-requested),
// tap zones with real mouse clicks, the position surviving a reload, focus and names for assistive tech, reduced motion, Exit,
// and the desktop column.
// Run: rm -rf dist && npm test && timeout 40 node e2e/cook-device.e2e.mjs
import { startHarness } from './harness.mjs';
import { installWakeStandIn } from './wake-standin.mjs';

const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep, rect, waitFor, send } = h;
await installWakeStandIn(send);
const loaded = async () => { await sleep(500); await waitFor("document.readyState === 'complete'"); await sleep(400); };
const mode = (m) => ev(`localStorage.setItem('e2e:wake', '${m}')`);
// goto() to a hash on the same page does not reload it, so a changed stand-in mode needs a real reload.
const open = async (path) => { await goto(path); await ev('location.reload()'); await loaded(); };
const hash = () => ev('location.hash');
const wake = () => ev('({ requests: window.__wake.requests, active: window.__wake.active })');
const chip = () => ev("(() => { const s = document.querySelector('#wake-status'); return { shown: !s.hidden, status: s.dataset.status, text: document.querySelector('#wake-text').textContent, border: getComputedStyle(s).borderTopStyle }; })()");
const tap = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(200);
};
const BANNER = "Couldn't keep the screen on. Set Auto-Lock to Never in Settings.";
try {
  // --- denied: the dashed chip, the dark banner, Got it for the session -----------------------------------------------------
  await goto('/cook/example-1/');
  await mode('deny');
  await ev("sessionStorage.clear()");
  await ev('location.reload()');
  await loaded();
  let c = await chip();
  check('denied: a dashed "Screen may sleep" chip', c.shown && c.status === 'failed' && c.text === 'Screen may sleep' && c.border === 'dashed', JSON.stringify(c));
  check('denied: the banner says what to do, and Got it is 44px or more', (await visible('#wake-banner')) && (await text('#wake-banner p')) === BANNER && (await rect('#wake-dismiss')).h >= 44 && (await text('#wake-dismiss')) === 'Got it');
  await click('#wake-dismiss');
  check('Got it hides the banner and the chip stays', !(await visible('#wake-banner')) && (await chip()).shown);
  await click('#start');
  check('the banner stays away on the next step (dismissed for the session)', !(await visible('#wake-banner')));
  await ev('location.reload()');
  await loaded();
  check('and after a reload in the same session; the chip is still there', !(await visible('#wake-banner')) && (await chip()).text === 'Screen may sleep');
  await ev("sessionStorage.clear()");
  await mode('none');
  await ev('location.reload()');
  await loaded();
  c = await chip();
  check('no Wake Lock API: the same chip and banner', c.status === 'failed' && c.text === 'Screen may sleep' && (await visible('#wake-banner')) && (await text('#wake-banner p')) === BANNER, JSON.stringify(c));

  // --- granted: pill, release on Done and Exit, re-request on visibility ---------------------------------------------------
  await mode('grant');
  await open('/cook/example-1/#step-2');
  c = await chip();
  check('granted: the dark "Screen stays on" pill, no banner', c.shown && c.status === 'on' && c.text === 'Screen stays on' && !(await visible('#wake-banner')) && (await wake()).active === 1, JSON.stringify(c));
  await ev("Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); window.__wake.systemRelease();");
  await sleep(150);
  check('the system releases the lock while the page is hidden: the pill goes quietly, no banner', !(await chip()).shown && !(await visible('#wake-banner')) && (await wake()).active === 0);
  const before = (await wake()).requests;
  await ev("Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'));");
  await sleep(200);
  check('coming back asks for the lock again and the pill returns', (await wake()).requests === before + 1 && (await wake()).active === 1 && (await chip()).status === 'on', JSON.stringify(await wake()));
  await ev("window.__wake.systemRelease()");
  await sleep(150);
  check('lost while the page is visible: the chip and banner say so', (await chip()).status === 'failed' && (await visible('#wake-banner')));
  await click('#wake-dismiss');
  await open('/cook/example-1/#step-4');
  check('(setup) a fresh lock on step 4', (await wake()).active === 1, JSON.stringify(await wake()));
  await click('#next');
  check('Finish releases the lock', (await hash()) === '#done' && (await wake()).active === 0);
  await open('/cook/example-1/#step-2');
  await ev("document.addEventListener('click', (e) => { if (e.target.closest('#exit')) e.preventDefault(); }, true)");
  await click('#exit');
  check('Exit releases the lock', (await ev('location.pathname')) === '/cook/example-1/' && (await wake()).active === 0, JSON.stringify(await wake()));

  // --- tap zones with real clicks ------------------------------------------------------------------------------------------
  await goto('/cook/example-1/#step-2');
  const col = await rect('#cook');
  const t = await rect('#step-text');
  const y = Math.round(t.y + t.h / 2);
  await tap(Math.round(col.x + col.w * 0.9), y);
  check('a tap on the right side goes forward', (await hash()) === '#step-3' && (await text('#step-heading')) === 'Step 3 of 4', await hash());
  await tap(Math.round(col.x + col.w * 0.1), Math.round((await rect('#step-text')).y + 10));
  check('a tap on the left side goes back', (await hash()) === '#step-2', await hash());
  await ev("(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#step-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()");
  await tap(Math.round(col.x + col.w * 0.9), Math.round((await rect('#step-text')).y + 10));
  check('with text selected a tap does nothing', (await hash()) === '#step-2', await hash());
  await ev('getSelection().removeAllRanges()');
  const row = await rect('#use-now .kk-tick');
  await tap(Math.round(col.x + col.w * 0.9), Math.round(row.y + row.h / 2));
  check('a tap on a Use now row ticks it and does not turn the page', (await hash()) === '#step-2' && (await ev("document.querySelector('#use-now input').checked")));
  const back = await rect('#back-step');
  await tap(Math.round(back.x + back.w / 2), Math.round(back.y + back.h / 2));
  check('Back moves back one step, and only one (the button is not also a left tap)', (await hash()) === '#step-1', await hash());
  await goto('/cook/example-1/');
  await ev('location.reload()');
  await loaded();
  await tap(Math.round(col.x + col.w * 0.9), 400);
  check('on Gather a tap on the right does not start the steps', (await hash()) === '');

  // --- the place survives a reload ---------------------------------------------------------------------------------------------
  await goto('/cook/example-1/#step-3');
  await ev('location.reload()');
  await loaded();
  check('reload on step 3 comes back to step 3', (await text('#step-heading')) === 'Step 3 of 4' && (await text('#step-text')) === 'Add the tomatoes and simmer until soft.');
  await goto('/cook/example-1/#step-99');
  check('a hash past the last step falls back to the last step; nonsense falls back to Gather', (await text('#step-heading')) === 'Step 4 of 4');
  await goto('/cook/example-1/#banana');
  check('(nonsense hash)', !(await ev("document.querySelector('#screen-gather').hidden")));

  // --- assistive tech and reduced motion -----------------------------------------------------------------------------------------
  await goto('/cook/example-1/#step-1');
  await click('#next');
  check('after Next the focus is on the step heading', (await ev('document.activeElement.id')) === 'step-heading');
  check('the step text is a polite live region, and the progress strip is named', (await ev("document.querySelector('#step-text').getAttribute('aria-live')")) === 'polite' && (await ev("document.querySelector('#cook-progress').getAttribute('aria-label')")).startsWith('Progress through'));
  const dur = () => ev("getComputedStyle(document.querySelector('.kk-seg')).transitionDuration");
  const normal = await dur();
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(100);
  check('reduced motion turns the progress animation off', normal !== '0s' && (await dur()) === '0s', `${normal} -> ${await dur()}`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });

  // --- Exit -------------------------------------------------------------------------------------------------------------------------
  await goto('/cook/example-1/#step-2');
  await click('#exit');
  await loaded();
  check('opened directly, Exit follows its link to the recipe page without asking', (await ev('location.pathname')) === '/recipe/example-1/');
  await click('#start-cooking');
  await loaded();
  await click('#start');
  await click('#exit');
  await loaded();
  check('opened from the recipe page, Exit goes back to it and Back from there does not return to cooking', (await ev('location.pathname')) === '/recipe/example-1/' && (await ev('location.hash')) === '');

  const sizes = () => ev(`(() => { const px = (q) => parseFloat(getComputedStyle(document.querySelector(q)).fontSize); return { text: px('#step-text'), row: px('#use-now .kk-tick span'), next: px('#next'), nextH: document.querySelector('#next').getBoundingClientRect().height }; })()`);
  await goto('/cook/example-1/#step-1');
  const phone = await sizes();
  check('phone: the step sentence, Use now rows and Next step keep their sizes (30px, 18px, 18px)', phone.text === 30 && phone.row === 18 && phone.next === 18, JSON.stringify(phone));

  // --- desktop column -------------------------------------------------------------------------------------------------------------------
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await goto('/cook/example-1/#step-2');
  const d = await ev("(() => { const r = document.querySelector('#cook').getBoundingClientRect(); return { w: r.width, x: r.x, scroll: document.documentElement.scrollWidth, inner: innerWidth, tabs: !!document.querySelector('nav[aria-label=\"Main\"]') && !document.querySelector('nav[aria-label=\"Main\"]').hidden && document.querySelector('nav[aria-label=\"Main\"]').getBoundingClientRect().height > 0 }; })()");
  check('desktop: a centred reading column, no sideways scroll, no tab bar', d.w <= 760 && d.w > 360 && Math.abs(d.x * 2 + d.w - d.inner) < 20 && d.scroll <= d.inner && !d.tabs, JSON.stringify(d));
  await tap(20, 400);
  check('desktop: empty space beside the column is not a tap zone', (await hash()) === '#step-2', await hash());
  await goto('/cook/example-1/#step-1');
  const big = await sizes();
  check('desktop: the step sentence is about 40px and Use now rows and Next step scale up with it', big.text >= 38 && big.text <= 46 && big.row >= 22 && big.next >= 22 && big.nextH > phone.nextH, JSON.stringify(big));
  const wide = await ev("(() => { const r = document.querySelector('#cook').getBoundingClientRect(); return { x: r.x, w: r.width, h: document.documentElement.scrollWidth <= innerWidth }; })()");
  check('desktop: the larger text still fits the column without sideways scroll', wide.h, JSON.stringify(wide));
  await goto('/cook/example-1/#step-2');
  const col2 = await rect('#cook');
  await tap(Math.round(col2.x + col2.w * 0.9), 120);
  check('desktop, larger text: a tap on the right of the reading column goes forward', (await hash()) === '#step-3', await hash());
  await tap(Math.round(col2.x + col2.w * 0.1), 120);
  check('desktop, larger text: a tap on the left of the reading column goes back', (await hash()) === '#step-2', await hash());
  await tap(Math.round(col2.x - 30), 120);
  check('desktop, larger text: a tap beside the column still does nothing', (await hash()) === '#step-2', await hash());
} catch (e) {
  check('the run finished without an error: ' + e.message, false);
}
await h.finish();
