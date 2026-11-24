// The two people this site is for. An email comes from Cloudflare Access; anything else is nobody.
export const PEOPLE = {
  'ed@local': 'ed',
  'kristina@local': 'kristina',
  'ed@rainyday.media': 'ed',
  'kristina.hodgkinson@yahoo.com': 'kristina',
} as const;

export type Person = (typeof PEOPLE)[keyof typeof PEOPLE];

export const personFor = (email: string | undefined): Person | null =>
  (email && PEOPLE[email.toLowerCase() as keyof typeof PEOPLE]) || null;

export const REFUSED = 'This site is for Ed and Kristina.';

// A known email is that person and the page is served. Anything else is a refusal and no page.
export const decide = (
  email: string | undefined,
): { person: Person; response?: undefined } | { person: null; response: Response } => {
  const person = personFor(email);
  return person ? { person } : { person: null, response: new Response(REFUSED, { status: 403 }) };
};
