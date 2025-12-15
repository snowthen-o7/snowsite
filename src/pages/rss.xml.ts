import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

// In a real setup, you'd pull these from content collections
const posts = [
  {
    slug: 'building-csv-diff-tool',
    title: 'Building a CSV Diff Tool for API Regression Testing',
    date: '2024-12-15',
    description: 'How I built a high-concurrency Python tool to catch data feed regressions before they hit production.',
  }
];

export function GET(context: APIContext) {
  return rss({
    title: 'Alex Diaz',
    description: 'Technical writing, devlogs, and things I\'ve learned',
    site: context.site ?? 'https://alexdiaz.dev',
    items: posts.map(post => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.description,
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
