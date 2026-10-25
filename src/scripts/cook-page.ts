// Cooking mode: Gather, one screen per step, Done. The position is the address hash (replaceState, see docs/cooking-mode-notes.md);
// ticks are the recipe page's own (same store, same controller); Done reuses the ratings controller; the screen is kept on by wake-lock.ts.
import { createSession } from './browse-state';
import { back, encode, next, parse, segments, stepCount, type CookState } from './cook-machine';
import { exitAction } from './cook-exit';
import { createTicksController } from './ticks-controller';
import { TICKS_KEY, createTicksStore } from './ticks-store';
import { mountRatings } from './ratings-ui';
import { mountUndoSlot } from './undo-mount';
import { phoneStorage } from './phone-storage';
import { INTERACTIVE, tapDecision } from './tap-zones';
import { browserWakeApi, createWakeLock, type WakeStatus } from './wake-lock';


const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const article = $('#cook');
const recipeId = article.dataset.id!;
const total = Number(article.dataset.total);
const data: { steps: { text: string; uses: string[] }[]; items: Record<string, string> } = JSON.parse($('#cook-data').textContent ?? '{}');

// --- shared Undo bar, ratings (Done) -------------------------------------------------------------------------------
const slot = mountUndoSlot({ bar: $('#undo-bar'), stack: $('#bottom-stack'), text: $('#undo-text'), button: $('#undo-button') });
const { controller: ratings } = mountRatings({ root: article, cards: [article], slot });
void ratings.init();

// --- ticks: the same per-recipe ticks as the recipe page -------------------------------------------------------------
const gatherBoxes = [...document.querySelectorAll<HTMLInputElement>('input[data-item]')];
const ticks = createTicksController({
  store: createTicksStore({ storage: phoneStorage() }),
  recipeId,
  itemIds: gatherBoxes.map((box) => box.dataset.item!),
  slot,
});

// --- keep-awake -------------------------------------------------------------------------------------------------------
const DISMISS_KEY = 'kk:wake-banner-dismissed';
const wakeStatus = $('#wake-status');
const wakeBanner = $('#wake-banner');
let dismissed = false;
try {
  dismissed = window.sessionStorage.getItem(DISMISS_KEY) === '1';
} catch {
  /* private mode: the banner simply comes back after a reload */
}
function renderWake(status: WakeStatus): void {
  wakeStatus.dataset.status = status;
  wakeStatus.hidden = status === 'off';
  $('#wake-text').textContent = status === 'on' ? 'Screen stays on' : 'Screen may sleep';
  wakeBanner.hidden = status !== 'failed' || dismissed;
}
const wake = createWakeLock({ api: browserWakeApi(), isVisible: () => document.visibilityState === 'visible', onChange: renderWake });
$('#wake-dismiss').addEventListener('click', () => {
  dismissed = true;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* kept in memory for this page */
  }
  renderWake(wake.status());
});

// --- where we are -----------------------------------------------------------------------------------------------------
let state: CookState = parse(location.hash, total);
let doneHandled = state.phase === 'done'; // arriving on #done (a reload) must not clear checks again
const screens = { gather: $('#screen-gather'), step: $('#screen-step'), done: $('#screen-done') };
const segEls = [...document.querySelectorAll<HTMLElement>('.kk-seg')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function renderUseNow(ids: readonly string[]): void {
  const list = $('#use-now');
  list.replaceChildren(
    ...ids.map((id) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      label.className = 'kk-tick';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'kk-tick-box';
      box.dataset.use = id;
      box.checked = ticks.view().checked.has(id);
      box.addEventListener('change', () => ticks.toggle(id));
      const text = document.createElement('span');
      text.textContent = data.items[id] ?? '';
      label.append(box, text);
      li.append(label);
      return li;
    }),
  );
  $('#use-now-wrap').hidden = ids.length === 0;
}

function renderTicks(): void {
  const { checked, unavailable } = ticks.view();
  for (const box of gatherBoxes) box.checked = checked.has(box.dataset.item!);
  for (const box of document.querySelectorAll<HTMLInputElement>('input[data-use]')) box.checked = checked.has(box.dataset.use!);
  const ready = gatherBoxes.filter((box) => box.checked).length;
  $('#ready-count').textContent = `${ready} of ${gatherBoxes.length} ready · tap a row`;
  $('#ticks-unavailable').hidden = !unavailable;
}

