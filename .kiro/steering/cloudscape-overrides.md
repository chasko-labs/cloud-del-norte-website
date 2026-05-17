# cloudscape overrides — cloud-del-norte-website

## why overrides are hard

cloudscape v3 uses hashed CSS Modules. class names are non-deterministic at build time (e.g. `awsui_button-content_1d2x3`). you cannot target a stable class name directly.

## selector pattern

use the substring attribute selector to match the stable prefix portion:

```css
[class*="awsui_button"][class*="variant-primary"] {
  background-color: var(--cdn-purple, #5a1f8a) !important;
}
```

`!important` is required on every property override. cloudscape's own specificity wins without it.

## scoped override containers

| scope class | where used | what it overrides |
| ----------- | ---------- | ----------------- |
| .cdn-card--cta | feed page speaker CTA card | primary button inside that card |
| .hp-role-card--cta | right help-panel role cards | primary button inside panel cards |

these scopes wrap the Cloudscape Button so the override only fires inside the intended container, not globally.

## modal button overrides (wave 9 lesson)

modal buttons live inside a different DOM subtree than page-level buttons. the scope selector must chain through the dialog container:

```css
[class*="awsui_dialog"] [class*="awsui_button"][class*="variant-primary"] {
  background-color: var(--cdn-purple, #5a1f8a) !important;
  background-image: linear-gradient(135deg, var(--cdn-purple, #5a1f8a), var(--cdn-violet, #9060f0)) !important;
  color: #fff !important;
}
```

link/cancel buttons in modals:

```css
[class*="awsui_dialog"] [class*="awsui_button"][class*="variant-link"] {
  color: var(--cdn-purple) !important;
}
```

## brand tokens

| token | value | usage |
| ----- | ----- | ----- |
| --cdn-purple | #5a1f8a | primary brand, button backgrounds, link text |
| --cdn-violet | #9060f0 | gradient endpoint, accent |
| --cdn-gold | #c9a23f | warm CTA alternative (auth page) |
| --cdn-cream | (light surface) | background tint |
| --cdn-glass-bg | rgba with alpha 0.97 light / 1.0 dark | glass card surface |
| --cdn-mid | 0-1 float | audio-reactive level for sigil pulse (written per-frame by background-viz) |

## postcard direction tokens (auth subdomain)

- parchment texture gradient on card background
- deckled-edge inset shadow: `inset 0 0 12px rgba(139,90,43,0.12)`
- decorative ::after stamp corner with cloud glyph
- card opacity 0.97 light / mirrored dark
- cinzel italic serif typography preserved

## light/dark parity rule

every override declared in `:root` must have a matching declaration in `:root.awsui-dark-mode`. if you add a light-mode override without its dark counterpart, the dark theme breaks.

## prefers-reduced-motion

all animation (sigil pulse, shimmer, chromatic aberration) must respect:

```css
@media (prefers-reduced-motion: reduce) {
  /* disable or simplify animation */
}
```

## inspection tool

```bash
node scripts/probe-cta-button-classes.mjs
```

launches playwright, navigates to the target page, and logs the actual hashed class names on CTA buttons. use this to verify your selector substring matches the live DOM.

## the rule in one sentence

cloudscape overrides require !important on every property, substring attribute selectors for hashed classes, scoped containers to avoid global bleed, and light/dark parity on every declaration.
