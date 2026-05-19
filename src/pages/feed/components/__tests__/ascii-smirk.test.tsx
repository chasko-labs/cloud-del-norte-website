// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AsciiSmirk from "../ascii-smirk";

describe("AsciiSmirk", () => {
	it("renders an inline SVG with role=img and aria-label='smirk'", () => {
		const { container } = render(<AsciiSmirk />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("role")).toBe("img");
		expect(svg?.getAttribute("aria-label")).toBe("smirk");
	});

	it("renders the wrapper span as aria-hidden so the description carries meaning", () => {
		const { container } = render(<AsciiSmirk />);
		const span = container.querySelector("span.cdn-ascii-smirk");
		expect(span).not.toBeNull();
		expect(span?.getAttribute("aria-hidden")).toBe("true");
	});

	it("contains at least one path element (mouth) and at least two rect elements (eyes + brow)", () => {
		const { container } = render(<AsciiSmirk />);
		const paths = container.querySelectorAll("path");
		const rects = container.querySelectorAll("rect");
		expect(paths.length).toBeGreaterThanOrEqual(1);
		expect(rects.length).toBeGreaterThanOrEqual(2);
	});

	it("includes a title element labelling the SVG 'smirk' for AT that traverse roles", () => {
		const { container } = render(<AsciiSmirk />);
		const title = container.querySelector("svg title");
		expect(title?.textContent).toBe("smirk");
	});
});
