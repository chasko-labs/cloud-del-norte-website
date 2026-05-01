# themes

two scenes ship with the cdn wallpaper suite. each scene is a named `<CdnWallpaperLayer>` implementation tied to one cloudscape theme state.

naming convention: geographically meaningful to the cloud del norte context — north of el paso, NM / TX high desert corridor. future scenes (`chihuahuan-storm`, `tularosa-aurora`, `organ-mountains-dawn`) follow the same pattern.

see also: [components.md](./components.md) | [migration.md](./migration.md)

---

## gypsum-sands

| field | value |
| --- | --- |
| name | `gypsum-sands` |
| geographic origin | white sands national monument, NM — gypsum dune field |
| active when | light theme (`:root:not(.awsui-dark-mode)`) |
| file | `src/components/cdn-wallpaper/layers/gypsum-sands.tsx` |
| rendering engine | BabylonJS (WebGL) |

### visual character

warm cream dunes drifting slowly under a gradient sky. the ground surface is shader-displaced — geometry shifts in low-frequency waves to simulate wind-sculpted gypsum. lighting is directional with analytical normals; the sun direction wobbles on a slow 90s time-of-day cycle so dawn-to-dusk light raking plays out over a session. the sky is a custom gradient (not a skybox texture) that transitions from pale blue-white overhead to warm horizon amber.

### technical details

- BabylonJS shader-displaced ground mesh with custom gradient sky
- analytical normals computed from displacement derivatives
- sun direction wobble: slow oscillation over a 90-second period
- entrance: 2-second opacity fade on first activation
- `prefers-reduced-motion`: displacement animation paused; scene renders static mid-cycle frame

### audio-reactivity

audio-reactive uniforms are published to the BabylonJS shader. the scene reads audio signal levels and modulates ground displacement amplitude and sky saturation. specific uniforms:

| uniform | audio source | effect |
| --- | --- | --- |
| displacement amplitude | bass energy | dune wave height scales with low-frequency signal |
| sky saturation | mid energy | sky color richness shifts with midrange presence |

when no audio source is active, uniforms hold at baseline values.

---

## el-paso-nights

| field | value |
| --- | --- |
| name | `el-paso-nights` |
| geographic origin | el paso, TX night sky — basin-and-range dark sky corridor |
| active when | dark theme (`.awsui-dark-mode`) |
| file | `src/components/cdn-wallpaper/layers/el-paso-nights.tsx` |
| rendering engine | canvas-2D |

### visual character

dark navy-to-indigo sky with a star field. music visualization layers over the stars as reactive arcs or frequency bars (implementation detail of the scene). the overall tone is cool dark blue-black with the city-glow warmth characteristic of looking north from el paso toward the chihuahuan desert.

### technical details

- canvas-2D rendering; no WebGL dependency
- star field drawn as static or slowly-drifting points
- music visualization draws frequency data as canvas paths
- entrance: 2-second opacity fade on first activation
- `prefers-reduced-motion`: visualization animation paused; static star field remains

### audio-reactivity

audio signal levels are published as CSS custom properties on `:root` so other surfaces can consume them without direct coupling to the canvas render loop.

| css custom property | audio source | range |
| --- | --- | --- |
| `--cdn-audio-bass` | bass energy | 0.0 – 1.0 |
| `--cdn-audio-mid` | mid energy | 0.0 – 1.0 |
| `--cdn-audio-flux` | total flux | 0.0 – 1.0 |

these properties update on each animation frame when audio is active. consumers can read them in CSS via `var(--cdn-audio-bass)` or in JS via `getComputedStyle(document.documentElement).getPropertyValue('--cdn-audio-bass')`.

when no audio source is active, properties hold at `0.0`.

---

## verification harness override

headless chromium on rocm-aibox reports its WebGL renderer as:

```
ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
```

the `shouldSkipDune()` check in `src/lib/background-viz/index.ts` sees `SwiftShader` in that string and skips the BabylonJS dune mount, falling back to the gradient div. this is correct behavior for real users on software-only hardware — the dune scene would chug and the perf gate would race the canvas-opacity flip.

for verification harnesses that need to capture the actual wallpaper (not the fallback), append `?__cdn_force_wallpaper=1` to any page URL:

- the CI screenshot pipeline (`scripts/ci-screenshot.mjs`) always appends this param
- ad-hoc capture scripts on linux dev hosts should do the same

### what each audience gets

| audience | renderer | param | result |
| --- | --- | --- | --- |
| real user, hardware GPU | native | absent | dune scene |
| real user, software GPU | SwiftShader / llvmpipe | absent | fallback gradient |
| CI screenshot pipeline | SwiftShader (headless) | `__cdn_force_wallpaper=1` | dune scene (forced) |
| ad-hoc capture, linux | SwiftShader (headless) | `__cdn_force_wallpaper=1` | dune scene (forced) |

the param is internal — underscore-prefix marks it a harness concern, not a user-facing feature. it does not appear in any nav or documentation surface visible to end users.
