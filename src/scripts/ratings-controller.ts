// The ratings behaviour without any DOM: who this phone is, what the store says, the Undo offer and
// the "Ratings unavailable" / Retry path. browse.ts only draws what view() says, so node:test can check it.

import { ratingOf, removedFamilyFavorite, type Person, type Rating, type Ratings } from './ratings.ts';
import type { RatingsStore } from './ratings-store.ts';

export interface UndoInfo {
  id: string;
  person: Person;
  /** What to put back: the rating before the change that removed the Family favorite. */
  previous: Rating | null;
}

export interface RatingsView {
  /** null while unavailable (never loaded, or a load/save failed): filters then ignore ratings. */
  ratings: Ratings | null;
  unavailable: boolean;
  me: Person | null;
  undo: UndoInfo | null;
}

interface Identity {
  get(): Person | null;
  set(person: Person): void;
}

export function createRatingsController({ store, identity }: { store: RatingsStore; identity: Identity }) {
  let data: Ratings | null = null;
  let unavailable = false;
  let me: Person | null = identity.get();
  let undo: UndoInfo | null = null;
  // The operation that last failed, so Retry repeats exactly it (a lost tap is not silently dropped).
  let pending: (() => Promise<void>) | null = null;
  let chain: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  const attempt = async (op: () => Promise<void>): Promise<void> => {
    try {
      await op();
      pending = null;
      unavailable = false;
    } catch {
      pending = op;
      unavailable = true;
    }
    emit();
  };
  // One at a time, in tap order, so quick taps never race each other.
  const enqueue = (op: () => Promise<void>): Promise<void> => (chain = chain.then(() => attempt(op)));

  const loadOp = async () => {
    data = await store.load();
  };

  return {
    view: (): RatingsView => ({ ratings: unavailable ? null : data, unavailable, me, undo }),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    init: () => enqueue(loadOp),
    /** Reload from the store (page shown again, another tab changed it). Does not paper over a failure. */
    refresh: () => (unavailable ? Promise.resolve() : enqueue(loadOp)),
    retry: () => enqueue(pending ?? loadOp),
    setMe(person: Person): void {
      identity.set(person);
      me = person;
      undo = null;
      emit();
    },
    /** Tap a rating button: the same rating again clears it. Needs a chosen person and a working store. */
    tap(id: string, rating: Rating): Promise<void> {
      const person = me;
      if (!person || unavailable) return Promise.resolve();
      return enqueue(async () => {
        const before = await store.load();
        const current = ratingOf(before, id, person);
        const after = await store.set(id, person, current === rating ? null : rating);
        data = after;
        undo = removedFamilyFavorite(before, after, id) ? { id, person, previous: current } : null;
      });
    },
    undo(): Promise<void> {
      const offer = undo;
      if (!offer) return Promise.resolve();
      return enqueue(async () => {
        data = await store.set(offer.id, offer.person, offer.previous);
        undo = null;
      });
    },
    dismissUndo(): void {
      undo = null;
      emit();
    },
  };
}
