import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CSS_PATH = resolve(__dirname, "..", "menu-signage.css");
const css = readFileSync(CSS_PATH, "utf-8");

describe("wave 61 — menu-signage neon-sign typography", () => {
	it("light-mode idle text-shadow meets WCAG-safe low-alpha glow (no high-alpha that would bleed)", () => {
		// Idle light-mode shadow: 0 0 3px violet at 0.18 + depth shadow at 0.25
		expect(css).toContain("0 0 3px rgba(90, 31, 138, 0.18)");
		expect(css).toContain("0 2px 0 rgba(90, 58, 20, 0.25)");
	});

	it("hover state has more shadow layers than idle (sign lights up)", () => {
		// Light hover block has 4 shadow layers vs idle's 2
		const hoverMatch = css.match(
			/:root:not\(\.awsui-dark-mode\)[^{]*:hover[^{]*\{([^}]+)\}/,
		);
		expect(hoverMatch).not.toBeNull();
		const hoverShadows = (hoverMatch?.[1] ?? "").split(",").length;
		expect(hoverShadows).toBeGreaterThanOrEqual(4);
	});

	it("prefers-reduced-motion sets transition: none", () => {
		expect(css).toContain("@media (prefers-reduced-motion: reduce)");
		expect(css).toContain("transition: none !important");
	});

	it("does not contain any infinite animation keywords", () => {
		expect(css).not.toContain("infinite");
		expect(css).not.toContain("@keyframes");
	});

	it("all property overrides use !important per cloudscape-overrides doctrine", () => {
		// Every text-shadow and transition declaration must end with !important
		const declarations = css.match(/text-shadow:[^;]+;/g) ?? [];
		for (const decl of declarations) {
			expect(decl).toContain("!important");
		}
		const transitions = css.match(/transition:[^;]+;/g) ?? [];
		for (const t of transitions) {
			expect(t).toContain("!important");
		}
	});

	it("dark-mode idle shadow uses violet palette (not amber)", () => {
		// Dark idle: violet glow + deep depth shadow
		expect(css).toContain("0 0 3px rgba(144, 96, 240, 0.22)");
		expect(css).toContain("0 2px 0 rgba(20, 10, 40, 0.4)");
	});
});
