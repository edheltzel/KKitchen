// The ticks of ONE recipe, shared by the recipe page and cooking mode. What is on screen is kept in memory, so a tick always
// shows even when the phone refuses to save it; then the view says `unavailable` (a banner with Retry, like ratings and the
// week plan) and Retry saves what is on screen. Reset and the Undo that follows go through the shared Undo slot.
import { TicksUnavailableError, type TicksStore } from './ticks-store.ts';
import type { UndoOffer } from './undo-slot.ts';

export interface TicksView {
  checked: ReadonlySet<string>;
  /** The phone could not read or save the checks; they last until this page closes unless Retry works. */
  unavailable: boolean;
}

export interface TicksControllerOptions {
  store: TicksStore;
  recipeId: string;
  /** Every item id this recipe has: anything else saved is ignored. */
  itemIds: readonly string[];
  slot: { offer(offer: UndoOffer): void };
}

export function createTicksController({ store, recipeId, itemIds, slot }: TicksControllerOptions) {
  const known = new Set(itemIds);
  let checked = new Set<string>();
  let unavailable = false;
  let loaded = false; // false until the saved checks were read once
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((fn) => fn());
  const mine = (ids: readonly string[]) => new Set(ids.filter((id) => known.has(id)));
  const attempt = (save: () => string[] | void): void => {
    try {
      const merged = save();
      if (merged) checked = mine(merged);
      unavailable = false;
    } catch (error) {
      if (!(error instanceof TicksUnavailableError)) throw error;
      unavailable = true;
    }
  };

  const api = {
    view(): TicksView {
      return { checked: new Set(checked), unavailable };
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    init(): void {
      try {
        checked = mine(store.read(recipeId));
        loaded = true;
        unavailable = false;
      } catch (error) {
        if (!(error instanceof TicksUnavailableError)) throw error;
        unavailable = true;
      }
      changed();
    },
    /** Re-read after another tab or a returning page may have changed them. Does nothing while unsaved checks are on screen. */
    refresh(): void {
      if (unavailable) return;
      api.init();
    },
    toggle(itemId: string): void {
      if (!known.has(itemId)) return;
      const on = !checked.has(itemId);
      if (on) checked.add(itemId);
      else checked.delete(itemId);
      if (unavailable) return changed(); // already known to be unsaved: Retry saves the whole screen
      attempt(() => store.set(recipeId, itemId, on));
      changed();
    },
    /** Untick everything and offer Undo. Returns false when nothing was ticked. */
    reset({ text = 'Checks cleared' }: { text?: string } = {}): boolean {
      if (checked.size === 0) return false;
      const before = [...checked];
      checked = new Set();
      if (!unavailable) attempt(() => void store.clear(recipeId));
      changed();
      slot.offer({
        text,
        run: () => {
          before.forEach((id) => checked.add(id));
          if (!unavailable) attempt(() => store.add(recipeId, before));
          changed();
        },
        drop: () => {},
      });
      return true;
    },
    /** Save what is on screen (and, if the saved checks were never read, keep those too). */
    retry(): void {
      attempt(() => {
        if (!loaded) {
          store.read(recipeId).forEach((id) => known.has(id) && checked.add(id));
          loaded = true;
        }
        store.clear(recipeId);
        return store.add(recipeId, [...checked]);
      });
      changed();
    },
  };
  return api;
}
