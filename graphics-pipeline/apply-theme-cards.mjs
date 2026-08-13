// SPDX-License-Identifier: MIT-0
// Iteration-0 theme-page edit, authored by the product-owner poltergeist and
// EXECUTED by a ghost (poltergeists orchestrate, ghosts write src/). Idempotent:
// re-running is a no-op. Adds graphics-pipeline data + three cards to /theme.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(root, "src/pages/theme/data.ts");
const APP = join(root, "src/pages/theme/app.tsx");

/* ---- 1. data.ts: append graphics-pipeline structures ---- */
let data = readFileSync(DATA, "utf8");
if (!data.includes("imageGenResolutions")) {
	data += `
/* --------------------------------------------------------------------------
   graphics-pipeline — image generation standards + reusable components
   (Iteration 0). Plain-string content, matching the brand-logo section.
   -------------------------------------------------------------------------- */

export interface ResolutionTarget {
	label: string;
	size: string;
	notes: string;
}

export const imageGenResolutions: ResolutionTarget[] = [
	{ label: "Wallpaper QHD", size: "2560×1440", notes: "16:9 desktop standard" },
	{ label: "Wallpaper 4K", size: "3840×2160", notes: "16:9 high-DPI" },
	{
		label: "Mobile",
		size: "1290×2796",
		notes: "portrait — keep mark within center 80% safe-area",
	},
];

export const imageGenRules: string[] = [
	"Palette-lock: backgrounds use only CDN palette hexes (navy #00002a → purple-deep #30006a → violet #9060f0 → lavender #d7c7ee → cream #faf7f0); espresso #2c1206 for warmth; AWS orange #ff9900 is CTA-only, never in atmospheres.",
	"Texture: directional Ben-Day dot field + matte newspaper grain in the mid-tones; World's-Fair mid-century-futurist geometry.",
	"Vignette + gradient: dark vignette at the edges, warm-cool cream-to-lavender gradient, halftone fade transitions, low-elevation glassmorphism.",
	"Safe-area: on mobile (1290×2796) keep the logo and any focal content within the center 80% to clear notch, status bar, and home indicator.",
];

export const logoReproSteps: string[] = [
	"Rasterize lib/brand/logo.svg (viewBox 1024×1024) at the target resolution with rsvg-convert so the cdn-bulb-glow + cdn-arm-glow filters bake in; center on a transparent canvas (run graphics-pipeline/render-logo.mjs).",
	"Generate the BACKGROUND atmosphere only with SDXL (sd_xl_base_1.0), prompt-locked to the palette hexes — Ben-Day dots, grain, vignette, gradient. No star, no logo, no text.",
	"Apply the glow in image space: gaussian-blur the logo raster and screen/add it onto the atmosphere (mirrors cdn-bulb-glow dual-blur bloom + cdn-arm-glow halo).",
	"Composite the sharp, untouched logo over the atmosphere using its own alpha as the mask (ComfyUI: LoadImage → InvertMask → ImageCompositeMasked).",
	"Export at wallpaper + mobile resolutions. Workflow: graphics-pipeline/cdn-composite.api.json (API) / .ui.json (editor).",
];

export const logoIntegrityDos: string[] = [
	"Use logo.svg exactly as authored — 3 cdn-arm paths + 12 cdn-bulb paths.",
	"Composite the mark; vary only the atmosphere + glow (KSampler seed).",
	"Preserve the 1:1 aspect ratio; center within the safe-area.",
];

export const logoIntegrityDonts: string[] = [
	"Never warp, skew, or apply perspective to the mark.",
	"Never detach or recompose the arms or bulbs.",
	"Never let SDXL generate the logo — diffusion cannot reproduce the geometry (no ControlNet/LoRA available).",
];
`;
	writeFileSync(DATA, data);
	console.log("data.ts: appended graphics-pipeline structures");
} else {
	console.log("data.ts: already present, skipped");
}

/* ---- 2. app.tsx: imports + TOC + three card sections ---- */
let app = readFileSync(APP, "utf8");

const importOld = `import {
	elevationLevels,
	paletteGroups,
	radiusTokens,
	shadowTokens,
	textEmphasisLevels,
	typographyScale,
} from "./data";`;
const importNew = `import {
	elevationLevels,
	imageGenResolutions,
	imageGenRules,
	logoIntegrityDonts,
	logoIntegrityDos,
	logoReproSteps,
	paletteGroups,
	radiusTokens,
	shadowTokens,
	textEmphasisLevels,
	typographyScale,
} from "./data";`;
if (app.includes(importOld)) {
	app = app.replace(importOld, importNew);
} else if (!app.includes("imageGenResolutions")) {
	throw new Error("app.tsx: import anchor not found");
}

