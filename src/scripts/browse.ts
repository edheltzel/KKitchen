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
import { PERSON_LABEL, PEOPLE, RATING_LABEL, isFamilyFavorite, ratingOf, type Person, type Rating } from './ratings';
import { RATINGS_KEY, createIdentity, createLocalRatingsStore } from './ratings-store';
import { createRatingsController } from './ratings-controller';
import { phoneStorage } from './phone-storage';
import { createUndoBar } from './undo-bar';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const input = $<HTMLInputElement>('#search-input');
const tray = $<HTMLDialogElement>('#filter-tray');
const filtersButton = $<HTMLButtonElement>('#filters-button');
const filtersCount = $('#filters-count');
const count = $('#recipe-count');
const chipsRow = $('#chips');
const empty = $('#empty');
const emptyText = $('#empty-message');
const meButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-me]')];
const meHint = $('#me-hint');
const unavailableBar = $('#ratings-unavailable');
const whoNote = $('#who-note');
const whoNoteText = whoNote.textContent ?? '';

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
    id: el.dataset.id ?? '',
    name: el.dataset.name ?? '',
    ingredients: list(el.dataset.ingredients),
    meal: el.dataset.meal ?? '',
    minutes: Number(el.dataset.minutes),
    diet: list(el.dataset.diet),
  };
  return {
    el,
    data,
    badge: el.querySelector<HTMLElement>('[data-role="family-badge"]')!,
    buttons: [...el.querySelectorAll<HTMLButtonElement>('button[data-rating]')],
    lines: PEOPLE.map((person) => ({ person, el: el.querySelector<HTMLElement>(`[data-person="${person}"]`)! })),
  };
});

// Ratings live in a local stand-in store (this phone's localStorage). The future shared store plugs in
// behind the same RatingsStore shape. Blocked storage reads as empty and refuses saves, which shows as
// "Ratings unavailable" rather than silently losing a tap.
const ratingsStorage = phoneStorage();
const undoBar = createUndoBar({ bar: $('#undo-bar'), stack: $('#bottom-stack'), expire: () => controller.dismissUndo() });
const controller = createRatingsController({
  store: createLocalRatingsStore({ storage: ratingsStorage }),
  identity: createIdentity(ratingsStorage),
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

  chipsRow.replaceChildren();
  for (const group of GROUPS) {
    for (const value of state[group]) {
      const label = labels.get(`${group}:${value}`) ?? value;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'kk-chip kk-chip-on';
      chip.dataset.group = group;
      chip.dataset.value = value;
      const paused = group === 'who' && view.unavailable; // ratings cannot be read, so this filter is not applied
      if (paused) {
        chip.classList.add('kk-chip-paused');
        chip.dataset.paused = 'true';
      }
      chip.setAttribute('aria-label', paused ? `Remove filter: ${label} (paused until ratings load)` : `Remove filter: ${label}`);
      chip.textContent = paused ? `${label}, paused` : label;
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
  renderRatings(view);
}

// Draws what the controller says: statuses, pressed buttons, badges, picker, banner and Undo bar.
// Everything here is a fixed label or a rating value from a fixed list, set through textContent.
function renderRatings(view: ReturnType<typeof controller.view>): void {
  const { ratings, me, unavailable } = view;
  for (const card of cards) {
    const id = card.data.id!;
    for (const line of card.lines) {
      const value = ratings ? ratingOf(ratings, id, line.person) : null;
      line.el.textContent = `${PERSON_LABEL[line.person]}: ${unavailable ? 'unavailable' : value ? RATING_LABEL[value] : 'not rated yet'}`;
    }
    for (const button of card.buttons) {
      const mine = me && ratings ? ratingOf(ratings, id, me) : null;
      button.setAttribute('aria-pressed', String(mine === button.dataset.rating));
      button.disabled = unavailable; // with nobody picked a tap leads to the picker instead
    }
    card.badge.hidden = !(ratings && isFamilyFavorite(ratings, id));
  }
  for (const button of meButtons) button.setAttribute('aria-pressed', String(button.dataset.me === me));
  meHint.hidden = me !== null;
  if (me !== null) meHint.dataset.nudge = 'off';
  unavailableBar.hidden = !unavailable;
  whoNote.textContent = unavailable ? 'Ratings unavailable: this filter is paused until they load.' : whoNoteText;
  undoBar.show(view.undo);
}

// A rating tap with nobody picked: take them to the picker and point at the hint. Nothing is saved.
// The card they tapped is remembered, so picking a person takes them back to it.
let tappedCard: HTMLElement | null = null;
function nudgePicker(card: HTMLElement): void {
  tappedCard = card;
  meHint.dataset.nudge = 'on';
  $('#me-picker').scrollIntoView({ block: 'center' });
  meButtons[0]?.focus({ preventScroll: true });
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

$('#recipe-grid').addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-rating]');
  const card = button?.closest<HTMLElement>('article');
  const id = card?.dataset.id;
  if (!button || !card || !id) return;
  if (controller.view().me === null) return nudgePicker(card);
  void controller.tap(id, button.dataset.rating as Rating);
});
for (const button of meButtons) {
  button.addEventListener('click', () => {
    controller.setMe(button.dataset.me as Person);
    if (tappedCard?.isConnected && !tappedCard.hidden) tappedCard.scrollIntoView({ block: 'center' }); // back to where they were
    tappedCard = null;
  });
}
$('#ratings-retry').addEventListener('click', () => void controller.retry());
$('#undo-button').addEventListener('click', () => void controller.undo());
controller.subscribe(render);
// Another tab, or coming back to the app, may have changed the ratings.
addEventListener('storage', (event) => event.key === RATINGS_KEY && void controller.refresh());
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void controller.refresh());

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
