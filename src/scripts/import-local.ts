// The one-time copy from a phone's own storage into the shared store. Nothing moves until the person confirms,
// and a phone that already imported is not asked again. The old week held one recipe per day, which lands on dinner.
import type { StorageLike } from './phone-storage.ts';

export interface LocalCopy {
  ratings: { recipeId: string; person: string; value: string }[];
  dinners: { day: string; recipeId: string }[];
  ticks: { recipeId: string; itemId: string }[];
}

const IMPORTED = 'kk:imported';

const read = (storage: StorageLike, key: string): unknown => {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const localCopy = (storage: StorageLike): LocalCopy | null => {
  if (storage.getItem(IMPORTED)) return null;
  const ratingsRaw = read(storage, 'kk:ratings') as { entries?: Record<string, Record<string, { value: string | null }>> } | null;
  const weekRaw = read(storage, 'kk:week') as { entries?: Record<string, { recipeId: string | null }> } | null;
  const ticksRaw = read(storage, 'kk:ticks') as { ticks?: Record<string, string[]> } | null;

  const ratings = Object.entries(ratingsRaw?.entries ?? {}).flatMap(([recipeId, people]) =>
    Object.entries(people)
      .filter(([, entry]) => entry.value)
      .map(([person, entry]) => ({ recipeId, person, value: entry.value as string })),
  );
  const dinners = Object.entries(weekRaw?.entries ?? {})
    .filter(([, entry]) => entry.recipeId)
    .map(([day, entry]) => ({ day, recipeId: entry.recipeId as string }));
  const ticks = Object.entries(ticksRaw?.ticks ?? {}).flatMap(([recipeId, items]) => items.map((itemId) => ({ recipeId, itemId })));

  return ratings.length || dinners.length || ticks.length ? { ratings, dinners, ticks } : null;
};

export const markImported = (storage: StorageLike): void => storage.setItem(IMPORTED, '1');
