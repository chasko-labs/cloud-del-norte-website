# Quantum Banner Generation — ComfyUI Pipeline

## Setup

- Host: rocm-aibox (192.168.4.53)
- ComfyUI: http://localhost:8188
- GPU: AMD RX 6700 XT (12GB VRAM, ROCm)
- Models: SDXL Base 1.0 (sd_xl_base_1.0.safetensors), DreamShaperXL Turbo V2 (DreamShaperXL_Turbo_V2.safetensors)
- VAE: sdxl_vae (built into checkpoints)
- Samplers available: euler, euler_ancestral, dpm++_2m, dpm++_sde, uni_pc, etc
- Schedulers: normal, karras, exponential, sgm_uniform

## Brand Constraints

- No hex codes in positive prompts
- No geometric trigger words in positive (geometry, lattice, grid, pattern, structure, framework) — put in NEGATIVE
- Composite-not-generate for all marks/logos/text
- Seeds locked per approved variant
- Brand colors expressed as words: deep navy, rich purple, soft violet, lavender, gold
- Quantum tokens as words: cyan, teal, bright violet, warm gold/amber, emerald

## Methodology

1. Turbo validation (DreamShaper XL Turbo, cfg 2, 6 steps, DPM++ SDE Karras) — batch of 4 per concept
2. Selection: pick best composition per concept
3. Full render (SDXL Base, cfg 4.5, 30 steps, DPM++ 2M Karras) — locked seed from turbo winner
4. Upscale (4x-UltraSharp ESRGAN)
5. Composite (rsvg-convert for marks + Pillow for overlay)
6. Publish to s3://dev.clouddelnorte.org/_previews/quantum/

## Concepts

### 1. High-Dimensional Origami (State Space Transformation)

Metaphor: quantum operations fold/unfold possibility space
Aesthetic: architectural, sleek, futuristic — color field painting depth
Usage: card background (badges section)

Positive:
```
ben-day halftone dot field, atmospheric gradient wash, no hard lines,
abstract angular translucent planes folding through deep space,
color field painting depth, layered translucent violet and navy surfaces,
origami-like faceted forms dissolving into probability cloud,
soft cyan edge light where surfaces meet, deep purple shadows between folds,
architectural minimalism, vast dark void, single point of warm gold light,
Rothko-inspired emotional depth, futuristic paper sculpture floating
```

Negative:
```
grid, plaid, tartan, checkerboard, graph paper, ruled lines, crosshatch, lattice pattern,
text, watermark, signature, logo, numbers, letters,
human, face, hands, body, realistic photo,
color chart, swatch card, measurement scale, diagram, schematic,
busy, cluttered, wireframe mesh, mechanical, hardware
```

Params: SDXL Base, 768x512, euler_ancestral, karras, cfg 4.5, steps 30
Seed: 710042001
Crop: center to 600x400

### 2. Lattices of Light (Physical Qubits — ions/atoms in traps)

Metaphor: precise coherent points of light held in perfect arrays by invisible forces
Aesthetic: minimalist, ethereal, pristine — Light & Space art (Turrell)
Usage: card background (speakers section)

Positive:
```
ben-day halftone dot field, atmospheric gradient wash, no hard lines,
scattered luminous cyan points suspended in pristine dark void,
optical trap visualization, coherent light motes in precise suspended array,
deep navy emptiness between floating points of soft teal emission,
James Turrell light installation aesthetic, perception of infinite depth,
minimalist constellation of quantum dots, each point a perfect sphere of light,
clean dark laboratory vacuum, ethereal photon scatter
```

Negative:
```
grid, plaid, tartan, checkerboard, graph paper, ruled lines, crosshatch, lattice pattern,
text, watermark, signature, logo, numbers, letters,
human, face, hands, body, realistic photo,
color chart, swatch card, measurement scale, diagram, schematic,
mechanical, hardware, wires, tubes, equipment, circuit board
```

