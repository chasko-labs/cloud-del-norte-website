# AWS User Group Cloud Del Norte — Website

Community website for the **AWS User Group Cloud Del Norte** (formerly awsaerospace), serving the North Coast region.

🌐 **Live:** <https://d2ly3jmh1f74xt.cloudfront.net>
📅 **Meetup:** <https://www.meetup.com/cloud-del-norte/>

---

## Stack

| Layer | Technology |
| ----- | ---------- |
| Bundler | Vite 7 (multi-page app) |
| UI | React 19 + [Cloudscape Design System](https://cloudscape.design/) 3.x |
| Language | TypeScript 5.9 |
| Tests | Vitest + @testing-library/react |
| Linter | ESLint 10 (flat config — `eslint.config.js`) |
| Build output | `./lib/` |
| Hosting | S3 + CloudFront |

---

## Getting Started

```bash
npm install              # install dependencies
npm run dev              # dev server at localhost:8080
npm run build            # tsc + vite build → ./lib/
npm run lint             # eslint
npm test                 # vitest run
npm run test:watch       # vitest (watch mode)
npm run test:ui          # vitest --ui
npm run coverage         # vitest run --coverage
```

Quality gate before deploy: `npm run lint && npm test && npm run build`

---

## Architecture

This is a **multi-page app (MPA)** — each page is an independent Vite entry point. There is no React Router and no shared runtime bundle between pages.

### Page anatomy

Every page requires exactly three files:

```
src/pages/<name>/
  index.html    ← Vite HTML entry point
  main.tsx      ← mounts React root, imports global styles + tokens
  app.tsx       ← page component tree wrapped in Shell
```

### Pages

| Page | Path |
| ---- | ---- |
| Home | `src/pages/home/` |
| Meetings | `src/pages/meetings/` |
| Create Meeting | `src/pages/create-meeting/` |
| Learning / API | `src/pages/learning/api/` |
| Maintenance Calendar | `src/pages/maintenance-calendar/` |

### Adding a new page

1. Create `src/pages/<name>/` with `index.html`, `main.tsx`, and `app.tsx`
2. Register the entry in `vite.config.ts` → `build.rollupOptions.input`
3. Add a nav item in `src/components/navigation/index.tsx`

### Key conventions

- **Deep imports only** — `import Button from '@cloudscape-design/components/button'` (never barrel imports)
- **No path aliases** — all imports use relative paths
- **Cloudscape only** — no other UI component libraries
- **No backend** — static site; data fetched at build time and bundled as JSON

See [AGENTS.md](AGENTS.md) for the full architectural conventions and constraints.

---

## Deploy

```bash
npm run build
aws s3 sync lib/ s3://awsaerospace.org --delete --profile bc-website
aws cloudfront create-invalidation \
  --distribution-id ECC3LP1BL2CZS \
  --paths "/*" \
  --profile bc-website
```

Deploy is fully manual — no CI/CD pipeline.

---

## AI Agent Team

This project uses [Squad](https://github.com/bradygaster/squad) v0.5.4 with [HeraldStack](https://github.com/BryanChasko/HeraldStack) personas for AI-assisted development. Run `copilot --agent squad` to engage the team. See [AGENTS.md](AGENTS.md) for agent roles and routing.

---

## Security

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License

The sample code is available under a modified MIT license. See the [LICENSE](LICENSE) file.
