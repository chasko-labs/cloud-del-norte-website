# cloud del norte — developer guide

> a love letter to the stack. welcome to the desert.

cloud del norte is a community radio + events platform for the el paso / ciudad juárez border region. it's built entirely on static hosting, serverless auth, a self-hosted CI runner, and a 3D babylon.js dune wallpaper that nobody asked for but everybody seems to love.

this doc is the map. read it once, then go listen to kexp.

---

## the sites

three independently-built SPAs share one repo and one pipeline:

| url | vite config | output dir | purpose |
|-----|-------------|------------|---------|
| `clouddelnorte.org` | `vite.config.ts` | `lib/` | main app — feed, events, radio, admin |
| `auth.clouddelnorte.org` | `vite.config.auth.ts` | `lib-auth/` | cognito auth flows (login/signup/verify/forgot) |
| `dev.clouddelnorte.org` | `vite.config.ts` | `lib/` | dev branch preview — same build, different bucket |
| `awsug.clouddelnorte.org` | `vite.config.awsug.ts` | `lib-awsug/` | aws user group subsite |

all four are static — no server, no lambda, no edge function. just s3 + cloudfront + a content-type header and you're done.

---

## language + toolchain

```
TypeScript 6     — strict mode, no any escapes, tsconfig.json at root
React 19         — concurrent mode, hooks-first, no class components
CSS              — vanilla, heavy custom properties (--cdn-*, --awsui-*), no preprocessors
GLSL             — inline in TS as template strings, compiled by babylon.js ShaderMaterial
Node 22          — build scripts (.mjs), uses native fetch
YAML             — woodpecker CI pipeline definitions
Bash             — deploy scripts, hooks, cert management
```

**build toolchain:**

| tool | role | why |
|------|------|-----|
| Vite 8 + Rollup | bundler | es modules first, manualChunks splits babylon + cloudscape into named long-lived cache targets |
| TypeScript 6 | typecheck | runs `tsc --noEmit` as a CI gate; type errors block deploy |
| Biome 2 | lint + format | replaces ESLint + Prettier in one binary; configured at `biome.json` |
| Vitest 4 | unit tests | jsdom environment; `@testing-library/react` for component tests |
| fast-xml-parser | RSS/podcast | server-side + client-side XML parsing for podcast episode metadata |

---

## the build pipeline

```
npm run build
  └─ node scripts/fetch-feeds.mjs            # RSS + podcast episodes → public/data/*.json
  └─ node scripts/fetch-releases.mjs         # github releases API → releases.generated.json
  └─ node scripts/fetch-next-meetup.mjs      # next meetup date
  └─ tsc                                     # typecheck (blocks on error)
  └─ vite build                              # main site → lib/
  └─ vite build --config vite.config.auth.ts # auth site → lib-auth/
  └─ vite build --config vite.config.awsug.ts# awsug → lib-awsug/
```

**pre-build scripts** run before vite. they write JSON into `public/data/` which vite includes in the build output. this gives the app server-side-fetched RSS data with no CORS issues, no runtime latency, and clean fallbacks when feeds are down.

**chunk splitting** — babylon.js is monolithic and heavy. we carve it into named rollup chunks by module path so browsers cache each independently:

```
babylon-shaders      ~599kB   GLSL source strings (can't fragment further)
babylon-core         ~varies  engine primitives
babylon-animations   ~450kB   animation system
babylon-meshes       large    geometry
babylon-materials    large    material system
cloudscape-core      ~560kB   AWS design system primitives
cloudscape-layout    ~varies  AppLayout, TopNav, SideNav, BreadcrumbGroup
cloudscape-forms     ~varies  Form, Input, Select, Checkbox
cloudscape-tables    ~varies  Table, Cards, CollectionHooks
```

when you only change app code, the browser fetches only the app chunk — the babylon + cloudscape chunks stay cached from the prior deploy.

**cache headers strategy:**
```
HTML + non-hashed files  →  Cache-Control: no-cache
/assets/* (hashed names) →  Cache-Control: public, max-age=31536000, immutable
```