Params: SDXL Base, 768x512, euler_ancestral, karras, cfg 4.5, steps 30
Seed: 710042002
Crop: center to 600x400

### 3. Bloch Sphere Constellations (Mathematical Quantum States)

Metaphor: each qubit state is a point in abstract mathematical space, many qubits form a constellation
Aesthetic: cosmic, interconnected, sci-fi — desert night sky meeting quantum state space
Usage: hero banner (1920x600), OG image (1200x630), mobile hero (1080x1920)

Positive:
```
ben-day halftone dot field, atmospheric gradient wash, no hard lines,
cosmic desert night sky fading from deep navy to rich purple,
scattered gold and violet luminous nodes connected by faint threads,
concentric arc traces suggesting spherical geometry in deep space,
lavender nebula wisps, warm amber horizon glow at bottom,
constellation of quantum state points in mathematical space,
vast empty cosmic void with precise luminous markers,
cinematic panoramic composition, atmospheric infinite depth
```

Negative:
```
grid, plaid, tartan, checkerboard, graph paper, ruled lines, crosshatch, lattice pattern,
text, watermark, signature, logo, numbers, letters,
human, face, hands, body, realistic photo, planet, moon, earth,
color chart, swatch card, measurement scale, diagram, schematic,
spaceship, sci-fi hardware, satellite, technology device
```

Params (hero): SDXL Base, 1920x768, euler_ancestral, karras, cfg 4.5, steps 30
Seed: 710042003
Crop: bottom 168px removed → 1920x600

Params (OG): SDXL Base, 1216x640, euler_ancestral, karras, cfg 4.5, steps 30
Seed: 710042004
Crop: center to 1200x630

Params (mobile): SDXL Base, 1088x1920, euler_ancestral, karras, cfg 4.5, steps 30
Seed: 710042005
Crop: trim 4px each side → 1080x1920

### 4. Quantum Prism / Tapestry (Interference & Algorithms)

Metaphor: probability amplitudes splitting through a prism and recombining — how quantum computation works
Aesthetic: organic light, vibrant, analytical — lyrical abstraction
Usage: card background (sessions section)

Positive:
```
ben-day halftone dot field, atmospheric gradient wash, no hard lines,
soft prismatic light dispersion through deep navy atmosphere,
organic rainbow-fringe bands at very low opacity splitting from a point,
constructive and destructive interference rendered as light and shadow bands,
lyrical abstraction, flowing probability waves recombining,
emerald and cyan interference peaks, violet and lavender nulls,
analytical yet organic, radial emission from center,
impressionistic quantum light study, deep cosmic background
```

Negative:
```
grid, plaid, tartan, checkerboard, graph paper, ruled lines, crosshatch, lattice pattern,
text, watermark, signature, logo, numbers, letters,
human, face, hands, body, realistic photo,
color chart, swatch card, measurement scale, diagram, schematic,
rainbow flag, pride flag, color bars, test card, spectrum chart, prism photo
```

Params: SDXL Base, 768x512, euler_ancestral, karras, cfg 4.5, steps 30
Seed: 710042006
Crop: center to 600x400

## Composite Plan

| deliverable | logo overlay | circuit SVG | text composite |
|---|---|---|---|
| Hero 1920x600 | CDN logo top-left, light variant | 8% opacity bottom third | none |
| OG 1200x630 | CDN logo center-top 120px | none | "Quantum Computing Workshop Series" Cinzel 600 lower-center |
| Mobile 1080x1920 | CDN logo top-center 80px | none | none |
| Card: badges 600x400 | none | none | none (glass CSS overlay at display) |
| Card: speakers 600x400 | none | none | none |
| Card: sessions 600x400 | none | none | none |

## Output Paths

```
public/brand/quantum/
├── quantum-hero-1920x600.webp
├── quantum-og-1200x630.png
├── quantum-mobile-1080x1920.webp
├── quantum-card-badges-600x400.webp
├── quantum-card-speakers-600x400.webp
└── quantum-card-sessions-600x400.webp
```
