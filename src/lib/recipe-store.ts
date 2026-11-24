// Recipes live in the RECIPES bucket, one markdown file per id. The three files in src/content/recipes are the
// starting set; a save from the form writes here, so the other person sees it on the next request.
import { stringify } from 'yaml';
import { recipeFromFile } from './recipe-file.ts';
import type { ExampleRecipe, Ingredient, Step } from '../data/examples.ts';

export interface RecipeInput {
  id: string;
  name: string;
  minutes: number;
  meal: string;
  ingredients: string;
  method: string;
  /** The recipe being edited, so a save keeps its prep, source, notes and tags instead of blanking them. */
  previous?: ExampleRecipe;
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class RecipeRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeRejected';
  }
}

const lines = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);

// The form is plain text. One ingredient per line becomes the group the page renders, and the search list.
const ingredientsOf = (text: string): { ingredients: string[]; groups: { items: Ingredient[] }[] } => {
  const items = lines(text).map((text, i) => ({ id: `i${i + 1}`, text }));
  return { ingredients: items.map((item) => item.text), groups: [{ items }] };
};

const stepsOf = (text: string): Step[] => lines(text).map((text) => ({ text }));

export const checkRecipe = (input: RecipeInput): ExampleRecipe => {
  if (!ID.test(input.id)) throw new RecipeRejected('A recipe needs an id of lowercase letters, numbers and dashes.');
  if (!input.name.trim()) throw new RecipeRejected('A recipe needs a name.');
  if (!MEALS.includes(input.meal)) throw new RecipeRejected('A recipe needs a meal: breakfast, lunch, dinner or snack.');
  const { ingredients, groups } = ingredientsOf(input.ingredients);
  if (ingredients.length === 0) throw new RecipeRejected('A recipe needs at least one ingredient.');
  const steps = stepsOf(input.method);
  if (steps.length === 0) throw new RecipeRejected('A recipe needs at least one step.');
  const previous = input.previous;
  return {
    ...(previous ?? {}),
    id: input.id,
    name: input.name.trim(),
    minutes: input.minutes,
    meal: input.meal as ExampleRecipe['meal'],
    ingredients,
    prep: previous?.prep ?? 0,
    cook: input.minutes,
    serves: previous?.serves ?? 0,
    groups,
    steps,
    tags: previous?.tags ?? [],
    approved: true,
  };
};

const fileFor = (recipe: ExampleRecipe): string => {
  const front = { ...recipe, steps: recipe.steps.map((step) => (step.uses ? { uses: [...step.uses] } : {})) };
  const body = recipe.steps.map((step, i) => `${i + 1}. ${step.text}`).join('\n\n');
  return `---\n${stringify(front)}---\n\n${body}\n`;
};

export interface RecipeBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<unknown>;
  list(): Promise<{ objects: { key: string }[] }>;
}

// The bundled files, for a bucket that has never been written to. Tests and dev read them from disk; the build bundles them.
const seed = async (): Promise<ExampleRecipe[]> => {
  try {
    const { recipeFiles } = await import('./recipe-files.ts');
    const values = Object.values(recipeFiles);
    if (values.length > 0) return values.map(recipeFromFile);
  } catch {
    // import.meta.glob only exists inside the build.
  }
  const { recipesFromFiles } = await import('./recipes.ts');
  return [...(await recipesFromFiles())];
};

export const createRecipeStore = (bucket: RecipeBucket) => ({
  async list(): Promise<ExampleRecipe[]> {
    const seeded = await seed();
    const listed = await bucket.list();
    const saved = new Map<string, ExampleRecipe>();
    for (const object of listed.objects) {
      const file = await bucket.get(object.key);
      if (file) {
        const recipe = recipeFromFile(await file.text());
        saved.set(recipe.id, recipe);
      }
    }
    // A saved recipe replaces its seeded copy. The seeded recipes stay until someone edits them.
    const ids = new Set([...seeded.map((recipe) => recipe.id), ...saved.keys()]);
    return [...ids].map((id) => saved.get(id) ?? seeded.find((recipe) => recipe.id === id)!);
  },
  async save(input: RecipeInput): Promise<ExampleRecipe> {
    const recipe = checkRecipe(input);
    await bucket.put(`${recipe.id}.md`, fileFor(recipe));
    return recipe;
  },
});