const tocOld = `\t\t{ id: "card-example", label: "card example" },\n\t];`;
const tocNew = `\t\t{ id: "card-example", label: "card example" },\n\t\t{ id: "image-gen", label: "image generation standards" },\n\t\t{ id: "reusable-components", label: "reusable components" },\n\t\t{ id: "component-cdn-logo", label: "component: cdn logo" },\n\t];`;
if (app.includes(tocOld)) {
	app = app.replace(tocOld, tocNew);
} else if (!app.includes('id: "image-gen"')) {
	throw new Error("app.tsx: TOC anchor not found");
}

const sectionsAnchor = `\t\t\t</SpaceBetween>\n\t\t</ContentLayout>\n\t);\n}`;
const sections =
	`\t\t\t\t{/* image generation standards */}
				<div id="section-image-gen">
					<Container
						header={
							<Header variant="h2">
								image generation standards — wallpaper &amp; mobile
							</Header>
						}
					>
						<SpaceBetween size="m">
							<Box variant="p" fontSize="body-s">
								target resolutions for generated atmospheres. backgrounds are
								palette-locked; the brand mark is composited, never generated.
							</Box>
							<ColumnLayout columns={3} variant="text-grid">
								{imageGenResolutions.map((r) => (
									<Box key={r.size} padding="s">
										<SpaceBetween size="xxs">
											<Box variant="strong">{r.label}</Box>
											<Box variant="code" fontSize="body-s">
												{r.size}
											</Box>
											<Box variant="small" color="text-body-secondary">
												{r.notes}
											</Box>
										</SpaceBetween>
									</Box>
								))}
							</ColumnLayout>
							<SpaceBetween size="xs">
								{imageGenRules.map((rule) => (
									<Box key={rule} variant="p" fontSize="body-s">
										{rule}
									</Box>
								))}
							</SpaceBetween>
						</SpaceBetween>
					</Container>
					<a href="#toc" className="theme-toc-back">
						^ top
					</a>
				</div>

				{/* reusable components */}
				<div id="section-reusable-components">
					<Container header={<Header variant="h2">reusable components</Header>}>
						<Box variant="p" fontSize="body-s">
							the component library is the catalog of reusable, brand-canonical
							building blocks — each with its tokens, integrity rules, and a
							from-scratch reproduction guide. the cdn logo below is the first
							entry.
						</Box>
					</Container>
					<a href="#toc" className="theme-toc-back">
						^ top
					</a>
				</div>

				{/* component: cdn logo */}
				<div id="section-component-cdn-logo">
					<Container header={<Header variant="h2">cdn logo</Header>}>
						<SpaceBetween size="m">
							<div className="theme-logo-showcase">
								<img
									src="/brand/logo.svg"
									alt="Cloud Del Norte AWS User Group"
									className="theme-logo-img"
								/>
								<div className="theme-logo-meta">
									<p>
										<strong>rendered raster:</strong>{" "}
										<code>
											graphics-pipeline/renders/cdn-logo-2560x1440.png
										</code>{" "}
										(also 3840×2160 + mobile 1290×2796)
									</p>
									<p>
										<strong>workflow:</strong>{" "}
										<code>graphics-pipeline/cdn-composite.api.json</code>
									</p>
								</div>
							</div>
							<Box variant="strong" fontSize="heading-s">
								from-scratch ComfyUI reproduction (locked composite method)
							</Box>
							<SpaceBetween size="xs">
								{logoReproSteps.map((step, i) => (
									<Box key={step} variant="p" fontSize="body-s">
										{i + 1}. {step}
									</Box>
								))}
							</SpaceBetween>
							<ColumnLayout columns={2} variant="text-grid">
								<SpaceBetween size="xs">
									<Box variant="strong" fontSize="body-m">
										do
									</Box>
									{logoIntegrityDos.map((d) => (
										<Box key={d} variant="p" fontSize="body-s">
											{d}
										</Box>
									))}
								</SpaceBetween>
								<SpaceBetween size="xs">
									<Box variant="strong" fontSize="body-m">
										don't
									</Box>
									{logoIntegrityDonts.map((d) => (
										<Box key={d} variant="p" fontSize="body-s">
											{d}
										</Box>
									))}
								</SpaceBetween>
							</ColumnLayout>
						</SpaceBetween>
					</Container>
					<a href="#toc" className="theme-toc-back">
						^ top
					</a>
				</div>
` + sectionsAnchor;
if (!app.includes('id: "section-image-gen"')) {
	if (!app.includes(sectionsAnchor))
		throw new Error("app.tsx: sections anchor not found");
	app = app.replace(sectionsAnchor, sections);
}

writeFileSync(APP, app);
console.log("app.tsx: imports + TOC + 3 card sections applied");
