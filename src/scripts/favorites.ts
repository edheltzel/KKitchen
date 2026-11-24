// Favorites page: a Family favorite is a recipe both people rated Loved it.
// Cards for every approved recipe are in the markup, hidden until ratings load.
// Text goes through textContent only.
import { isFamilyFavorite } from './ratings';
import { mountRatings } from './ratings-ui';
import { mountUndoSlot } from './undo-mount';
import { mountPlanSheet } from './plan-ui';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const grid = $('#recipe-grid');
const empty = $('#empty');
const cards = [...grid.querySelectorAll<HTMLElement>('article[data-id]')];

const slot = mountUndoSlot({ bar: $('#undo-bar'), stack: $('#bottom-stack'), text: $('#undo-text'), button: $('#undo-button') });
const { controller } = mountRatings({ root: grid, cards, slot });

type ListName = 'family' | 'ed' | 'kristina';
let lists: Record<ListName, string[]> = { family: [], ed: [], kristina: [] };
let current: ListName = 'family';

async function loadLists(): Promise<void> {
  const response = await fetch('/api/lists');
  if (response.ok) lists = await response.json();
  showFavorites();
}

function showFavorites(): void {
  const { ratings } = controller.view();
  const shared = lists[current];
  let shown = 0;
  for (const card of cards) {
    const id = card.dataset.id!;
    const keep = shared.length > 0 ? shared.includes(id) : ratings !== null && current === 'family' && isFamilyFavorite(ratings, id);
    card.hidden = !keep;
    if (keep) shown += 1;
  }
  empty.hidden = shown > 0;
}

document.querySelector('#lists')?.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-list]');
  if (!button) return;
  current = button.dataset.list as ListName;
  for (const chip of document.querySelectorAll<HTMLButtonElement>('#lists button')) chip.setAttribute('aria-pressed', String(chip === button));
  showFavorites();
});

controller.subscribe(() => void loadLists());
showFavorites();
void controller.init();
void loadLists();

mountPlanSheet({ cards, names: new Map(cards.map((el) => [el.dataset.id!, el.dataset.name!])), slot });
