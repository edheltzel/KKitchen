// The week plan store interface, and the LOCAL STAND-IN behind it (same idea as ratings-store.ts).
//
// The future real store (a Cloudflare Worker + D1 shared by both phones) is NOT built or called here. It
// will implement the same WeekPlanStore shape: load() and set(day, recipeId | null). The server will also
// check what this stand-in checks: valid days, valid recipe ids only, and one dinner per day (one entry
// per day). Every set() re-reads the saved plan, merges that one day (last writer wins by timestamp) and
// writes back; a removal is kept as an empty entry with a time, so it beats older data on another phone.

import { isValidId } from './ratings.ts';
import { isValidDay, mergePlans, sanitizePlan, type Plan } from './week-plan.ts';
import type { StorageLike } from './phone-storage.ts';

export const WEEK_KEY = 'kk:week';

export interface WeekPlanStore {
  /** The current merged plan. Rejects with WeekPlanUnavailableError when the store cannot be read. */
  load(): Promise<Plan>;
  /** Plan one dinner for one day, or clear the day with null. Resolves with the merged plan. */
  set(day: string, recipeId: string | null): Promise<Plan>;
}

export class WeekPlanUnavailableError extends Error {
  constructor(message = 'Week plan unavailable') {
    super(message);
    this.name = 'WeekPlanUnavailableError';
  }
}

interface LocalWeekStoreOptions {
  storage: StorageLike;
  key?: string;
  /** Injectable clock (milliseconds). */
  now?: () => number;
  /** Injectable failure mode for tests: flip a flag and that operation rejects as unavailable. */
  failures?: { load?: boolean; save?: boolean };
  /** When given, only these recipes can be planned (what the server will do). */
  knownRecipeIds?: ReadonlySet<string>;
}

export function createLocalWeekStore(options: LocalWeekStoreOptions): WeekPlanStore {
  const { storage, key = WEEK_KEY, now = Date.now, failures = {}, knownRecipeIds } = options;
  // The last timestamp this phone used for each day, so quick changes always move forward.
  const lastAt = new Map<string, number>();

  const read = (): Plan => {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      throw new WeekPlanUnavailableError();
    }
    if (raw === null) return {};
    try {
      const parsed = JSON.parse(raw);
      // A garbled or unknown-version value is treated as empty, never as an error.
      return parsed && parsed.v === 1 ? sanitizePlan(parsed.entries) : {};
    } catch {
      return {};
    }
  };

  return {
    async load() {
      if (failures.load) throw new WeekPlanUnavailableError();
      return read();
    },
    async set(day, recipeId) {
      if (!isValidDay(day)) throw new TypeError(`bad day: ${String(day)}`);
      if (recipeId !== null && !isValidId(recipeId)) throw new TypeError(`bad recipe id: ${String(recipeId)}`);
      if (recipeId !== null && knownRecipeIds && !knownRecipeIds.has(recipeId)) throw new TypeError(`unknown recipe id: ${recipeId}`);
      if (failures.save) throw new WeekPlanUnavailableError();

      const at = Math.max(Math.floor(now()), (lastAt.get(day) ?? 0) + 1);
      const merged = mergePlans(read(), { [day]: { recipeId, at } });
      try {
        storage.setItem(key, JSON.stringify({ v: 1, entries: merged }));
      } catch {
        throw new WeekPlanUnavailableError();
      }
      lastAt.set(day, at);
      return merged;
    },
  };
}
