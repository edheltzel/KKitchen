import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSharedRatings } from '../../lib/ratings-shared';
import { PEOPLE, RATINGS, type Person, type Rating } from '../../scripts/ratings';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const ratings = await createSharedRatings(env.DB).load();
  return Response.json({ ratings, me: locals.person });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json();
  const person = (PEOPLE as readonly string[]).includes(body.person) ? (body.person as Person) : null;
  const value = body.value === null ? null : (RATINGS as readonly string[]).includes(body.value) ? (body.value as Rating) : undefined;
  if (!person || value === undefined) return new Response('bad rating', { status: 400 });
  const ratings = await createSharedRatings(env.DB).set(body.recipeId, person, value);
  return Response.json({ ratings });
};
