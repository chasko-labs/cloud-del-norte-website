/**
 * wave 70a — weather card dark mode (Fix 3)
 *
 * Bryan: "I'm lookin at it on dark mode the footer weather card shows for
 * light mode the fonts are not compliant"
 *
 * Root cause: .awsui-dark-mode .cdn-weather had only 50-55% opacity dark
 * background — in the docked sticky footer context with backdrop-filter,
 * the semi-transparent glass could pull in light page content making the
 * background appear lighter than intended. Text colors depended on opacity
 * inheritance over an ambiguous dark background.
 *
 * Fix:
 * 1. Raised dark-mode weather card background opacity to 82-85% (was 50-55%)
 *    so the dark navy reads through regardless of backdrop content.
 * 2. Added explicit color declarations for metric dt/dd and temp-c in dark mode
 *    so text never depends solely on opacity inheritance.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const weatherCss = readFileSync(
	resolve(REPO_ROOT, "src/components/weather/styles.css"),
	"utf-8",
);

describe("wave 70a — weather card dark mode contrast", () => {
	it("dark-mode weather background opacity is >= 0.80 (was 0.50-0.55)", () => {
		// Extract the background values from .awsui-dark-mode .cdn-weather block
		// The alpha values in rgba(28, 34, 48, X) must be >= 0.80
		const darkBgMatch = weatherCss.match(
			/\.awsui-dark-mode\s+\.cdn-weather\s*\{[^}]*background:\s*linear-gradient[^;]+;/,
		);
		expect(darkBgMatch).not.toBeNull();
		const bgBlock = darkBgMatch?.[0] ?? "";
		// Extract all rgba alpha values from the gradient
		const alphas = [...bgBlock.matchAll(/rgba\([^)]+,\s*([\d.]+)\)/g)].map(
			(m) => Number.parseFloat(m[1]),
		);
		expect(alphas.length).toBeGreaterThan(0);
		// All background alphas should be >= 0.80
		for (const alpha of alphas) {
			expect(
				alpha,
				`Background alpha ${alpha} is below 0.80`,
			).toBeGreaterThanOrEqual(0.8);
		}
	});

	it("dark-mode metric dt labels have explicit color (not just opacity inheritance)", () => {
		expect(weatherCss).toMatch(
			/\.awsui-dark-mode\s+\.cdn-weather__metric\s+dt[^{]*\{[^}]*color:/,
		);
	});

	it("dark-mode metric dd values have explicit color", () => {
		expect(weatherCss).toMatch(
			/\.awsui-dark-mode\s+\.cdn-weather__metric\s+dd[^{]*\{[^}]*color:/,
		);
	});

	it("dark-mode temp-c has explicit color", () => {
		expect(weatherCss).toMatch(
			/\.awsui-dark-mode\s+\.cdn-weather__temp-c[^{]*\{[^}]*color:/,
		);
	});

	it("dark mode city gradient uses violet/lavender (not amber/orange)", () => {
		// .awsui-dark-mode .cdn-weather__city must override background-image
		// to violet/lavender palette, not the light-mode amber/orange
		const darkCityMatch = weatherCss.match(
			/\.awsui-dark-mode\s+\.cdn-weather__city\s*\{[^}]+\}/,
		);
		expect(darkCityMatch).not.toBeNull();
		const block = darkCityMatch?.[0] ?? "";
		// Should contain violet (#9060f0) or lavender (#d7c7ee)
		expect(block).toMatch(
			/#9060f0|#d7c7ee|var\(--cdn-violet|var\(--cdn-lavender/i,
		);
		// Should NOT contain the amber/orange light-mode gradient colors
		expect(block).not.toMatch(/#8b5a2b|#ff9900/);
	});

	it("light-mode weather uses amber color token", () => {
		// Ensures the light mode rule is still intact
		expect(weatherCss).toMatch(
			/:root:not\(\.awsui-dark-mode\)\s+\.cdn-weather\s*\{[^}]*color:\s*var\(--cdn-amber/,
		);
	});
});
