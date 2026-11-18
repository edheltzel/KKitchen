// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // The tests and the e2e harness read the built pages from dist/, where a static build writes them.
  build: { client: './' },
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
});
