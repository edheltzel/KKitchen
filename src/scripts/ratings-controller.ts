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
  // Operations that failed, in tap order. While this list is not empty nothing new runs: later taps wait
  // behind it, and Retry replays the whole list in order, so no tap is lost or applied out of order.
  interface Op {
    kind: 'load' | 'write';
    run: () => Promise<void>;
  }
  let failed: Op[] = [];
  let chain: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  const fail = (ops: Op[]): void => {
    failed = ops;
    unavailable = true;
    undo = null; // an Undo offer next to "Ratings unavailable" would be stale, and Retry is what matters then
  };
  const attempt = async (op: Op): Promise<void> => {
    if (unavailable) {
      if (op.kind === 'write') failed.push(op); // wait behind the failed ones
    } else {
      try {
        await op.run();
      } catch {
        fail([op]);
      }
    }
    emit();
  };
  // One at a time, in tap order, so quick taps never race each other.
  const enqueue = (op: Op): Promise<void> => (chain = chain.then(() => attempt(op)));

  const loadOp: Op = {
    kind: 'load',
    run: async () => {
      data = await store.load();
    },
  };
  const replay = async (): Promise<void> => {
    const todo = failed.length ? [...failed] : [loadOp];
    for (let i = 0; i < todo.length; i++) {
      try {
        await todo[i].run();
      } catch {
        fail(todo.slice(i)); // the one that failed again and everything behind it, still in order
        emit();
        return;
      }
    }
    failed = [];
    unavailable = false;
    emit();
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
    retry: () => (chain = chain.then(replay)),
    setMe(person: Person): void {
      identity.set(person);
      me = person;
      undo = null;
      emit();
    },
    /** Tap a rating button: the same rating again clears it. Needs a chosen person. While the store is failing the tap waits for Retry. */
    tap(id: string, rating: Rating): Promise<void> {
      const person = me;
      if (!person) return Promise.resolve();
      const run = async () => {
        const before = await store.load();
        const current = ratingOf(before, id, person);
        const after = await store.set(id, person, current === rating ? null : rating);
        data = after;
        undo = removedFamilyFavorite(before, after, id) ? { id, person, previous: current } : null;
      };
      return enqueue({ kind: 'write', run });
    },
    undo(): Promise<void> {
      const offer = undo;
      if (!offer) return Promise.resolve();
      const run = async () => {
        data = await store.set(offer.id, offer.person, offer.previous);
        undo = null;
      };
      return enqueue({ kind: 'write', run });
    },
    dismissUndo(): void {
      undo = null;
      emit();
    },
  };
}
