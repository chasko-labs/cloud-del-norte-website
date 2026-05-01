# design tokens

all `--cdn-wallpaper-*` tokens live in `src/styles/design-tokens-wallpaper.css`. they control transparency surfaces and stacking; the wallpaper animation itself is not token-driven.

default values are calibrated starting points — expect 1-2 tuning passes as the suite matures against real content.

see also: [atmospheric-surfaces.md](./atmospheric-surfaces.md) — utility classes that consume these tokens

---

## token table

| token | type | default | intent | when to override |
| --- | --- | --- | --- | --- |
| `--cdn-wallpaper-alpha-panel` | `<number>` (0–1) | `0.94` | background-color alpha for side panels (navigation, tools drawer) | lower if panel needs more wallpaper bleed; raise to opaque if legibility suffers |
| `--cdn-wallpaper-alpha-header` | `<number>` (0–1) | `0.88` | background-color alpha for the ContentLayout header strip | lower for more atmospheric feel in hero headers |
| `--cdn-wallpaper-alpha-content` | `<number>` (0–1) | `0.75` | background-color alpha for main content area | raise toward 1.0 for dense-data pages; lower only when content is sparse and decorative |
| `--cdn-wallpaper-blur-panel` | `<length>` | `6px` | backdrop-filter blur radius for panels | increase if motion artifact shows through; must stay proportional to alpha |
| `--cdn-wallpaper-blur-header` | `<length>` | `8px` | backdrop-filter blur radius for header strip | more blur softens fast-moving wallpaper behind headers |
| `--cdn-wallpaper-blur-content` | `<length>` | `10px` | backdrop-filter blur radius for content area | highest blur of the three because content area has most text |
| `--cdn-wallpaper-saturate` | `<number>` | `1.05` | backdrop-filter saturate multiplier applied with blur | values above 1.2 can oversaturate wallpaper colors; values below 1.0 desaturate |
| `--cdn-wallpaper-z-index` | `<integer>` | `-3` | z-index of the fixed wallpaper container | change only when page has existing negative-z stacking layers that conflict |

---

## override scope

tokens are declared on `:root`. to scope an override to a single page or feature shell, redeclare on a container that establishes a stacking context:

```css
/* page-level override example */
.my-dense-page {
  --cdn-wallpaper-alpha-content: 0.97;
  --cdn-wallpaper-blur-content: 4px;
}
```

```css
/* dark-mode-specific override */
.awsui-dark-mode {
  --cdn-wallpaper-alpha-panel: 0.90;
}
```

---

## background tone

the background color tokens are not `--cdn-wallpaper-*` tokens — they are theme-level CSS custom properties that atmospheric utility classes consume to compute `rgba()` values.

| theme | selector | background tone |
| --- | --- | --- |
| light | `:root:not(.awsui-dark-mode)` | cream `#ede5d4` (rgb 237, 229, 212) |
| dark | `.awsui-dark-mode` | cloudscape dark bg token (use cloudscape's existing value) |

if a future scene introduces a different background tone (e.g. a sunrise amber scene), declare new theme-scoped color custom properties alongside — do not mutate `--cdn-wallpaper-*` tokens for color.
