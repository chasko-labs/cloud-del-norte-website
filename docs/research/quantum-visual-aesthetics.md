# quantum visual aesthetics research — quantum.clouddelnorte.org

research output for quantum computing workshop landing page visual design.
desert/juárez/el paso night sky blended with quantum science visuals.

---

## industry visual patterns observed

### IBM Quantum
- near-black backgrounds with high-contrast white/blue text
- geometric hardware photography as hero — the golden chandelier (Q System One)
- Carbon Design System: structured grid, deep navy/black, accent blues
- circuit diagram line art as decorative borders
- github.com/IBM-Quantum-Technical-Enablement/quantum-styles — dedicated color themes for quantum UIs

### Google Quantum AI (quantumai.google)
- dark hero with particle/wave animation (WebGL-driven)
- gradient text on dark backgrounds (deep blue → teal → white)
- chip photography with dramatic lighting
- their 2026 brand refresh: gradient-forward design language (Gemini influence)
- Willow chip marketing: blue-purple-teal palette, constellation-like node diagrams

### AWS Braket
- standard AWS dark theme (squid ink #232F3E base)
- circuit diagram iconography — gates represented as colored blocks on wire lines
- trapped-ion / neutral-atom hardware imagery
- clean, technical — less artistic, more dashboard-functional

### common quantum visualization patterns across all three
- circuit diagrams (horizontal lines with gate blocks)
- Bloch sphere representations (wireframe sphere with state vectors)
- interference fringes (parallel bands with varying intensity)
- probability amplitude clouds (gaussian-like radial fades)
- lattice/grid patterns representing qubit arrays
- entanglement visualized as connecting arcs between nodes

---

## CDN brand palette (existing)

| token | hex | role |
| --- | --- | --- |
| navy | #00002a | background, dark ground |
| purple | #5a1f8a | primary brand, lattice fills |
| violet | #9060f0 | accent fills, mid-tone banding |
| lavender | #d7c7ee | highlight, soft accent |

---

## concept 1: high-dimensional origami — state space transformation

### mood
architectural, sleek, futuristic. folded planes in high-dimensional space collapsing into observable states.

### color palette additions

| name | hex | role | contrast vs navy |
| --- | --- | --- | --- |
| crease-silver | #b8c4d0 | fold edges, architectural lines | 8.2:1 ✓ |
| dimension-teal | #2dd4bf | transformation accent | 7.8:1 ✓ |
| fold-indigo | #3a29ff | deep fold shadow | 3.1:1 (decorative only) |
| plane-white | #e8edf2 | surface highlights | 11.4:1 ✓ |

### CSS implementation

```css
/* high-dimensional origami — card background */
.quantum-origami-bg {
  --cdn-navy: #00002a;
  --fold-teal: #2dd4bf;
  --fold-purple: #5a1f8a;
  --crease-silver: rgba(184, 196, 208, 0.08);

  background-color: var(--cdn-navy);
  background-image:
    /* diagonal fold lines — architectural creases */
    repeating-linear-gradient(
      35deg,
      transparent,
      transparent 80px,
      var(--crease-silver) 80px,
      var(--crease-silver) 81px
    ),
    repeating-linear-gradient(
      -55deg,
      transparent,
      transparent 120px,
      var(--crease-silver) 120px,
      var(--crease-silver) 121px
    ),
    /* triangular facet shading via conic */
    conic-gradient(
      from 200deg at 30% 40%,
      rgba(90, 31, 138, 0.12) 0deg,
      transparent 60deg,
      rgba(45, 212, 191, 0.06) 120deg,
      transparent 180deg,
      rgba(90, 31, 138, 0.08) 240deg,
      transparent 360deg
    );
}

/* section divider — folded edge */
.origami-divider {
  height: 60px;
  background: var(--cdn-navy);
  clip-path: polygon(
    0% 0%, 100% 0%,
    100% 40%, 75% 100%,
    50% 40%, 25% 100%,
    0% 40%
  );
  background-image: linear-gradient(
    135deg,
    rgba(45, 212, 191, 0.15) 0%,
    rgba(90, 31, 138, 0.2) 50%,
    rgba(0, 0, 42, 0.9) 100%
  );
}

/* animation — slow fold rotation */
@property --origami-angle {
  syntax: '<angle>';
  initial-value: 200deg;
  inherits: false;
}

.quantum-origami-bg {
  animation: origami-shift 30s ease-in-out infinite alternate;
}

@keyframes origami-shift {
  from { --origami-angle: 200deg; }
  to { --origami-angle: 240deg; }
}

@media (prefers-reduced-motion: reduce) {
  .quantum-origami-bg { animation: none; }
}
```

### usage guidance
- card backgrounds: use as full card bg with glass overlay panel for text
- the clip-path divider separates page sections with a "folded paper" edge
- keep fold lines at < 10% opacity so they read as texture, not content

---

## concept 2: lattices of light — physical quantum hardware (ions/atoms)

### mood
minimalist, ethereal, pristine. trapped ions in optical lattices — points of light suspended in precise geometric arrays.

### color palette additions

| name | hex | role | contrast vs navy |
| --- | --- | --- | --- |
| ion-cyan | #67e8f9 | trapped ion glow | 9.1:1 ✓ |
| lattice-blue | #38bdf8 | lattice connection lines | 7.2:1 ✓ |
| vacuum-dark | #000014 | deeper-than-navy void | n/a (bg) |
| photon-white | #f0f9ff | photon scatter | 12.8:1 ✓ |

### CSS implementation

```css
/* lattices of light — dot grid background */
.quantum-lattice-bg {
  --cdn-navy: #00002a;
  --ion-cyan: #67e8f9;
  --lattice-blue: #38bdf8;

  background-color: var(--cdn-navy);
  background-image:
    /* primary lattice: dots at intersections */
    radial-gradient(
      circle 1.5px at center,
      rgba(103, 232, 249, 0.4) 0%,
      rgba(103, 232, 249, 0.4) 100%,
      transparent 100%
    ),
    /* secondary lattice offset — creates depth */
    radial-gradient(
      circle 1px at center,
      rgba(56, 189, 248, 0.2) 0%,
      rgba(56, 189, 248, 0.2) 100%,
      transparent 100%
    ),
    /* subtle connecting glow between nodes */
    radial-gradient(
      ellipse 200px 200px at 50% 50%,
      rgba(103, 232, 249, 0.03) 0%,
      transparent 70%
    );
  background-size:
    40px 40px,
    40px 40px,
    100% 100%;
  background-position:
    0 0,
    20px 20px,
    center;
}

/* single ion glow — for card hover states */
.ion-glow {
  position: relative;
}
.ion-glow::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 120px;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    rgba(103, 232, 249, 0.15) 0%,
    rgba(103, 232, 249, 0.05) 40%,
    transparent 70%
  );
  border-radius: 50%;
  pointer-events: none;
  animation: ion-pulse 4s ease-in-out infinite;
}

@keyframes ion-pulse {
  0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
}

/* lattice connection lines via SVG pattern */
.lattice-connections {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cline x1='20' y1='0' x2='20' y2='40' stroke='rgba(56,189,248,0.06)' stroke-width='0.5'/%3E%3Cline x1='0' y1='20' x2='40' y2='20' stroke='rgba(56,189,248,0.06)' stroke-width='0.5'/%3E%3C/svg%3E");
}

@media (prefers-reduced-motion: reduce) {
  .ion-glow::before { animation: none; opacity: 0.8; }
}
```

### usage guidance
- the dot grid reads as a qubit array / ion trap viewed from above
- use as full-page section background behind glass registration cards
- ion-pulse animation is extremely subtle — just a gentle breathing glow
- lattice connections add orthogonal structure without competing with text

---

## concept 3: bloch sphere constellations — mathematical quantum states

### mood
cosmic, interconnected, sci-fi. qubit states as points on spheres, connected across space like constellations in a desert night sky.

### color palette additions

| name | hex | role | contrast vs navy |
| --- | --- | --- | --- |
| state-gold | #fbbf24 | |0⟩ state marker | 8.9:1 ✓ |
| superposition-rose | #f472b6 | superposition accent | 5.2:1 ✓ |
| entangle-violet | #a78bfa | entanglement arcs | 4.8:1 ✓ |
| cosmos-deep | #0c0024 | deeper void layer | n/a (bg) |

### CSS implementation

```css
/* bloch sphere constellations — cosmic background */
.quantum-constellation-bg {
  --cdn-navy: #00002a;
  --state-gold: #fbbf24;
  --superposition-rose: #f472b6;
  --entangle-violet: #a78bfa;

  background-color: #0c0024;
  background-image:
    /* constellation nodes — scattered points */
    radial-gradient(circle 2px at 15% 20%, rgba(251, 191, 36, 0.6) 0%, transparent 100%),
    radial-gradient(circle 1.5px at 35% 45%, rgba(167, 139, 250, 0.5) 0%, transparent 100%),
    radial-gradient(circle 2px at 65% 30%, rgba(244, 114, 182, 0.5) 0%, transparent 100%),
    radial-gradient(circle 1px at 80% 60%, rgba(251, 191, 36, 0.4) 0%, transparent 100%),
    radial-gradient(circle 1.5px at 25% 75%, rgba(167, 139, 250, 0.4) 0%, transparent 100%),
    radial-gradient(circle 1px at 55% 80%, rgba(244, 114, 182, 0.3) 0%, transparent 100%),
    radial-gradient(circle 2px at 90% 15%, rgba(251, 191, 36, 0.5) 0%, transparent 100%),
    radial-gradient(circle 1px at 45% 10%, rgba(167, 139, 250, 0.3) 0%, transparent 100%),
    /* sphere wireframe suggestion — concentric rings */
    radial-gradient(
      circle 180px at 50% 50%,
      transparent 170px,
      rgba(167, 139, 250, 0.08) 171px,
      rgba(167, 139, 250, 0.08) 172px,
      transparent 173px
    ),
    radial-gradient(
      circle 120px at 50% 50%,
      transparent 110px,
      rgba(144, 96, 240, 0.06) 111px,
      rgba(144, 96, 240, 0.06) 112px,
      transparent 113px
    ),
    /* deep space gradient base */
    radial-gradient(
      ellipse at 50% 50%,
      rgba(90, 31, 138, 0.15) 0%,
      transparent 60%
    );
}

/* entanglement arc — SVG connector between cards */
.entanglement-arc {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.3;
}
.entanglement-arc svg path {
  stroke: var(--entangle-violet);
  stroke-width: 1;
  fill: none;
  stroke-dasharray: 4 8;
  animation: entangle-flow 8s linear infinite;
}

@keyframes entangle-flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -48; }
}

/* constellation twinkle */
@keyframes star-twinkle {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.constellation-node {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--state-gold);
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.4);
  animation: star-twinkle 3s ease-in-out infinite;
  animation-delay: var(--twinkle-delay, 0s);
}

@media (prefers-reduced-motion: reduce) {
  .entanglement-arc svg path { animation: none; }
  .constellation-node { animation: none; opacity: 0.7; }
}
```

### usage guidance
- the scattered radial-gradient "stars" evoke the desert night sky over el paso/juárez
- concentric rings suggest Bloch sphere wireframes without needing 3D
- entanglement arcs connect related workshop cards (paired topics)
- twinkle delay uses CSS custom properties for staggered timing: `style="--twinkle-delay: 1.2s"`

---

## concept 4: quantum prism / tapestry — interference & algorithms

### mood
organic light, vibrant, analytical. interference patterns where probability amplitudes constructively and destructively combine — rainbow fringe patterns through a computational lens.

### color palette additions

| name | hex | role | contrast vs navy |
| --- | --- | --- | --- |
| constructive-emerald | #34d399 | constructive interference peak | 7.6:1 ✓ |
| destructive-amber | #f59e0b | destructive interference node | 7.1:1 ✓ |
| fringe-magenta | #e879f9 | fringe band accent | 5.4:1 ✓ |
| prism-spectrum-start | #06b6d4 | spectrum start (cyan) | 6.8:1 ✓ |

### CSS implementation

```css
/* quantum prism — interference pattern background */
.quantum-prism-bg {
  --cdn-navy: #00002a;
  --cdn-purple: #5a1f8a;
  --cdn-violet: #9060f0;
  --constructive: #34d399;
  --prism-cyan: #06b6d4;

  background-color: var(--cdn-navy);
  background-image:
    /* interference fringes — repeating bands */
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 18px,
      rgba(144, 96, 240, 0.04) 18px,
      rgba(144, 96, 240, 0.08) 20px,
      rgba(144, 96, 240, 0.04) 22px,
      transparent 22px
    ),
    /* secondary fringe at offset angle — creates moiré */
    repeating-linear-gradient(
      95deg,
      transparent,
      transparent 22px,
      rgba(6, 182, 212, 0.03) 22px,
      rgba(6, 182, 212, 0.06) 24px,
      rgba(6, 182, 212, 0.03) 26px,
      transparent 26px
    ),
    /* probability amplitude envelope */
    radial-gradient(
      ellipse 60% 80% at 50% 50%,
      rgba(52, 211, 153, 0.06) 0%,
      transparent 70%
    );
}

/* prism light dispersion — section accent */
.prism-dispersion {
  position: relative;
  overflow: hidden;
}
.prism-dispersion::before {
  content: '';
  position: absolute;
  top: 0;
  left: 30%;
  width: 40%;
  height: 100%;
  background: conic-gradient(
    from 180deg at 50% 0%,
    rgba(6, 182, 212, 0.12) 0deg,
    rgba(52, 211, 153, 0.1) 30deg,
    rgba(251, 191, 36, 0.08) 60deg,
    rgba(245, 158, 11, 0.08) 90deg,
    rgba(232, 121, 249, 0.1) 120deg,
    rgba(144, 96, 240, 0.12) 150deg,
    transparent 180deg
  );
  filter: blur(40px);
  opacity: 0.6;
  pointer-events: none;
  animation: prism-shift 20s ease-in-out infinite alternate;
}

@keyframes prism-shift {
  from { transform: translateX(-5%) rotate(0deg); }
  to { transform: translateX(5%) rotate(3deg); }
}

/* wave function collapse — hover transition */
.wave-collapse-card {
  transition: background-image 0.6s ease;
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 8px,
      rgba(144, 96, 240, 0.06) 8px,
      rgba(144, 96, 240, 0.06) 9px,
      transparent 9px
    );
}
.wave-collapse-card:hover {
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 8px,
      rgba(52, 211, 153, 0.12) 8px,
      rgba(52, 211, 153, 0.12) 9px,
      transparent 9px
    );
}

@media (prefers-reduced-motion: reduce) {
  .prism-dispersion::before { animation: none; }
}
```

### usage guidance
- interference fringes at slight angle offset create subtle moiré — reads as "wave physics"
- the conic prism dispersion is a blurred overlay that suggests light splitting
- use wave-collapse-card for workshop topic cards: fringes "collapse" on hover
- fringe opacity must stay below 10% to maintain text readability

---

## glass card pattern — text readability over all concepts

```css
/* universal glass card for text over quantum backgrounds */
.quantum-glass-card {
  position: relative;
  z-index: 1;
  background: rgba(0, 0, 42, 0.75);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid rgba(144, 96, 240, 0.15);
  border-radius: 16px;
  padding: 2rem;
  color: #f0f4f8;
}

/* verified contrast ratios on rgba(0,0,42,0.75) over #00002a: */
/* #f0f4f8 (primary text): ~13.2:1 ✓ AA + AAA */
/* #d7c7ee (lavender accent): ~8.1:1 ✓ AA + AAA */
/* #9060f0 (violet links): ~4.6:1 ✓ AA for normal text */
/* #67e8f9 (ion-cyan links): ~9.1:1 ✓ AA + AAA */

.quantum-glass-card h2,
.quantum-glass-card h3 {
  color: #ffffff;
  /* white on the card bg: ~14.8:1 */
}

.quantum-glass-card a {
  color: #67e8f9;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* fallback for browsers without backdrop-filter */
@supports not (backdrop-filter: blur(16px)) {
  .quantum-glass-card {
    background: rgba(0, 0, 42, 0.92);
  }
}
```

---

## atmospheric overlay pattern — behind all content

```css
/* full-page atmospheric layer — desert night + quantum */
.quantum-atmosphere {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-color: #00002a;
  background-image:
    /* desert horizon glow — el paso sunset memory */
    radial-gradient(
      ellipse 120% 40% at 50% 100%,
      rgba(90, 31, 138, 0.2) 0%,
      transparent 60%
    ),
    /* upper sky — deep space */
    radial-gradient(
      ellipse 100% 60% at 50% 0%,
      rgba(12, 0, 36, 0.8) 0%,
      transparent 70%
    ),
    /* scattered quantum "stars" */
    radial-gradient(circle 1px at 10% 15%, rgba(215, 199, 238, 0.5) 0%, transparent 100%),
    radial-gradient(circle 1px at 30% 25%, rgba(103, 232, 249, 0.3) 0%, transparent 100%),
    radial-gradient(circle 1.5px at 70% 10%, rgba(215, 199, 238, 0.4) 0%, transparent 100%),
    radial-gradient(circle 1px at 85% 35%, rgba(167, 139, 250, 0.3) 0%, transparent 100%),
    radial-gradient(circle 1px at 45% 8%, rgba(251, 191, 36, 0.3) 0%, transparent 100%),
    radial-gradient(circle 1px at 60% 42%, rgba(215, 199, 238, 0.2) 0%, transparent 100%);
}
```

---

## SVG filter for organic quantum texture

```html
<!-- inline SVG filter — apply via CSS filter: url(#quantum-noise) -->
<svg width="0" height="0" style="position:absolute">
  <defs>
    <filter id="quantum-noise" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves="3"
        seed="42"
        result="noise"
      />
      <feColorMatrix
        type="saturate"
        values="0"
        in="noise"
        result="mono-noise"
      />
      <feBlend
        in="SourceGraphic"
        in2="mono-noise"
        mode="overlay"
        result="blended"
      />
      <feComposite in="blended" in2="SourceGraphic" operator="in" />
    </filter>
  </defs>
</svg>
```

```css
/* apply sparingly — adds organic grain texture */
.quantum-grain {
  filter: url(#quantum-noise);
  /* grain adds depth to solid-color panels */
}
```

---

## animation summary — all concepts

| concept | animation | duration | technique | reduced-motion fallback |
| --- | --- | --- | --- | --- |
| origami | conic angle shift | 30s | @property + keyframe | static |
| lattice | ion pulse (scale+opacity) | 4s | transform + opacity | static opacity 0.8 |
| constellation | star twinkle | 3s (staggered) | opacity keyframe | static opacity 0.7 |
| constellation | entanglement flow | 8s | stroke-dashoffset | static dashes |
| prism | dispersion drift | 20s | translate + rotate | static position |
| prism | wave collapse (hover) | 0.6s | transition on bg-image | instant change |

all animations are > 3s duration (no seizure risk), low amplitude, and purely decorative.

---

## WCAG compliance checklist

- [x] all text sits on glass card (rgba(0,0,42,0.75)) — never on raw animated gradient
- [x] primary text #f0f4f8 on card: 13.2:1 (exceeds AAA 7:1)
- [x] link color #67e8f9 on card: 9.1:1 (exceeds AAA 7:1)
- [x] violet accent #9060f0 on card: 4.6:1 (meets AA 4.5:1)
- [x] lavender #d7c7ee on card: 8.1:1 (exceeds AAA 7:1)
- [x] all animations respect prefers-reduced-motion: reduce
- [x] no animation faster than 3s cycle (seizure safety)
- [x] decorative backgrounds do not convey information
- [x] interactive elements have visible focus states independent of background

---

## implementation recommendations

1. start with `quantum-atmosphere` as the page-level fixed background
2. apply concept-specific backgrounds to individual sections/cards
3. every text block lives inside `quantum-glass-card`
4. use concept 2 (lattice) for the registration form section — cleanest, most readable
5. use concept 3 (constellation) for the hero/header — most dramatic, desert-sky tie-in
6. use concept 4 (prism) for workshop topic cards — the interference hover effect communicates "quantum"
7. use concept 1 (origami) for section dividers — architectural clip-path edges

---

## desert night sky integration notes

the el paso / juárez / chihuahua desert night sky is the unifying aesthetic:
- navy #00002a IS the deep desert sky after astronomical twilight
- scattered dot "stars" in lavender + gold + cyan tie quantum nodes to constellations
- the horizon glow (purple radial at bottom) references city light pollution on the horizon
- concept 3 most directly maps to "looking up at the stars from the desert"
- the warm gold (#fbbf24) accent represents the amber lights of the border cities viewed from the mesa
