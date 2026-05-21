import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = join(__dirname, "..", "..");

function readCss(relativePath: string): string {
	return readFileSync(join(srcRoot, relativePath), "utf8");
}

/** WCAG relative luminance */
function luminance(r: number, g: number, b: number): number {
	const [rs, gs, bs] = [r, g, b].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(
	fg: [number, number, number],
	bg: [number, number, number],
): number {
	const l1 = luminance(...fg);
	const l2 = luminance(...bg);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

describe("Wave 71 — Bug 1: no transition:all on cdn-viz-active", () => {
	const shellCss = readCss("layouts/shell/styles.css");

	it("cdn-viz-active rule uses narrow transition (background-color, color)", () => {
		const vizBlock = shellCss.match(
			/\.cdn-viz-active\s*\{[^}]*transition:[^}]*\}/,
		);
		expect(vizBlock).not.toBeNull();
		const block = vizBlock![0];
		expect(block).toMatch(/background-color/);
		expect(block).toMatch(/color/);
		expect(block).not.toMatch(/transition:\s*all/);
	});

	it("no transition:all declaration exists anywhere in shell/styles.css rules", () => {
		// Only in comments is acceptable
		const lines = shellCss.split("\n");
		let inBlockComment = false;
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith("/*")) {
				inBlockComment = true;
			}
			if (inBlockComment) {
				if (trimmed.includes("*/")) inBlockComment = false;
				continue;
			}
			if (trimmed.startsWith("//")) continue;
			if (/transition:\s*all/.test(line)) {
				expect(line).not.toMatch(/transition:\s*all/);
			}
		}
	});
});

describe("Wave 71 — Bug 2: backdrop-filter capped at 4px", () => {
	const files = [
		"styles/tokens.css",
		"styles/cdn-glass-streaks.css",
		"pages/feed/styles.css",
		"components/footer/styles.css",
		"components/persistent-player/styles.css",
		"components/weather/styles.css",
		"pages/roadmap/styles.css",
	];

	for (const file of files) {
		it(`${file}: no backdrop-filter blur exceeds 4px`, () => {
			const css = readCss(file);
			const blurMatches = css.matchAll(/backdrop-filter:\s*blur\((\d+)px\)/g);
			for (const m of blurMatches) {
				const px = Number.parseInt(m[1], 10);
				expect(px).toBeLessThanOrEqual(4);
			}
		});
	}

	it("side-panel-card has no backdrop-filter", () => {
		const css = readCss("pages/create-meeting/components/side-panel-card.css");
		expect(css).not.toMatch(/backdrop-filter:\s*blur/);
	});

	it("hp-role-card has no backdrop-filter", () => {
		const css = readCss("pages/create-meeting/components/help-panel.css");
		const roleCardBlock = css.match(/\.hp-role-card\s*\{[^}]*\}/);
		expect(roleCardBlock).not.toBeNull();
		expect(roleCardBlock![0]).not.toMatch(/backdrop-filter/);
	});

	it("hp-leader has no backdrop-filter", () => {
		const css = readCss("pages/create-meeting/components/help-panel.css");
		const leaderBlock = css.match(/\.hp-leader\s*\{[^}]*\}/);
		expect(leaderBlock).not.toBeNull();
		expect(leaderBlock![0]).not.toMatch(/backdrop-filter/);
	});
});

describe("Wave 71 — Bug 3: WCAG AA contrast >= 4.5:1", () => {
	const cream: [number, number, number] = [237, 229, 212]; // #ede5d4
	const darkBg: [number, number, number] = [10, 10, 46]; // #0a0a2e

	it("AWS orange text rgb(140,75,0) on cream passes 4.5:1", () => {
		const ratio = contrastRatio([140, 75, 0], cream);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it("brand purple text rgb(100,60,180) on cream passes 4.5:1", () => {
		const ratio = contrastRatio([100, 60, 180], cream);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it("dark mode secondary text rgb(145,148,157) on #0a0a2e passes 4.5:1", () => {
		const ratio = contrastRatio([145, 148, 157], darkBg);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it("light mode icon fill #5a3a1e on cream passes 4.5:1", () => {
		const ratio = contrastRatio([90, 58, 30], cream);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});
});

describe("Wave 71 — Bug 4: next-meetup spacing uses token grid", () => {
	const feedCss = readCss("pages/feed/styles.css");

	it("feed-mini-card__link uses var(--cdn-space-*) for padding", () => {
		const block = feedCss.match(/\.feed-mini-card__link\s*\{[^}]*\}/s);
		expect(block).not.toBeNull();
		expect(block![0]).toMatch(/padding:.*var\(--cdn-space-/);
	});

	it("feed-mini-card__link uses var(--cdn-space-*) for gap", () => {
		const block = feedCss.match(/\.feed-mini-card__link\s*\{[^}]*\}/s);
		expect(block).not.toBeNull();
		expect(block![0]).toMatch(/gap:.*var\(--cdn-space-/);
	});
});

describe("Wave 71 — Bonus: version bump", () => {
	it("footer version string is 0.0.0147 or higher", () => {
		const footerTsx = readFileSync(
			join(srcRoot, "components/footer/index.tsx"),
			"utf8",
		);
		const versionMatch = footerTsx.match(/0\.0\.0(\d+)/);
		expect(versionMatch).not.toBeNull();
		const versionNum = Number.parseInt(versionMatch![1], 10);
		expect(versionNum).toBeGreaterThanOrEqual(147);
	});
});
