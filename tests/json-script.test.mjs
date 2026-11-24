import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, decode } from './helpers.mjs';
import { jsonForScript } from '../src/scripts/json-script.ts';

test('a title with </script> cannot end the script block: "<" becomes \\u003c and the JSON still parses back', () => {
  const data = [{ id: 'example-9', name: 'Soup</script><img src=x onerror=alert(1)>' }];
  const text = jsonForScript(data);
  assert.ok(!text.includes('<'), text);
  assert.ok(!/<\/script/i.test(text));
  assert.match(text, /\\u003c\/script/);
  assert.deepEqual(JSON.parse(text), data);
});

test('the line and paragraph separators and ">" and "&" are escaped too, and the value still round-trips', () => {
  const data = { a: 'x\u2028y\u2029z & > <!--' };
  const text = jsonForScript(data);
  assert.ok(!/[<>&\u2028\u2029]/.test(text), text);
  assert.deepEqual(JSON.parse(text), data);
});

test('the recipe page puts its catalog through jsonForScript', () => {
  const page = read('src/pages/recipe/[id].astro');
  const view = read('src/components/RecipeView.astro');
  assert.match(page, /<RecipeView[^>]*catalog=\{catalog\}/);
  assert.match(view, /jsonForScript\(catalog\)/);
  assert.ok(!/JSON\.stringify\(catalog\)/.test(view));
  const html = decode(read('dist/recipe/example-1/index.html'));
  const block = html.match(/<script id="catalog" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.ok(!block.includes('<') && JSON.parse(block).length === 6, block);
});
