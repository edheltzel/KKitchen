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

test('Branch 7 notes: store errors come in two kinds, retry and rejected, for ratings and the week plan', () => {
  for (const file of ['docs/ratings-store-notes.md', 'docs/week-store-notes.md']) {
    const doc = read(file);
    assert.match(doc, /Branch 7[^\n]*two kinds of store error[^\n]*"retry"[^\n]*"rejected"/i, file);
    assert.match(doc, /"rejected"[^\n]*(drop|dropped)[^\n]*(message|says)[^\n]*never[^\n]*front of the failed list/i, file);
  }
  assert.match(read('docs/ratings-store-notes.md'), /ratings/i);
  assert.match(read('docs/week-store-notes.md'), /week/i);
});

test('week store notes list what to do for the real store phase', () => {
  const doc = read('docs/week-store-notes.md');
  assert.match(doc, /Plan sheet shows "Free" for every day until the first read answers[^\n]*loading state like ratings/i);
  assert.match(doc, /replacing a dinner has no Undo[^\n]*"Replaced X" note/i);
  assert.match(doc, /does not reload when the week rolls over[^\n]*past Sunday night[^\n]*last week's days/i);
  assert.match(doc, /recipe is gone[^\n]*"a recipe"[^\n]*"A" tile/i);
  assert.match(doc, /both banners show together above the search bar[^\n]*checked in `e2e\/plan\.e2e\.mjs`/i);
});

test('real-iphone checklist: a swipe must not open the change sheet, and the last card clears the bars', () => {
  const doc = read('docs/real-iphone-checklist.md');
  assert.match(doc, /a swipe must not also open the change sheet[^\n]*click-swallow timer[^\n]*Safari/i);
  assert.match(doc, /last card clears the bars with the keyboard up and with the Undo bar showing/i);
});

test('Retry replays the saved plan, not a fresh one: the stale-old-day risk is written down for the real store', () => {
  for (const file of ['docs/week-store-notes.md', 'docs/ratings-store-notes.md']) {
    const doc = read(file);
    assert.match(doc, /Retry replays the saved plan, not a fresh one\. If another phone changed the old day in between, the clear could erase that dinner\. For the real store, Retry re-checks the old day first, or the server owns the move \(one atomic move call\)\./, file);
  }
});

test('real-iphone checklist has the recipe page items', () => {
  const doc = read('docs/real-iphone-checklist.md');
  assert.match(doc, /Recipe page[^\n]*ticks survive closing the home-screen app[^\n]*reopen[^\n]*still ticked/i);
  assert.match(doc, /Recipe page[^\n]*Safari and the home-screen app keep separate (tick )?storage[^\n]*tick again/i);
  assert.match(doc, /Recipe page[^\n]*Back[^\n]*same filters and scroll/i);
  assert.match(doc, /Recipe page[^\n]*Reset checks[^\n]*Undo/i);
  assert.match(doc, /Recipe page[^\n]*tick rows[^\n]*thumb/i);
});

test('ticks store notes: ticks are per phone by design and never shared', () => {
  const doc = read('docs/ticks-store-notes.md');
  assert.match(doc, /per phone by design[^\n]*never shared/i);
  assert.match(doc, /`kk:ticks`/);
  assert.match(doc, /no timestamps/i);
  assert.match(doc, /Do not (move|add) (them|ticks) to the (shared|real) store/i);
  assert.ok(doc.split('\n').length < 30, 'stays short');
});

test('ticks store notes say what Retry does to a tick made in another tab', () => {
  const doc = read('docs/ticks-store-notes.md');
  assert.match(doc, /Retry clears the saved list and re-adds what is on screen[^\n]*another tab[^\n]*blocked[^\n]*lost/i);
  assert.ok(doc.split('\n').length < 30, 'stays short');
});

test('real-iphone checklist: tapping just outside each button on a card opens the recipe (the whole card is a tap target)', () => {
  const doc = read('docs/real-iphone-checklist.md');
  assert.match(doc, /tap just outside each button on a card[^\n]*what opens[^\n]*whole card is a tap target/i);
});

test('ratings notes record that a tap with nobody picked opens the picker and is not applied', () => {
  const doc = read('docs/ratings-store-notes.md');
  assert.match(doc, /nobody picked[^\n]*in place[^\n]*not (applied|saved)[^\n]*taps again/i);
});

test('real-iphone checklist: cooking mode items (Wake Lock, tap zones, a 10 minute cook, Exit and reload)', () => {
  const doc = read('docs/real-iphone-checklist.md');
  assert.match(doc, /Cooking mode[^\n]*Wake Lock[^\n]*Safari[^\n]*installed home-screen app/i);
  assert.match(doc, /Cooking mode[^\n]*tap zones[^\n]*thumb/i);
  assert.match(doc, /Cooking mode[^\n]*screen stays on[^\n]*10 minute/i);
  assert.match(doc, /Cooking mode[^\n]*Exit[^\n]*reload[^\n]*(keep|keeps)[^\n]*place/i);
});

test('cooking mode notes: why steps use replaceState, the hash, tap zones, the wake lock states, what Done clears', () => {
  const doc = read('docs/cooking-mode-notes.md');
  assert.match(doc, /replaceState[^\n]*Back leaves cooking mode/i);
  assert.match(doc, /`#step-N`[^\n]*`#done`/);
  assert.match(doc, /left 35%[^\n]*back/i);
  assert.match(doc, /Screen stays on[^\n]*Screen may sleep/i);
  assert.match(doc, /Done clears[^\n]*ticks[^\n]*Undo/i);
  assert.match(doc, /Done[^\n]*Ed \/ Kristina[^\n]*picker[^\n]*(mock|differs)/i);
  assert.match(doc, /Finish/);
  assert.ok(doc.split('\n').length < 40, 'stays short');
});

test('real-iphone checklist: VoiceOver may read the step twice, and a cmd-click on Exit may release the screen lock (desktop only)', () => {
  const doc = read('docs/real-iphone-checklist.md');
  const voice = doc.split('\n').find((l) => /VoiceOver/.test(l) && /Cooking mode/.test(l));
  assert.ok(voice, 'a Cooking mode VoiceOver item');
  assert.match(voice, /step heading/);
  assert.match(voice, /live region/);
  assert.match(voice, /twice/);
  const cmd = doc.split('\n').find((l) => /cmd-click/i.test(l) && /Exit/.test(l));
  assert.ok(cmd, 'a cmd-click on Exit item');
  assert.match(cmd, /desktop only/i);
  assert.match(cmd, /screen lock|wake lock/i);
});
