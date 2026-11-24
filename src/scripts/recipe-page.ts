// The recipe page: Back link, ratings and Plan (the same controllers as the Recipes grid), and the ingredient ticks.
import { backAction } from './back-link';
import { createSession } from './browse-state';
import { createTicksController } from './ticks-controller';
import { TICKS_KEY, createTicksStore } from './ticks-store';
import { mountPlanSheet } from './plan-ui';
import { mountRatings } from './ratings-ui';
import { mountUndoSlot } from './undo-mount';
import { pageSession, phoneStorage } from './phone-storage';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const article = $('#recipe');
const recipeId = article.dataset.id!;

const session = createSession(pageSession());
const back = $<HTMLAnchorElement>('#back');
back.setAttribute('href', session.recipesHref());
back.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (backAction({ referrer: document.referrer, origin: location.origin, historyLength: history.length }) === 'history') {
    event.preventDefault();
    history.back();
  }
});

const slot = mountUndoSlot({ bar: $('#undo-bar'), stack: $('#bottom-stack'), text: $('#undo-text'), button: $('#undo-button') });
const { controller: ratings } = mountRatings({ root: article, cards: [article], slot, inlinePicker: document.getElementById('me-inline')! });
const catalog: { id: string; name: string }[] = JSON.parse($('#catalog').textContent ?? '[]');
mountPlanSheet({ cards: [article], names: new Map(catalog.map((r) => [r.id, r.name])) });
void ratings.init();

const boxes = [...document.querySelectorAll<HTMLInputElement>('input[data-item]')];
const local = createTicksStore({ storage: phoneStorage() });
const share = (itemId: string, checked: boolean) =>
  void fetch('/api/ticks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipeId, itemId, checked }) });
const store = {
  read: (id: string) => local.read(id),
  set: (id: string, itemId: string, checked: boolean) => { const result = local.set(id, itemId, checked); share(itemId, checked); return result; },
  clear: (id: string) => { const before = local.read(id); const result = local.clear(id); for (const itemId of before) share(itemId, false); return result; },
  add: (id: string, itemIds: readonly string[]) => { const result = local.add(id, itemIds); for (const itemId of itemIds) share(itemId, true); return result; },
};
const ticks = createTicksController({
  store,
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

// The shared ticks win over the phone copy once they load, so Ed's two devices agree.
void fetch(`/api/ticks?recipe=${recipeId}`)
  .then((response) => (response.ok ? response.json() : null))
  .then((body: { ticks: string[] } | null) => {
    if (!body) return;
    const remote = new Set(body.ticks);
    for (const itemId of local.read(recipeId)) if (!remote.has(itemId)) local.set(recipeId, itemId, false);
    for (const itemId of body.ticks) local.add(recipeId, [itemId]);
    ticks.refresh();
  });
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && ticks.refresh());
addEventListener('pageshow', (event) => {
  if (event.persisted) {
    ticks.refresh();
    void ratings.refresh();
  }
});
ticks.init();
