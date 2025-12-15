import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://alexdiaz.dev', // Update this with your actual domain
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
