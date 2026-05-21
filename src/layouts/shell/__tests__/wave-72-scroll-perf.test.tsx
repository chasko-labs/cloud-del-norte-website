// Wave 72 — scroll perf structural tests
// Validates compositor layer promotion on fixed surfaces and
// rAF-throttled scroll handlers.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");

const footerCss = readFileSync(
	resolve(REPO_ROOT, "src/components/footer/styles.css"),
	"utf-8",
);

const glassStreaksCss = readFileSync(
	resolve(REPO_ROOT, "src/styles/cdn-glass-streaks.css"),
	"utf-8",
);

const shellTsx = readFileSync(
	resolve(REPO_ROOT, "src/layouts/shell/index.tsx"),
	"utf-8",
);

describe("wave 72 — compositor layer promotion", () => {
	it("footer has will-change: transform for GPU layer", () => {
		expect(footerCss).toContain("will-change: transform");
	});

	it("footer has transform: translateZ(0) for layer creation", () => {
		expect(footerCss).toContain("transform: translateZ(0)");
	});

	it("volunteer-btn has will-change: transform", () => {
		const btnStart = glassStreaksCss.indexOf(".cdn-volunteer-btn {");
		const btnBlock = glassStreaksCss.slice(btnStart, btnStart + 800);
		expect(btnBlock).toContain("will-change: transform");
	});
});

describe("wave 72 — scroll handler throttling", () => {
	it("cdn-scrolled toggle uses requestAnimationFrame", () => {
		const scrolledIdx = shellTsx.indexOf("cdn-scrolled");
		const scrolledBlock = shellTsx.slice(scrolledIdx, scrolledIdx + 500);
		expect(scrolledBlock).toContain("requestAnimationFrame");
	});

	it("volunteer pill ResizeObserver does NOT observe document.body", () => {
		expect(shellTsx).not.toContain("ro.observe(document.body)");
	});
});
