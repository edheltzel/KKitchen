import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSharedTicks } from '../../lib/ticks-shared';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const recipeId = url.searchParams.get('recipe') ?? '';
  const ticks = await createSharedTicks(env.DB).read(recipeId, locals.person);
  return Response.json({ ticks });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json();
  const ticks = await createSharedTicks(env.DB).set(body.recipeId, locals.person, body.itemId, body.checked === true);
  return Response.json({ ticks });
};
