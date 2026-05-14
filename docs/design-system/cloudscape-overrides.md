# Cloudscape CSS Override Reference

How we override AWS Cloudscape Design System internals without breaking things.

## DOM Elements We Override

| Cloudscape Class Pattern | What It Is | Height | Default Color |
|---|---|---|---|
| `awsui_scrolling-background` | Decorative strip below breadcrumbs | 48px | cream/white |
| `awsui_has-default-background` / `awsui_background` | ContentLayout header background | 36px | lavender rgb(244,241,250) |
| `awsui_layout-main` | Main content area wrapper | full | white |
| `awsui_navigation-container` / `awsui_navigation` | Side nav drawer | full | white |
| `awsui_tools-container` / `awsui_tools` | Help/tools panel | full | white |
| `awsui_breadcrumbs` | Breadcrumb bar | auto | transparent |
| `awsui_content-layout` | ContentLayout wrapper | auto | white |
| `awsui_top-navigation` | Top nav bar (inside #top-nav) | 62px | dark blue |
| `awsui_mobile-bar` | Mobile toolbar | auto | white |

## Specificity Convention

Cloudscape uses `:not(#\9)` internally for +1,0,0 specificity. We stack them:

| Level | Pattern | Used By |
|---|---|---|
| Base | `:not(#\9)` | shell/styles.css — matches Cloudscape's own level |
| Glass | `:not(#\9):not(#\10)` | cdn-glass-streaks.css — beats base overrides |
| Nuclear | `:not(#\9):not(#\10):not(#\11)` | auth/_layout/styles.css — beats glass |
| Last resort | `!important` | Only when scoped to body class (e.g., `body.cdn-auth-subdomain`) |

## CSS Import Order (Cascade)

Loaded via shell/styles.css imports:

1. `cdn-atmospheric.css` — wallpaper passthrough (transparent when `cdn-viz-active`)
2. `cdn-glass-streaks.css` — glass plates, streaks, frosted chrome, card styling
3. `shell/styles.css` body — top-nav gradient, layout-main background, ambient drift

Site-specific (loaded by entry point):
4. `auth/_layout/styles.css` — auth page scoped overrides
5. `awsug/_layout/styles.css` — awsug scoped overrides (currently empty)

## Entry Point Requirements

Every `main.tsx` entry point MUST import:
- `@cloudscape-design/global-styles/index.css` — Cloudscape base
- `../../styles/tokens.css` (correct relative path) — brand tokens

Without tokens.css, all `var(--cdn-*)` properties resolve to empty strings.

## Body Classes

| Class | Set By | Purpose |
|---|---|---|
| `cdn-auth-subdomain` | auth/_layout | Scopes auth-only overrides |
| `cdn-viz-active` | background-viz/canvas.ts | Signals wallpaper canvas is mounted |
| `cdn-scrolled` | shell/index.tsx | Fires when scrollY > 80px |
| `cdn-tools-open` | shell/index.tsx | Tools panel is open |
| `cdn-stream-playing` | persistent-player | Audio stream is active |
| `awsui-dark-mode` | Cloudscape applyMode() | Dark theme active |

## Common Override Patterns

### Make an element transparent (wallpaper passthrough)
```css
body.cdn-auth-subdomain [class*="awsui_TARGET"]:not(#\9):not(#\10):not(#\11) {
  background: transparent !important;
  background-color: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

### Add glass treatment
```css
[class*="awsui_TARGET"]:not(#\9):not(#\10) {
  background-color: var(--cdn-glass-bg-scroll);
  backdrop-filter: blur(8px) saturate(1.05);
}
```

### Nav gradient (uses tokens)
```css
#top-nav [class*="top-navigation"] {
  background: linear-gradient(135deg,
    var(--cdn-gradient-nav-start) 0%,
    var(--cdn-gradient-nav-mid) 55%,
    var(--cdn-gradient-nav-end) 100%);
}
```

## Gotchas

1. **Class names are hashed** — always use `[class*="awsui_partial-name"]`
2. **Inline styles** — Cloudscape sets `min-block-size` inline on AppLayout; need `!important`
3. **tokens.css missing** — nav gradient becomes transparent (empty var fallback)
4. **cdn-viz-active** — when set, backgrounds should be transparent so canvas shows through
5. **Auth CSP** — auth.clouddelnorte.org has strict CSP; connect-src only allows self + cognito + ipinfo.io
6. **Sumerian host IDs** — embed expects `liora-*` IDs (not `fiona-*`); mount function is `mountLioraPanel`
7. **Deploy** — always clean build (`emptyOutDir: true`); stale chunks cause old code to be served
