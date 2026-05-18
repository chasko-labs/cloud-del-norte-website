// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EventBulbsOverlay from "../event-bulbs-overlay";

describe("EventBulbsOverlay", () => {
	it("renders an SVG with role=presentation and aria-hidden=true", () => {
		const { container } = render(<EventBulbsOverlay />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg).toHaveAttribute("role", "presentation");
		expect(svg).toHaveAttribute("aria-hidden", "true");
	});

	it("renders at least 10 <circle> elements (bulbs)", () => {
		const { container } = render(<EventBulbsOverlay />);
		const circles = container.querySelectorAll("circle");
		expect(circles.length).toBeGreaterThanOrEqual(10);
	});

	it("toggles .cdn-bulb--twinkling on a <circle> when clicked", () => {
		const { container } = render(<EventBulbsOverlay />);
		const circles = container.querySelectorAll("circle");
		const target = circles[0];
		expect(target.getAttribute("class") ?? "").not.toContain(
			"cdn-bulb--twinkling",
		);
		fireEvent.click(target);
		const twinkling = container.querySelector(".cdn-bulb--twinkling");
		expect(twinkling).not.toBeNull();
		expect(twinkling).toBe(target);
	});

	it("each bulb circle has the warm-glow fill", () => {
		const { container } = render(<EventBulbsOverlay />);
		const circles = container.querySelectorAll("circle");
		for (const c of circles) {
			expect(c.getAttribute("fill")).toBe("#fde68a");
		}
	});
});
