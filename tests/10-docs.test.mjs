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
