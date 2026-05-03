# audio band map — cloud del norte design system

living inventory of visual elements that respond to audio frequency bands.
all reactivity gated on `.cdn-stream-playing` body class — idle page stays quiet.
`prefers-reduced-motion` guard on all audio-reactive rules.

css vars written each frame by `src/lib/background-viz/canvas.ts`:
`--cdn-bass` `--cdn-mid` `--cdn-treble` `--cdn-flux` `--cdn-centroid` (all 0..1)

---

## bass ( < 250 hz )

kick drums, sub-bass, low-end energy

| element | selector / file | effect | dark mode | light mode |
|---------|----------------|--------|-----------|------------|
| dune crest height | vertex shader — `DuneMaterial.ts` | `hOut = h * (1 + clamp(bassLevel,0,1) * 0.18)` — bass inflates every crest by up to 18% | yes | yes |
| dune drift coupling | vertex shader — `DuneMaterial.ts` | `drift = time * (baseDrift * playingBoost + midLevel*0.012 + bassLevel*bassSway*streamPlaying)` — bass adds an additive push so dunes lurch with each kick | yes | yes |
| dune ripple amplitude | fragment shader — `DuneMaterial.ts` | `rippleAmpDyn = rippleAmp * (1 + bassLevel * streamPlaying * 1.2)` — surface ripples brighten/dim +120% at full bass | yes | yes |
| dune sparkle brightness | fragment shader — `DuneMaterial.ts` | `bassEnv = 1 + bassLevel * streamPlaying * 1.4` — sparkle multiplier ramps to 2.4x on heavy bass hit | yes | yes |
| logo-svg bulb scale | `.cdn-bulb` — `logo-svg/index.tsx` | `transform: scale(calc(1 + var(--cdn-bass,0) * 0.18))` — all 5 bulbs + center pulse outward on kick | yes | yes |
| weather glyph scale | `.cdn-weather__icon` — `weather/styles.css` | `transform: scale(calc(1 + var(--cdn-bass,0) * 0.18))` — sun/cloud/storm icon grows with each bass hit | yes (orange halo) | yes (violet halo) |
| page background violet spot | `main[class*="awsui_layout"]` — `shell/styles.css` | `rgba(48,0,106, calc(0.32 + var(--cdn-bass)*0.12))` — deep violet counter-spotlight deepens on kick | dark only | n/a |
| hamburger nav-toggle ring | `[class*="awsui_navigation-toggle_"]` — `cdn-glass-streaks.css` | ring expands `2px + band*4px`, glow `6px + band*10px`; ravy cycle `cdn-ravy-ring-bass` at 3.2s | violet | aws-orange |
| liora LED group 1–4 | `body.cdn-stream-playing .liora-led` — `navigation/liora.css` | `liora-led-cycle-bass` at 3s — slow brand palette rotation on the bottom 4 EQ LEDs | yes | yes |
| liora head tilt | `.liora-canvas` — `navigation/liora.css` | `rotate: calc(var(--cdn-bass,0) * -4deg)` — avatar leans left with each bass hit, pivots from neck | yes | yes |

## mid ( 250 hz – 4 khz )

vocals, guitars, keys — the main body of sound

| element | selector / file | effect | dark mode | light mode |
|---------|----------------|--------|-----------|------------|
| dune drift coupling | vertex shader — `DuneMaterial.ts` | `midLevel * 0.012` additive term in drift formula — sustained mid content keeps dunes rolling slightly faster | yes | yes |
| dune heat shimmer | fragment shader — `DuneMaterial.ts` | `warpedUV = vUV + (baseNoise-0.5) * midLevel * 0.008` — uv micro-warp simulates heat haze on mid peaks | yes | yes |
| dune sparkle color axis | fragment shader — `DuneMaterial.ts` | `sparklePlaying = mix(warmMix, coolMix, clamp(midLevel*1.5,0,1))` — mid shifts sparkle palette from amber/orange toward violet/lavender | yes | yes |
| franklin star glow | `.cdn-stream-playing .franklin-overlay__star` — `franklin-overlay/styles.css` | `opacity: calc(0.55 + var(--cdn-mid,0)*0.2)`, drop-shadow alpha `0.3 + mid*0.45` — whole star composite brightens on vocals | dark only | n/a |
| franklin star body opacity | `.cdn-stream-playing .franklin-overlay__star-body` — `franklin-overlay/styles.css` | `opacity: calc(0.85 + var(--cdn-mid,0)*0.15)` — wireframe stroke brightens gently | dark only | n/a |
| logo-svg arm opacity | `.cdn-arm` — `logo-svg/index.tsx` | `opacity: calc(0.7 + var(--cdn-mid,0)*0.3)` — the 5 arm fill silhouettes breathe in from 70% floor | yes | yes (lower floor) |
| player stop button ring | `.cdn-pp__btn--stop` — `persistent-player/styles.css` | `--cdn-band: var(--cdn-mid)`, ring radius `2px + mid*3px`, glow `8px + mid*8px`; ravy `cdn-ravy-ring-mid` at 1.6s | violet | aws-orange |
| volunteer button ring | `.cdn-volunteer-btn` — `cdn-glass-streaks.css` | `--cdn-band: var(--cdn-mid)`, same ring/glow formula as stop button; ravy `cdn-ravy-ring-mid` at 1.6s | violet | aws-orange |
| card rim light pulse | `body.cdn-stream-playing .cdn-card` — `styles/tokens.css` (Phase B) | outer glow `calc(4px + mid*8px)`, alpha `calc(0.04 + mid*0.10)` — violet bloom on card edges | dark only | n/a |
| cloudscape container rim | `body.cdn-stream-playing [class*="awsui_root_variant-default_"]` — `styles/tokens.css` (Phase B) | same mid-pulse outer glow layered over `--cdn-card-rim-light` | dark only | n/a |
| liora LED group 5–8 | `body.cdn-stream-playing .liora-led:nth-child(n+5):nth-child(-n+8)` — `navigation/liora.css` | `liora-led-cycle-mid` at 1.5s — medium-tempo brand palette rotation on middle 4 EQ LEDs | yes | yes |
| liora head nod | `.liora-canvas` — `navigation/liora.css` | `translate: 0 calc(var(--cdn-mid,0)*-6px)` at 0.9s period — avatar bobs up on each snare/vocal hit | yes | yes |

