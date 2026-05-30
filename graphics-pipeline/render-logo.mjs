// SPDX-License-Identifier: MIT-0
// Deterministic raster of the canonical CDN brand mark (lib/brand/logo.svg).
// rsvg-convert rasterizes the square SVG (applies cdn-bulb-glow / cdn-arm-glow
// filters at the static first frame); sharp centers it on a transparent canvas
// at each target resolution. The 1:1 mark is never stretched — INTEGRITY RULE.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = join(root, "lib/brand/logo.svg");
const OUT = join(root, "graphics-pipeline/renders");
mkdirSync(OUT, { recursive: true });

// [width, height, filename] — wallpaper (16:9) + mobile (portrait safe-area)
const targets = [
	[2560, 1440, "cdn-logo-2560x1440.png"],
	[3840, 2160, "cdn-logo-3840x2160.png"],
	[1290, 2796, "cdn-logo-1290x2796.png"],
];

for (const [w, h, name] of targets) {
	const side = Math.min(w, h); // fit short side, preserve square aspect
	const png = execFileSync(
		"rsvg-convert",
		["-w", String(side), "-h", String(side), SVG],
		{ maxBuffer: 1 << 30 },
	);
	await sharp({
		create: {
			width: w,
			height: h,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([
			{ input: png, left: Math.round((w - side) / 2), top: Math.round((h - side) / 2) },
		])
		.png()
		.toFile(join(OUT, name));
	console.log(`wrote graphics-pipeline/renders/${name} (${w}x${h}, mark ${side}px centered)`);
}
