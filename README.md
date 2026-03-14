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
| Theme Preview | `src/pages/theme/` |

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

## Localization

The site supports two locales, toggled via 🇺🇸↔🇲🇽 in the top navigation:

| Locale | Flag | Description |
| ------ | ---- | ----------- |
| `us` | 🇺🇸 | New Mexican English — El Paso Spanglish + local slang |
| `mx` | 🇲🇽 | Chihuahua norteño Spanish — Ciudad Juárez dialect |

Translation files live in `src/locales/`:
- `en-US.json` — English (source of truth)
- `es-MX.json` — Spanish (human-reviewed translations)

Components use the `useTranslation()` hook:

```tsx
import { useTranslation } from '../../hooks/useTranslation';

export default function MyComponent() {
  const { t } = useTranslation();
  return <Header>{t('namespace.headerTitle')}</Header>;
}
```

See [LOCALIZATION.md](LOCALIZATION.md) for dialect guides, key naming conventions, and translation workflow.

---

## Deploy

### CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` triggers on pushes to `main` that touch `src/`,
`public/`, `package.json`, `package-lock.json`, `vite.config.ts`, or `tsconfig.json`.

It runs: `npm install` → `npm run build` → `aws s3 sync` → CloudFront invalidation.

**Required repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Purpose |
| ------ | ------- |
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_ROLE_ARN` | IAM role ARN for OIDC (optional if using keys) |

> ⚠️ If secrets are not configured, the workflow builds successfully but
> **silently skips** the S3 deploy and CloudFront invalidation.

### Manual deploy

```bash
aws sso login --profile aerospaceug-admin
npm run lint && npm test && npm run build
aws s3 sync lib/ s3://awsaerospace.org --delete --profile aerospaceug-admin
aws cloudfront create-invalidation \
  --distribution-id ECC3LP1BL2CZS \
  --paths "/*" \
  --profile aerospaceug-admin
```

| Resource | Value |
| -------- | ----- |
| AWS CLI profile | `aerospaceug-admin` (SSO) |
| S3 bucket | `awsaerospace.org` |
| CloudFront distribution | `ECC3LP1BL2CZS` |
| CloudFront domain | `d2ly3jmh1f74xt.cloudfront.net` |

---

## AI Agent Team

This project uses [Squad](https://github.com/bradygaster/squad) v0.5.4 with [HeraldStack](https://github.com/BryanChasko/HeraldStack) personas for AI-assisted development. Run `copilot --agent squad` to engage the team. See [AGENTS.md](AGENTS.md) for agent roles and routing.

---

## Security

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License

The sample code is available under a modified MIT license. See the [LICENSE](LICENSE) file.
