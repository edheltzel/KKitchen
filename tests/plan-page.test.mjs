import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, decode } from './helpers.mjs';

const home = decode(read('dist/index.html'));
const cards = [...home.matchAll(/<article[^>]*data-example[\s\S]*?<\/article>/g)].map((m) => m[0]);

test('every recipe card has a Plan button and an empty plan-status line, in the card body', () => {
  assert.equal(cards.length, 6);
  for (const card of cards) {
    assert.match(card, /<button[^>]*type="button"[^>]*data-role="plan"[^>]*>\s*Plan\s*<\/button>/);
    assert.match(card, /<button[^>]*data-role="plan"[^>]*aria-label="Plan Example recipe: [^"]+ for a day"/);
    assert.match(card, /<p[^>]*data-role="plan-status"[^>]*hidden/);
  }
});

test('the day picker sheet comes after the filter tray, which stays the first dialog', () => {
  const dialogs = [...home.matchAll(/<dialog[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(dialogs, ['filter-tray', 'plan-sheet']);
});

test('the day picker lists Monday to Sunday as buttons with a status line each', () => {
  const sheet = home.match(/<dialog[^>]*id="plan-sheet"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(sheet, /id="plan-title"/);
  const rows = [...sheet.matchAll(/<button[^>]*data-slot="(\d)"[^>]*>[\s\S]*?<span[^>]*data-role="day-label"[^>]*>(\w+)<\/span>[\s\S]*?data-role="day-status"/g)];
  assert.deepEqual(rows.map((r) => r[2]), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  for (const r of rows) assert.match(r[0], /type="button"/);
  assert.ok(!/data-day=/.test(sheet), 'dates come from the phone calendar, set by the script');
});

test('the Recipes page has its own Week plan banner, hidden, in the slot above the tab bar', () => {
  const stack = home.match(/<div id="bottom-stack"[\s\S]*$/)?.[0] ?? '';
  assert.match(stack, /<div[^>]*id="week-unavailable"[^>]*role="alert"[^>]*hidden[^>]*>[\s\S]*Week plan unavailable\. Your changes will save when you tap Retry\.[\s\S]*id="week-retry"/);
  assert.ok(stack.indexOf('id="week-unavailable"') < stack.indexOf('<nav'));
  assert.match(home, /<p[^>]*id="plan-live"[^>]*aria-live="polite"/);
});
