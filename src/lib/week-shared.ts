// The shared week. A week is Monday to Sunday, named by its Monday. A day has four meals and a meal holds an
// ordered list of recipes. A save sends the list the device last read; when the stored list has changed since,
// nothing is written and the caller is told, so one person never silently replaces the other's meal.
import type { D1Database } from '@cloudflare/workers-types';
import { ensureRecipe } from './recipes-row.ts';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export interface Slot {
  week: string;
  day: string;
  meal: Meal;
  recipes: string[];
}

export interface MealConflict {
  conflict: true;
  current: string[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const mondayOf = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(year, month - 1, date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export const createSharedWeek = (db: D1Database) => {
  const read = async (day: string, meal: Meal): Promise<string[]> => {
    const { results } = await db
      .prepare('SELECT recipe_id FROM slot_items WHERE day = ? AND meal = ? ORDER BY position')
      .bind(day, meal)
      .all<{ recipe_id: string }>();
    return results.map((row) => row.recipe_id);
  };

  // One statement decides the conflict. Two saves that both saw the old list cannot both change it.
  const claim = async (week: string, day: string, meal: Meal, recipes: readonly string[], seen: readonly string[]): Promise<boolean> => {
    const next = JSON.stringify(recipes);
    const previous = JSON.stringify(seen);
    const claimed = await db
      .prepare('UPDATE meal_slots SET seen = ? WHERE day = ? AND meal = ? AND seen = ?')
      .bind(next, day, meal, previous)
      .run();
    if (claimed.meta.changes > 0) return true;
    await db.prepare('INSERT OR IGNORE INTO weeks (monday) VALUES (?)').bind(week).run();
    const inserted = await db
      .prepare('INSERT INTO meal_slots (week, day, meal, seen) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM meal_slots WHERE day = ? AND meal = ?)')
      .bind(week, day, meal, next, day, meal)
      .run();
    return inserted.meta.changes > 0 && previous === '[]';
  };

  return {
    async get(day: string, meal: Meal): Promise<Slot> {
      return { week: mondayOf(day), day, meal, recipes: await read(day, meal) };
    },

    // `seen` is the list the device last read. It must still be what is stored, or the write is refused.
    async set(day: string, meal: Meal, recipes: string[], seen: readonly string[]): Promise<Slot | MealConflict> {
      if (!DAY.test(day) || !MEALS.includes(meal)) throw new TypeError('bad day or meal');
      const current = await read(day, meal);
      if (!same(current, seen)) return { conflict: true, current };
      const week = mondayOf(day);
      const next = JSON.stringify(recipes);
      const previous = JSON.stringify(seen);
      // The token and the items move in one batch, so a reader never sees the token ahead of the items.
      const statements = [
        db.prepare('UPDATE meal_slots SET seen = ? WHERE day = ? AND meal = ? AND seen = ?').bind(next, day, meal, previous),
        db.prepare('DELETE FROM slot_items WHERE day = ? AND meal = ?').bind(day, meal),
        ...recipes.map((recipeId, position) =>
          db.prepare('INSERT INTO slot_items (week, day, meal, position, recipe_id) VALUES (?, ?, ?, ?, ?)').bind(week, day, meal, position, recipeId),
        ),
      ];
      if (!(await claim(week, day, meal, recipes, seen))) return { conflict: true, current: await read(day, meal) };
        for (const recipeId of recipes) await ensureRecipe(db, recipeId);
      try {
        if (db.batch) await db.batch(statements);
        else for (const statement of statements) await statement.run();
      } catch (error) {
        // The claim moved the token. Put it back so the next save is not stuck behind a meal that never changed.
        await db.prepare('UPDATE meal_slots SET seen = ? WHERE day = ? AND meal = ?').bind(JSON.stringify(seen), day, meal).run();
        throw error;
      }
      return { week, day, meal, recipes };
    },
  };
};
