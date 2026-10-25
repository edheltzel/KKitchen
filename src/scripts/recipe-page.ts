// The recipe page: Back link, ratings and Plan (the same controllers as the Recipes grid), and the ingredient ticks.
import { backAction } from './back-link';
import { createSession } from './browse-state';
import { createTicksController } from './ticks-controller';
import { TICKS_KEY, createTicksStore } from './ticks-store';
import { mountPlanSheet } from './plan-ui';
import { mountRatings } from './ratings-ui';
import { mountUndoSlot } from './undo-mount';
import { phoneStorage } from './phone-storage';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const article = $('#recipe');
const recipeId = article.dataset.id!;

// --- Back: to the Recipes list the way it was (URL query = filters; the list restores its own scroll) --------
let session: ReturnType<typeof createSession> | null = null;
try {
  session = createSession(window.sessionStorage);
} catch {
  // Storage blocked: Back is a link to "/".
}
const back = $<HTMLAnchorElement>('#back');
back.setAttribute('href', session?.recipesHref() ?? '/');
back.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (backAction({ referrer: document.referrer, origin: location.origin, historyLength: history.length }) === 'history') {
    event.preventDefault();
    history.back();
  }
});

// --- shared Undo bar, ratings, Plan ---------------------------------------------------------------------------
const slot = mountUndoSlot({ bar: $('#undo-bar'), stack: $('#bottom-stack'), text: $('#undo-text'), button: $('#undo-button') });
const { controller: ratings } = mountRatings({ root: article, cards: [article], slot });
const catalog: { id: string; name: string }[] = JSON.parse($('#catalog').textContent ?? '[]');
mountPlanSheet({ cards: [article], names: new Map(catalog.map((r) => [r.id, r.name])) });
void ratings.init();

// --- ingredient ticks -------------------------------------------------------------------------------------------
const boxes = [...document.querySelectorAll<HTMLInputElement>('input[data-item]')];
const ticks = createTicksController({
  store: createTicksStore({ storage: phoneStorage() }),
  recipeId,
  itemIds: boxes.map((box) => box.dataset.item!),
  slot,
});
const reset = $<HTMLButtonElement>('#reset-ticks');
function renderTicks(): void {
  const { checked, unavailable } = ticks.view();
  for (const box of boxes) box.checked = checked.has(box.dataset.item!);
  reset.disabled = checked.size === 0;
  $('#ticks-unavailable').hidden = !unavailable;
}
for (const box of boxes) box.addEventListener('change', () => ticks.toggle(box.dataset.item!));
reset.addEventListener('click', () => ticks.reset());
$('#ticks-retry').addEventListener('click', () => ticks.retry());
ticks.subscribe(renderTicks);
addEventListener('storage', (event) => event.key === TICKS_KEY && ticks.refresh());
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && ticks.refresh());
addEventListener('pageshow', (event) => {
  if (event.persisted) {
    ticks.refresh();
    void ratings.refresh();
  }
});
ticks.init();
