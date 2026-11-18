import { defineMiddleware } from 'astro:middleware';
import { decide } from './scripts/who';

// Cloudflare Access sits in front of the site. Locally, wrangler.jsonc's access.dev block stands in for it.
export const onRequest = defineMiddleware(async (context, next) => {
  const access = context.locals.cfContext?.access;
  // The build prerenders with no Access in front of it, and it is the only request that both lacks Access and is
  // still building. A served request always has Access, so one without it is refused.
  if (!access) {
    // The build and local dev have no Access in front of them. A served request always does, so one without it is refused.
    // The build is the request with no runtime env. Reading it throws once the adapter is in front, which is a served request.
    let building = false;
    try { building = !context.locals.runtime?.env; } catch { building = false; }
    if (import.meta.env.DEV || building) return next();
    return new Response('This site is for Ed and Kristina.', { status: 403 });
  }
  const decision = decide((await access.getIdentity())?.email);
  if (!decision.person) return decision.response;
  context.locals.person = decision.person;
  const response = await next();
  // A prerendered page cannot know who is asking. The response says, so the page script can read it.
  response.headers.set('x-kk-person', decision.person);
  // A prerendered page cannot read the header. The cookie lets its script know who is signed in.
  response.headers.append('set-cookie', `kk-person=${decision.person}; Path=/; SameSite=Lax`);
  return response;
});
