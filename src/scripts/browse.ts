// Wires the Recipes page: live search, filter tray, chips, count and empty state.
// The address bar is the source of truth, so refresh and shared links restore the same results.
// All text from the address goes through textContent / value, never innerHTML.
import {
  GROUPS,
  createSession,
  activeFilterCount,
  emptyMessage,
  emptyState,
  filterRecipes,
  parseState,
  serializeState,
  toggleValue,
  type BrowseState,
  type Group,
  type Options,
  type Searchable,
} from './browse-state';
import { pageSession, phoneStorage } from './phone-storage';
import { localCopy } from './import-local';
import { mountRatings } from './ratings-ui';

// The first time a signed-in phone still holds its own ratings or week, offer to copy them into the shared store.
if (localCopy(phoneStorage()) && !sessionStorage.getItem('kk:import-declined')) location.assign('/import/');
import { mountUndoSlot } from './undo-mount';
import { mountPlanSheet } from "./plan-ui";

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const input = $<HTMLInputElement>('#search-input');
const tray = $<HTMLDialogElement>('#filter-tray');
const filtersButton = $<HTMLButtonElement>('#filters-button');
const filtersCount = $('#filters-count');
const count = $('#recipe-count');
const chipsRow = $('#chips');
const empty = $('#empty');
const emptyText = $('#empty-message');
const whoNote = $('#who-note');
const whoNoteText = whoNote.textContent ?? '';

// Filter options and their labels come from the tray markup, which is built from approved data only.
const options: Options = { meal: [], time: [], diet: [], who: [], source: [] };
const labels = new Map<string, string>();
const trayChips = [...tray.querySelectorAll<HTMLButtonElement>('button[data-group]')];
for (const chip of trayChips) {
  const group = chip.dataset.group as Group;
  options[group].push(chip.dataset.value!);
  labels.set(`${group}:${chip.dataset.value}`, chip.textContent!.trim());
}

const list = (value: string | undefined) => (value ?? '').split('|').filter(Boolean);
// Recipes saved after the build are not in the prerendered grid. Add a card for each one the page does not have.
const grid = document.querySelector('#recipe-grid');
const template = document.querySelector<HTMLElement>('#recipe-grid article');
void fetch('/api/recipes')
  .then((response) => (response.ok ? response.json() : []))
  .then((saved: { id: string; name: string; meal: string; minutes: number; ingredients: string[]; photo?: string }[]) => {
    for (const recipe of saved) {
      if (document.querySelector(`article[data-id="${recipe.id}"]`) || !template || !grid) continue;
      const card = template.cloneNode(true) as HTMLElement;
      card.hidden = false;
      card.dataset.id = recipe.id;
      card.dataset.name = recipe.name;
      card.dataset.meal = recipe.meal;
      card.dataset.minutes = String(recipe.minutes);
      card.dataset.ingredients = (recipe.ingredients ?? []).join('|');
      const link = card.querySelector<HTMLAnchorElement>('a');
      if (link) { link.href = `/recipe/saved/${recipe.id}/`; link.textContent = recipe.name; }
      const letter = card.querySelector('.kk-tile-letter');
      if (letter) letter.textContent = recipe.name.charAt(0);
      card.querySelector('.kk-tile-photo')?.remove();
      if (recipe.photo) {
        const photo = document.createElement('img');
        photo.src = `/${recipe.photo}`;
        photo.alt = '';
        photo.loading = 'lazy';
        photo.decoding = 'async';
        photo.className = 'kk-tile-photo';
        letter?.after(photo);
      }
      grid.append(card);
    }
  });

const cards = [...document.querySelectorAll<HTMLElement>('#recipe-grid article')].map((el) => {
  const data: Searchable = {
    id: el.dataset.id ?? '',
    name: el.dataset.name ?? '',
    ingredients: list(el.dataset.ingredients),
    meal: el.dataset.meal ?? '',
    minutes: Number(el.dataset.minutes),
    diet: list(el.dataset.diet),
    sourceStated: el.hasAttribute('data-source-stated'),
  };
  return { el, data };
});

// The ratings buttons, picker, banner and Undo offer are drawn by ratings-ui.ts (shared with the recipe page).
const slot = mountUndoSlot({ bar: $('#undo-bar'), stack: $('#bottom-stack'), text: $('#undo-text'), button: $('#undo-button') });
const { controller } = mountRatings({ root: $('#recipe-grid'), cards: cards.map((c) => c.el), slot });
mountPlanSheet({ cards: cards.map((c) => c.el), names: new Map(cards.map((c) => [c.el.dataset.id!, c.el.dataset.name!])), slot });

let state: BrowseState = parseState(location.search, options);

