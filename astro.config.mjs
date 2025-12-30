import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  adapter: vercel(),
  integrations: [react()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
  site: 'https://alexdiaz.me',
  vite: {
    plugins: [tailwindcss()],
  },
});
