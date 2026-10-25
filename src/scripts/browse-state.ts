// Pure browse state: no DOM, so node:test can run it. The page address is the source of truth
// (?q=...&meal=...&time=...&diet=...), which makes refresh, Back and shared links restore the same results.

export const GROUPS = ['meal', 'time', 'diet'] as const;
export type Group = (typeof GROUPS)[number];
export type Options = Record<Group, string[]>;

export interface BrowseState {
  q: string;
  meal: string[];
  time: string[];
  diet: string[];
}

export interface Searchable {
  name: string;
  ingredients: string[];
  meal: string;
  minutes: number;
  diet: string[];
}

const MAX_QUERY = 100;

export const emptyState = (): BrowseState => ({ q: '', meal: [], time: [], diet: [] });

// Keep only known values, in the canonical option order.
const canonical = (values: string[], allowed: string[]): string[] => allowed.filter((v) => values.includes(v));

export function parseState(search: string, options: Options): BrowseState {
  const params = new URLSearchParams(search);
  const list = (group: Group) => canonical((params.get(group) ?? '').split(','), options[group]);
  return {
    q: (params.get('q') ?? '').trim().slice(0, MAX_QUERY),
    meal: list('meal'),
    time: list('time'),
    diet: list('diet'),
  };
}

/** Returns '' or '?q=...&meal=...'. Same state always gives the same string. */
export function serializeState(state: BrowseState, options: Options): string {
  const params = new URLSearchParams();
  const q = state.q.trim().slice(0, MAX_QUERY);
  if (q) params.set('q', q);
  for (const group of GROUPS) {
    const values = canonical(state[group], options[group]);
    if (values.length) params.set(group, values.join(','));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const activeFilterCount = (state: BrowseState): number =>
  GROUPS.reduce((sum, group) => sum + state[group].length, 0);

export const hasAnyState = (state: BrowseState): boolean => state.q.trim() !== '' || activeFilterCount(state) > 0;

export function toggleValue(state: BrowseState, group: Group, value: string, options: Options): BrowseState {
  const has = state[group].includes(value);
  const next = has ? state[group].filter((v) => v !== value) : [...state[group], value];
  return { ...state, [group]: canonical(next, options[group]) };
}

// Search: every word must appear in the name or in an ingredient. Filters: AND across groups.
// Within a group: meal is any-of, time is "N min or less" (several picks mean the loosest one),
// diet is every-of (a recipe needs ALL the picked tags).
export function matchesRecipe(recipe: Searchable, state: BrowseState): boolean {
  const name = recipe.name.toLowerCase();
  const ingredients = recipe.ingredients.map((i) => i.toLowerCase());
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => name.includes(w) || ingredients.some((i) => i.includes(w)))) return false;
  if (state.meal.length && !state.meal.includes(recipe.meal)) return false;
  if (state.time.length && recipe.minutes > Math.max(...state.time.map(Number))) return false;
  if (!state.diet.every((d) => recipe.diet.includes(d))) return false;
  return true;
}

export const filterRecipes = <T extends Searchable>(recipes: readonly T[], state: BrowseState): T[] =>
  recipes.filter((r) => matchesRecipe(r, state));

export function emptyMessage(state: BrowseState): string {
  const q = state.q.trim();
  const filtered = activeFilterCount(state) > 0;
  if (q && filtered) return `No recipe lists '${q}' with these filters`;
  if (q) return `No recipe lists '${q}'`;
  return 'No recipes match these filters';
}

// --- session: last Recipes URL (for the tab bar) and scroll position per URL ---------------------------

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ENTRY_KEY = 'kk:recipes';

// Only "/" or "/?query" is ever accepted, so a poisoned value cannot redirect off-site.
const isRecipesUrl = (url: string): boolean => /^\/(\?[^\s\\]*)?$/.test(url);

type Entry = { url: string; y: number };

export function createSession(storage: StorageLike) {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  // One entry only: the last Recipes URL and how far it was scrolled.
  const read = (): Entry | null =>
    safe(() => {
      const raw = JSON.parse(storage.getItem(ENTRY_KEY) ?? 'null');
      if (!raw || typeof raw.url !== 'string' || !isRecipesUrl(raw.url)) return null;
      const y = typeof raw.y === 'number' && Number.isFinite(raw.y) && raw.y > 0 ? Math.round(raw.y) : 0;
      return { url: raw.url, y };
    }, null);
  const write = (entry: Entry): void =>
    safe(() => (isRecipesUrl(entry.url) ? storage.setItem(ENTRY_KEY, JSON.stringify(entry)) : storage.removeItem(ENTRY_KEY)), undefined);
  return {
    saveRecipesUrl(url: string): void {
      const old = read();
      write({ url, y: old && old.url === url ? old.y : 0 });
    },
    recipesHref(): string {
      return read()?.url ?? '/';
    },
    saveScroll(url: string, y: number): void {
      write({ url, y: Math.max(0, Math.round(y)) });
    },
    readScroll(url: string): number {
      const entry = read();
      return entry && entry.url === url ? entry.y : 0;
    },
  };
}
