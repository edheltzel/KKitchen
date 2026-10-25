import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme, contrast } from './helpers.mjs';

const light = theme('kk-light');
const dark = theme('kk-dark');
const report = (label, ratio) => console.log(`  contrast ${ratio.toFixed(2)}:1  ${label}`);

test('light: white button text on #B8421F fill >= 4.5', () => {
  assert.equal(light['--color-primary'], '#B8421F');
  assert.equal(light['--color-primary-content'], '#FFFFFF');
  const r = contrast(light['--color-primary-content'], light['--color-primary']);
  report('white on #B8421F', r);
  assert.ok(r >= 4.5);
});

test('light: small accent text >= 4.5 on card (#F1EADD), paper (#FAF6EF) and white card', () => {
  const accent = light['--kk-accent-text'];
  assert.ok(accent, 'accent text token exists');
  assert.equal(light['--color-base-100'], '#FAF6EF');
  assert.equal(light['--color-base-200'], '#F1EADD');
  for (const [label, bg] of [
    ['#F1EADD', light['--color-base-200']],
    ['#FAF6EF', light['--color-base-100']],
    ['card ' + light['--kk-card'], light['--kk-card']],
  ]) {
    const r = contrast(accent, bg);
    report(`${accent} on ${label}`, r);
    assert.ok(r >= 4.5);
  }
});

test('dark: accent #F08A57 >= 4.5 on #1E1713 and on card', () => {
  assert.equal(dark['--color-primary'], '#F08A57');
  assert.equal(dark['--kk-accent-text'], '#F08A57');
  for (const [label, bg] of [
    ['bg ' + dark['--color-base-100'], dark['--color-base-100']],
    ['card ' + dark['--kk-card'], dark['--kk-card']],
  ]) {
    const r = contrast(dark['--kk-accent-text'], bg);
    report(`#F08A57 on ${label}`, r);
    assert.ok(r >= 4.5);
  }
  const r = contrast(dark['--color-primary-content'], dark['--color-primary']);
  report('dark button text on #F08A57', r);
  assert.ok(r >= 4.5);
});

test('muted text >= 4.5 on its backgrounds', () => {
  for (const t of [light, dark]) {
    for (const bg of [t['--color-base-100'], t['--kk-card']]) {
      const r = contrast(t['--kk-muted'], bg);
      report(`${t['--kk-muted']} muted on ${bg}`, r);
      assert.ok(r >= 4.5);
    }
  }
});
