import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalWeekStore, WEEK_KEY, WeekPlanUnavailableError } from '../src/scripts/week-store.ts';

function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let t = 1000;
const now = () => (t += 10);
const WED = '2026-10-28';
const THU = '2026-10-29';

test('an empty store loads an empty plan', async () => {
  assert.deepEqual(await createLocalWeekStore({ storage: fakeStorage(), now }).load(), {});
});

test('set saves one dinner for a day, with a time, under the one key kk:week', async () => {
  const storage = fakeStorage();
  const store = createLocalWeekStore({ storage, now });
  const plan = await store.set(WED, 'r1');
  assert.equal(plan[WED].recipeId, 'r1');
  assert.equal(typeof plan[WED].at, 'number');
  assert.deepEqual([...storage.m.keys()], [WEEK_KEY]);
  assert.equal(WEEK_KEY, 'kk:week');
  assert.deepEqual(await createLocalWeekStore({ storage, now }).load(), plan, 'a new store instance (a reopened app) sees it');
});

test('one dinner per day: setting the same day again replaces the dinner', async () => {
  const store = createLocalWeekStore({ storage: fakeStorage(), now });
  await store.set(WED, 'r1');
  const plan = await store.set(WED, 'r2');
  assert.equal(Object.keys(plan).length, 1);
  assert.equal(plan[WED].recipeId, 'r2');
});

test('clearing a day keeps a timestamped empty entry instead of deleting the day', async () => {
  const storage = fakeStorage();
  const store = createLocalWeekStore({ storage, now });
  const planned = await store.set(WED, 'r1');
  const cleared = await store.set(WED, null);
  assert.equal(cleared[WED].recipeId, null);
  assert.ok(cleared[WED].at > planned[WED].at, 'the removal is newer than the plan');
  assert.ok(JSON.parse(storage.m.get(WEEK_KEY)).entries[WED], 'still saved');
});

test('quick changes in the same millisecond still move forward in time', async () => {
  const store = createLocalWeekStore({ storage: fakeStorage(), now: () => 5000 });
  const a = await store.set(WED, 'r1');
  const b = await store.set(WED, null);
  const c = await store.set(WED, 'r2');
  assert.ok(a[WED].at < b[WED].at && b[WED].at < c[WED].at);
});

test('two phones: a removal made later is not undone when the other phone saves a different day', async () => {
  const backing = fakeStorage();
  const a = createLocalWeekStore({ storage: backing, now });
  const b = createLocalWeekStore({ storage: backing, now });
  await a.set(WED, 'r1');
  await b.set(WED, null); // phone B removes Wednesday
  const plan = await a.set(THU, 'r2'); // phone A saves another day afterwards
  assert.equal(plan[WED].recipeId, null);
  assert.equal(plan[THU].recipeId, 'r2');
});

test('a garbled value, a wrong version or the wrong shape all load as an empty plan', async () => {
  for (const raw of ['{{not json', '"text"', '{"v":2,"entries":{}}', '{"v":1,"entries":[1,2]}', 'null', '{"v":1}']) {
    const store = createLocalWeekStore({ storage: fakeStorage({ [WEEK_KEY]: raw }), now });
    assert.deepEqual(await store.load(), {}, raw);
  }
});

test('a garbled value does not stop the next save', async () => {
  const store = createLocalWeekStore({ storage: fakeStorage({ [WEEK_KEY]: '{{garbage' }), now });
  assert.equal((await store.set(WED, 'r1'))[WED].recipeId, 'r1');
});

test('bad days and bad recipe ids are rejected before anything is saved', async () => {
  const storage = fakeStorage();
  const store = createLocalWeekStore({ storage, now });
  await assert.rejects(store.set('2026-02-30', 'r1'), TypeError);
  await assert.rejects(store.set('Wednesday', 'r1'), TypeError);
  await assert.rejects(store.set(WED, 'bad id!'), TypeError);
  await assert.rejects(store.set(WED, undefined), TypeError);
  assert.equal(storage.m.size, 0);
});

test('with a list of known recipes, an unknown recipe id is rejected (what the server will do)', async () => {
  const store = createLocalWeekStore({ storage: fakeStorage(), now, knownRecipeIds: new Set(['r1']) });
  await store.set(WED, 'r1');
  await assert.rejects(store.set(THU, 'r9'), TypeError);
  await store.set(WED, null); // clearing never needs a recipe
});

test('injectable failure: load and save each reject as unavailable, and nothing is changed by a failed save', async () => {
  const storage = fakeStorage();
  const failures = { load: false, save: false };
  const store = createLocalWeekStore({ storage, now, failures });
  await store.set(WED, 'r1');
  failures.save = true;
  await assert.rejects(store.set(THU, 'r2'), WeekPlanUnavailableError);
  failures.save = false;
  failures.load = true;
  await assert.rejects(store.load(), WeekPlanUnavailableError);
  failures.load = false;
  assert.deepEqual(Object.keys(await store.load()), [WED]);
});

test('storage that throws (private mode, full) is unavailable, not a crash', async () => {
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  const store = createLocalWeekStore({ storage, now });
  await assert.rejects(store.load(), WeekPlanUnavailableError);
  await assert.rejects(store.set(WED, 'r1'), WeekPlanUnavailableError);
  const onlyWrites = { getItem: () => null, setItem: () => { throw new Error('full'); } };
  await assert.rejects(createLocalWeekStore({ storage: onlyWrites, now }).set(WED, 'r1'), WeekPlanUnavailableError);
});
