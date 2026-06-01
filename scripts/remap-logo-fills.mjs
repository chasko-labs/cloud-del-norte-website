#!/usr/bin/env node
/**
 * CDN Logo Fill Remap v4
 * Preserves all 353 VTracer paths exactly, remaps 336 banding fills to 3 clean roles.
 *
 * Palette:
 *   BRIGHT #FCFCFD — white outline, arms, sparkles, center
 *   MID    #9B5CF4 — violet accents: tip diamonds, bulbs, arm fills
 *   DARK   #5A1F8A — deep purple inner lattice
 *
 * Run: node scripts/remap-logo-fills.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "lib/brand/logo.svg");
const DST = resolve(ROOT, "lib/brand/logo-clean.svg");

const BRIGHT = "#FCFCFD";
const MID = "#9B5CF4";
const DARK = "#5A1F8A";

function hexToHSL(hex) {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0,
		l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / d + 2) / 6;
		else h = ((r - g) / d + 4) / 6;
	}
	return { h: h * 360, s: s * 100, l: l * 100 };
}

function classify(hex) {
	const { s, l } = hexToHSL(hex);
	// High lightness (>80%) regardless of saturation → bright (white structural + pastel AA)
	if (l > 80) return BRIGHT;
	// Low saturation + moderate lightness → bright (desaturated edge AA)
	if (s < 25 && l > 65) return BRIGHT;
	// High saturation + lightness >= 55% → mid violet (bulbs, tips, arm fills)
	if (s >= 40 && l >= 55) return MID;
	// Moderate saturation + high-ish lightness → bright
	if (s < 40 && l >= 55) return BRIGHT;
	// Everything else (saturated + dark) → deep purple lattice
	return DARK;
}

let svg = readFileSync(SRC, "utf8");

// Strip animated glow defs and style blocks
svg = svg.replace(/<defs>[\s\S]*?<\/defs>\s*/i, "");
svg = svg.replace(/<style>[\s\S]*?<\/style>\s*/i, "");

// Strip class and style attributes from path elements (animation hooks)
svg = svg.replace(/(<path\b[^>]*?)\s+class="[^"]*"/g, "$1");
svg = svg.replace(/(<path\b[^>]*?)\s+style="[^"]*"/g, "$1");

// Remap all fills to the 3-color palette
const stats = { bright: 0, mid: 0, dark: 0 };
svg = svg.replace(/fill="(#[A-Fa-f0-9]{6})"/g, (_, hex) => {
	const target = classify(hex.toUpperCase());
	if (target === BRIGHT) stats.bright++;
	else if (target === MID) stats.mid++;
	else stats.dark++;
	return `fill="${target}"`;
});

// Clean up excessive blank lines from removed blocks
svg = svg.replace(/\n{3,}/g, "\n\n");

// Update the comment header
svg = svg.replace(
	/<!-- Generator: visioncortex VTracer 0\.6\.12 -->/,
	"<!-- CDN logo – geometry-preserving fill remap v4 (353 paths, 3-color palette) -->",
);

writeFileSync(DST, svg, "utf8");

// Verification
const pathCount = (svg.match(/<path /g) || []).length;
const uniqueFills = [
	...new Set([...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1])),
];
console.log(`✓ ${pathCount} paths preserved`);
console.log(`✓ ${uniqueFills.length} unique fills: ${uniqueFills.join(", ")}`);
console.log(
	`  bright: ${stats.bright}, mid: ${stats.mid}, dark: ${stats.dark}`,
);
console.log(`✓ Output: ${DST}`);
