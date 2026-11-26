// EXAMPLE DATA ONLY. These are obvious placeholders, not real family recipes: a TEST FIXTURE.
// Every title starts with EXAMPLE_PREFIX so nothing here can be mistaken for real content.
// The site ships the real recipes (recipes.ts). Only a build run with KK_DATA=fixture (npm test) uses these examples.
import { recipesFromFiles } from '../lib/recipes.ts';

export const EXAMPLE_PREFIX = 'Example recipe: ';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_ORDER: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const TIME_OPTIONS: readonly number[] = [15, 30, 45];

interface DietTag {
  label: string;
  /** Only tags a person confirmed are ever shown or offered as a filter. */
  confirmed: boolean;
}

/** One ingredient line. The id is written by hand and never changes: it is the key a tick is saved under. */
export interface Ingredient {
  id: string;
  text: string;
}
interface IngredientGroup {
  /** Omitted when a recipe has one plain list. */
  title?: string;
  items: readonly Ingredient[];
}
export interface Step {
  text: string;
  /** Item ids (of this recipe) the step uses. Cooking mode shows them under "Use now"; omitted means it shows nothing there. */
  uses?: readonly string[];
}

export interface ExampleRecipe {
  id: string;
  /** Short dish name without the prefix. */
  name: string;
  minutes: number;
  meal: Meal;
  /** Search keywords only. What the page shows is `groups`. */
  ingredients: readonly string[];
  /** prep + cook = minutes, the total on the card. 0 means the note gives no prep, and the meta line leaves it out. */
  prep: number;
  cook: number;
  /** Hands-off time not in `minutes`, e.g. "2 h marinate". Shown beside the minutes; the time filter ignores it. */
  wait?: string;
  /** Set only when the source says gluten-free. The only input to the recipe-page label and the "Gluten-free per source" chip; no tag, no badge, nothing inferred. */
  glutenFreePerSource?: true;
  serves: number;
  groups: readonly IngredientGroup[];
  steps: readonly Step[];
  /** Link to the original recipe. Only a recipe that has one shows the link. */
  source?: string;
  /** R2 key of the recipe's photo, under photos/. Served at /<key>. Omitted means the letter tile. */
  photo?: string;
  /** Who wrote the original. Kept in the data only: no page shows it yet. */
  author?: string;
  /** Short plain lines shown under the steps on the recipe page (tips, wait time, equipment). Omitted means no Notes section. */
  notes?: readonly string[];
  tags: readonly DietTag[];
  /** A note without approved: true never reaches the grid, the search or the counts. */
  approved: boolean;
}

const it = (id: string, text: string): Ingredient => ({ id, text });
const step = (text: string, ...uses: string[]): Step => (uses.length > 0 ? { text, uses } : { text });

