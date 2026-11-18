// The week page's view of the shared store. It reads and writes one meal at a time and remembers the list it
// last saw, so a save that finds the meal changed comes back as a conflict instead of overwriting it.
import type { Meal, MealConflict, Slot } from '../lib/week-shared';

export interface WeekClient {
  get(day: string, meal: Meal): Promise<Slot>;
  set(day: string, meal: Meal, recipes: string[], seen: readonly string[]): Promise<Slot | MealConflict>;
}

export const createWeekClient = (fetchImpl: typeof fetch = fetch): WeekClient => ({
  async get(day, meal) {
    const response = await fetchImpl(`/api/week?day=${day}&meal=${meal}`);
    if (!response.ok) throw new Error('week unavailable');
    return response.json();
  },
  async set(day, meal, recipes, seen) {
    const response = await fetchImpl('/api/week', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ day, meal, recipes, seen }),
    });
    if (!response.ok && response.status !== 409) throw new Error('week unavailable');
    return response.json();
  },
});
