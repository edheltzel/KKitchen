// The recipes a request sees. The fixture build has no bucket and uses the examples. A real request reads the
// bucket, which falls back to the bundled files until the first recipe is saved.
import { exampleRecipes, isFixture, type ExampleRecipe } from '../data/examples.ts';
import { createRecipeStore, type RecipeBucket } from './recipe-store.ts';

export const recipesFor = async (bucket: RecipeBucket | undefined): Promise<readonly ExampleRecipe[]> => {
  if (isFixture || !bucket) return exampleRecipes;
  return createRecipeStore(bucket).list();
};
