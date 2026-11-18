import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { read, decode, root } from './helpers.mjs';

const page = decode(read('dist/favorites/index.html'));
const articles = [...page.matchAll(/<article [^>]*data-example[\s\S]*?<\/article>/g)].map((m) => m[0]);

test('favorites page builds with the Recipes layout hooks', () => {
  assert.match(page, /<h1[^>]*>Favorites<\/h1>/);
  assert.match(page, /<meta name="robots" content="noindex"/);
  assert.match(page, /id="recipe-grid"/);
  assert.match(page, /aria-current="page"[^>]*>[\s\S]*Favorites/);
});

test('empty line names a Family favorite and links to Recipes', () => {
  assert.match(page, /<div[^>]*id="empty"[^>]*hidden[^>]*class="mt-6 rounded-2xl border border-base-300 bg-kk-card p-5 text-center"/);
  assert.match(page, /<p[^>]*id="empty-message"[^>]*>A Family favorite is a recipe both Ed and Kristina loved\.<\/p>/);
  assert.match(page, /<a href="\/"[^>]*>\s*Recipes\s*<\/a>/);
});

test('one card per approved recipe, Family favorite badge hidden', () => {
  assert.equal(articles.length, 6);
  const ids = articles.map((a) => a.match(/data-id="([^"]+)"/)?.[1]);
  assert.deepEqual(ids, ['example-1', 'example-2', 'example-3', 'example-4', 'example-5', 'example-6']);
  for (const a of articles) {
    assert.match(a, /<article[^>]*\bhidden\b/);
    assert.match(a, /<span[^>]*data-role="family-badge"[^>]*\bhidden\b[^>]*>[^<]*Family favorite<\/span>/);
  }
});

test('the favorites script hides cards that are not Family favorites', () => {
  const tags = page.match(/<script type="module" src="([^"]+)"><\/script>/g) ?? [];
  const href = tags.map((tag) => tag.match(/src="([^"]+)"/)?.[1]).find((h) => h?.includes('favorites'));
  assert.ok(href, 'page loads the favorites script');
  const js = readFileSync(join(root, 'dist', href.replace(/^\//, '')), 'utf8');
  assert.match(js, /\.hidden\s*=/);
  const source = read('src/scripts/favorites.ts');
  assert.match(source, /isFamilyFavorite/);
  assert.match(source, /card\.hidden = !keep/);
  assert.ok(!source.includes('innerHTML'), 'text is not set through innerHTML');
});
