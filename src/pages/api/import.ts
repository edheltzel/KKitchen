import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSharedRatings } from '../../lib/ratings-shared';
import { createSharedWeek } from '../../lib/week-shared';
import { createSharedTicks } from '../../lib/ticks-shared';
import type { Person, Rating } from '../../scripts/ratings';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const copy = await request.json();
  const ratings = createSharedRatings(env.DB);
  for (const rating of copy.ratings ?? []) await ratings.set(rating.recipeId, rating.person as Person, rating.value as Rating);
  const week = createSharedWeek(env.DB);
  const skipped: string[] = [];
  for (const dinner of copy.dinners ?? []) {
    const result = await week.set(dinner.day, 'dinner', [dinner.recipeId], []);
    if ('conflict' in result) skipped.push(dinner.day);
  }
  const ticks = createSharedTicks(env.DB);
  for (const tick of copy.ticks ?? []) await ticks.set(tick.recipeId, locals.person, tick.itemId, true);
  return Response.json({ ok: true, skipped });
};
