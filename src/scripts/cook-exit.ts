// Leaving cooking mode. When we came from this recipe's page, "Back" in history lands on it exactly as it was (scroll and ticks
// included) and leaves no cooking page behind to swipe back into. Opened any other way (a reload from elsewhere, a bookmark, the
// installed app), the Exit link is followed as a plain link to the recipe page.
export function exitAction({ referrer, origin, recipeId, historyLength }: { referrer: string; origin: string; recipeId: string; historyLength: number }): 'back' | 'link' {
  if (historyLength <= 1 || !referrer) return 'link';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return 'link';
  }
  return url.origin === origin && url.pathname === `/recipe/${recipeId}/` ? 'back' : 'link';
}
