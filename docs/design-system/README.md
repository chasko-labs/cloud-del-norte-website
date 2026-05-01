# design system

cloud del norte design-system documentation. components, tokens, utility classes, and patterns that extend cloudscape for the cdn platform.

---

## suites

### cdn-wallpaper suite

animated wallpaper layer + frosted-glass atmospheric surface system. cloudscape-compatible; drops behind any `<AppLayout>`.

- [wallpaper suite index](./wallpaper/README.md)
- [components api](./wallpaper/components.md) — `<CdnWallpaper>`, `<CdnWallpaperLayer>`, `useWallpaperTheme()`
- [design tokens](./wallpaper/tokens.md) — `--cdn-wallpaper-*` token table
- [themes](./wallpaper/themes.md) — `gypsum-sands` (white sands NM, light) + `el-paso-nights` (el paso TX, dark)
- [atmospheric surfaces](./wallpaper/atmospheric-surfaces.md) — `.cdn-atmospheric-*` utility classes
- [migration + authoring](./wallpaper/migration.md) — adoption guide; how to add a new scene layer

### cdn-card suite

layout-isolated content cards with polling lifecycle, sticky state, and compositor-only transitions. the card wall is the primary content layout primitive for the cloud del norte main page.

- [card wall architecture](./card-wall.md)
- [stable-state pattern](./stable-state.md) — sticky polling + reserved-slot DOM stability

---

## architecture relationship

the two suites are siblings. the wallpaper suite operates at fixed z-index behind the page; the card suite operates in normal document flow inside `<AppLayout>`. either can be adopted independently. they share the design-token root (`src/styles/design-tokens.css`) but have no runtime dependency on each other.
