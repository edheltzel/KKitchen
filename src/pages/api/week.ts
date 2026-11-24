import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSharedWeek, MEALS, type Meal } from '../../lib/week-shared';

export const prerender = false;

const isMeal = (value: unknown): value is Meal => MEALS.includes(value as Meal);

export const GET: APIRoute = async ({ url, locals }) => {
  const day = url.searchParams.get('day') ?? '';
  const meal = url.searchParams.get('meal') ?? '';
  if (!isMeal(meal)) return new Response('bad meal', { status: 400 });
  const slot = await createSharedWeek(env.DB).get(day, meal);
  return Response.json(slot);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json();
  if (!isMeal(body.meal) || !Array.isArray(body.recipes) || !Array.isArray(body.seen)) return new Response('bad request', { status: 400 });
  const result = await createSharedWeek(env.DB).set(body.day, body.meal, body.recipes, body.seen);
  return Response.json(result, { status: 'conflict' in result ? 409 : 200 });
};
