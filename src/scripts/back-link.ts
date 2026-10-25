// How the recipe page's Back link works. Coming from the Recipes list, history.back() returns to that exact list
// entry (same URL query, and the page restores its own saved scroll), without piling a second Recipes entry on top.
// Any other way in (a bookmark, a new tab, the Week page) gets a plain link to the last Recipes URL the phone saved.
import { isRecipesUrl } from './browse-state.ts';

export function backAction({ referrer, origin, historyLength }: { referrer: string; origin: string; historyLength: number }): 'history' | 'link' {
  if (historyLength <= 1 || !referrer) return 'link';
  let from: URL;
  try {
    from = new URL(referrer);
  } catch {
    return 'link';
  }
  if (from.origin !== origin) return 'link';
  return isRecipesUrl(from.pathname + from.search) ? 'history' : 'link';
}