hashed filenames make it safe to ship immutable cache on assets — if a file changes, its hash changes, and the browser fetches the new one.

---

## aws architecture

> exact account IDs, distribution IDs, role ARNs, and bucket names are in the deployment config. this section covers topology, not secrets.

**account:** one aws account hosts all site infrastructure (aerospaceug-admin). no multi-account complexity for the website itself.

**static hosting pattern:**

```
GitHub → Woodpecker CI → S3 bucket (private, OAC)
                              ↓
                        CloudFront distribution
                              ↓
                        Route53 → clouddelnorte.org
```

each of the four sites (main, auth, dev, awsug) has:
- one private S3 bucket (public access fully blocked — only CloudFront OAC can read)
- one CloudFront distribution with OAC
- one ACM certificate (us-east-1, required for CloudFront)
- one Route53 A record

infrastructure is declared in `infra/dev-site.cfn.yaml` (cloudformation). prod infra is applied manually; dev auto-provisions via the CFN template.

**auth:**
AWS Cognito user pool backs `auth.clouddelnorte.org`. the auth site is a pure SPA — cognito hosted UI is not used. we build the forms ourselves on Cloudscape, call Cognito APIs directly. the auth site runs on its own subdomain so the session cookie scope matches.

**zero long-lived IAM keys:**
CI runs entirely via IAM RolesAnywhere. a workload x509 certificate is mounted into the woodpecker agent at `$WOODPECKER_BACKEND_DOCKER_VOLUMES`. the deploy pipeline:

```
workload x509 cert + aws_signing_helper
  → rolesanywhere credential-process
  → assumed role: heraldstack-ci-deploy
  → s3:PutObject on site buckets
  → cloudfront:CreateInvalidation on distributions
```

no `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` ever touches a config file or CI secret. the cert is the credential.

**secrets:** stored in SSM Parameter Store under `/heraldstack/shared/`. accessed at runtime via `hs-secret load /heraldstack/shared` which evals exports into the shell. never `.env` files, never committed.

**notifications:**
- `ntfy.sh` push: deploy events → phone
- AWS SNS topic: `cdn-deploy-alerts` → email/SMS

**estimated monthly cost (low-traffic profile):**

| service | what it does | est. $/mo |
|---------|-------------|-----------|
| S3 (4 buckets) | static asset storage, CI screenshots | ~$0.50 |
| CloudFront (4 distributions) | CDN, HTTPS, caching | ~$1-2 |
| ACM | TLS certificates | $0 |
| Route53 (1 hosted zone) | DNS | $0.50 |
| Cognito | auth (free tier covers ~50k MAU) | $0 |
| SNS | deploy notifications | ~$0.01 |
| EC2 bastion (CI host) | woodpecker agent, wireguard endpoint | ~$5-8 |
| IAM RolesAnywhere | zero-key auth infra | $0 |
| **total** | | **~$7-12/mo** |

> this is a remarkably cheap production setup for a site that runs babylon.js, cognito auth, live radio, and CI with playwright screenshots. the static-hosting architecture earns its keep.

---

## CI/CD — woodpecker

woodpecker runs self-hosted at `ci.bryanchasko.com`. the agent is a docker container on the bastion EC2. webhooks from github route through an nginx proxy on the bastion, then to the local woodpecker server.

three pipeline files in `.woodpecker/`:

**`ci.yml`** — quality gates, runs on main + PR:
```
tier-0-draft-gate      alpine  skip if PR is labeled 'draft'
tier-0-skip-ci-gate    alpine  skip if commit message has [skip ci]
tier-0-metadata        alpine  print repo/commit/branch/event
install                node:22 npm ci
biome                  biome   lint + format check (error-level diagnostic = fail)
typecheck              node:22 tsc --noEmit (after fetch-releases.mjs)
build                  node:22 full npm run build
audit                  node:22 npm audit --audit-level=high (failure: ignore)
scan-secrets           gitleaks detect --exit-code 1
```

