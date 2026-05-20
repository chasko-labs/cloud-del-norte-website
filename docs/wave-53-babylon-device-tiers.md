# Wave 53 — Babylon Device Tiers & BabylonGate Contract

> "Create rules for who we serve babylon to and who we don't. Pixel 10 fine, MacBook Air gentle. Always load these last. Skeletons + CSS are the bones, babylon are accessories."
> — Bryan

---

## Philosophy

Babylon scenes are **enhancements, not structure**. Every mount point has:
1. A CSS skeleton or 2D fallback that renders first (the bones)
2. A `<BabylonGate>` wrapper that lazy-loads the Babylon scene only on capable devices (the accessory)

Think: adding shaders to 2D to make 3D. The 2D always works; 3D is the upgrade.

---

## Device Tier Matrix

| Device / Context               | deviceMemory | hardwareConcurrency | Software WebGL | Tier       |
|-------------------------------|:------------:|:-------------------:|:--------------:|:----------:|
| **Pixel 10**                  | 12 GB        | 9 cores             | no             | **high**   |
| **MacBook Air M-series**      | 8–24 GB      | 8 cores             | no             | **high**   |
| Older Intel MacBook Air       | 8 GB         | 4 cores             | no             | **medium** |
| Pixel 4 / older Android       | 3 GB         | 4 cores             | no             | **low**    |
| VM / headless / software WebGL| any          | any                 | yes            | **low**    |
| prefers-reduced-motion (any)  | any          | any                 | any            | **low**    |

### Tier rules (`src/lib/device-capabilities.ts`)

```
high   = capable + deviceMemory ≥ 8 + hardwareConcurrency ≥ 8
medium = capable (not high)
low    = software WebGL OR (low mem AND few cores) OR prefers-reduced-motion
```

`isCapableForBabylon()` fails **low** when:
- `prefersReducedMotion()` → always fail-closed
- `isSoftwareWebGL()` → skip entirely (would chug + race the canvas flip)
- `hasLowMemory() AND hasFewCores()` → both signals must be present (AND gate, not OR), so MacBook Air with 8 GB RAM but 4 cores stays **medium**.

When `deviceMemory` is `undefined` (Firefox, Safari) — default `false` (no over-restriction).

---

## BabylonGate API

**File:** `src/components/babylon-gate/index.tsx`

```tsx
import BabylonGate from "../../components/babylon-gate";

<BabylonGate
  tier="medium"              // 'high' | 'medium' | 'low'  (default: 'medium')
  fallback={<CssSpinner />}  // shown on incapable devices & during Suspense
>
  <HeavyBabylonScene />      // lazy-loaded via React.lazy() + dynamic import
</BabylonGate>
```

- **Renders `fallback`** when `getDeviceTier() < tier`
- **Wraps children in `<Suspense>`** so lazy imports don't block
- The children component MUST use `React.lazy()` pointing to a file that does `import('@babylonjs/core')` inside `useEffect` — never at module top-level

### Usage pattern (all future Babylon mounts)

```tsx
// 1. Lazy-wrap the Babylon component
const MyBabylonScene = lazy(() => import("../my-babylon-scene"));

// 2. Gate it
<BabylonGate tier="medium" fallback={<MyCSSSkeleton />}>
  <MyBabylonScene />
</BabylonGate>
```

---

## Wave 53 ships

| File | Purpose |
|------|---------|
| `src/lib/device-capabilities.ts` | Centralized detection: `isSoftwareWebGL`, `hasLowMemory`, `hasFewCores`, `prefersReducedMotion`, `isCapableForBabylon`, `getDeviceTier` |
| `src/components/babylon-gate/index.tsx` | Public gate wrapper |
| `src/components/babylon-spin-demo/index.tsx` | 60-line demo Babylon mount (ArcRotateCamera + plane + thumbnail texture + click-to-spin) |
| `src/lib/background-viz/index.ts` | Refactored — `isSoftwareRendering()` removed, re-exports `isSoftwareWebGL` from device-capabilities |
| `src/components/fiona-frame/index.tsx` | Babylon end-credit canvas wrapped in `<BabylonGate tier="medium">` |
| `src/pages/feed/components/youtube-carousel.tsx` | Wave 52 spin placeholder wrapped in `<BabylonGate tier="medium">` with `BabylonSpinDemo` as enhancement |

---

## Bundle contract

Babylon stays **lazy**. The main feed chunk does not import `@babylonjs/core`. After build, verify:

```
dist/assets/index-[hash].js        — main feed chunk; should NOT contain babylon
dist/assets/babylon-spin-demo-[hash].js  — lazy chunk; loads after first paint
```

Run `npm run build` and check that no babylon symbols appear in the main `index-*.js` output.

---

## Wave 55+ planned scenes

| Location | Scene | Tier |
|----------|-------|------|
| Footer | Atmospheric particle field (stars / dust) | medium |
| Sidepanel | Neon signage lettering (3D extruded text) | high |
| Login form | Subtle depth shader on the form card | medium |
| Feed personality SVGs | Shader overlay on 2D SVG icons | high |

All mount via `<BabylonGate>` with CSS/SVG fallbacks already in place.

---

## Constraints

- `prefers-reduced-motion` is **always fail-closed** — no override
- `visibilitychange` must pause the render loop (wave 21 pattern) — implemented in `babylon-spin-demo`
- Dynamic import `@babylonjs/core` must live inside `useEffect`, never at module level
- Every Babylon component ships with a `data-testid` canvas for test verification
