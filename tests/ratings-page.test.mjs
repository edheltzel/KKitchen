import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, decode, distFiles, root } from './helpers.mjs';

const home = decode(read('dist/index.html'));
const tray = home.match(/<dialog[\s\S]*?<\/dialog>/)?.[0] ?? '';
const articles = [...home.matchAll(/<article [^>]*data-example[\s\S]*?<\/article>/g)].map((m) => m[0]);
const stack = home.match(/<div id="bottom-stack"[\s\S]*$/)?.[0] ?? '';

test('every card has its id and a compact rating row: Loved it and Not for us, 44px, not pressed', () => {
  assert.equal(articles.length, 6);
  const ids = articles.map((a) => a.match(/<article[^>]*data-id="([^"]+)"/)?.[1]);
  assert.deepEqual(ids, ['example-1', 'example-2', 'example-3', 'example-4', 'example-5', 'example-6']);
  for (const a of articles) {
    assert.match(a, /role="group"[^>]*aria-label="Ratings for Example recipe: [^"]+"/);
    const buttons = [...a.matchAll(/<button[^>]*data-rating="([\w-]+)"[^>]*>([^<]*)<\/button>/g)];
    assert.deepEqual(buttons.map((b) => [b[1], b[2].trim()]), [['loved', 'Loved it'], ['not-for-us', 'Not for us']]);
    for (const b of buttons) {
      assert.match(b[0], /aria-pressed="false"/);
      assert.match(b[0], /type="button"/);
      assert.match(b[0], /class="kk-rate-btn"/);
    }
    assert.match(a, /data-person="ed"[^>]*>Ed: not rated yet</);
    assert.match(a, /data-person="kristina"[^>]*>Kristina: not rated yet</);
  }
});

test('the Family favorite badge exists on each card but is hidden until both people say Loved it', () => {
  for (const a of articles) assert.match(a, /<span[^>]*data-role="family-badge"[^>]*\bhidden\b[^>]*>[^<]*Family favorite<\/span>/);
});

test('"I\'m Ed / I\'m Kristina" picker: two toggles, exact labels, nothing chosen in the markup', () => {
  const picks = [...home.matchAll(/<button[^>]*data-me="(\w+)"[^>]*>([^<]*)<\/button>/g)];
  assert.deepEqual(picks.map((p) => [p[1], p[2].trim()]), [['ed', "I'm Ed"], ['kristina', "I'm Kristina"]]);
  for (const p of picks) {
    assert.match(p[0], /aria-pressed="false"/);
    assert.match(p[0], /class="kk-chip"/);
  }
  assert.match(home, /id="me-hint"[^>]*>[^<]*who you are/);
  assert.match(home, /<fieldset[^>]*id="me-picker"/, 'a tap with nobody picked scrolls to this');
});

test('"Ratings unavailable" banner with Retry sits above the search bar and starts hidden', () => {
  assert.match(stack, /<div[^>]*id="ratings-unavailable"[^>]*role="alert"[^>]*hidden[^>]*>[\s\S]*<p[^>]*>Ratings unavailable\. Your last tap will save when you tap Retry\.<\/p>[\s\S]*<button[^>]*id="ratings-retry"[^>]*>\s*Retry\s*<\/button>/);
  assert.ok(stack.indexOf('id="ratings-unavailable"') < stack.indexOf('id="search-form"'), 'banner sits above the search bar');
});

test('Undo bar takes the tab bar\'s place: right where the nav is, role=status, hidden to start, Undo button', () => {
  const bar = stack.match(/<div[^>]*id="undo-bar"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(bar, /role="status"/);
  assert.match(bar, /\bhidden\b/);
  assert.match(bar, /class="[^"]*\bkk-undo-bar\b/);
  assert.ok(!/kk-notice/.test(bar), 'it is a bar, not a floating notice');
  assert.match(bar, /<button[^>]*id="undo-button"[^>]*>\s*Undo\s*<\/button>/);
  const at = stack.indexOf('id="undo-bar"');
  assert.ok(at > stack.indexOf('id="search-form"'), 'below the search bar');
  assert.ok(at < stack.indexOf('<nav'), 'immediately before the tab bar, in its slot');
  assert.ok(!stack.slice(stack.indexOf('id="ratings-unavailable"'), stack.indexOf('id="search-form"')).includes('undo-bar'), 'not stacked above search any more');
});

test('tray has a "Who liked it" group: Family favorites, Ed loved it, Kristina loved it, Not tried yet', () => {
  const chips = [...tray.matchAll(/<button[^>]*data-group="who"[^>]*data-value="([^"]*)"[^>]*>([^<]*)<\/button>/g)];
  assert.deepEqual(chips.map((c) => [c[1], c[2].trim()]), [
    ['favorite', 'Family favorites'],
    ['ed', 'Ed loved it'],
    ['kristina', 'Kristina loved it'],
    ['untried', 'Not tried yet'],
  ]);
  for (const c of chips) {
    assert.match(c[0], /aria-pressed="false"/);
    assert.match(c[0], /class="kk-chip"/);
  }
  assert.match(tray, /Who liked it/);
  assert.match(tray, /id="who-note"[^>]*>[^<]*any of them/);
});

test('no rating or favorite data is baked into the built page (ratings live only on the phone)', () => {
  assert.ok(!/data-rated|data-loved|aria-pressed="true"/.test(home));
  assert.ok(distFiles().length > 0);
});
