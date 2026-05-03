import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOON_CRESCENT_PATH, MoonSvg } from "../moon-icon";

describe("MoonSvg", () => {
	it("renders an SVG with the crescent path (no outline circle, no defs)", () => {
		const { container } = render(<MoonSvg />);
		const svg = container.querySelector("svg.cdn-svg-moon");
		expect(svg).not.toBeNull();
		const path = svg?.querySelector("path.cdn-svg-moon__disc");
		expect(path).not.toBeNull();
		expect(path?.getAttribute("d")).toBe(MOON_CRESCENT_PATH);
		// no leftover phase-math artefacts: outline circle (v0.0.0107) and
		// defs/mask (v0.0.0078) are gone — bryan flagged the outline as
		// part of why the icon read as a "full disc".
		expect(svg?.querySelector("circle")).toBeNull();
		expect(svg?.querySelector("defs")).toBeNull();
		expect(svg?.querySelector("mask")).toBeNull();
		expect(svg?.querySelector("clipPath")).toBeNull();
	});

	it("crescent path has two arc commands so the rendered shape is concave", () => {
		// recognizable moon icon = outer convex limb + inner concave bite.
		// A single-arc path can only describe a half-disc / ellipse — must
		// have two arcs to read as "crescent".
		const arcMatches = MOON_CRESCENT_PATH.match(/[Aa]/g) ?? [];
		expect(arcMatches.length).toBe(2);
		// closed path
		expect(MOON_CRESCENT_PATH.trim().endsWith("Z")).toBe(true);
	});
});