## treble ( > 4 khz )

cymbals, hi-hats, shimmer, high transients

| element | selector / file | effect | dark mode | light mode |
|---------|----------------|--------|-----------|------------|
| dune sparkle tint within axis | fragment shader — `DuneMaterial.ts` | `warmMix = mix(amber, awsOrange, clamp(trebleLevel*1.5,0,1))` and same for cool axis — treble picks the warm/cool pair member | yes | yes |
| franklin star bulb brightness | `.cdn-stream-playing .franklin-overlay__star-bulb` — `franklin-overlay/styles.css` | `opacity: calc(0.35 + var(--cdn-treble,0)*0.5)` — all 5 tip bulbs + center brighten on hi-hats | dark only | n/a |
| site logo brightness | `.cdn-stream-playing .cdn-logo-hero .cdn-logo-img` — `shell/styles.css` | `brightness(calc(1 + var(--cdn-treble,0)*0.35))` appended to multi-layer drop-shadow filter chain | yes (violet halos) | yes (amber halos) |
| us flag stars | `.cdn-svg-flag--us .cdn-svg-flag__stars circle` — `shell/styles.css` | `cdn-star-sparkle` keyframe — time-based scale/opacity pulse, **not yet audio-reactive** | yes | yes |
| info tools-toggle ring | `[class*="awsui_tools-toggle_"]` — `cdn-glass-streaks.css` | `--cdn-band: var(--cdn-treble)`, ring/glow formula; ravy `cdn-ravy-ring-treble` at 0.7s (fastest — matches hat cadence) | violet | aws-orange |
| liora LED group 9–12 | `body.cdn-stream-playing .liora-led:nth-child(n+9)` — `navigation/liora.css` | `liora-led-cycle-treble` at 0.6s — fast brand palette rotation on top 4 EQ LEDs | yes | yes |

## flux ( rate of change / beat onset )

transient detector — fires on beat hits and sudden energy changes

| element | selector / file | effect | dark mode | light mode |
|---------|----------------|--------|-----------|------------|
| dune surface brightness pop | fragment shader — `DuneMaterial.ts` | `fluxPop = 1 + clamp(fluxLevel,0,1)*0.08` — whole surface multiplied by up to 1.08 on beat onset | yes | yes |
| sun icon glow | `.cdn-stream-playing .cdn-svg-sun` — `shell/styles.css` | `brightness(calc(1 + var(--cdn-flux,0)*0.4))` on the multi-layer drop-shadow — solar icon flares on snares/onsets | yes | yes |
| logo-svg hero tip halo | `.cdn-bulb-tip-hero` — `logo-svg/index.tsx` | `drop-shadow(0 0 calc(6px + var(--cdn-flux,0)*14px) rgba(155,92,244,0.85))` — topmost bulb tip halo ignites 6→20px on transients | yes | yes |
| beat detection | `canvas.ts` render loop — `lib/background-viz/canvas.ts` | `beatFired` bool passed to 2d renderer each frame; used to trigger particle/flash events in the background-viz starfield | yes | yes |

---

## not yet wired

elements with animation that could be connected to a band but aren't yet:

- moon shine (`cdn-moon-shine` keyframe on `.cdn-svg-moon`) — 6s scale/filter pulse, time-only, no band coupling
- flag wave (`cdn-flag-wave-v` / `cdn-flag-wave-h`) — 3.6s time-based stripe wave on mx/us flags
- auth card shimmer — `cdn-auth-card` surface has no audio var coupling
- weather shimmer (`cdn-shimmer` on `#top-nav::after`) — 24s time-based sweep, independent of any band
- liora crt effects (`crt-roll`, `crt-scan`) — 8s/10s time-based rolling scan lines; no band gate
- us flag stars (`cdn-star-sparkle`) — already noted in treble table; runs on time, not treble level

---

## architecture notes

`src/lib/background-viz/audio.ts` — web audio api analyser node. outputs `getBandBass()`, `getBandMid()`, `getBandTreble()`, `spectralCentroid()`, `spectralFlux()` using biquad filter banks (not raw bin slices — avoids bass leaking into mid at decade boundaries).

`src/lib/background-viz/canvas.ts` — animation loop. each frame calls the band functions and writes `--cdn-bass`, `--cdn-mid`, `--cdn-treble`, `--cdn-flux`, `--cdn-centroid` to `document.documentElement.style`. this makes them cascade to every element on the page.

`src/dune/AudioAdapter.ts` — babylonjs side. reads the css vars from `:root` computed style (flux only; bass/mid/treble come through a direct module import from audio.ts) and passes a `DuneMaterialUpdateContext` object to `DuneMaterial.update()` each babylon frame. reduces coupling between the two renderers.

`body.cdn-stream-playing` — set by `persistent-player/index.tsx` when hls stream is active and audio is unpaused. all css audio-reactive rules are scoped inside this selector so the idle page makes zero visual noise.

`prefers-reduced-motion: reduce` — every audio-reactive block has a guard that zeros or resets the affected properties. transforms are frozen; filter halos may still respond (no motion involved) per the accessibility spec rationale in `logo-svg/index.tsx`.
