// Shared ticks, per recipe and per person. Ed's two devices see the same ticks. Kristina's stay hers.
import type { D1Database } from '@cloudflare/workers-types';
import type { Person } from '../scripts/ratings.ts';
import { ensureRecipe } from './recipes-row.ts';

export const createSharedTicks = (db: D1Database) => {
  const read = async (recipeId: string, person: Person): Promise<string[]> => {
    const { results } = await db
      .prepare('SELECT item_id FROM ticks WHERE recipe_id = ? AND person = ?')
      .bind(recipeId, person)
      .all<{ item_id: string }>();
    return results.map((row) => row.item_id);
  };

  return {
    read,
    async set(recipeId: string, person: Person, itemId: string, checked: boolean): Promise<string[]> {
      await ensureRecipe(db, recipeId);
      if (checked) await db.prepare('INSERT OR IGNORE INTO ticks (recipe_id, person, item_id) VALUES (?, ?, ?)').bind(recipeId, person, itemId).run();
      else await db.prepare('DELETE FROM ticks WHERE recipe_id = ? AND person = ? AND item_id = ?').bind(recipeId, person, itemId).run();
      return read(recipeId, person);
    },
  };
};
