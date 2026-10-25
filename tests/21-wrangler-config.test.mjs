import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { read, root, distFiles } from './helpers.mjs';

const config = () => JSON.parse(read('wrangler.jsonc').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'));

test('wrangler.jsonc exists and is a static-assets-only Worker: no code, no bindings, no routes, no account', () => {
  assert.ok(existsSync(join(root, 'wrangler.jsonc')));
  const c = config();
  const forbidden = ['main', 'd1_databases', 'kv_namespaces', 'r2_buckets', 'durable_objects', 'migrations', 'services', 'queues', 'vectorize', 'ai', 'hyperdrive', 'analytics_engine_datasets', 'routes', 'route', 'custom_domain', 'account_id', 'triggers', 'vars', 'env', 'workers_dev_domain'];
  for (const key of forbidden) assert.ok(!(key in c), `no ${key}`);
  assert.ok(!/d1_databases|kv_namespaces|r2_buckets|durable_objects|custom_domain|"routes?"|zone_/i.test(read('wrangler.jsonc')), 'no binding or route words anywhere in the file');
  assert.deepEqual(Object.keys(c).sort(), ['assets', 'compatibility_date', 'name', 'workers_dev']);
});

test('the Worker name is k + 20 random lowercase hex characters and names nothing about the site', () => {
  const { name } = config();
  assert.match(name, /^k[0-9a-f]{20}$/);
  for (const word of ['kitchen', 'kris', 'recipe']) assert.ok(!name.toLowerCase().includes(word), word);
  assert.ok(!/kitchen|kris|recipe/i.test(read('wrangler.jsonc')), 'the word is not anywhere in the file either');
});

test('it serves the built dist folder on the workers.dev address, with a current compatibility date', () => {
  const c = config();
  assert.equal(c.workers_dev, true);
  assert.deepEqual(Object.keys(c.assets), ['directory']);
  assert.equal(c.assets.directory, './dist');
  assert.match(c.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
  const age = (Date.now() - Date.parse(c.compatibility_date)) / 86400000;
  assert.ok(age >= 0 && age < 120, `compatibility_date ${c.compatibility_date} is within the last 120 days and not in the future`);
});

test('the dist leak scan stays clean and dist ships _headers', () => {
  const files = distFiles();
  assert.ok(files.length > 10);
  assert.ok(files.some((f) => f.endsWith('_headers')), '_headers is in dist');
  for (const f of files) {
    if (/\.(png|ico|jpg|woff2?)$/.test(f)) continue;
    const text = readFileSync(f, 'utf8');
    for (const bad of ['Draft-only', 'saffron', 'Hidden Draft Note', 'Nut-free']) assert.ok(!text.includes(bad), `${bad} in ${f}`);
  }
});
