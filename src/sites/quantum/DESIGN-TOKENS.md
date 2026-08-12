# Quantum Design Tokens

design system for the quantum computing workshop series site. all tokens defined in `_layout/styles.css` under `:root`.

## Color Tokens

| token | value | usage |
|-------|-------|-------|
| --q-cyan | #06b6d4 | measurement, info states |
| --q-teal | #14b8a6 | state \|0⟩, success |
| --q-violet-bright | #a855f7 | state \|1⟩, primary actions |
| --q-gold-warm | #f59e0b | entanglement, highlights |
| --q-emerald | #10b981 | coherent, confirmed |

## Glass Tokens

| token | value | usage |
|-------|-------|-------|
| --q-glass-bg | rgba(33, 29, 48, 0.8) | card/container background |
| --q-glass-border | rgba(59, 53, 86, 0.6) | glass panel borders |
| --q-glass-blur | blur(12px) | backdrop-filter intensity |

## Shadow Tokens

| token | value | usage |
|-------|-------|-------|
| --q-shadow-card | multi-layer purple + black | default card depth |
| --q-shadow-elevated | 0 12px 40px rgba(0,0,0,0.4) | hover/focus lift |
| --q-shadow-focus | 0 0 0 3px rgba(167,148,224,0.6) | focus-visible ring |
| --q-glow-terminal | 0 0 20px rgba(129,105,197,0.3) | terminal glow effect |

## Typography Rules

| context | font | size | weight |
|---------|------|------|--------|
| body text (cards) | system sans-serif | 16px desktop / 15px mobile | 400 |
| headers | Cinzel (brand) or system | clamp(20px, 3vw, 32px) | 600-700 |
| technical labels | JetBrains Mono | 14-16px | 500-600 |
| code/status badges | JetBrains Mono | 14px | 400 |
| toolbar brand | Cinzel display | clamp(16px, 2vw, 22px) | 600 |

JetBrains Mono is reserved for: code snippets, toolbar brand text, status badges, and technical labels. body/paragraph text uses system sans-serif for readability (especially important for senior readers).

line-height rules:
- body text in cards: 1.6 minimum
- headers: 1.3 minimum
- buttons/CTAs: 1.3 minimum (never below 1.2)

## Touch Targets

- all interactive elements: min 44×44px (WCAG 2.5.8)
- primary CTA (Register for Workshop): min 48px height
- calendar action buttons: min 44px height with padding
- toolbar pills (theme/locale toggles): min 44×44px
- sign-in link: min 44px height

## Effects

| effect | usage | reduced-motion |
|--------|-------|----------------|
| scanlines | page overlay via ::after (2% opacity) | hidden |
| noise grain | fractal turbulence texture | hidden |
| vignette | dark edge fade (radial-gradient) | static (no animation) |
| interference | card bg drift (60s linear) | static |
| Bloch sphere | conic gradient rotation (120s) | static |
| glow pulse | CTA button hover | disabled |
| quantum particles | 4 floating dots (22-32s drift) | static position, reduced opacity |
| card entrance | fade-up (0.6s staggered) | disabled |

## Background System

the page background has three conceptual layers:

1. **base** — `.quantum-layout` background with radial Bloch sphere ellipse + conic meridians + center glow on top of --cdn-navy
2. **atmosphere** — `.quantum-layout::before` with rotating conic gradient (120s), interference waves, and lattice dots
3. **particles** — `.quantum-particles` containing 4 pure-CSS drift circles using quantum color tokens (--q-cyan, --q-violet-bright, --q-gold-warm)
4. **effects overlay** — `.quantum-layout::after` combining scanlines + noise + vignette in one composited layer

## Light Mode

light mode overrides reduce all effects:
- container background becomes white with 80% opacity
- ::before atmosphere becomes minimal radial gradients with no animation
- ::after effects overlay drops to 25% opacity
- particles remain visible at reduced opacity

## Brand Colors (inherited from CDN tokens)

| token | value | usage |
|-------|-------|-------|
| --cdn-navy | #00002a | base dark background |
| --cdn-purple | #5a1f8a | primary brand |
| --cdn-violet | #9060f0 | accent, gradient endpoints |
| --cdn-lavender | #d7c7ee | light text on dark bg |
| --cdn-gold | #c9a23f | warm CTA (brass register button) |

## Animation Tokens

| token | value | usage |
|-------|-------|-------|
| --q-ease-spring | cubic-bezier(0.34, 1.56, 0.64, 1) | bouncy interactions |
| --q-transition-glow | box-shadow 600ms ease, border-color 600ms ease | glow transitions |
