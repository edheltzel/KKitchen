import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

const src = read('src/styles/global.css');

test('while the Undo bar shows, the tab bar is taken out of the page (and the accessibility tree)', () => {
  assert.match(src, /#bottom-stack\[data-undo=['"]on['"]\]\s+\.kk-dock\s*\{[^}]*display:\s*none/);
  assert.match(src, /\.kk-undo-bar\s*\{[^}]*padding:[^}]*env\(safe-area-inset-bottom\)/, 'same safe-area padding as the tab bar');
  assert.match(src, /\.kk-undo-bar\s*\{[^}]*border-top:/);
});

