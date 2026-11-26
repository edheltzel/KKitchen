import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { PHOTO_KEY, PHOTO_TYPES } from '../../lib/recipe-store';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const key = `photos/${params.name}`;
  if (!PHOTO_KEY.test(key)) return new Response(null, { status: 404 });
  const photo = await env.RECIPES?.get(key);
  if (!photo) return new Response(null, { status: 404 });
  const ext = key.slice(key.lastIndexOf('.') + 1);
  const type = photo.httpMetadata?.contentType ?? Object.keys(PHOTO_TYPES).find((mime) => PHOTO_TYPES[mime] === ext)!;
  return new Response(photo.body as unknown as BodyInit, {
    headers: { 'content-type': type, 'cache-control': 'private, max-age=31536000, immutable', etag: photo.httpEtag },
  });
};
