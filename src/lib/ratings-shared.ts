// Shared ratings. Each person has one rating per recipe, and it is the same on every device. Only "loved"
// counts toward a list: Ed's loved, Kristina's loved, and Family favorites where both loved it.
import type { D1Database } from '@cloudflare/workers-types';
import { PEOPLE, RATINGS, isFamilyFavorite, ratingOf, type Person, type Rating, type Ratings } from '../scripts/ratings.ts';
import { ensureRecipe } from './recipes-row.ts';

export interface RatingLists {
  ed: string[];
  kristina: string[];
  family: string[];
}

const listsOf = (ratings: Ratings, ids: readonly string[]): RatingLists => ({
  ed: ids.filter((id) => ratingOf(ratings, id, 'ed') === 'loved'),
  kristina: ids.filter((id) => ratingOf(ratings, id, 'kristina') === 'loved'),
  family: ids.filter((id) => isFamilyFavorite(ratings, id)),
});

export const createSharedRatings = (db: D1Database) => {
  const load = async (): Promise<Ratings> => {
    const { results } = await db.prepare('SELECT recipe_id, person, value FROM ratings').bind().all<{ recipe_id: string; person: Person; value: Rating }>();
    const out: Ratings = {};
    for (const row of results) (out[row.recipe_id] ??= {})[row.person] = { value: row.value, at: 0 };
    return out;
  };

  return {
    load,
    async lists(ids: readonly string[]): Promise<RatingLists> {
      return listsOf(await load(), ids);
    },
    async set(recipeId: string, person: Person, value: Rating | null): Promise<Ratings> {
      if (!(PEOPLE as readonly string[]).includes(person)) throw new TypeError('bad person');
      if (value !== null && !(RATINGS as readonly string[]).includes(value)) throw new TypeError('bad rating');
      await ensureRecipe(db, recipeId);
      if (value === null) await db.prepare('DELETE FROM ratings WHERE recipe_id = ? AND person = ?').bind(recipeId, person).run();
      else await db.prepare('INSERT OR REPLACE INTO ratings (recipe_id, person, value, at) VALUES (?, ?, ?, ?)').bind(recipeId, person, value, new Date().toISOString()).run();
      return load();
    },
  };
};
