// Which ingredients are ticked off, per recipe, on THIS phone. By design nothing here is ever shared with another phone
// (see docs/ticks-store-notes.md), so there is no timestamp and no server shape: just the ticked item ids per recipe
// under one localStorage key. Every write re-reads the saved data and changes only what it means to change, so a second
// tab ticking a different item is never overwritten.
import type { StorageLike } from './phone-storage.ts';
import { isValidId } from './ratings.ts';

export const TICKS_KEY = 'kk:ticks';

/** Saved data cannot be read or written (blocked storage, private mode, full). */
export class TicksUnavailableError extends Error {
  constructor(message = 'Ingredient checks unavailable') {
    super(message);
    this.name = 'TicksUnavailableError';
  }
}

const ITEM_ID = /^[a-z][a-z0-9-]{0,39}$/;
const isItemId = (value: unknown): value is string => typeof value === 'string' && ITEM_ID.test(value);

type Saved = Record<string, string[]>;

export interface TicksStore {
  /** The ticked item ids of one recipe. Throws TicksUnavailableError when storage cannot be read. */
  read(recipeId: string): string[];
  /** Tick or untick one item. Returns the merged ticked ids. */
  set(recipeId: string, itemId: string, checked: boolean): string[];
  /** Untick everything for the recipe. Returns what was ticked, so Undo can put it back. */
  clear(recipeId: string): string[];
  /** Tick these items too (Undo, and Retry). Returns the merged ticked ids. */
  add(recipeId: string, itemIds: readonly string[]): string[];
}

export function createTicksStore({ storage, key = TICKS_KEY }: { storage: StorageLike; key?: string }): TicksStore {
  const readAll = (): Saved => {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      throw new TicksUnavailableError();
    }
    if (raw === null) return Object.create(null);
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !parsed.ticks || typeof parsed.ticks !== 'object' || Array.isArray(parsed.ticks)) return Object.create(null);
      const clean: Saved = Object.create(null);
      for (const [recipeId, ids] of Object.entries(parsed.ticks)) {
        if (!isValidId(recipeId) || !Array.isArray(ids)) continue;
        const kept = [...new Set(ids.filter(isItemId))];
        if (kept.length > 0) clean[recipeId] = kept;
      }
      return clean;
    } catch {
      return Object.create(null); // garbled or an unknown version: treated as empty, never as an error
    }
  };
  const writeAll = (all: Saved): void => {
    try {
      storage.setItem(key, JSON.stringify({ v: 1, ticks: all }));
    } catch {
      throw new TicksUnavailableError();
    }
  };
  const checkRecipe = (recipeId: string) => {
    if (!isValidId(recipeId)) throw new TypeError(`bad recipe id: ${String(recipeId)}`);
  };
  const checkItems = (ids: readonly string[]) => {
    for (const id of ids) if (!isItemId(id)) throw new TypeError(`bad item id: ${String(id)}`);
  };
  const change = (recipeId: string, edit: (ids: Set<string>) => void): string[] => {
    const all = readAll();
    const ids = new Set(all[recipeId] ?? []);
    edit(ids);
    if (ids.size > 0) all[recipeId] = [...ids];
    else delete all[recipeId];
    writeAll(all);
    return [...ids];
  };

  return {
    read(recipeId) {
      checkRecipe(recipeId);
      return readAll()[recipeId] ?? [];
    },
    set(recipeId, itemId, checked) {
      checkRecipe(recipeId);
      checkItems([itemId]);
      return change(recipeId, (ids) => (checked ? ids.add(itemId) : ids.delete(itemId)));
    },
    clear(recipeId) {
      checkRecipe(recipeId);
      const before = readAll()[recipeId] ?? [];
      change(recipeId, (ids) => ids.clear());
      return before;
    },
    add(recipeId, itemIds) {
      checkRecipe(recipeId);
      checkItems(itemIds);
      return change(recipeId, (ids) => itemIds.forEach((id) => ids.add(id)));
    },
  };
}
