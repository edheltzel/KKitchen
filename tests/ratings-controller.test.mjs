import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRatingsController } from '../src/scripts/ratings-controller.ts';
import { createLocalRatingsStore, createIdentity } from '../src/scripts/ratings-store.ts';
import { isFamilyFavorite, ratingOf } from '../src/scripts/ratings.ts';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let t = 0;
const now = () => (t += 5);

/** One phone: its own identity memory, sharing a ratings backing with any other phone. */
function phone(backing, person, failures = { load: false, save: false }) {
  const store = createLocalRatingsStore({ storage: backing, now, failures });
  const identity = createIdentity(fakeStorage());
  if (person) identity.set(person);
  const controller = createRatingsController({ store, identity });
  return { controller, failures, identity };
}
const fav = (c, id = 'r1') => isFamilyFavorite(c.view().ratings ?? {}, id);

test('the Family favorite shows only after BOTH say Loved it', async () => {
  const backing = fakeStorage();
  const ed = phone(backing, 'ed');
  const kris = phone(backing, 'kristina');
  await ed.controller.init();
  await kris.controller.init();
  await ed.controller.tap('r1', 'loved');
  assert.equal(fav(ed.controller), false, 'only Ed so far');
  await kris.controller.tap('r1', 'not-for-us');
  assert.equal(fav(kris.controller), false, 'Kristina said Not for us');
  await kris.controller.tap('r1', 'loved');
  assert.equal(fav(kris.controller), true, 'both loved it');
  await ed.controller.refresh();
  assert.equal(fav(ed.controller), true, "Ed's phone sees it after it reloads");
});

test('tapping Loved it again clears it; clearing a Family favorite offers Undo, and Undo reverses it', async () => {
  const backing = fakeStorage();
  const ed = phone(backing, 'ed');
  const kris = phone(backing, 'kristina');
  await ed.controller.init();
  await kris.controller.tap('r1', 'loved');
  await ed.controller.tap('r1', 'loved');
  assert.equal(fav(ed.controller), true);
  assert.equal(ed.controller.view().undo, null, 'making a favorite offers no Undo');
  await ed.controller.tap('r1', 'loved'); // tap again: clear
  assert.equal(ratingOf(ed.controller.view().ratings, 'r1', 'ed'), null);
  assert.equal(fav(ed.controller), false);
  assert.deepEqual(ed.controller.view().undo, { id: 'r1', person: 'ed', previous: 'loved' });
  await ed.controller.undo();
  assert.equal(ratingOf(ed.controller.view().ratings, 'r1', 'ed'), 'loved');
  assert.equal(fav(ed.controller), true, 'Undo brought the favorite back');
  assert.equal(ed.controller.view().undo, null);
  await kris.controller.refresh();
  assert.equal(fav(kris.controller), true, 'and it is saved, not just shown');
});

test('switching Loved it to Not for us also removes the favorite and offers Undo; unrelated edits do not', async () => {
  const backing = fakeStorage();
  const ed = phone(backing, 'ed');
  const kris = phone(backing, 'kristina');
  await ed.controller.init();
  await kris.controller.tap('r1', 'loved');
  await ed.controller.tap('r1', 'loved');
  await ed.controller.tap('r1', 'not-for-us');
  assert.deepEqual(ed.controller.view().undo, { id: 'r1', person: 'ed', previous: 'loved' });
  await ed.controller.tap('r2', 'loved');
  assert.equal(ed.controller.view().undo, null, 'a new unrelated tap replaces the Undo');
  await ed.controller.tap('r1', 'loved');
  await ed.controller.tap('r1', 'not-for-us');
  ed.controller.dismissUndo();
  assert.equal(ed.controller.view().undo, null);
});

test('a rating only ever writes this phone\'s person, never the other one', async () => {
  const backing = fakeStorage();
  const ed = phone(backing, 'ed');
  await ed.controller.init();
  await ed.controller.tap('r1', 'loved');
  const r = ed.controller.view().ratings.r1;
  assert.ok(r.ed);
  assert.equal(r.kristina, undefined);
});

test('nobody chosen yet: taps do nothing; choosing is remembered and changeable', async () => {
  const backing = fakeStorage();
  const p = phone(backing, null);
  await p.controller.init();
  assert.equal(p.controller.view().me, null);
  await p.controller.tap('r1', 'loved');
  assert.deepEqual(p.controller.view().ratings, {}, 'nothing saved');
  p.controller.setMe('kristina');
  assert.equal(p.controller.view().me, 'kristina');
  assert.equal(p.identity.get(), 'kristina');
  await p.controller.tap('r1', 'loved');
  assert.equal(ratingOf(p.controller.view().ratings, 'r1', 'kristina'), 'loved');
  p.controller.setMe('ed');
  assert.equal(p.identity.get(), 'ed');
  assert.equal(p.controller.view().undo, null);
});

test('load failure: "unavailable", then Retry loads', async () => {
  const backing = fakeStorage();
  const seed = phone(backing, 'ed');
  await seed.controller.init();
  await seed.controller.tap('r1', 'loved');
  const p = phone(backing, 'kristina', { load: true, save: false });
  await p.controller.init();
  assert.equal(p.controller.view().unavailable, true);
  assert.equal(p.controller.view().ratings, null, 'filters get null, so browsing is unaffected');
  p.failures.load = false;
  await p.controller.retry();
  assert.equal(p.controller.view().unavailable, false);
  assert.equal(ratingOf(p.controller.view().ratings, 'r1', 'ed'), 'loved');
});

test('save failure: unavailable, nothing saved, Retry saves the tap that failed', async () => {
  const backing = fakeStorage();
  const p = phone(backing, 'ed');
  await p.controller.init();
  p.failures.save = true;
  await p.controller.tap('r1', 'loved');
  assert.equal(p.controller.view().unavailable, true);
  assert.deepEqual(await createLocalRatingsStore({ storage: backing }).load(), {}, 'nothing was saved');
  p.failures.save = false;
  await p.controller.retry();
  assert.equal(p.controller.view().unavailable, false);
  assert.equal(ratingOf(p.controller.view().ratings, 'r1', 'ed'), 'loved', 'the tap was not lost');
  assert.equal(ratingOf((await createLocalRatingsStore({ storage: backing }).load()), 'r1', 'ed'), 'loved');
});

test('Retry that still fails stays unavailable; a refresh does not hide the problem', async () => {
  const p = phone(fakeStorage(), 'ed', { load: true, save: true });
  await p.controller.init();
  await p.controller.retry();
  assert.equal(p.controller.view().unavailable, true);
  await p.controller.refresh();
  assert.equal(p.controller.view().unavailable, true);
});

test('quick taps in a row are applied in order', async () => {
  const p = phone(fakeStorage(), 'ed');
  await p.controller.init();
  await Promise.all([p.controller.tap('r1', 'loved'), p.controller.tap('r1', 'loved'), p.controller.tap('r1', 'not-for-us')]);
  assert.equal(ratingOf(p.controller.view().ratings, 'r1', 'ed'), 'not-for-us');
});

test('subscribers hear about every change and can stop listening', async () => {
  const p = phone(fakeStorage(), 'ed');
  let calls = 0;
  const stop = p.controller.subscribe(() => calls++);
  await p.controller.init();
  const afterInit = calls;
  assert.ok(afterInit > 0);
  await p.controller.tap('r1', 'loved');
  assert.ok(calls > afterInit);
  stop();
  const frozen = calls;
  await p.controller.tap('r1', 'not-for-us');
  assert.equal(calls, frozen);
});
