// The real recipes, read from their markdown files. The fixture build never reaches this: it uses the examples.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recipeFromFile } from './recipe-file.ts';
import type { ExampleRecipe } from '../data/examples.ts';

const fromDisk = (): readonly ExampleRecipe[] => {
  const dir = join(process.cwd(), 'src/content/recipes');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => recipeFromFile(readFileSync(join(dir, name), 'utf8')));
};

// The tests run this file in plain Node, which cannot bundle the markdown. The build can, and its filesystem cannot see the project.
export const recipesFromFiles = async (): Promise<readonly ExampleRecipe[]> => {
  try {
    const { recipeFiles } = await import('./recipe-files.ts');
    return Object.values(recipeFiles).map(recipeFromFile);
  } catch {
    return fromDisk();
  }
};