const session = createSession(pageSession());
const here = () => location.pathname + serializeState(state, options);
// Remember this URL for the Recipes tab, and the scroll offset under this exact URL.
const remember = () => {
  session.saveRecipesUrl(here());
  session.saveScroll(here(), scrollY);
};
const restoreScroll = () => scrollTo(0, session.readScroll(here()));

function render(): void {
  const view = controller.view();
  const matches = new Set(filterRecipes(cards.map((c) => c.data), state, view.ratings));
  for (const card of cards) card.el.hidden = !matches.has(card.data);
  count.textContent = matches.size === 1 ? '1 recipe' : `${matches.size} recipes`;
  empty.hidden = matches.size > 0;
  if (matches.size === 0) emptyText.textContent = emptyMessage(state);
  if (input.value !== state.q) input.value = state.q;

  for (const chip of trayChips) {
    chip.setAttribute('aria-pressed', String(state[chip.dataset.group as Group].includes(chip.dataset.value!)));
  }

  // Reuse the buttons already in the row. Typing only changes the search, so rebuilding here
    // would throw away the focused chip and the click target on every keystroke.
    const wanted = GROUPS.flatMap((group) => state[group].map((value) => ({ group, value })));
    const have = [...chipsRow.querySelectorAll<HTMLButtonElement>('button')];
    const same =
      have.length === wanted.length &&
      wanted.every((w, i) => have[i].dataset.group === w.group && have[i].dataset.value === w.value);
    if (!same) {
      chipsRow.replaceChildren();
      for (const { group, value } of wanted) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'kk-chip kk-chip-on';
        chip.append(document.createTextNode(''));
        chip.dataset.group = group;
        chip.dataset.value = value;
        chip.insertAdjacentHTML(
          'beforeend',
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>',
        );
        chipsRow.append(chip);
      }
    }
    for (const chip of chipsRow.querySelectorAll<HTMLButtonElement>('button')) {
      const label = labels.get(`${chip.dataset.group}:${chip.dataset.value}`) ?? chip.dataset.value!;
      const paused = chip.dataset.group === 'who' && view.unavailable; // ratings cannot be read, so this filter is not applied
      chip.classList.toggle('kk-chip-paused', paused);
      if (paused) chip.dataset.paused = 'true';
      else delete chip.dataset.paused;
      chip.setAttribute('aria-label', paused ? `Remove filter: ${label} (paused until ratings load)` : `Remove filter: ${label}`);
      chip.firstChild!.textContent = paused ? `${label}, paused` : label;
    }
    chipsRow.hidden = wanted.length === 0;

  const active = activeFilterCount(state);
  filtersCount.textContent = String(active);
  filtersCount.hidden = active === 0;
  filtersButton.setAttribute('aria-label', active > 0 ? `Filters, ${active} active` : 'Filters');
  whoNote.textContent = view.unavailable ? 'Ratings unavailable: this filter is paused until they load.' : whoNoteText;
}

// replaceState everywhere: a tap or keystroke should not add a Back step, so Back leaves Recipes.
function commit(next: BrowseState): void {
  state = next;
  history.replaceState(history.state, '', location.pathname + serializeState(state, options));
  render();
  remember();
}

input.addEventListener('input', () => commit({ ...state, q: input.value }));
filtersButton.addEventListener('click', () => {
  // Drop the keyboard first, so the sheet and its Done button are not hidden behind it on iOS.
  input.blur();
  tray.showModal();
});
tray.addEventListener('click', (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-group]');
  if (chip) commit(toggleValue(state, chip.dataset.group as Group, chip.dataset.value!, options));
  if ((event.target as HTMLElement).closest('#clear-filters')) commit({ ...emptyState(), q: state.q });
});
chipsRow.addEventListener('click', (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-group]');
  if (chip) commit(toggleValue(state, chip.dataset.group as Group, chip.dataset.value!, options));
});
$('#clear-all').addEventListener('click', () => commit(emptyState()));

controller.subscribe(render);

// Normalise a hand-edited address once so every reload and shared link looks the same.
history.replaceState(history.state, '', location.pathname + serializeState(state, options));
render();

// Scroll: we restore it ourselves (per URL, in sessionStorage) after refresh, Back and tab switches.
history.scrollRestoration = 'manual';
let frame = 0;
addEventListener(
  'scroll',
  () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), remember()));
  },
  { passive: true },
);
addEventListener('pagehide', remember);
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  state = parseState(location.search, options);
  render();
  restoreScroll();
  void controller.refresh();
});
session.saveRecipesUrl(here());
restoreScroll();
// First load of the ratings; a shared "who" link only filters once they are in, so fix the scroll after.
void controller.init().then(() => state.who.length > 0 && restoreScroll());
