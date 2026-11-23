import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme, contrast, read } from './helpers.mjs';

const css = read('src/styles/global.css');
const report = (label, ratio) => console.log(`  contrast ${ratio.toFixed(2)}:1  ${label}`);

// Branch 3a pairs, both themes, existing kk tokens only. Text needs 4.5:1; a state indicator needs 3:1.
for (const name of ['kk-light', 'kk-dark']) {
  test(`${name}: rating row, badge, picker and notices text >= 4.5:1, state fills >= 3:1`, () => {
    const t = theme(name);
    const text = [
      ['rating status line (muted) on card', t['--kk-muted'], t['--kk-card']],
      ['rating button text on card', t['--color-base-content'], t['--kk-card']],
      ['Loved it pressed / Family favorite badge / Retry / Undo text on primary', t['--color-primary-content'], t['--color-primary']],
      ['Not for us pressed text', t['--color-base-100'], t['--color-base-content']],
      ['notice text on notice background (card)', t['--color-base-content'], t['--kk-card']],
      ['picker hint (muted) on page', t['--kk-muted'], t['--color-base-100']],
    ];
    for (const [label, fg, bg] of text) {
      const r = contrast(fg, bg);
      report(`${name}: ${label} ${fg} on ${bg}`, r);
      assert.ok(r >= 4.5, `${label} = ${r.toFixed(2)}`);
    }
    const states = [
      ['Loved it pressed fill vs card', t['--color-primary'], t['--kk-card']],
      ['Not for us pressed fill vs card', t['--color-base-content'], t['--kk-card']],
      ['badge fill vs the tile it sits on', t['--color-primary'], t['--kk-tile-to']],
      ['notice border vs page', t['--color-primary'], t['--color-base-100']],
    ];
    for (const [label, a, b] of states) {
      const r = contrast(a, b);
      report(`${name}: ${label} ${a} vs ${b}`, r);
      assert.ok(r >= 3, `${label} = ${r.toFixed(2)}`);
    }
  });
}

const rule = (selector) => {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${selector} rule exists`);
  return css.slice(start, css.indexOf('}', start) + 1);
};

test('rating styles: 44px targets, tokens only (no hard-coded colours), pressed states, focus ring', () => {
  const btn = rule('.kk-rate-btn {');
  assert.match(btn, /min-height:\s*2\.75rem/);
  const rules = [btn, rule(".kk-rate-btn[aria-pressed='true'][data-rating='loved']"), rule(".kk-rate-btn[aria-pressed='true'][data-rating='not-for-us']"), rule('.kk-fav-badge {'), rule('.kk-notice {'), rule('.kk-rate-status {')].join('\n');
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(rules), 'no hard-coded colours');
  assert.match(rule(".kk-rate-btn[aria-pressed='true'][data-rating='loved']"), /background:\s*var\(--color-primary\)/);
  assert.match(rule(".kk-rate-btn[aria-pressed='true'][data-rating='not-for-us']"), /background:\s*var\(--color-base-content\)/);
  assert.match(css, /\.kk-rate-btn:focus-visible/);
  assert.match(css, /\.kk-rate-btn:disabled/);
});

test('a paused Who liked it chip is dashed and uses tokens only, so it reads as paused in both themes', () => {
  const paused = rule('.kk-chip-paused {');
  assert.match(paused, /border-style:\s*dashed/);
  assert.match(paused, /background(-color)?:\s*var\(--kk-card\)|background(-color)?:\s*transparent/);
  assert.match(paused, /color:\s*var\(--color-base-content\)/);
  assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(/i.test(paused), 'no hard-coded colours');
});
