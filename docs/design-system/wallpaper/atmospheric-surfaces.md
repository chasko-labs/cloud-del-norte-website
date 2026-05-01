# atmospheric surfaces

utility classes for applying frosted-glass transparency to cloudscape UI chrome. all classes live in `src/styles/cdn-atmospheric.css` and consume tokens from `src/styles/design-tokens-wallpaper.css`.

see also: [tokens.md](./tokens.md) | [components.md](./components.md)

---

## feature gating

all alpha + blur rules are wrapped in:

```css
@supports (backdrop-filter: blur(0)) {
  /* alpha + blur declarations */
}
```

browsers without `backdrop-filter` support receive fully opaque chrome — no transparency, no blur. the layout and color remain correct; only the atmospheric effect is absent.

```css
@media (prefers-reduced-transparency: reduce) {
  /* all atmospheric classes fall back to fully opaque */
}
```

when the user has requested reduced transparency at the OS level, every `.cdn-atmospheric-*` class renders opaque regardless of `@supports`. this is a first-class accessibility behavior, not a fallback.

---

## class reference

### .cdn-atmospheric-panel

| property | value |
| --- | --- |
| background alpha | `var(--cdn-wallpaper-alpha-panel, 0.94)` |
| backdrop blur | `var(--cdn-wallpaper-blur-panel, 6px)` |
| backdrop saturate | `var(--cdn-wallpaper-saturate, 1.05)` |
| typical targets | cloudscape `<SideNavigation>`, tools drawer, secondary panels |

**intent**: high-alpha frosted surface for navigation panels that need legibility at all times. blur and saturate values are lighter than content surfaces so panel chrome doesn't visually compete with navigation labels.

```tsx
// example: cloudscape side navigation with atmospheric panel
<div className="cdn-atmospheric-panel">
  <SideNavigation ... />
</div>
```

---

### .cdn-atmospheric-header

| property | value |
| --- | --- |
| background alpha | `var(--cdn-wallpaper-alpha-header, 0.88)` |
| backdrop blur | `var(--cdn-wallpaper-blur-header, 8px)` |
| backdrop saturate | not applied (header strip is wide; extra saturate unnecessary) |
| typical targets | cloudscape `<ContentLayout>` header strip, breadcrumb bands |

**intent**: moderately transparent header strip that lets wallpaper motion bleed through slightly while keeping text readable. more blur than panel (8px vs 6px) to smooth the fast-moving wallpaper visible at the top of the viewport.

```tsx
// example: contentlayout header with atmospheric header class
<div className="cdn-atmospheric-header">
  <ContentLayout header={...} />
</div>
```

---

### .cdn-atmospheric-content

| property | value |
| --- | --- |
| background alpha | `var(--cdn-wallpaper-alpha-content, 0.75)` |
| backdrop blur | `var(--cdn-wallpaper-blur-content, 10px)` |
| backdrop saturate | `var(--cdn-wallpaper-saturate, 1.05)` |
| typical targets | main content area behind body text; wide container wells |

**intent**: most transparent of the three surfaces — used where the wallpaper contributes the most atmosphere. highest blur (10px) compensates for the lower alpha so text over animated wallpaper stays legible. apply only to layout containers, not to individual cards or interactive controls.

```tsx
// example: main content well
<div className="cdn-atmospheric-content">
  {/* page body */}
</div>
```

---

### .cdn-atmospheric-opaque

| property | value |
| --- | --- |
| background alpha | `1.0` |
| backdrop blur | none |
| backdrop saturate | none |
| typical targets | cards, buttons, liora panel, nav, footer, any surface where transparency would harm legibility or interaction |

**intent**: explicit opt-out. apply when a surface must be fully opaque regardless of the surrounding wallpaper. overrides the other atmospheric classes if both are present.

```tsx
// example: card that must be fully opaque
<CdnCard className="cdn-atmospheric-opaque" ... />
```

```tsx
// example: footer
<footer className="cdn-atmospheric-opaque">
  ...
</footer>
```

---

## accessibility behavior under prefers-reduced-transparency

when `prefers-reduced-transparency: reduce` is active:

- `.cdn-atmospheric-panel`, `.cdn-atmospheric-header`, `.cdn-atmospheric-content` all render as fully opaque (alpha = 1.0, no backdrop-filter)
- `.cdn-atmospheric-opaque` behavior is unchanged — it is already opaque
- no class names need to change; the CSS media query handles it transparently

this means a consumer never needs to conditionally apply different class names for accessibility — the stylesheet adapts automatically.

---

## stacking with cloudscape tokens

cloudscape's own background tokens (e.g. `--color-background-layout-panel-content`) provide the base color. atmospheric utility classes layer `background-color: rgba(<bg-rgb>, <alpha>)` on top of whatever cloudscape sets. the `<bg-rgb>` channel is a theme-scoped CSS custom property:

| theme | property | value |
| --- | --- | --- |
| light | `--cdn-bg-rgb` | `237, 229, 212` (cream `#ede5d4`) |
| dark | `--cdn-bg-rgb` | resolved from cloudscape dark bg token |

consumers adopting the suite must define `--cdn-bg-rgb` for any custom theme variant they introduce. see [migration.md](./migration.md).
