# migration + adoption

covers: adopting the wallpaper suite in a new cloudscape consumer, authoring a new scene layer.

see also: [components.md](./components.md) | [tokens.md](./tokens.md) | [atmospheric-surfaces.md](./atmospheric-surfaces.md)

---

## adopting the suite — 3 steps

### step 1 — import CdnWallpaper at the app root

```tsx
// app root (e.g. src/App.tsx or src/pages/_app.tsx)
import { CdnWallpaper, CdnWallpaperLayer } from '@/components/cdn-wallpaper';

function App() {
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

`<CdnWallpaper>` must be a sibling before `<AppLayout>`, not nested inside it. fixed positioning takes the wallpaper out of flow.

### step 2 — import token and utility-class stylesheets

```ts
// main entry (e.g. src/index.tsx or src/main.tsx)
import '@/styles/design-tokens-wallpaper.css';
import '@/styles/cdn-atmospheric.css';
```

if you are using a custom theme with different background tones, define `--cdn-bg-rgb` for each theme variant:

```css
/* your custom theme file */
:root {
  --cdn-bg-rgb: 237, 229, 212; /* cream, light mode */
}
.awsui-dark-mode {
  --cdn-bg-rgb: /* match cloudscape dark bg token rgb equivalent */;
}
```

### step 3 — apply utility classes to surfaces

```tsx
// navigation panel
<div className="cdn-atmospheric-panel">
  <SideNavigation ... />
</div>

// header strip
<div className="cdn-atmospheric-header">
  <ContentLayout header={<Header>...</Header>} ... />
</div>

// main content well
<div className="cdn-atmospheric-content">
  {children}
</div>

// cards, footer, interactive chrome — opt out explicitly
<CdnCard className="cdn-atmospheric-opaque" ... />
<footer className="cdn-atmospheric-opaque">...</footer>
```

see [atmospheric-surfaces.md](./atmospheric-surfaces.md) for full class reference and accessibility behavior.

---

## authoring a new CdnWallpaperLayer

### file location + naming

create the scene at:

```
src/components/cdn-wallpaper/layers/<scene-name>.tsx
```

name the scene geographically — cloud del norte context (new mexico / west texas high desert):

- existing: `gypsum-sands`, `el-paso-nights`
- example future: `chihuahuan-storm`, `tularosa-aurora`, `organ-mountains-dawn`

avoid generic names (`scene-1`, `dark-scene`, `parallax`). the name becomes the `CdnWallpaperLayer name` prop value and appears in documentation.

### lifecycle contract

a layer implementation must:

- accept theme context from `<CdnWallpaper>` parent (use the context hook or prop drilling — match the existing pattern)
- render `aria-hidden="true"` on the layer root element
- apply a 2-second opacity entrance fade on first activation
- pause all animation when `prefers-reduced-motion: reduce` is signaled by parent context
- release WebGL contexts and canvas handles on unmount (return a cleanup function from `useEffect`)
- not intercept pointer events (`pointer-events: none`)

```tsx
// minimal layer skeleton
import { useEffect, useRef } from 'react';

interface LayerProps {
  active: boolean;
  reducedMotion: boolean;
}

export function MySceneLayer({ active, reducedMotion }: LayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    // ... setup ...
    return () => {
      // ... cleanup ctx / cancel animation frame / destroy BabylonJS engine ...
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        opacity: active ? 1 : 0,
        transition: 'opacity 2s ease',
        pointerEvents: 'none',
      }}
    />
  );
}
```

### theme gating

register the scene in `<CdnWallpaper>` and gate visibility using `useWallpaperTheme()` or parent context. the layer remains mounted in both theme states to avoid remount cost; only `active` (opacity) changes.

```tsx
// inside CdnWallpaper children — theme gating
const theme = useWallpaperTheme();

<CdnWallpaperLayer name="my-new-scene" />
// the layer reads `active = theme === "my-new-scene"` from context
```

if the new scene introduces a third theme variant, extend the `useWallpaperTheme()` return type and the selector logic in the hook.

### registration

after creating the layer file:

1. import it in `src/components/cdn-wallpaper/index.tsx` (or wherever the layer registry lives)
2. map the `name` string to the component
3. add an entry to [themes.md](./themes.md)

---

## sibling architecture

the cdn-card suite is the sibling component system for layout-isolated content cards. it shares the design-token root (`src/styles/design-tokens.css`) but does not depend on the wallpaper suite — either can be adopted independently.

- [cdn-card suite — card-wall.md](../card-wall.md)
- [cdn-card stable-state pattern](../stable-state.md)
