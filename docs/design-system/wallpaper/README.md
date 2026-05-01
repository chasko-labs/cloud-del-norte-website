# cdn wallpaper suite

the cdn wallpaper suite is a cloudscape-compatible set of components, hooks, design tokens, and utility classes that composites a fixed animated wallpaper beneath any cloudscape page layout. it owns the scene lifecycle, theme switching, and transparency surfaces so product teams can adopt atmospheric depth without writing shader or canvas code.

the suite ships two scene layers out of the box — `gypsum-sands` (light theme, white sands NM dunes rendered in BabylonJS) and `el-paso-nights` (dark theme, music-visualization over el paso night sky in canvas-2D). both scenes respond to audio and the active cloudscape theme. additional scenes plug in as named `<CdnWallpaperLayer>` children using the same lifecycle contract.

## when to use it

- any cloudscape app that wants atmospheric depth behind standard AppLayout chrome
- interfaces where glass-style translucency (frosted panels, header strips) improves visual hierarchy without sacrificing legibility
- pages that already use the cloudscape dark-mode toggle — theme switching is automatic

## when not to use it

- highly information-dense interfaces (data tables, code editors, dashboards with many concurrent metrics) — transparency behind dense content degrades scan speed
- accessibility-critical apps where contrast ratios are hard requirements — animated wallpaper and backdrop-filter can challenge wcag AA thresholds; use `.cdn-atmospheric-opaque` on every surface or skip the suite entirely
- server-side render paths that cannot hydrate WebGL or canvas — BabylonJS requires a browser context

## entry points

- [components.md](./components.md) — `<CdnWallpaper>`, `<CdnWallpaperLayer>`, `useWallpaperTheme()` api reference
- [tokens.md](./tokens.md) — `--cdn-wallpaper-*` design-token table
- [themes.md](./themes.md) — `gypsum-sands` and `el-paso-nights` scene specs
- [atmospheric-surfaces.md](./atmospheric-surfaces.md) — `.cdn-atmospheric-*` utility class reference
- [migration.md](./migration.md) — adoption guide for new consumers; how to author a new layer

## contribution model

to add a new scene:

1. create `src/components/cdn-wallpaper/layers/<scene-name>.tsx` following the lifecycle contract in [migration.md](./migration.md)
2. name the scene geographically (white sands / el paso / chihuahuan / tularosa / organ mountains context)
3. register it as a `<CdnWallpaperLayer name="<scene-name>">` child in the app root
4. gate it behind the correct theme selector (`gypsum-sands` for light, `el-paso-nights` for dark, or a new variant)
5. add an entry to [themes.md](./themes.md)

see also: [cdn-card suite](../card-wall.md) — sibling architecture for layout-isolated content cards
