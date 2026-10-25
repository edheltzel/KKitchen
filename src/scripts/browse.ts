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

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const input = $<HTMLInputElement>('#search-input');
const tray = $<HTMLDialogElement>('#filter-tray');
const filtersButton = $<HTMLButtonElement>('#filters-button');
const filtersCount = $('#filters-count');
const count = $('#recipe-count');
const chipsRow = $('#chips');
const empty = $('#empty');
const emptyText = $('#empty-message');

// Filter options and their labels come from the tray markup, which is built from approved data only.
const options: Options = { meal: [], time: [], diet: [], who: [] };
const labels = new Map<string, string>();
const trayChips = [...tray.querySelectorAll<HTMLButtonElement>('button[data-group]')];
for (const chip of trayChips) {
  const group = chip.dataset.group as Group;
  options[group].push(chip.dataset.value!);
  labels.set(`${group}:${chip.dataset.value}`, chip.textContent!.trim());
}

const list = (value: string | undefined) => (value ?? '').split('|').filter(Boolean);
const cards = [...document.querySelectorAll<HTMLElement>('#recipe-grid article')].map((el) => {
  const data: Searchable = {
    name: el.dataset.name ?? '',
    ingredients: list(el.dataset.ingredients),
    meal: el.dataset.meal ?? '',
    minutes: Number(el.dataset.minutes),
    diet: list(el.dataset.diet),
  };
  return { el, data };
});

let state: BrowseState = parseState(location.search, options);

function pageStorage(): Storage {
  try {
    return window.sessionStorage;
  } catch {
    // Storage blocked (private mode): the page still works, it just forgets scroll and tab state.
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage;
  }
}
const session = createSession(pageStorage());
const here = () => location.pathname + serializeState(state, options);
// Remember this URL for the Recipes tab, and the scroll offset under this exact URL.
const remember = () => {
  session.saveRecipesUrl(here());
  session.saveScroll(here(), scrollY);
};
const restoreScroll = () => scrollTo(0, session.readScroll(here()));

function render(): void {
  const matches = new Set(filterRecipes(cards.map((c) => c.data), state));
  for (const card of cards) card.el.hidden = !matches.has(card.data);
  count.textContent = matches.size === 1 ? '1 recipe' : `${matches.size} recipes`;
  empty.hidden = matches.size > 0;
  if (matches.size === 0) emptyText.textContent = emptyMessage(state);
  if (input.value !== state.q) input.value = state.q;

  for (const chip of trayChips) {
    chip.setAttribute('aria-pressed', String(state[chip.dataset.group as Group].includes(chip.dataset.value!)));
  }

  chipsRow.replaceChildren();
  for (const group of GROUPS) {
    for (const value of state[group]) {
      const label = labels.get(`${group}:${value}`) ?? value;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'kk-chip kk-chip-on';
      chip.dataset.group = group;
      chip.dataset.value = value;
      chip.setAttribute('aria-label', `Remove filter: ${label}`);
      chip.textContent = label;
      chip.insertAdjacentHTML(
        'beforeend',
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>',
      );
      chipsRow.append(chip);
    }
  }
  chipsRow.hidden = chipsRow.childElementCount === 0;

  const active = activeFilterCount(state);
  filtersCount.textContent = String(active);
  filtersCount.hidden = active === 0;
  filtersButton.setAttribute('aria-label', active > 0 ? `Filters, ${active} active` : 'Filters');
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
});
session.saveRecipesUrl(here());
restoreScroll();
