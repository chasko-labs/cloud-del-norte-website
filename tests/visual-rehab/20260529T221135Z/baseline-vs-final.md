# Feed Page Visual Rehabilitation — Baseline vs Final Comparison

**Dispatch:** DISPATCH 10 — GAN-inspired generator/evaluator loop
**Method:** Anthropic "Harness design for long-running application development" (Rajasekaran, 2026-03-24) — generator/evaluator pattern with criteria-based grading.
**Generator:** ghost-liora-css-repair · **Evaluator:** ghost-liora-headless-verifier (calibrated skeptical, read-only)
**Converged:** cycle 3 of 8 · **Merged:** PR #416 -> main 29d4c489 · **Deployed:** production clouddelnorte.org (CloudFront ECC3LP1BL2CZS, invalidation IDZWQIVNEEKMGS9DEKENV90Y7U)
**Live URL:** https://clouddelnorte.org/feed/index.html

## Score progression

| Criterion | Weight | Threshold | Baseline (c0) | Final (live) | Delta |
|-----------|:------:|:---------:|:-------------:|:------------:|:--:|
| 1. Scene Visibility | 0.30 | 0.70 | 0.18 FAIL | 0.72 PASS | +0.54 |
| 2. Dark Mode Discipline | 0.25 | 0.70 | 0.62 FAIL | 0.78 PASS | +0.16 |
| 3. Time-of-Day Communication | 0.20 | 0.70 | 0.00 FAIL | 0.80 PASS | +0.80 |
| 4. Craft + Functionality | 0.25 | 0.85 | 0.58 FAIL | 0.86 PASS | +0.28 |
| **Weighted aggregate** | — | — | **0.354** | **0.786** | **+0.432** |

Live production scores match converged cycle-3 dev scores exactly (zero delta), confirming the deploy preserved the result.

## What changed

- **Glassmorphism:** opaque Cloudscape cards -> glass panes (backdrop-filter: blur(14px) + rgba backgrounds 0.28-0.52 alpha + low-alpha borders) revealing the 3D scene. Light-mode text-shadow backing preserves WCAG AA at reduced opacity.
- **Dark-mode discipline:** deep-navy base rgb(10,12,20) (no pure black); all 8 palette rim accents desaturated to <60% chroma; RSVP brand button desaturated; elevation-tinted surfaces.
- **Time-of-day bar (new component):** position-primary sun/moon glyph at ((hour+min/60)/24)*100%, anchored to El Paso time (elPasoHour(), America/Denver) so the glyph agrees with the 3D scene + footer ribbon regardless of viewer timezone. Mode-aware luminance.
- **Weather card (new component):** icon + numeric data primary, desaturated accent, glass surface, no literal sky simulation.
- **Craft fixes:** created public/data/rsvp-counts.json (was 404); eliminated ~50-error Twitch iframe render-race cascade (gate embed on resolved probe); restored footer glass blur (removed shell @supports backdrop-filter:none override); mobile persistent-player overflow fix.

## Side-by-side pairs

12-shot matrix: {desktop,mobile} x {light,dark} x {top,mid,bottom}. Baseline in cycle-0-baseline/, final (live) in final/; filenames are identical for mechanical pairing.

| Shot | Baseline | Final (live) |
|------|----------|--------------|
| Desktop / Light / Top | cycle-0-baseline/desktop-light-top.png | final/desktop-light-top.png |
| Desktop / Light / Mid | cycle-0-baseline/desktop-light-mid.png | final/desktop-light-mid.png |
| Desktop / Light / Bottom | cycle-0-baseline/desktop-light-bottom.png | final/desktop-light-bottom.png |
| Desktop / Dark / Top | cycle-0-baseline/desktop-dark-top.png | final/desktop-dark-top.png |
| Desktop / Dark / Mid | cycle-0-baseline/desktop-dark-mid.png | final/desktop-dark-mid.png |
| Desktop / Dark / Bottom | cycle-0-baseline/desktop-dark-bottom.png | final/desktop-dark-bottom.png |
| Mobile / Light / Top | cycle-0-baseline/mobile-light-top.png | final/mobile-light-top.png |
| Mobile / Light / Mid | cycle-0-baseline/mobile-light-mid.png | final/mobile-light-mid.png |
| Mobile / Light / Bottom | cycle-0-baseline/mobile-light-bottom.png | final/mobile-light-bottom.png |
| Mobile / Dark / Top | cycle-0-baseline/mobile-dark-top.png | final/mobile-dark-top.png |
| Mobile / Dark / Mid | cycle-0-baseline/mobile-dark-mid.png | final/mobile-dark-mid.png |
| Mobile / Dark / Bottom | cycle-0-baseline/mobile-dark-bottom.png | final/mobile-dark-bottom.png |

## Per-cycle critiques

cycle-0-baseline/cycle-0-critique.md / cycle-1/cycle-1-critique.md / cycle-2/cycle-2-critique.md / cycle-3/cycle-3-critique.md / final/final-critique.md

## Cycle log

| Cycle | Strategy | Weighted | Notes |
|-------|----------|:--------:|-------|
| 0 | baseline | 0.354 | opaque cards, no time-of-day bar, no weather card — all 4 hard-fail |
| 1 | PIVOT | 0.640 | glass cards + new time-of-day bar + weather card + dark desaturation -> Dark & Time PASS |
| 2 | refine | 0.776 | alpha 0.48->0.28, blur 20->14px, killed local console errors -> Scene PASS |
| 3 | refine | 0.786 | Twitch race fix + footer glass -> Craft 0.86 PASS — CONVERGED, no regression |
| post-audit | fix | — | time-of-day bar anchored to El Paso time (code-mapper review) |
