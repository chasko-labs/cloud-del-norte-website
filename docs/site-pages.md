# Cloud Del Norte — site pages inventory

Last updated: 2026-05-02 (v0.0.0031).

Three vite configs build the production sites:

- `vite.config.ts` — main site (clouddelnorte.org), `src/pages/`
- `vite.config.auth.ts` — auth subdomain (auth.clouddelnorte.org), `src/sites/auth/`
- `vite.config.awsug.ts` — AWS UG subdomain (awsug.clouddelnorte.org), `src/sites/awsug/`

Every page that imports `src/layouts/shell/index.tsx` automatically gets:

- `<CdnWallpaper />` — gypsum-dune (light) / starfield (dark) animated background
- `<PersistentPlayer />` — radio player at the bottom
- `<Footer />` — community description + version sticker

`<HelpPanel />` only renders if a page passes a `tools={...}` prop to Shell.

## main site (clouddelnorte.org)

| page | route | source app | player | helpPanel | wallpaper | left-nav linked? | notes |
|---|---|---|---|---|---|---|---|
| feed | `/feed/index.html` | `src/pages/feed/app.tsx` | yes | HelpPanelHome | yes | no (top-nav identity + logo) | canonical landing |
| home | `/home/index.html` | `src/pages/home/app.tsx` | yes | HelpPanelHome | yes | no | duplicate of feed (legacy rename — confirm canonical) |
| roadmap | `/roadmap/index.html` | `src/pages/roadmap/app.tsx` | yes | none | yes | yes (plans) | help drawer empty — UX gap |
| meetings | `/meetings/index.html` | `src/pages/meetings/app.tsx` | yes | HelpPanelHome | yes | yes (top) | top entry in side nav |
| create-meeting | `/create-meeting/index.html` | `src/pages/create-meeting/app.tsx` | yes | own HelpPanelContent | yes | no (CTA-only) | only page with bespoke help content |
| learning/api | `/learning/api/index.html` | `src/pages/learning/api/app.tsx` | yes | none | yes | yes (references → api basics) | help drawer empty |
| maintenance-calendar | `/maintenance-calendar/index.html` | `src/pages/maintenance-calendar/app.tsx` | yes | none | yes | yes (references → tech debt countdowns) | help drawer empty |
| theme | `/theme/index.html` | `src/pages/theme/app.tsx` | yes | none | yes | yes (plans → design system) | design system reference |
| auth/callback | `/auth/callback/index.html` | `src/pages/auth/callback/app.tsx` | no | no | no | no | bare Spinner/Alert — failure branch should wrap in Shell |
| admin | `/admin/index.html` | `src/pages/admin/app.tsx` | yes | none | yes | yes (moderator-only) | RequireAuth gate; help drawer empty |
| dune-test | `/dune-test/index.html` | `src/pages/dune-test/main.ts` (vanilla TS) | no | no | no (own canvas) | no | standalone Babylon harness, no React, no Shell |

## auth subdomain (auth.clouddelnorte.org)

All auth pages wrap in `src/sites/auth/_layout/index.tsx` which renders `<Shell>` — gets wallpaper + footer + tokens. Audit (2026-05-02) flagged 9 cohesion issues; commit sequence in flight.

| page | route | source app | player | helpPanel | wallpaper | notes |
|---|---|---|---|---|---|---|
| login | `/login/index.html` | `src/sites/auth/login/app.tsx` | yes | HelpPanelHome (irrelevant — leaks) | yes | de-dup formError; minimize side nav |
| signup | `/signup/index.html` | `src/sites/auth/signup/app.tsx` | yes | HelpPanelHome | yes | same; six-cell verification code follow-up |
| verify | `/verify/index.html` | `src/sites/auth/verify/app.tsx` | yes | HelpPanelHome | yes | same |
| forgot-password | `/forgot-password/index.html` | `src/sites/auth/forgot-password/app.tsx` | yes | HelpPanelHome | yes | same |

## awsug subdomain (awsug.clouddelnorte.org)

All wrap `src/sites/awsug/_layout/index.tsx` → Shell.

| page | route | source app | notes |
|---|---|---|---|
| home | `/index.html` | `src/sites/awsug/app.tsx` | own sub-nav |
| auth/redeem | `/auth/redeem/index.html` | `src/sites/awsug/auth/redeem/app.tsx` | redeem invite token |
| meetings | `/meetings/index.html` | `src/sites/awsug/meetings/app.tsx` | mirrors main meetings |
| create-meeting | `/create-meeting/index.html` | `src/sites/awsug/create-meeting/app.tsx` | mirrors main create-meeting |
| admin | `/admin/index.html` | `src/sites/awsug/admin/app.tsx` | moderator-only |

## weakest pages — cohesion gaps

- **dune-test** — fully orphan. No Shell, top-nav, logo, player, wallpaper, or exit affordance. Either move to a moderator-gated `/labs/` route or wrap in Shell with a back-to-home breadcrumb.
- **auth/callback** — bare Cloudscape Box/Spinner; if OIDC exchange fails the user lands on a chrome-less page. Cheap fix: wrap the error branch in Shell.
- **roadmap, learning/api, maintenance-calendar, theme, admin** — Shell is good but `tools={...}` is undefined; help icon is a dead button. Either ship a generic HelpPanelHome on every Shell page or pass `toolsHide={true}` on AppLayout for pages without bespoke help.
- **home vs feed** — both default-export Shell with identical HelpPanelHome and Navigation; likely a leftover rename. Decide canonical and redirect the other.
- **auth subdomain** — currently inherits unscoped main-site SideNavigation + irrelevant HelpPanelHome. Cohesion fixes in flight (see audit recs).

## next steps

- consolidate home vs feed
- generic HelpPanelHome or `toolsHide` on every Shell page
- promote dune-test out of public route set or reparent under Shell
- harden auth/callback error branch with Shell wrapper
