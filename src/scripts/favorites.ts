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

const { controller } = mountRatings({
  root: grid,
  cards,
  slot: mountUndoSlot({ bar: $('#undo-bar'), stack: $('#bottom-stack'), text: $('#undo-text'), button: $('#undo-button') }),
});

function showFavorites(): void {
  const { ratings } = controller.view();
  let shown = 0;
  for (const card of cards) {
    const keep = ratings !== null && isFamilyFavorite(ratings, card.dataset.id!);
    card.hidden = !keep;
    if (keep) shown += 1;
  }
  empty.hidden = shown > 0;
}

controller.subscribe(showFavorites);
showFavorites();
void controller.init();

mountPlanSheet({ cards, names: new Map(cards.map((el) => [el.dataset.id!, el.dataset.name!])) });
