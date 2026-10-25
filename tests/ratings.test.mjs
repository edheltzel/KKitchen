import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIKED_OPTIONS,
  PEOPLE,
  PERSON_LABEL,
  RATING_LABEL,
  ratingOf,
  isFamilyFavorite,
  likedBy,
  removedFamilyFavorite,
  mergeRatings,
  sanitizeRatings,
} from '../src/scripts/ratings.ts';

const e = (value, at) => ({ value, at });

test('two people, labelled exactly Ed and Kristina; two buttons, Loved it and Not for us', () => {
  assert.deepEqual([...PEOPLE], ['ed', 'kristina']);
  assert.deepEqual(PERSON_LABEL, { ed: 'Ed', kristina: 'Kristina' });
  assert.deepEqual(RATING_LABEL, { loved: 'Loved it', 'not-for-us': 'Not for us' });
});

test('Family favorite is derived: only when both people say Loved it', () => {
  const r = { a: { ed: e('loved', 1) } };
  assert.equal(isFamilyFavorite(r, 'a'), false, 'one person is not enough');
  r.a.kristina = e('not-for-us', 2);
  assert.equal(isFamilyFavorite(r, 'a'), false, 'Not for us is not Loved it');
  r.a.kristina = e('loved', 3);
  assert.equal(isFamilyFavorite(r, 'a'), true);
  r.a.ed = e(null, 4);
  assert.equal(isFamilyFavorite(r, 'a'), false, 'clearing one rating removes it');
  assert.equal(isFamilyFavorite({}, 'missing'), false);
});

test('nothing is saved for the favorite: it is not a stored field', () => {
  const r = { a: { ed: e('loved', 1), kristina: e('loved', 2) } };
  assert.deepEqual(Object.keys(r.a).sort(), ['ed', 'kristina']);
  assert.ok(!JSON.stringify(r).includes('favorite'));
});

test('ratingOf ignores inherited keys and unknown recipes', () => {
  assert.equal(ratingOf({}, 'constructor', 'ed'), null);
  assert.equal(ratingOf({ a: { ed: e('loved', 1) } }, 'a', 'kristina'), null);
  assert.equal(ratingOf({ a: { ed: e('loved', 1) } }, 'a', 'ed'), 'loved');
});

test('likedBy lists who liked it, and "untried" only when nobody has rated', () => {
  assert.deepEqual([...likedBy({}, 'a')], ['untried']);
  assert.deepEqual([...likedBy({ a: { ed: e('loved', 1) } }, 'a')], ['ed']);
  assert.deepEqual([...likedBy({ a: { ed: e('loved', 1), kristina: e('loved', 1) } }, 'a')].sort(), ['ed', 'favorite', 'kristina']);
  assert.deepEqual([...likedBy({ a: { ed: e('not-for-us', 1) } }, 'a')], [], 'tried, but nobody loved it');
  assert.deepEqual([...likedBy({ a: { ed: e(null, 5) } }, 'a')], ['untried'], 'a cleared rating counts as not tried');
});

test('removedFamilyFavorite: true only when an edit takes a favorite away', () => {
  const both = { a: { ed: e('loved', 1), kristina: e('loved', 2) } };
  const cleared = { a: { ed: e(null, 3), kristina: e('loved', 2) } };
  const switched = { a: { ed: e('not-for-us', 3), kristina: e('loved', 2) } };
  assert.equal(removedFamilyFavorite(both, cleared, 'a'), true);
  assert.equal(removedFamilyFavorite(both, switched, 'a'), true);
  assert.equal(removedFamilyFavorite(cleared, both, 'a'), false);
  assert.equal(removedFamilyFavorite({}, cleared, 'a'), false);
});

test('mergeRatings: last writer wins per recipe + person; the other person is never overwritten', () => {
  const a = { r1: { ed: e('loved', 10) }, r2: { kristina: e('loved', 5) } };
  const b = { r1: { ed: e('not-for-us', 20), kristina: e('loved', 1) }, r3: { ed: e('loved', 7) } };
  const m = mergeRatings(a, b);
  assert.equal(m.r1.ed.value, 'not-for-us', 'newer edit wins');
  assert.equal(m.r1.kristina.value, 'loved', 'other person kept');
  assert.equal(m.r2.kristina.value, 'loved');
  assert.equal(m.r3.ed.value, 'loved');
  assert.deepEqual(mergeRatings(a, b), mergeRatings(b, a), 'order of merging does not matter');
  assert.deepEqual(mergeRatings(m, m), m, 'merging twice changes nothing');
});

test('merge: a newer clear (tombstone) beats an older rating, and equal times are deterministic', () => {
  const m = mergeRatings({ r: { ed: e('loved', 5) } }, { r: { ed: e(null, 9) } });
  assert.deepEqual(m.r.ed, e(null, 9));
  const t1 = mergeRatings({ r: { ed: e('loved', 5) } }, { r: { ed: e('not-for-us', 5) } });
  const t2 = mergeRatings({ r: { ed: e('not-for-us', 5) } }, { r: { ed: e('loved', 5) } });
  assert.deepEqual(t1, t2);
});

test('sanitizeRatings drops anything malformed instead of trusting it', () => {
  const dirty = {
    ok: { ed: e('loved', 1) },
    'bad id!': { ed: e('loved', 1) },
    p: { ed: e('meh', 1), kristina: e('loved', -3), nobody: e('loved', 1) },
    q: { ed: { value: 'loved', at: 'x' }, kristina: e(null, 2.9) },
    r: 'text',
  };
  Object.defineProperty(dirty, '__proto__', { value: { ed: e('loved', 1) }, enumerable: true }); // an own key, as JSON.parse makes
  assert.deepEqual(sanitizeRatings(dirty), { ok: { ed: e('loved', 1) }, q: { kristina: e(null, 2) } });
  for (const junk of [null, 5, 'x', [], undefined]) assert.deepEqual(sanitizeRatings(junk), {});
});

test('"Who liked it" options: exact labels, in tray order', () => {
  assert.deepEqual(LIKED_OPTIONS, [
    { value: 'favorite', label: 'Family favorites' },
    { value: 'ed', label: 'Ed loved it' },
    { value: 'kristina', label: 'Kristina loved it' },
    { value: 'untried', label: 'Not tried yet' },
  ]);
});
