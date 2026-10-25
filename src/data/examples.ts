// EXAMPLE DATA ONLY. These are obvious placeholders, not real family recipes.
// Every title starts with EXAMPLE_PREFIX so nothing here can be mistaken for real content.

export const EXAMPLE_PREFIX = 'Example recipe: ';

export interface ExampleRecipe {
  id: string;
  /** Short dish name without the prefix. */
  name: string;
  minutes: number;
}

export const exampleRecipes: readonly ExampleRecipe[] = [
  { id: 'example-1', name: 'Weeknight Pasta', minutes: 25 },
  { id: 'example-2', name: 'Sheet-Pan Vegetables', minutes: 40 },
  { id: 'example-3', name: 'Tomato Soup', minutes: 30 },
  { id: 'example-4', name: 'Overnight Oats', minutes: 10 },
  { id: 'example-5', name: 'Lemon Rice Bowl', minutes: 20 },
  { id: 'example-6', name: 'Banana Pancakes', minutes: 15 },
];

export const exampleTitle = (recipe: ExampleRecipe): string => `${EXAMPLE_PREFIX}${recipe.name}`;