const fixtureNotes: readonly ExampleRecipe[] = [
  { id: 'example-1', name: 'Weeknight Pasta', minutes: 25, meal: 'dinner', approved: true,
    ingredients: ['spaghetti', 'tomato', 'garlic', 'olive oil'], tags: [{ label: 'Meatless', confirmed: true }],
    prep: 10, cook: 15, serves: 4, source: 'https://example.com/example-pasta',
    groups: [
      { title: 'Pasta', items: [it('spaghetti', '250 g spaghetti')] },
      { title: 'Sauce', items: [it('tomato', '4 ripe tomatoes, chopped'), it('garlic', '2 cloves garlic'), it('olive-oil', '2 tbsp olive oil')] },
    ],
    steps: [
      step('Boil the spaghetti in salted water until tender.', 'spaghetti'),
      step('Warm the olive oil and cook the garlic for one minute.', 'olive-oil', 'garlic'),
      step('Add the tomatoes and simmer until soft.', 'tomato'),
      step('Toss with the drained spaghetti and serve.'),
    ] },
  { id: 'example-2', name: 'Sheet-Pan Vegetables', minutes: 40, meal: 'dinner', approved: true,
    ingredients: ['zucchini', 'bell pepper', 'red onion', 'olive oil'], tags: [{ label: 'Meatless', confirmed: true }],
    prep: 15, cook: 25, serves: 4,
    groups: [
      { items: [it('zucchini', '2 zucchini, sliced'), it('bell-pepper', '2 bell peppers, in strips'), it('red-onion', '1 red onion, in wedges'), it('olive-oil', '3 tbsp olive oil')] },
    ],
    steps: [
      step('Heat the oven to 220 C.'),
      step('Toss the vegetables with the olive oil on a tray.'),
      step('Roast until browned at the edges, turning once.'),
    ] },
  { id: 'example-3', name: 'Tomato Soup', minutes: 30, meal: 'lunch', approved: true,
    ingredients: ['tomato', 'onion', 'basil', 'vegetable stock'],
    tags: [{ label: 'Meatless', confirmed: true }, { label: 'Nut-free', confirmed: false }],
    prep: 10, cook: 20, serves: 4,
    groups: [
      { title: 'Base', items: [it('onion', '1 onion, diced'), it('tomato', '6 ripe tomatoes, chopped')] },
      { title: 'To finish', items: [it('vegetable-stock', '500 ml vegetable stock'), it('basil', 'A handful of basil')] },
    ],
    steps: [
      step('Soften the onion in a large pot.', 'onion'),
      step('Add the tomatoes and the stock.', 'tomato', 'vegetable-stock'),
      step('Simmer for fifteen minutes.'),
      step('Blend until smooth and stir in the basil.', 'basil'),
    ] },
  // FIXTURE ONLY: example-4 and example-5 carry the flag so filter tests have both cases. Not a claim about any real recipe.
  { id: 'example-4', name: 'Overnight Oats', minutes: 10, meal: 'breakfast', approved: true, glutenFreePerSource: true,
    ingredients: ['rolled oats', 'milk', 'chia seeds', 'honey'], tags: [{ label: 'Meatless', confirmed: true }],
    prep: 10, cook: 0, serves: 2, source: 'https://example.com/example-oats',
    groups: [
      { items: [it('rolled-oats', '100 g rolled oats'), it('milk', '250 ml milk'), it('chia-seeds', '1 tbsp chia seeds'), it('honey', '1 tbsp honey')] },
    ],
    steps: [
      step('Stir the oats, milk and chia seeds together in a jar.'),
      step('Stir in the honey.'),
      step('Cover and chill overnight.'),
    ] },
  { id: 'example-5', name: 'Lemon Rice Bowl', minutes: 20, meal: 'lunch', approved: true, glutenFreePerSource: true,
    ingredients: ['rice', 'lemon', 'peas', 'parsley'], tags: [],
    prep: 5, cook: 15, serves: 2,
    groups: [
      { title: 'Rice', items: [it('rice', '200 g rice')] },
      { title: 'Toppings', items: [it('lemon', '1 lemon'), it('peas', '100 g peas'), it('parsley', 'A little parsley, chopped')] },
    ],
    steps: [
      step('Cook the rice, adding the peas for the last three minutes.'),
      step('Drain and stir in the lemon juice.'),
      step('Top with the parsley.'),
    ] },
  { id: 'example-6', name: 'Banana Pancakes', minutes: 15, meal: 'breakfast', approved: true,
    ingredients: ['banana', 'flour', 'egg', 'milk'], tags: [{ label: 'Meatless', confirmed: true }],
    prep: 5, cook: 10, serves: 3,
    groups: [
      { title: 'Batter', items: [it('banana', '2 ripe bananas'), it('flour', '150 g flour'), it('egg', '2 eggs'), it('milk', '200 ml milk')] },
    ],
    steps: [
      step('Mash the bananas and whisk in the eggs and milk.', 'banana', 'egg', 'milk'),
      step('Stir in the flour until just combined.', 'flour'),
      step('Cook spoonfuls in a hot pan, turning once.'),
      step('Serve warm.'),
    ] },
  // Deliberately unapproved: must never appear anywhere on the site (tests check the built HTML).
  { id: 'example-7', name: 'Hidden Draft Note', minutes: 5, meal: 'snack', approved: false,
    ingredients: ['saffron'], tags: [{ label: 'Draft-only', confirmed: true }],
    prep: 5, cook: 0, serves: 1,
    groups: [{ items: [it('saffron', 'A pinch of saffron')] }],
    steps: [step('Draft only.')] },
];

/**
 * True only when KK_DATA=fixture is set (npm test). A plain build or `npm run build` has it false and ships the real recipes.
 * The build prerenders inside workerd, which cannot see the shell's environment, so the value also comes through wrangler.jsonc's vars.
 */
export const isFixture: boolean = (process.env.KK_DATA || (globalThis as { KK_DATA?: string }).KK_DATA) === 'fixture';

const notes: readonly ExampleRecipe[] = isFixture ? fixtureNotes : await recipesFromFiles();

export const allExampleNotes = notes;
export const exampleRecipes: readonly ExampleRecipe[] = notes.filter((r) => r.approved === true);

/** The fixture adds the Example prefix; a real recipe shows its own title as it is. */
export const exampleTitle = (recipe: ExampleRecipe): string => (isFixture ? `${EXAMPLE_PREFIX}${recipe.name}` : recipe.name);

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

/** Every ingredient line of a recipe, in page order. */
export const flatItems = (recipe: ExampleRecipe): Ingredient[] => recipe.groups.flatMap((g) => [...g.items]);

/** Under 120 minutes stays in minutes; from 120 it reads in hours: 120 is "2 h", 125 is "2 h 5 min", 360 is "6 h". */
export const formatMinutes = (n: number): string => {
  if (n < 120) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/** The time on a recipe card: "60 min + 2 h marinate", or just "25 min". */
/** The wait with no-break spaces, so "2 h marinate" never splits across two lines. */
const glue = (text: string): string => text.split(' ').join('\u00a0');
export const cardTime = (recipe: ExampleRecipe): string =>
  recipe.wait ? `${formatMinutes(recipe.minutes)} +\u00a0${glue(recipe.wait)}` : formatMinutes(recipe.minutes);

/** "Prep 10 min · Cook 15 min · Serves 4" */
export const recipeMeta = (recipe: ExampleRecipe): string =>
  [
    ...(recipe.prep > 0 ? [`Prep ${formatMinutes(recipe.prep)}`] : []),
    recipe.cook > 0 ? `Cook ${formatMinutes(recipe.cook)}` : 'No cooking',
    ...(recipe.wait ? [`Plus\u00a0${glue(recipe.wait)}`] : []),
    `Serves ${recipe.serves}`,
  ].join(' · ');
