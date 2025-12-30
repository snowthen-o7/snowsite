# alexdiaz.me

Personal website and blog built with [Astro](https://astro.build).

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── SeasonalEffects.astro  # Seasonal visual effects (snow, leaves, etc.)
│   ├── CsvToolkit/            # CSV toolkit React components
│   └── WebhookInspector/      # Webhook inspector React components
├── layouts/
│   └── Layout.astro           # Base layout with nav/footer
├── lib/                       # Shared utilities and engines
│   ├── csv-parser.ts          # CSV parsing logic
│   ├── diff-engine.ts         # Diff comparison engine
│   ├── merge-engine.ts        # CSV merge logic
│   ├── dedupe-engine.ts       # Deduplication logic
│   ├── transform-engine.ts    # Data transformation logic
│   └── upstash.ts             # Upstash Redis client
├── pages/
│   ├── index.astro            # Homepage
│   ├── services.astro         # Services & pricing
│   ├── contact.astro          # Contact info
│   ├── rss.xml.ts             # RSS feed
│   ├── api/webhook/           # Webhook API endpoints
│   ├── tools/
│   │   ├── index.astro        # Tools listing
│   │   ├── csv-toolkit.astro  # CSV toolkit tool
│   │   └── webhook-inspector.astro
│   ├── portfolio/
│   │   ├── index.astro        # Portfolio listing
│   │   └── *.astro            # Individual project pages
│   └── blog/
│       ├── index.astro        # Blog listing
│       └── *.astro            # Individual blog posts
├── styles/
│   └── global.css             # Global styles
└── types/
    └── csv.ts                 # CSV type definitions
```

## Adding a Blog Post

1. Create a new `.astro` file in `src/pages/blog/`
2. Add the post metadata to the `posts` array in `src/pages/blog/index.astro`

For a more scalable approach, consider migrating to [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/).

## Deployment

This site is configured to deploy automatically via:

- **Vercel**: Connect your GitHub repo at [vercel.com](https://vercel.com)
- **Netlify**: Connect your GitHub repo at [netlify.com](https://netlify.com)

Both platforms will auto-detect Astro and configure the build settings.

## Customization

- Update `astro.config.mjs` with your actual domain
- Replace contact info in `src/pages/contact.astro`
- Update social links throughout
- Customize colors in `src/layouts/Layout.astro` (CSS variables)

## License

Content is copyright. Code structure is MIT.