**`deploy.yml`** — syncs to S3 + invalidates CloudFront, runs on push to main or dev:
```
install   node:22
build     node:22
deploy         → lib/  → awsaerospace.org (main site)
deploy-auth    → lib-auth/ → auth.clouddelnorte.org
deploy-awsug   → lib-awsug/ → awsug.clouddelnorte.org
deploy-dev     → lib/ → dev.clouddelnorte.org  (dev branch only)
notify-*       ntfy.sh + SNS
```

liora assets (`liora/*`, `liora-embed/*`) are excluded from `--delete` syncs — they're managed out-of-band and shared between prod and dev.

**`screenshot.yml`** — playwright captures after deploy, failure: ignore:
```
sleep 90  (wait for CloudFront propagation)
node scripts/ci-screenshot.mjs <url> /tmp/shots
aws s3 sync /tmp/shots → <bucket>/_ci/screenshots/<sha>/
aws s3 sync /tmp/shots → <bucket>/_ci/screenshots/latest/
```

screenshots live at `https://dev.clouddelnorte.org/_ci/screenshots/latest/` for dev deploys, and at the prod equivalent for main. when you want to verify a visual change deployed correctly, check there — no VPN required.

**git workflow:**

```
edit code → commit to dev → push dev
  ↓
woodpecker deploy.yml → dev.clouddelnorte.org
  ↓
verify at dev.clouddelnorte.org (or via CI screenshot)
  ↓
git checkout main && git merge dev && git push main
  ↓
woodpecker deploy.yml → clouddelnorte.org + auth + awsug
```

never push directly to main. main is prod.

---

## remote development

local dev on rocm-aibox (linux workstation, amd gpu). nothing in the cloud runs hot for dev — no dev lambda, no dev container, no hot-reload CDN.

```bash
npm run dev        # main site, port 8080
npm run dev:auth   # auth site, port 8081
```

**remote access when not at the workstation:**

```
macbook air / pixel9
    ↓ WireGuard tunnel
EC2 bastion (aerospaceug)
    ↓ SSH ForwardAgent
rocm-aibox workstation
    ↓ SSH
  code lives here
```

WireGuard is configured on the bastion with rocm-aibox as a permanent peer. wireguard config lives at `~/code/heraldstack/heraldstack-infra/`. for remote sessions: `wg show` on the bastion to verify the peer is up, then `ssh rocm-aibox` from the bastion.

git identity flows via SSH agent forwarding — no PATs on remote machines. rocm-aibox is the trust anchor for github identity. macmini + other machines borrow that identity for git ops via `ForwardAgent yes` in `~/.ssh/config`.

---

## external APIs

**cognito** — auth flows: sign-in, sign-up, confirm account, forgot/reset password. the auth SPA calls cognito's auth API directly (no hosted UI). user pool is in the same aws account.

**icecast / zeno streams** — live radio. the persistent player sets `<audio src="...">` directly. no proxy. stream URLs live in `src/lib/streams.ts`. currently ~12 live radio stations + 8 podcasts.

**RSS podcast feeds** — two access paths:
1. server-side at build time via `scripts/fetch-feeds.mjs` → `public/data/podcast-episodes.json` (no CORS issue)
2. client-side fetch at runtime → falls back to build-time cache if CORS blocked

**op3.dev** — podcast analytics proxy for some episode audio URLs. if you see op3.dev in a stream URL, it's an analytics passthrough, not an origin. the actual MP3 is further in the redirect chain.

**youtube oembed** — `https://www.youtube.com/oembed` resolves meeting embed metadata. called during the meeting build step.

**github releases API** — `scripts/fetch-releases.mjs` fetches release notes at build time → `releases.generated.json`. the file is gitignored; CI generates it. GITHUB_TOKEN is optional — the script degrades gracefully when absent.

**ntfy.sh** — `https://ntfy.sh/cdn-deploy-74697e0f` — deploy push notifications. topic is effectively a secret by obscurity (not private). messages go to phone.

---

## the dune scene

the 3D dune wallpaper is the site's personality. it runs on babylon.js 9 with a custom GLSL shader in `src/dune/DuneMaterial.ts`. it has its own perf budget, reduced-motion gate, and rollout flag.

