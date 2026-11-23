import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { distFiles } from './helpers.mjs';

const LIMIT_BYTES = 100 * 1024; // 102400

test('total built CSS stays under 100 KB raw', () => {
  const files = distFiles().filter((f) => f.endsWith('.css'));
  assert.ok(files.length > 0, 'dist has CSS (run the build first)');
  const total = files.reduce((sum, f) => sum + statSync(f).size, 0);
  console.log(`  total CSS: ${total} bytes of ${LIMIT_BYTES}`);
  assert.ok(total <= LIMIT_BYTES, `built CSS is ${total} bytes, limit ${LIMIT_BYTES}`);
});
