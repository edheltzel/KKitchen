// EXAMPLE DATA ONLY. These are obvious placeholders, not real family recipes.
// Every title starts with EXAMPLE_PREFIX so nothing here can be mistaken for real content.

export const EXAMPLE_PREFIX = 'Example recipe: ';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_ORDER: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const TIME_OPTIONS: readonly number[] = [15, 30, 45];

export interface DietTag {
  label: string;
  /** Only tags a person confirmed are ever shown or offered as a filter. */
  confirmed: boolean;
}

export interface ExampleRecipe {
  id: string;
  /** Short dish name without the prefix. */
  name: string;
  minutes: number;
  meal: Meal;
  ingredients: readonly string[];
  tags: readonly DietTag[];
  /** A note without approved: true never reaches the grid, the search or the counts. */
  approved: boolean;
}

const notes: readonly ExampleRecipe[] = [
  { id: 'example-1', name: 'Weeknight Pasta', minutes: 25, meal: 'dinner', approved: true,
    ingredients: ['spaghetti', 'tomato', 'garlic', 'olive oil'], tags: [{ label: 'Meatless', confirmed: true }] },
  { id: 'example-2', name: 'Sheet-Pan Vegetables', minutes: 40, meal: 'dinner', approved: true,
    ingredients: ['zucchini', 'bell pepper', 'red onion', 'olive oil'], tags: [{ label: 'Meatless', confirmed: true }] },
  { id: 'example-3', name: 'Tomato Soup', minutes: 30, meal: 'lunch', approved: true,
    ingredients: ['tomato', 'onion', 'basil', 'vegetable stock'],
    tags: [{ label: 'Meatless', confirmed: true }, { label: 'Nut-free', confirmed: false }] },
  { id: 'example-4', name: 'Overnight Oats', minutes: 10, meal: 'breakfast', approved: true,
    ingredients: ['rolled oats', 'milk', 'chia seeds', 'honey'], tags: [{ label: 'Meatless', confirmed: true }] },
  { id: 'example-5', name: 'Lemon Rice Bowl', minutes: 20, meal: 'lunch', approved: true,
    ingredients: ['rice', 'lemon', 'peas', 'parsley'], tags: [] },
  { id: 'example-6', name: 'Banana Pancakes', minutes: 15, meal: 'breakfast', approved: true,
    ingredients: ['banana', 'flour', 'egg', 'milk'], tags: [{ label: 'Meatless', confirmed: true }] },
  // Deliberately unapproved: must never appear anywhere on the site (tests check the built HTML).
  { id: 'example-7', name: 'Hidden Draft Note', minutes: 5, meal: 'snack', approved: false,
    ingredients: ['saffron'], tags: [{ label: 'Draft-only', confirmed: true }] },
];

export const allExampleNotes = notes;
export const exampleRecipes: readonly ExampleRecipe[] = notes.filter((r) => r.approved === true);

export const exampleTitle = (recipe: ExampleRecipe): string => `${EXAMPLE_PREFIX}${recipe.name}`;

export const confirmedTags = (recipe: ExampleRecipe): string[] =>
  recipe.tags.filter((t) => t.confirmed === true).map((t) => t.label);

/** Filter choices, derived from approved recipes and confirmed tags only. */
export function filterOptions(): { meal: string[]; time: string[]; diet: string[] } {
  return {
    meal: MEAL_ORDER.filter((m) => exampleRecipes.some((r) => r.meal === m)),
    time: TIME_OPTIONS.map(String),
    diet: [...new Set(exampleRecipes.flatMap(confirmedTags))].sort(),
  };
}
