import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, read, decode } from './helpers.mjs';

test('npm run build passes', () => {
  execSync('npm run build', { cwd: root, stdio: 'pipe', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  assert.ok(existsSync(join(root, 'dist/index.html')));
});

for (const page of ['index.html', 'week/index.html', 'favorites/index.html']) {
  test(`dist/${page} has noindex, manifest link, viewport-fit=cover, both theme-colors`, () => {
    const html = decode(read(`dist/${page}`));
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /name="theme-color" content="#FAF6EF" media="\(prefers-color-scheme: light\)"/);
    assert.match(html, /name="theme-color" content="#1E1713" media="\(prefers-color-scheme: dark\)"/);
    assert.match(html, /<meta name="apple-mobile-web-app-title" content="Kris's"/);
  });
}
