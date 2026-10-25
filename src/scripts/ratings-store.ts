// The ratings store interface, and the LOCAL STAND-IN behind it.
//
// The future real store (a Cloudflare Worker + D1 shared by both phones) is NOT built or called here.
// It will implement the same RatingsStore shape: load() and set(). The stand-in keeps everything in the
// phone's localStorage under one key, so on its own it cannot sync two phones. It still behaves like the
// real thing where it matters: every set() re-reads the saved data, merges per recipe + person
// (last writer wins by timestamp) and writes back, so an edit never overwrites the other person's entry.
// Tests simulate two phones by giving two store instances one shared backing.

import {
  PEOPLE,
  RATINGS,
  isValidId,
  mergeRatings,
  sanitizeRatings,
  type Person,
  type Rating,
  type Ratings,
} from './ratings.ts';
import type { StorageLike } from './browse-state.ts';

export const RATINGS_KEY = 'kk:ratings';
export const IDENTITY_KEY = 'kk:me';

export interface RatingsStore {
  /** The current merged ratings. Rejects with RatingsUnavailableError when the store cannot be read. */
  load(): Promise<Ratings>;
  /** Save one person's rating for one recipe (null clears it). Resolves with the merged ratings. */
  set(recipeId: string, person: Person, value: Rating | null): Promise<Ratings>;
}

export class RatingsUnavailableError extends Error {
  constructor(message = 'Ratings unavailable') {
    super(message);
    this.name = 'RatingsUnavailableError';
  }
}

export interface LocalStoreOptions {
  storage: StorageLike;
  key?: string;
  /** Injectable clock (milliseconds). */
  now?: () => number;
  /** Injectable failure mode for tests: flip a flag and that operation rejects as unavailable. */
  failures?: { load?: boolean; save?: boolean };
}

export function createLocalRatingsStore(options: LocalStoreOptions): RatingsStore {
  const { storage, key = RATINGS_KEY, now = Date.now, failures = {} } = options;
  // The last timestamp this phone used for each recipe + person, so quick taps always move forward.
  const lastAt = new Map<string, number>();

  const read = (): Ratings => {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      throw new RatingsUnavailableError();
    }
    if (raw === null) return {};
    try {
      const parsed = JSON.parse(raw);
      // A garbled or unknown-version value is treated as empty, never as an error.
      return parsed && parsed.v === 1 ? sanitizeRatings(parsed.entries) : {};
    } catch {
      return {};
    }
  };

  return {
    async load() {
      if (failures.load) throw new RatingsUnavailableError();
      return read();
    },
    async set(recipeId, person, value) {
      if (!isValidId(recipeId)) throw new TypeError(`bad recipe id: ${String(recipeId)}`);
      if (!(PEOPLE as readonly string[]).includes(person)) throw new TypeError(`bad person: ${String(person)}`);
      if (value !== null && !(RATINGS as readonly unknown[]).includes(value)) throw new TypeError(`bad rating: ${String(value)}`);
      if (failures.save) throw new RatingsUnavailableError();

      const slot = `${recipeId}/${person}`;
      const at = Math.max(Math.floor(now()), (lastAt.get(slot) ?? 0) + 1);
      const merged = mergeRatings(read(), { [recipeId]: { [person]: { value, at } } });
      try {
        storage.setItem(key, JSON.stringify({ v: 1, entries: merged }));
      } catch {
        throw new RatingsUnavailableError();
      }
      lastAt.set(slot, at);
      return merged;
    },
  };
}

/** Which person this phone is. Remembered in localStorage; a missing or odd value means "not chosen yet". */
export function createIdentity(storage: StorageLike, key = IDENTITY_KEY) {
  return {
    get(): Person | null {
      try {
        const value = storage.getItem(key);
        return (PEOPLE as readonly string[]).includes(value ?? '') ? (value as Person) : null;
      } catch {
        return null;
      }
    },
    set(person: Person): void {
      if (!(PEOPLE as readonly string[]).includes(person)) throw new TypeError(`bad person: ${String(person)}`);
      try {
        storage.setItem(key, person);
      } catch {
        // Storage blocked: the choice just lasts until the page closes.
      }
    },
  };
}