```
src/dune/
  SceneBootstrap.ts      engine + scene lifecycle, perf gate, ?dune=static fallback
  AnimationController.ts time-of-day, camera breathe, sun wobble, logo pulse
  DuneGround.ts          subdivided plane mesh, passes uniforms to shader
  DuneMaterial.ts        GLSL vertex + fragment shader, White Sands morphology
  white-sands-features.ts tunable constants (speeds, amplitudes, sparkle)
  Atmosphere.ts          fog, ambient light, station-tint integration
  Skybox.ts              gradient sky plane
  HazeBackdrop.ts        camera-parented horizon haze billboard
  AudioAdapter.ts        reads --cdn-bass/mid/treble CSS vars
  dune-colors.ts         phase-weighted palette (time-of-day color mixing)
  blue-noise.ts          blue-noise texture for dithered sparkle
```

**perf budget:**
- 120-frame warmup before the gate activates
- if median frame time exceeds 8ms, canvas gets `dune-perf-degraded` class and the fallback gradient div stays visible
- `?dune=static` in the URL forces static cream fallback without a code change — useful rollback lever

**audio reactivity:**
- `--cdn-bass`, `--cdn-mid`, `--cdn-treble` CSS vars written to `:root` each frame by `src/lib/background-viz/canvas.ts`
- `--station-primary-light-rgb` set on `:root` when a station starts playing
- the dune shader reads these via `AudioAdapter.sample()` which reads computed CSS variable values

**photosensitivity budget:**
all temporal effects must stay under 3 Hz (epilepsy foundation / WCAG 2.3.1).
current values in `white-sands-features.ts`:

```ts
SPARKLE_SPEED_SILENT = 0.25   // ~0.5 Hz when idle
SPARKLE_SPEED_PLAYING = 1.0   // ~2 Hz when playing — SAFE UPPER BOUND, do not raise
SPARKLE_SPEED_REDUCED = 0.0   // sparkle off with prefers-reduced-motion
```

---

## auth flow overview

```
user → auth.clouddelnorte.org/login
  ↓
Cloudscape form → Cognito API
  ↓
success → redirect to clouddelnorte.org with cognito tokens in URL hash
  ↓
clouddelnorte.org/auth/callback → parse tokens → sessionStorage → app state
```

the four auth pages (login, signup, verify, forgot-password) share `AuthLayout` in `src/sites/auth/_layout/`. the layout tags `<body>` with `cdn-auth-subdomain` on mount — CSS uses this to taper the dune canvas alpha, pin the footer, and apply amber CTA button overrides.

---

## code quality standards

**biome** is the single source of truth for lint + format. no eslint, no prettier.

```bash
npm run lint          # biome lint src/
npm run format        # biome format --write src/
npm run format:check  # biome check src/  (CI uses this — no --write)
```

biome CI runs in parallel with `install` — it doesn't need node_modules. it fails the pipeline at `--diagnostic-level=error`.

**typecheck** runs after install because it needs node_modules. generates `releases.generated.json` first (some types depend on it).

**tests:**

```bash
npm test              # vitest run (single pass)
npm run test:watch    # vitest (watch mode)
npm run coverage      # vitest --coverage
```

tests live in `src/lib/__tests__/`. key files: `streams.test.ts` (stream definitions, location formatting), `dune-colors.test.ts` (shader color mixing). the full suite is 400+ tests; all must pass before a commit is merge-ready.

**the rule:** typecheck + biome + tests green before you push. CI will tell you if you didn't.

---

## secrets pattern

| where | what lives there | how to access |
|-------|-----------------|---------------|
| AWS SSM `/heraldstack/shared/` | github PAT, API keys, cognito IDs | `hs-secret load /heraldstack/shared` |
| workload x509 cert `~/.config/hs-secret/` | IAM RolesAnywhere operator identity | used by aws SDK via credential-process |
| CI workload cert `/workload.{crt,key}` | CI deploy identity (docker volume mount) | used by `aws_signing_helper` in pipelines |
| Woodpecker secrets | ntfy topic, WOODPECKER_GITHUB_* | set via woodpecker UI, not files |

never commit a `.env` file. never hardcode a key. if you find one, rotate it.
