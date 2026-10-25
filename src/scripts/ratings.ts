// Ratings model: pure, no DOM and no storage, so node:test can run it.
// Two people rate each recipe. "Family favorite" is never stored: it is derived (both said Loved it).
// Every stored rating is an Entry with a timestamp, so two phones merge per recipe + person.

export const PEOPLE = ['ed', 'kristina'] as const;
export type Person = (typeof PEOPLE)[number];
export const PERSON_LABEL: Record<Person, string> = { ed: 'Ed', kristina: 'Kristina' };

export const RATINGS = ['loved', 'not-for-us'] as const;
export type Rating = (typeof RATINGS)[number];
export const RATING_LABEL: Record<Rating, string> = { loved: 'Loved it', 'not-for-us': 'Not for us' };

/** value null = cleared. A cleared entry is kept (a tombstone) so a clear on one phone beats an older rating on another. */
export interface Entry {
  value: Rating | null;
  /** Milliseconds; the larger one wins when two phones edited the same recipe + person. */
  at: number;
}
export type Ratings = Record<string, Partial<Record<Person, Entry>>>;

/** The values of the "Who liked it" filter group. */
export type Liked = 'favorite' | 'ed' | 'kristina' | 'untried';

const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export const isValidId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9][\w-]{0,63}$/.test(id);

export function ratingOf(ratings: Ratings, id: string, person: Person): Rating | null {
  if (!has(ratings, id)) return null;
  return ratings[id]?.[person]?.value ?? null;
}

export const isFamilyFavorite = (ratings: Ratings, id: string): boolean =>
  PEOPLE.every((person) => ratingOf(ratings, id, person) === 'loved');

export function likedBy(ratings: Ratings, id: string): Set<Liked> {
  const out = new Set<Liked>();
  if (ratingOf(ratings, id, 'ed') === 'loved') out.add('ed');
  if (ratingOf(ratings, id, 'kristina') === 'loved') out.add('kristina');
  if (isFamilyFavorite(ratings, id)) out.add('favorite');
  if (PEOPLE.every((person) => ratingOf(ratings, id, person) === null)) out.add('untried');
  return out;
}

/** True when going from `before` to `after` takes a Family favorite away (the cue to offer Undo). */
export const removedFamilyFavorite = (before: Ratings, after: Ratings, id: string): boolean =>
  isFamilyFavorite(before, id) && !isFamilyFavorite(after, id);

// Newer time wins. Equal times pick a fixed winner so merging in either order gives the same result.
const rank = (entry: Entry): string => entry.value ?? '';
function newer(a: Entry, b: Entry): Entry {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return rank(a) >= rank(b) ? a : b;
}

export function mergeRatings(a: Ratings, b: Ratings): Ratings {
  const out: Ratings = {};
  for (const source of [a, b]) {
    for (const id of Object.keys(source)) {
      const slot = (out[id] ??= {});
      for (const person of PEOPLE) {
        const entry = source[id]?.[person];
        if (!entry) continue;
        const current = slot[person];
        slot[person] = current ? newer(current, entry) : { value: entry.value, at: entry.at };
      }
    }
  }
  return out;
}

const cleanEntry = (raw: unknown): Entry | null => {
  if (!raw || typeof raw !== 'object') return null;
  const { value, at } = raw as { value?: unknown; at?: unknown };
  if (value !== null && !(RATINGS as readonly unknown[]).includes(value)) return null;
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) return null;
  return { value: value as Rating | null, at: Math.floor(at) };
};

/** Anything that is not a well-formed ratings object is dropped, never trusted. */
export function sanitizeRatings(raw: unknown): Ratings {
  const out: Ratings = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const id of Object.keys(raw)) {
    if (!isValidId(id)) continue;
    const person = (raw as Record<string, unknown>)[id];
    if (!person || typeof person !== 'object') continue;
    const slot: Ratings[string] = {};
    for (const p of PEOPLE) {
      const entry = has(person, p) ? cleanEntry((person as Record<string, unknown>)[p]) : null;
      if (entry) slot[p] = entry;
    }
    if (Object.keys(slot).length) out[id] = slot;
  }
  return out;
}
