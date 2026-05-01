# components

api reference for `<CdnWallpaper>`, `<CdnWallpaperLayer>`, and `useWallpaperTheme()`.

see also: [tokens.md](./tokens.md) | [themes.md](./themes.md) | [atmospheric-surfaces.md](./atmospheric-surfaces.md)

---

## CdnWallpaper

root mount. renders a fixed-position canvas container at `z-index: var(--cdn-wallpaper-z-index, -3)`. owns the layer lifecycle registry, theme-switching coordination, and `prefers-reduced-motion` enforcement.

### props

| prop | type | default | required | description |
| --- | --- | --- | --- | --- |
| `children` | `ReactNode` | — | yes | one or more `<CdnWallpaperLayer>` elements |

no other props are public. behavioral configuration goes through design tokens (see [tokens.md](./tokens.md)).

### usage

```tsx
import { CdnWallpaper } from '@/components/cdn-wallpaper';
import { CdnWallpaperLayer } from '@/components/cdn-wallpaper';

function AppRoot() {
  return (
    <>
      <CdnWallpaper>
        <CdnWallpaperLayer name="gypsum-sands" />
        <CdnWallpaperLayer name="el-paso-nights" />
      </CdnWallpaper>
      <AppLayout ... />
    </>
  );
}
```

place `<CdnWallpaper>` as a sibling before cloudscape's `<AppLayout>` in the render tree, not inside it. the fixed positioning takes it out of flow; DOM order only matters for stacking context.

### lifecycle notes

- mounts a fixed container covering the viewport at z-index `--cdn-wallpaper-z-index`
- distributes theme change signals to child layers via context when `awsui-dark-mode` class toggles on `<html>`
- when `prefers-reduced-motion: reduce` is active, all animated layers receive a pause signal; static fallback frames are expected from each layer implementation
- unmounts cleanly; child layers are responsible for releasing their own WebGL contexts and canvas handles

### accessibility notes

- respects `prefers-reduced-motion: reduce` — animation is paused, not removed
- does not intercept pointer events (pointer-events: none on the container)
- does not affect tab order or focus management

### composition rules

- only accepts `<CdnWallpaperLayer>` as children — other elements are ignored at runtime
- at most one layer should be visible at any time; theme gating is the mechanism (see [themes.md](./themes.md))
- z-index is intentionally negative; do not render interactive content inside `<CdnWallpaper>`

---

## CdnWallpaperLayer

individual scene. wraps one named scene implementation. the `name` prop selects the scene; theme gating (light vs dark) is handled inside the layer.

### props

| prop | type | default | required | description |
| --- | --- | --- | --- | --- |
| `name` | `"gypsum-sands" \| "el-paso-nights"` | — | yes | scene identifier. must match a registered layer implementation |

### usage

```tsx
<CdnWallpaper>
  <CdnWallpaperLayer name="gypsum-sands" />
  <CdnWallpaperLayer name="el-paso-nights" />
</CdnWallpaper>
```

both layers are always mounted; theme gating controls which is visible. this avoids remount cost on theme switches.

### lifecycle notes

- receives theme context from `<CdnWallpaper>` parent
- applies a 2-second entrance fade on initial activation
- `gypsum-sands` uses BabylonJS WebGL context; `el-paso-nights` uses canvas-2D
- each layer is responsible for releasing its rendering context on unmount

### accessibility notes

- each layer implementation must honor the `prefers-reduced-motion` signal passed from parent context
- static fallback frames (no animation) are required when motion is reduced
- transparent to assistive technology — `aria-hidden="true"` expected on the layer root element

### composition rules

- must be a direct child of `<CdnWallpaper>`
- name must match a scene registered in `src/components/cdn-wallpaper/layers/`
- see [migration.md](./migration.md) for authoring a new layer

---

## useWallpaperTheme()

hook. returns the active wallpaper theme name derived from the `awsui-dark-mode` class on `<html>`.

### signature

```ts
function useWallpaperTheme(): "gypsum-sands" | "el-paso-nights"
```

### behavior

- returns `"gypsum-sands"` when `<html>` does not have class `awsui-dark-mode` (light mode)
- returns `"el-paso-nights"` when `<html>` has class `awsui-dark-mode` (dark mode)
- uses a `MutationObserver` on `<html>` to fire synchronous re-renders on class changes
- safe to call outside of `<CdnWallpaper>` context — it reads the DOM directly

### usage

```tsx
import { useWallpaperTheme } from '@/components/cdn-wallpaper';

function SceneDebugBadge() {
  const theme = useWallpaperTheme();
  return <span>{theme}</span>;
}
```

### notes

- observer is torn down on component unmount
- returns the initial value synchronously on first render (no suspense, no flash)
- if cloudscape ever changes its dark-mode class name, update the selector in the hook implementation
