import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const read = (rel) => readFileSync(join(root, rel), 'utf8');

export const decode = (html) =>
  html.replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

// WCAG 2.x contrast
const lum = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Read the custom properties of one daisyUI theme block out of src/styles/global.css. */
export const theme = (name) => {
  const css = read('src/styles/global.css');
  const blocks = css.split('@plugin "daisyui/theme" {').slice(1);
  const block = blocks.find((b) => b.includes(`name: "${name}"`));
  if (!block) throw new Error(`theme ${name} not found`);
  const body = block.slice(0, block.indexOf('\n}'));
  const vars = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6});/g)) vars[m[1]] = m[2].toUpperCase();
  return vars;
};

export const distFiles = (dir = join(root, 'dist'), acc = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    e.isDirectory() ? distFiles(p, acc) : acc.push(p);
  }
  return acc;
};
