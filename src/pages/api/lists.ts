import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSharedRatings } from '../../lib/ratings-shared';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const store = createSharedRatings(env.DB);
  const ratings = await store.load();
  const lists = await store.lists(Object.keys(ratings));
  return Response.json(lists);
};
