// The week plan with no DOM and no storage: which days make up the week, what one phone's plan looks like,
// how two phones' plans merge, and what planning a dinner changes. One entry per day means one dinner per day.

import { isValidId } from './ratings.ts';

/** One day's dinner. `recipeId: null` is a removal, kept with its time so an older plan on another phone cannot bring the dinner back. */
export interface DayEntry {
  recipeId: string | null;
  at: number;
}
/** Keyed by day, "YYYY-MM-DD". */
export type Plan = Record<string, DayEntry>;

export interface WeekDay {
  key: string;
  short: string;
  long: string;
  month: string;
  date: number;
}

const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number): string => String(n).padStart(2, '0');

/** Monday to Sunday of the week that holds `today` (the phone's own calendar days). */
export function weekDays(today: Date): WeekDay[] {
  const sinceMonday = (today.getDay() + 6) % 7;
  return SHORT.map((short, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday + i);
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      short,
      long: LONG[i],
      month: MONTHS[d.getMonth()],
      date: d.getDate(),
    };
  });
}

export function weekRange(days: WeekDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  return `${first.month} ${first.date} – ${last.month} ${last.date}`;
}

export function isValidDay(key: unknown): key is string {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export const dinnerOn = (plan: Plan, day: string): string | null => (has(plan, day) ? plan[day].recipeId : null);

/** The day this week that already has the recipe, or null. */
export function dayOfRecipe(plan: Plan, days: readonly string[], recipeId: string): string | null {
  return days.find((day) => dinnerOn(plan, day) === recipeId) ?? null;
}

// Newer time wins. On a tie a removal wins (a dinner never comes back by accident), then the larger id, so
// merging in either order gives the same result.
function newer(a: DayEntry, b: DayEntry): DayEntry {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  if (a.recipeId === null || b.recipeId === null) return a.recipeId === null ? a : b;
  return a.recipeId >= b.recipeId ? a : b;
}

export function mergePlans(a: Plan, b: Plan): Plan {
  const out: Plan = {};
  for (const source of [a, b]) {
    for (const day of Object.keys(source)) {
      const entry = source[day];
      out[day] = has(out, day) ? { ...newer(out[day], entry) } : { recipeId: entry.recipeId, at: entry.at };
    }
  }
  return out;
}

/** Anything that is not a well-formed plan is dropped, never trusted. */
export function sanitizePlan(raw: unknown): Plan {
  const out: Plan = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const day of Object.keys(raw)) {
    if (!isValidDay(day)) continue;
    const entry = (raw as Record<string, unknown>)[day];
    if (!entry || typeof entry !== 'object') continue;
    const { recipeId, at } = entry as { recipeId?: unknown; at?: unknown };
    if (recipeId !== null && !isValidId(recipeId)) continue;
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) continue;
    out[day] = { recipeId: recipeId as string | null, at: Math.floor(at) };
  }
  return out;
}

export type PlanNote =
  | { kind: 'planned'; day: string }
  | { kind: 'replaced'; day: string; replaced: string }
  | { kind: 'moved'; day: string; from: string; replaced?: string };

export interface PlanChange {
  writes: { day: string; recipeId: string | null }[];
  note: PlanNote | null;
}

/** What planning `recipeId` on `day` writes: a plain plan, a replace, or a move (the old day is cleared). */
export function planChange(plan: Plan, days: readonly string[], day: string, recipeId: string): PlanChange {
  if (!days.includes(day)) throw new RangeError(`That day is not in this week: ${day}`);
  if (!isValidId(recipeId)) throw new TypeError('Not a valid recipe id');
  const here = dinnerOn(plan, day);
  if (here === recipeId) return { writes: [], note: null };
  const from = dayOfRecipe(plan, days, recipeId);
  const writes: PlanChange['writes'] = [{ day, recipeId }];
  if (from !== null) {
    writes.push({ day: from, recipeId: null });
    return { writes, note: here === null ? { kind: 'moved', day, from } : { kind: 'moved', day, from, replaced: here } };
  }
  return { writes, note: here === null ? { kind: 'planned', day } : { kind: 'replaced', day, replaced: here } };
}

/** The visible words for what a change did. A plain plan needs none. */
export function noteText(
  note: PlanNote | null,
  dayLong: (day: string) => string,
  recipeName: (recipeId: string) => string,
): string | null {
  if (!note || note.kind === 'planned') return null;
  if (note.kind === 'replaced') return `Replaced ${recipeName(note.replaced)}`;
  const moved = `Moved from ${dayLong(note.from)}`;
  return note.replaced ? `${moved}. Replaced ${recipeName(note.replaced)}.` : moved;
}
