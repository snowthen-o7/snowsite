# alexdiaz.dev

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
├── layouts/
│   └── Layout.astro       # Base layout with nav/footer
├── pages/
│   ├── index.astro        # Homepage
│   ├── services.astro     # Services & pricing
│   ├── contact.astro      # Contact info
│   ├── portfolio/
│   │   ├── index.astro    # Portfolio listing
│   │   └── [project].astro # Individual project pages
│   └── blog/
│       ├── index.astro    # Blog listing
│       └── [post].astro   # Individual blog posts
└── content/               # (Future) Markdown content
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
