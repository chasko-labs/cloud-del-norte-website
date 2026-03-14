# Skill: Cloudscape Footer Component Pattern

**Confidence:** medium
**Domain:** UI/design
**Applies to:** Lyren (primary), Theren, Vael
**Last updated:** 2025-07-18

## Summary

How to build a footer for Cloudscape Design System apps using `AppLayout`'s `footerSelector` prop. Cloudscape has no native Footer component — the pattern relies on rendering a footer element outside `AppLayout` in the DOM and pointing `AppLayout` at it via a CSS selector so it positions correctly below the main content scrolling area.

## Key Facts

- Cloudscape has **NO native Footer component** (confirmed across all 109 components)
- `AppLayout` has a `footerSelector` prop — a CSS selector pointing to a DOM element rendered outside the main content scrolling area
- The footer element must be rendered **OUTSIDE** `AppLayout` in the DOM, but `AppLayout` uses the selector to position it correctly
- Current Shell (`src/layouts/shell/index.tsx`) does **NOT** use `footerSelector` — it needs to be added

## Recommended Component Stack

| Component | Role |
|-----------|------|
| `AppLayout` (`footerSelector="#site-footer"`) | Positioning mechanism — tells AppLayout where the footer lives |
| `ColumnLayout` (`columns={5}`, `variant="text-grid"`) | Leader card grid for footer sections |
| `SpaceBetween` | Vertical/horizontal spacing within footer sections |
| `Box` | Text, typography variants |
| `Link` | Social/contact links |
| `Badge` | Role/status indicators |

All imports must use deep paths:

```tsx
import AppLayout from '@cloudscape-design/components/app-layout';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import Badge from '@cloudscape-design/components/badge';
```

## NOT Recommended for Footer

These components exist in Cloudscape but are **not** designed for footer use:

| Component | Why Not |
|-----------|---------|
| `SplitPanel` | Designed for detail panels within content area |
| `Drawer` | Designed for side panels |
| `HelpPanel` | Designed for help content overlays |
| `PanelLayout` | Designed for side/drawer UI patterns |

## Implementation Sketch

```tsx
// In Shell or page-level component — footer rendered OUTSIDE AppLayout
<>
  <AppLayout
    footerSelector="#site-footer"
    navigation={navigation}
    content={children}
    // ...other props
  />
  <footer id="site-footer" role="contentinfo">
    <ColumnLayout columns={5} variant="text-grid">
      {/* footer sections */}
    </ColumnLayout>
  </footer>
</>
```

## Responsive Strategy

| Breakpoint | Columns |
|------------|---------|
| ≥ 1200px | 5 |
| ≥ 768px | 3 |
| ≥ 480px | 2 |
| < 480px | 1 |

Use CSS Grid or `ColumnLayout`'s built-in responsiveness. `ColumnLayout` handles column collapsing automatically at smaller viewports, but custom CSS media queries may be needed for the 5→3→2→1 progression.

## Dark Mode

- Inherits from `.awsui-dark-mode` class on `<body>`
- Use CSS custom properties from `src/styles/tokens.css`
- Footer background should use `--cdn-bg-primary` or a similar project token
- Test both light and dark modes — Cloudscape tokens automatically adapt when the dark-mode class is present

## Accessibility

- `role="contentinfo"` on the `<footer>` element
- Proper heading hierarchy (`<h2>` or `<h3>` for section titles within footer)
- All links must have descriptive text (no "click here")
- Images need `alt` text
- Keyboard navigable — all interactive elements reachable via Tab

## Agent Routing

| Agent | Role |
|-------|------|
| **Lyren** (primary) | Component selection, design tokens, AppLayout integration, accessibility |
| **Theren** (support) | Footer content/data, link lists, navigation items |
| **Vael** (support) | Build integration, ensuring footer works across all MPA pages |

## Sources

- Cloudscape AppLayout API docs (`footerSelector` prop)
- Context7 query results for `ColumnLayout`, `Grid`
- cloudscape.design website footer inspection
