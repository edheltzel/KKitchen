import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, REFUSED } from '../src/scripts/who.ts';

// The middleware is this decision plus the Access read. These stand in for the three identities it can be handed.
const run = async (email) => {
  const decision = decide(email);
  if (!decision.person) return { status: decision.response.status, body: await decision.response.text(), person: null };
  return { status: 200, body: 'ok', person: decision.person };
};

test('Ed is Ed and the page is served', async () => {
  const r = await run('ed@local');
  assert.equal(r.status, 200);
  assert.equal(r.person, 'ed');
  assert.equal(r.body, 'ok');
});

test('Kristina is Kristina and the page is served', async () => {
  const r = await run('kristina@local');
  assert.equal(r.status, 200);
  assert.equal(r.person, 'kristina');
});

test('the real Access emails are Ed and Kristina, whatever their case', async () => {
  assert.equal((await run('ed@rainyday.media')).person, 'ed');
  assert.equal((await run('Kristina.Hodgkinson@yahoo.com')).person, 'kristina');
});

test('anyone else, including nobody, gets no page', async () => {
  for (const email of ['bob@local', '', undefined]) {
    const r = await run(email);
    assert.equal(r.status, 403, String(email));
    assert.equal(r.person, null);
    assert.equal(r.body, REFUSED);
  }
});