function render(): void {
  for (const [name, el] of Object.entries(screens)) el.hidden = name !== state.phase;
  segments(state, total).forEach((segment, i) => {
    segEls[i].dataset.state = segment;
    const word = segment === 'current' ? 'current' : segment === 'done' ? 'done' : 'to do';
    segEls[i].setAttribute('aria-label', `Step ${i + 1} of ${total}: ${word}`);
    if (segment === 'current') segEls[i].setAttribute('aria-current', 'step');
    else segEls[i].removeAttribute('aria-current');
  });
  if (state.phase === 'step') {
    const step = data.steps[state.index];
    $('#step-heading').textContent = stepCount(state, total);
    $('#step-text').textContent = step.text;
    renderUseNow(step.uses);
    $('#next').firstChild!.textContent = state.index + 1 < total ? 'Next step ' : 'Finish ';
  }
  $('#start').firstChild!.textContent = 'Start step 1 ';
  renderTicks();
}

function focusHeading(): void {
  const id = state.phase === 'gather' ? 'gather-title' : state.phase === 'step' ? 'step-heading' : 'done-title';
  $(`#${id}`).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
}

function go(target: CookState): void {
  const before = state;
  state = target;
  history.replaceState(history.state, '', location.pathname + location.search + encode(state));
  render();
  focusHeading();
  if (state.phase === 'done') {
    void wake.release();
    if (!doneHandled || before.phase !== 'done') {
      doneHandled = true;
      ticks.reset({ text: 'Ingredient checks cleared' });
    }
  } else {
    void wake.acquire();
  }
}

$('#start').addEventListener('click', () => go(next(state, total)));
$('#next').addEventListener('click', () => go(next(state, total)));
$('#back-step').addEventListener('click', () => go(back(state, total)));

// --- tap zones on a step: right side forward, left side back ----------------------------------------------------------
document.addEventListener('click', (event) => {
  if (state.phase !== 'step' || event.defaultPrevented) return;
  const rect = article.getBoundingClientRect();
  const target = event.target instanceof Element ? event.target : null;
  const action = tapDecision({
    x: event.clientX - rect.left,
    width: rect.width,
    onInteractive: target?.closest(INTERACTIVE) != null,
    selectionText: String(window.getSelection() ?? ''),
  });
  if (action === 'next') go(next(state, total));
  else if (action === 'back') go(back(state, total));
});

// --- Exit and Back to recipes ----------------------------------------------------------------------------------------
const exit = $<HTMLAnchorElement>('#exit');
exit.addEventListener('click', (event) => {
  void wake.release();
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (exitAction({ referrer: document.referrer, origin: location.origin, recipeId, historyLength: history.length }) === 'back') {
    event.preventDefault();
    history.back();
  }
});
let session: ReturnType<typeof createSession> | null = null;
try {
  session = createSession(window.sessionStorage);
} catch {
  /* Back to recipes is a link to "/" */
}
$<HTMLAnchorElement>('#back-to-recipes').href = session?.recipesHref() ?? '/';

// --- lifecycle ----------------------------------------------------------------------------------------------------
addEventListener('storage', (event) => event.key === TICKS_KEY && ticks.refresh());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    ticks.refresh();
    void wake.onVisible();
  }
});
addEventListener('pagehide', () => void wake.release());
addEventListener('pageshow', (event) => {
  if (event.persisted) {
    ticks.refresh();
    void ratings.refresh();
    if (state.phase !== 'done') void wake.acquire();
  }
});
addEventListener('hashchange', () => {
  state = parse(location.hash, total);
  render();
});
$('#ticks-retry').addEventListener('click', () => ticks.retry());
for (const box of gatherBoxes) box.addEventListener('change', () => ticks.toggle(box.dataset.item!));
ticks.subscribe(renderTicks);
ticks.init();
render();
if (state.phase !== 'done') void wake.acquire();
