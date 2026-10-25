import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalRatingsStore, createIdentity, RatingsUnavailableError, RATINGS_KEY, IDENTITY_KEY } from '../src/scripts/ratings-store.ts';
import { isFamilyFavorite } from '../src/scripts/ratings.ts';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] };
}
const clock = (start = 1000, step = 10) => { let t = start; return () => (t += step); };

test('empty at first; a rating is saved under ONE key and loads back', async () => {
  const storage = fakeStorage();
  const store = createLocalRatingsStore({ storage, now: clock() });
  assert.deepEqual(await store.load(), {});
  const after = await store.set('example-1', 'ed', 'loved');
  assert.equal(after['example-1'].ed.value, 'loved');
  assert.deepEqual(storage.keys(), [RATINGS_KEY]);
  assert.deepEqual(await createLocalRatingsStore({ storage }).load(), after, 'a fresh store (page reload) sees the same ratings');
});

test('nothing is saved for the Family favorite', async () => {
  const storage = fakeStorage();
  const store = createLocalRatingsStore({ storage, now: clock() });
  await store.set('example-1', 'ed', 'loved');
  const both = await store.set('example-1', 'kristina', 'loved');
  assert.equal(isFamilyFavorite(both, 'example-1'), true);
  assert.ok(!/favorite/i.test(storage.getItem(RATINGS_KEY)));
});

test('clearing keeps a timestamped empty entry (so the clear can sync)', async () => {
  const store = createLocalRatingsStore({ storage: fakeStorage(), now: clock() });
  await store.set('a', 'ed', 'loved');
  const r = await store.set('a', 'ed', null);
  assert.equal(r.a.ed.value, null);
  assert.ok(r.a.ed.at > 0);
});

test('a garbled stored value falls back to empty, and saving over it works', async () => {
  for (const junk of ['not json', '{"v":1,"entries":5}', '[]', 'null', '{"v":9,"entries":{"a":{"ed":{"value":"loved","at":1}}}}', '']) {
    const storage = fakeStorage();
    storage.setItem(RATINGS_KEY, junk);
    const store = createLocalRatingsStore({ storage, now: clock() });
    assert.deepEqual(await store.load(), {}, junk);
    assert.equal((await store.set('a', 'ed', 'loved')).a.ed.value, 'loved', junk);
  }
});

test('two phones, one shared backing, interleaved edits: nothing is lost', async () => {
  const backing = fakeStorage();
  const tick = clock(1000, 1);
  const phoneEd = createLocalRatingsStore({ storage: backing, now: tick });
  const phoneKris = createLocalRatingsStore({ storage: backing, now: tick });
  await phoneEd.load();
  await phoneKris.load(); // both started from the same (empty) view
  await phoneEd.set('r1', 'ed', 'loved');
  await phoneKris.set('r1', 'kristina', 'loved'); // Kristina's phone never saw Ed's edit
  await phoneEd.set('r2', 'ed', 'not-for-us');
  await phoneKris.set('r3', 'kristina', 'loved');
  await phoneEd.set('r3', 'ed', 'loved');
  const final = await createLocalRatingsStore({ storage: backing }).load();
  assert.equal(final.r1.ed.value, 'loved');
  assert.equal(final.r1.kristina.value, 'loved');
  assert.equal(final.r2.ed.value, 'not-for-us');
  assert.equal(final.r3.kristina.value, 'loved');
  assert.equal(final.r3.ed.value, 'loved');
  assert.equal(isFamilyFavorite(final, 'r1'), true);
  assert.equal(isFamilyFavorite(final, 'r3'), true);
});

test('quick edits on one person: the last tap wins, even inside the same millisecond', async () => {
  const store = createLocalRatingsStore({ storage: fakeStorage(), now: () => 5000 });
  await store.set('a', 'ed', 'loved');
  await store.set('a', 'ed', 'not-for-us');
  await store.set('a', 'ed', 'loved');
  assert.equal((await store.load()).a.ed.value, 'loved');
  await store.set('a', 'ed', null);
  assert.equal((await store.load()).a.ed.value, null, 'clear right after a rating is not undone by the older rating');
});

test('last writer wins by edit time, not by arrival order (a late stale write loses)', async () => {
  const backing = fakeStorage();
  let tA = 2000;
  let tB = 1000; // phone B's clock says its edit happened earlier, but it arrives later
  const a = createLocalRatingsStore({ storage: backing, now: () => tA });
  const b = createLocalRatingsStore({ storage: backing, now: () => tB });
  await a.set('r', 'ed', 'not-for-us');
  await b.set('r', 'ed', 'loved');
  assert.equal((await a.load()).r.ed.value, 'not-for-us');
  await b.set('r', 'kristina', 'loved');
  assert.equal((await a.load()).r.kristina.value, 'loved', 'the other person is still saved');
  assert.equal((await a.load()).r.ed.value, 'not-for-us');
});

test('injectable failure: load and save reject with RatingsUnavailableError and change nothing', async () => {
  const storage = fakeStorage();
  const failures = { load: false, save: false };
  const store = createLocalRatingsStore({ storage, now: clock(), failures });
  await store.set('a', 'ed', 'loved');
  const before = storage.getItem(RATINGS_KEY);
  failures.save = true;
  await assert.rejects(store.set('a', 'ed', 'not-for-us'), RatingsUnavailableError);
  assert.equal(storage.getItem(RATINGS_KEY), before, 'a failed save writes nothing');
  failures.save = false;
  failures.load = true;
  await assert.rejects(store.load(), RatingsUnavailableError);
  failures.load = false;
  assert.equal((await store.load()).a.ed.value, 'loved', 'works again once the failure clears (Retry)');
});

test('storage that throws (blocked, full) is reported as unavailable, not a crash', async () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() {} };
  const store = createLocalRatingsStore({ storage: boom });
  await assert.rejects(store.load(), RatingsUnavailableError);
  await assert.rejects(store.set('a', 'ed', 'loved'), RatingsUnavailableError);
});

test('bad arguments are rejected', async () => {
  const store = createLocalRatingsStore({ storage: fakeStorage() });
  await assert.rejects(store.set('a', 'bob', 'loved'), TypeError);
  await assert.rejects(store.set('a', 'ed', 'meh'), TypeError);
  await assert.rejects(store.set('bad id!', 'ed', 'loved'), TypeError);
  await assert.rejects(store.set('__proto__', 'ed', 'loved'), TypeError);
});

test('identity: "I\'m Ed / I\'m Kristina" is remembered, changeable, and a bad value means not chosen', () => {
  const storage = fakeStorage();
  const me = createIdentity(storage);
  assert.equal(me.get(), null);
  me.set('kristina');
  assert.equal(createIdentity(storage).get(), 'kristina');
  me.set('ed');
  assert.equal(createIdentity(storage).get(), 'ed');
  assert.deepEqual(storage.keys(), [IDENTITY_KEY]);
  storage.setItem(IDENTITY_KEY, 'bob');
  assert.equal(me.get(), null);
  assert.throws(() => me.set('bob'), TypeError);
  const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() {} };
  assert.equal(createIdentity(boom).get(), null);
  assert.doesNotThrow(() => createIdentity(boom).set('ed'));
});
