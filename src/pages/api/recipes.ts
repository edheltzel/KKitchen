import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createRecipeStore, RecipeRejected, type RecipeInput } from '../../lib/recipe-store';
import { ensureRecipe } from '../../lib/recipes-row';

export const prerender = false;

const inputOf = async (request: Request): Promise<RecipeInput> => {
  const form = await request.formData();
  const text = (name: string) => String(form.get(name) ?? '');
  return { id: text('id'), name: text('name'), minutes: Number(text('minutes')) || 0, meal: text('meal'), ingredients: text('ingredients'), method: text('method') };
};

export const GET: APIRoute = async ({ locals }) => {
  const bucket = env.RECIPES;
  if (!bucket) return Response.json([]);
  const recipes = await createRecipeStore(bucket).list();
  return Response.json(recipes.map((recipe) => ({ id: recipe.id, name: recipe.name, meal: recipe.meal, minutes: recipe.minutes, ingredients: recipe.ingredients })));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bucket = env.RECIPES;
  if (!bucket) return new Response('Recipes are unavailable.', { status: 503 });
  try {
    const input = await inputOf(request);
    const existing = (await createRecipeStore(bucket).list()).find((recipe) => recipe.id === input.id);
    const recipe = await createRecipeStore(bucket).save({ ...input, previous: existing });
      await ensureRecipe(env.DB, recipe.id);
    const known = (await createRecipeStore(bucket).list()).some((item) => item.id === recipe.id && item === existing);
    const location = known ? `/recipe/${recipe.id}/` : `/recipe/saved/${recipe.id}/`;
    return new Response(null, { status: 303, headers: { location } });
  } catch (error) {
    if (error instanceof RecipeRejected) return new Response(error.message, { status: 422 });
    throw error;
  }
};
