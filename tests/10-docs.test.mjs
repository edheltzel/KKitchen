import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

test('real-iphone checklist: Safari and the home-screen app keep separate storage', () => {
  const doc = read('docs/real-iphone-checklist.md');
  assert.match(doc, /Safari and the home-screen app keep separate storage/i);
  assert.match(doc, /pick "I'm Ed"[^\n]*again after installing/i);
  assert.match(doc, /Safari ratings (will not|won't) appear in the app/i);
  assert.match(doc, /shared store[^\n]*only the picker repeats/i);
});

test('ratings store notes cover ids, server time, the loading state and the Favorites tab', () => {
  const doc = read('docs/ratings-store-notes.md');
  assert.match(doc, /fixed `id` field[^\n]*not the title/i);
  assert.match(doc, /example-\d+/);
  assert.match(doc, /stamps the time on the server[^\n]*ignores the phone clock/i);
  assert.match(doc, /loading state[^\n]*before the real store/i);
  assert.match(doc, /Favorites tab[^\n]*Family favorites/i);
  assert.match(doc, /branch 5\/6/i);
  assert.ok(doc.split('\n').length < 40, 'stays short');
});
