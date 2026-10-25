import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

const doc = () => read('docs/test-deploy.md');
const name = () => JSON.parse(read('wrangler.jsonc')).name;

test('test-deploy doc says what is deployed and what stays on each phone', () => {
  const d = doc();
  assert.match(d, /static/i);
  assert.match(d, /example recipes only/i);
  for (const word of ['ratings', 'week plan', 'ticks']) assert.ok(d.toLowerCase().includes(word), word);
  assert.match(d, /not shared/i);
});

test('test-deploy doc has the exact manual deploy command, with the Worker name from wrangler.jsonc, and says there is no automatic republish', () => {
  const d = doc();
  assert.match(d, /rm -rf dist && npm test && wrangler deploy/);
  assert.match(d, /manual only/i);
  assert.match(d, /no automatic republish/i);
  assert.ok(d.includes(name()), 'the Worker name appears so the delete step is copy-paste');
});

test('test-deploy doc has the verify steps, delete step, rollback and the scoped-token note', () => {
  const d = doc();
  assert.match(d, /curl -sI .*\| grep -i x-robots-tag/);
  assert.match(d, /<meta name="robots" content="noindex">/);
  assert.match(d, /Draft-only/);
  assert.match(d, /saffron/);
  assert.match(d, /Hidden Draft Note/);
  assert.ok(d.includes(`wrangler delete ${name()}`), 'delete step with the real name');
  assert.match(d, /rollback/i);
  assert.match(d, /git checkout/);
  assert.match(d, /Workers.*edit/i);
  assert.match(d, /no D1, KV or DNS/i);
  assert.match(d, /delete the setup token/i);
});

test('test-deploy doc carries the review line verbatim', () => {
  assert.ok(doc().includes('Is this test site still needed? Review after each test session; it stays up only on the captain\'s say-so. A random address only hides the site; real recipes or shared ratings need a proper gate (passcode) and a fresh Red-Team review.'));
});

test('test-deploy doc has no secret-looking strings and does not tell anyone to log in with wrangler login', () => {
  const d = doc();
  assert.ok(!/wrangler login/.test(d.replace(/Never run `wrangler login`[^\n]*/g, '')));
  assert.ok(!/[A-Za-z0-9_-]{40,}/.test(d), 'nothing token-like');
});

test('test-deploy doc says CLOUDFLARE_ACCOUNT_ID must be set, and to tell Atlas rather than widen the token', () => {
  const d = doc();
  assert.match(d, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(d, /account read permission/i);
  assert.match(d, /tell Atlas/i);
  assert.match(d, /do not widen the token/i);
  assert.ok(!/CLOUDFLARE_ACCOUNT_ID\s*=\s*[0-9a-f]{8,}/i.test(d), 'the variable name only, never an account id');
});

test('test-deploy doc warns the Workers-edit token covers all 8 existing Workers, and has a read-only name-collision check before the first deploy', () => {
  const d = doc();
  assert.match(d, /all 8 existing Workers/i);
  assert.match(d, /cannot be limited to one/i);
  assert.match(d, /short-lived/i);
  const pre = d.slice(d.search(/## Before the first deploy/i));
  assert.ok(pre.length < d.length, 'a "Before the first deploy" section');
  assert.ok(pre.includes(name()), 'the section names the random Worker name');
  assert.match(pre, /does not already exist/i);
  assert.match(pre, /workers_list/);
  assert.match(pre, /read-only/i);
  assert.ok(d.indexOf('## Before the first deploy') < d.indexOf('## Deploy'), 'the check comes before the deploy section');
});
