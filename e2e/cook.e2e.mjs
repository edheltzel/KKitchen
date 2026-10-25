// Headless-Chrome run-through of cooking mode: Gather, every step, Done; ticks shared with the recipe page; Done clearing the
// ticks with Undo; ratings on Done; Exit; no tab bar. Phone first, then the desktop column.
// Run: rm -rf dist && npm test && timeout 40 node e2e/cook.e2e.mjs
import { startHarness } from './harness.mjs';
import { installWakeStandIn } from './wake-standin.mjs';

const h = await startHarness();
const { ev, check, goto, text, visible, click, sleep, rect, waitFor, send } = h;
await installWakeStandIn(send);
const saved = async () => JSON.parse((await ev("localStorage.getItem('kk:ticks')")) ?? 'null');
const ticked = (scope = 'document') => ev(`[...${scope}.querySelectorAll('input[data-item]')].filter((b) => b.checked).map((b) => b.dataset.item).sort().join()`);
const loaded = async () => { await sleep(500); await waitFor("document.readyState === 'complete'"); await sleep(400); };
const used = () => ev("[...document.querySelectorAll('#use-now input[data-use]')].filter((b) => b.checked).map((b) => b.dataset.use).join()");
const shown = () => ev("['gather', 'step', 'done'].filter((n) => !document.querySelector('#screen-' + n).hidden).join()");
const hash = () => ev('location.hash');
try {
  // --- the Start cooking button on the recipe page, and ticks that come along ------------------------------------------
  await goto('/recipe/example-1/');
  await click('input[data-item="tomato"]');
  await click('#start-cooking');
  await loaded();
  check('Start cooking opens the cook route for that recipe', (await ev('location.pathname')) === '/cook/example-1/', await ev('location.pathname'));
  check('there is no tab bar in cooking mode', !(await ev("!!document.querySelector('nav[aria-label=\"Main\"]')")) || !(await visible('nav[aria-label="Main"]')));
  check('Gather is showing, with every ingredient as a tick row and the same tick as the recipe page had', (await shown()) === 'gather' && (await ev("document.querySelectorAll('#screen-gather input[data-item]').length")) === 4 && (await ticked()) === 'tomato');
  check('"N of M ready" counts the ticked row', (await text('#ready-count')) === '1 of 4 ready · tap a row', await text('#ready-count'));
  check('every Gather row and the Start button are at least 44px tall', await ev("[...document.querySelectorAll('#screen-gather .kk-tick, #start, #exit')].every((e) => e.getBoundingClientRect().height >= 44)"));
  await click('input[data-item="garlic"]');
  check('ticking on Gather updates the count and is saved', (await text('#ready-count')) === '2 of 4 ready · tap a row' && (await saved()).ticks['example-1'].slice().sort().join() === 'garlic,tomato');
  check('the progress strip has one segment per step, named, none current yet', (await ev("[...document.querySelectorAll('#cook-progress li')].map((l) => l.getAttribute('aria-label')).join('|')")) === 'Step 1 of 4: to do|Step 2 of 4: to do|Step 3 of 4: to do|Step 4 of 4: to do');
  check('the screen-stays-on pill shows when the lock is granted', (await text('#wake-text')) === 'Screen stays on' && (await visible('#wake-status')) && (await ev('window.__wake.active')) === 1);

  // --- Step 1: Use now shows only what the step marks ------------------------------------------------------------------
  const historyBefore = await ev('history.length');
  await click('#start');
  check('Start step 1 opens step 1 (hash #step-1, the heading has focus)', (await shown()) === 'step' && (await hash()) === '#step-1' && (await ev("document.activeElement.id")) === 'step-heading' && (await text('#step-heading')) === 'Step 1 of 4');
  check('step text is big and is the first step', (await text('#step-text')) === 'Boil the spaghetti in salted water until tender.' && parseFloat(await ev("getComputedStyle(document.querySelector('#step-text')).fontSize")) >= 22);
  check('Use now shows only the spaghetti, unticked', (await text('#use-now')) === '250 g spaghetti' && (await used()) === '');
  await click('#use-now input[data-use]');
  await click('#back-step');
  check('Back goes to Gather, where the spaghetti tick from Use now is the same tick', (await shown()) === 'gather' && (await hash()) === '' && (await ticked()) === 'garlic,spaghetti,tomato' && (await text('#ready-count')) === '3 of 4 ready · tap a row');
  const look = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const s = getComputedStyle(e); return { line: s.textDecorationLine, color: s.color }; })()`);
  const gatherTicked = await look('#screen-gather label:has(input:checked) span');
  check('(Gather keeps its strike-through and muted color on a ticked row)', gatherTicked.line === 'line-through', JSON.stringify(gatherTicked));
  await click('#start');
  check('step 1 again: the Use now row is ticked', (await used()) === 'spaghetti');
  const useTicked = await look('#use-now label:has(input:checked) span');
  await ev("document.querySelector('#use-now input').click()");
  const useOff = await look('#use-now label span');
  await ev("document.querySelector('#use-now input').click()");
  check('on Step a ticked Use now row shows the tick but no line-through, and the text is the same full-strength color as an unticked row', useTicked.line === 'none' && useTicked.color === useOff.color && useTicked.color !== gatherTicked.color, JSON.stringify([useTicked, useOff, gatherTicked]));
  check('Next step is the primary button and Back is the quiet one, both 44px or more', await ev("(() => { const n = document.querySelector('#next'), b = document.querySelector('#back-step'); return n.classList.contains('btn-primary') && !b.classList.contains('btn-primary') && n.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().height >= 44 && n.getBoundingClientRect().width > b.getBoundingClientRect().width; })()"));
  check('on a phone the step screen does not scroll sideways and the buttons are inside the screen', await ev("document.documentElement.scrollWidth <= innerWidth && document.querySelector('#next').getBoundingClientRect().bottom <= innerHeight"));

  // --- the whole run: step 2 to Finish ---------------------------------------------------------------------------------
  await click('#next');
  check('step 2 marks the olive oil and the garlic', (await text('#step-heading')) === 'Step 2 of 4' && (await ev("[...document.querySelectorAll('#use-now input[data-use]')].map((b) => b.dataset.use).join()")) === 'olive-oil,garlic');
  check('the progress strip marks step 1 done and step 2 current', (await ev("[...document.querySelectorAll('#cook-progress li')].map((l) => l.dataset.state).join()")) === 'done,current,todo,todo' && (await ev("document.querySelector('#cook-progress [aria-current=\"step\"]').getAttribute('aria-label')")) === 'Step 2 of 4: current');
  await click('#next');
  check('step 3 marks the tomato, which was ticked on the recipe page', (await ev("[...document.querySelectorAll('#use-now input[data-use]')].map((b) => b.dataset.use + ':' + b.checked).join()")) === 'tomato:true');
  await click('#next');
  check('step 4 marks nothing, so Use now is hidden, and the main button says Finish', !(await visible('#use-now-wrap')) && (await text('#next')).startsWith('Finish') && (await text('#step-text')) === 'Toss with the drained spaghetti and serve.');
  check('moving through steps added no history entries (replaceState)', (await ev('history.length')) === historyBefore, `${await ev('history.length')} vs ${historyBefore}`);
  await ev("document.querySelector('#screen-step input')?.blur()");
  const tapAt = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(250);
  };
  const lastCol = await rect('#cook');
  const lastY = Math.round((await rect('#step-text')).y + 10);
  await tapAt(Math.round(lastCol.x + lastCol.w * 0.9), lastY);
  check('on the last step a tap on the right stays put: no Done, the ticks stay, no Undo bar', (await shown()) === 'step' && (await hash()) === '#step-4' && (await saved()).ticks['example-1'].slice().sort().join() === 'garlic,spaghetti,tomato' && !(await visible('#undo-bar')), `${await hash()} ${await shown()}`);
  await tapAt(Math.round(lastCol.x + lastCol.w * 0.1), lastY);
  check('on the last step a tap on the left still goes back', (await hash()) === '#step-3', await hash());
  await click('#next');
  check('(back on the last step)', (await hash()) === '#step-4');
  await click('#next');
  check('Finish opens Done: "Dinner\'s ready", every segment done, heading focused', (await shown()) === 'done' && (await hash()) === '#done' && (await text('#done-title')) === "Dinner's ready" && (await ev("document.activeElement.id")) === 'done-title' && (await ev("[...document.querySelectorAll('#cook-progress li')].every((l) => l.dataset.state === 'done')")));
  check('Done says the ingredient checks are cleared, and that is true: nothing is saved for example-1', (await ev("document.querySelector('.kk-done-note').textContent")).includes('Ingredient checks are cleared for next time') && (await saved())?.ticks?.['example-1'] === undefined && (await ticked()) === '', JSON.stringify(await saved()));
  check('the shared Undo bar offers to bring them back, and the screen-stays-on pill is gone (the lock is released)', (await visible('#undo-bar')) && (await text('#undo-text')) === 'Ingredient checks cleared' && !(await visible('#wake-status')) && (await ev('window.__wake.active')) === 0);
  check('Undo is at least 44px tall and there is still no tab bar', (await rect('#undo-button')).h >= 44 && !(await visible('nav[aria-label="Main"]')));
  await click('#undo-button');
  check('after Undo the Done screen no longer says the checks are cleared', !(await visible('.kk-done-note')) && !(await ev("document.querySelector('#screen-done').innerText")).includes('are cleared'), await ev("document.querySelector('.kk-done-note').hidden + ' ' + document.querySelector('.kk-done-note').textContent"));
  check('Undo puts back the ticks that were on the recipe, saved', (await saved()).ticks['example-1'].slice().sort().join() === 'garlic,spaghetti,tomato' && !(await visible('#undo-bar')));

  // --- ratings on Done are the shared controls -------------------------------------------------------------------------
  check('Done has the Loved it / Not for us buttons, 44px tall, and the Ed / Kristina switch', (await ev("[...document.querySelectorAll('#screen-done .kk-rate-btn')].map((b) => b.textContent.trim()).join('|')")) === 'Loved it|Not for us' && (await ev("[...document.querySelectorAll('#screen-done .kk-rate-btn')].every((b) => b.getBoundingClientRect().height >= 44)")) && (await ev("[...document.querySelectorAll('#screen-done [data-me]')].map((b) => b.textContent.trim()).join('|')")).includes('Ed'));
  await click('[data-me="ed"]');
  await click('.kk-rate-btn[data-rating="loved"]');
  check('Ed rates Loved it on Done: the status line and the saved rating', (await text('[data-person="ed"]')) === 'Ed: Loved it' && (await ev("localStorage.getItem('kk:ratings')")) !== null);

  // --- reload on Done: it stays on Done and does not clear again ---------------------------------------------------------
  await ev('location.reload()');
  await loaded();
  check('reloading on Done stays on Done', (await shown()) === 'done' && (await hash()) === '#done');
  check('and does not clear the ticks a second time (the undone ticks are still there, no Undo bar)', (await saved()).ticks['example-1'].slice().sort().join() === 'garlic,spaghetti,tomato' && !(await visible('#undo-bar')));
  check('(Back to recipes link) points at the Recipes list', (await ev("document.querySelector('#back-to-recipes').getAttribute('href')")) === '/' && (await rect('#back-to-recipes')).h >= 44);
  await click('#back-to-recipes');
  await loaded();
  check('Back to recipes opens the Recipes list', (await ev('location.pathname')) === '/' && await visible('#recipe-grid'));

  // --- a recipe that is not a dinner finishes with neutral wording ----------------------------------------------------------
  await goto('/cook/example-3/'); // Tomato Soup, a lunch with 4 steps
  await loaded();
  await click('#start');
  for (let i = 0; i < 4; i++) await click('#next');
  check('finishing a lunch opens Done with "All done", not "Dinner\'s ready"', (await shown()) === 'done' && (await text('#done-title')) === 'All done', await text('#done-title'));
  check('and Done still has the rating buttons and Back to recipes', (await visible('#back-to-recipes')) && (await ev("document.querySelectorAll('#screen-done .kk-rate-btn').length")) === 2);
} catch (e) {
  check('the run finished without an error: ' + e.message, false);
}
await h.finish();
