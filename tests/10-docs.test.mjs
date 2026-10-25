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
  assert.match(doc, /Branch 7[^\n]*failed-operations list[^\n]*localStorage[^\n]*`online` event/i);
  assert.match(doc, /Do not build it (now|yet)/i);
});

test('real-iphone checklist has the week plan items', () => {
  const doc = read('docs/real-iphone-checklist.md');
  assert.match(doc, /Week plan[^\n]*swipe on a real phone[^\n]*swipe left[^\n]*red Remove[^\n]*Release to remove/i);
  assert.match(doc, /Week plan[^\n]*Undo bar[^\n]*replaces the tab bar[^\n]*same height[^\n]*Week tab stays active/i);
  assert.match(doc, /Week plan[^\n]*planned dinners survive close and reopen/i);
  assert.match(doc, /Week plan[^\n]*Safari and the home-screen app (keep )?separate (plan )?storage[^\n]*plan[^\n]*again/i);
  assert.match(doc, /Week plan[^\n]*Plan button[^\n]*day picker/i);
});

test('week store notes say what the server will check', () => {
  const doc = read('docs/week-store-notes.md');
  assert.match(doc, /one dinner per day/i);
  assert.match(doc, /valid recipe ids? only/i);
  assert.match(doc, /timestamped empty entry/i);
  assert.match(doc, /newer[^\n]*wins[^\n]*removal wins a tie/i);
  assert.match(doc, /move[^\n]*two (writes|steps)[^\n]*new day first/i);
  assert.ok(doc.split('\n').length < 40, 'stays short');
});

test('week store notes describe what Retry does for a half-finished move, truthfully', () => {
  const doc = read('docs/week-store-notes.md');
  assert.doesNotMatch(doc, /repeats the whole move safely/i);
  assert.match(doc, /Retry finishes the move[^\n]*skips any that already landed[^\n]*clears the old day/i);
  assert.match(doc, /atomic move/i);
});
