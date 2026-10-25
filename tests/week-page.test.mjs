import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, decode } from './helpers.mjs';

const week = decode(read('dist/week/index.html'));
const stack = week.match(/<div id="bottom-stack"[\s\S]*$/)?.[0] ?? '';

test('the Week page is the week view, not the placeholder; the Week tab is the current page', () => {
  assert.ok(!/Coming soon/.test(week));
  assert.match(week, /<h1[^>]*>This week<\/h1>/);
  assert.match(week, /id="week-range"/);
  assert.match(week, /<a[^>]*href="\/week\/"[^>]*aria-current="page"/);
  assert.match(week, /Example recipes only/);
});

test('seven day rows, Monday to Sunday, filled in by the page script (no dinners in the markup)', () => {
  const rows = [...week.matchAll(/<li[^>]*data-slot="(\d)"[^>]*>[\s\S]*?<span[^>]*kk-week-day[^>]*>(\w+)<\/span>/g)];
  assert.deepEqual(rows.map((r) => [r[1], r[2]]), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => [String(i), d]));
  assert.ok(!/data-day=/.test(week), 'days come from the phone calendar, so they are set by the script');
  assert.ok(!/Hidden Draft Note/.test(week));
});

test('the hint under the list says Remove is on every dinner and swipe also works', () => {
  assert.match(week, /Remove on every dinner\. Swipe left works too\./);
});

test('a polite live region announces what a change did', () => {
  assert.match(week, /<p[^>]*id="week-live"[^>]*aria-live="polite"/);
});

test('the Add a dinner sheet lists the six approved example recipes by id, as buttons', () => {
  const sheet = week.match(/<dialog[^>]*id="add-sheet"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.ok(sheet, 'dialog exists');
  const buttons = [...sheet.matchAll(/<button[^>]*data-id="([^"]+)"[^>]*data-name="([^"]*)"[^>]*>/g)];
  assert.deepEqual(buttons.map((b) => b[1]), ['example-1', 'example-2', 'example-3', 'example-4', 'example-5', 'example-6']);
  for (const b of buttons) assert.match(b[0], /type="button"/);
  assert.match(sheet, /id="add-title"/);
});

test('"Week plan unavailable" banner with Retry sits above the tab bar and starts hidden, in the same slot as the ratings one', () => {
  assert.match(stack, /<div[^>]*id="week-unavailable"[^>]*role="alert"[^>]*hidden[^>]*>[\s\S]*<p[^>]*>Week plan unavailable\. Your changes will save when you tap Retry\.<\/p>[\s\S]*<button[^>]*id="week-retry"[^>]*>\s*Retry\s*<\/button>/);
  assert.ok(stack.indexOf('id="week-unavailable"') < stack.indexOf('<nav'));
});

test('the Undo bar takes the tab bar\'s place, just before the nav, hidden to start', () => {
  const bar = stack.match(/<div[^>]*id="undo-bar"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(bar, /role="status"/);
  assert.match(bar, /\bhidden\b/);
  assert.match(bar, /class="[^"]*\bkk-undo-bar\b/);
  assert.match(bar, /id="undo-text"/);
  assert.match(bar, /<button[^>]*id="undo-button"[^>]*>\s*Undo\s*<\/button>/);
  assert.ok(stack.indexOf('id="undo-bar"') < stack.indexOf('<nav'));
});

test('the page leaves room for whatever is stacked at the bottom (tab bar, Undo bar, banner), measured not guessed', () => {
  const base = read('src/layouts/Base.astro');
  assert.match(base, /kk-room/);
  assert.match(base, /import ['"]\.\.\/scripts\/stack-room['"]/);
  assert.match(read('src/styles/global.css'), /\.kk-room\s*\{[^}]*padding-bottom:\s*calc\(var\(--kk-stack-height,/);
  assert.match(read('src/scripts/stack-room.ts'), /ResizeObserver[\s\S]*--kk-stack-height/);
});
