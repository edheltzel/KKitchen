import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backAction } from '../src/scripts/back-link.ts';

const origin = 'http://127.0.0.1:4399';

test('opened from the Recipes list (any filters): Back steps back in history, so the list keeps its scroll and filters', () => {
  for (const path of ['/', '/?q=pasta', '/?meal=dinner&time=30&who=favorite']) {
    assert.equal(backAction({ referrer: origin + path, origin, historyLength: 3 }), 'history', path);
  }
});

test('opened any other way, Back is a plain link to the last Recipes URL', () => {
  const cases = [
    { referrer: '', historyLength: 3 }, // typed or bookmarked
    { referrer: origin + '/week/', historyLength: 3 },
    { referrer: origin + '/favorites/', historyLength: 3 },
    { referrer: origin + '/recipe/example-2/', historyLength: 3 },
    { referrer: 'https://example.com/', historyLength: 3 },
    { referrer: 'https://evil.test/?q=x', historyLength: 3 },
    { referrer: origin + '/', historyLength: 1 }, // a fresh tab: nothing to step back to
    { referrer: 'not a url', historyLength: 3 },
  ];
  for (const c of cases) assert.equal(backAction({ ...c, origin }), 'link', JSON.stringify(c));
});

test('a look-alike origin is not the same origin', () => {
  assert.equal(backAction({ referrer: 'http://127.0.0.1:43999/', origin, historyLength: 3 }), 'link');
  assert.equal(backAction({ referrer: origin + '.evil.test/', origin, historyLength: 3 }), 'link');
});
