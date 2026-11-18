// A rating, a tick or a planned meal points at a recipe row. The markdown in the bucket is not that row, so a
// write creates it first. A recipe saved through the form already has one, and the insert does nothing then.
import type { D1Database } from '@cloudflare/workers-types';

export const ensureRecipe = async (db: D1Database, recipeId: string): Promise<void> => {
  if (!recipeId) return;
  await db.prepare('INSERT OR IGNORE INTO recipes (id, name, created_at) VALUES (?, ?, ?)').bind(recipeId, recipeId, new Date().toISOString()).run();
};
