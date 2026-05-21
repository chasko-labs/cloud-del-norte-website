/**
 * wave 70a — hamburger visibility on scroll (Fix 2)
 *
 * Bryan: "when I scroll down the left side bar menu button inappropriately
 * disappears (when closed)"
 *
 * Root cause: body.cdn-scrolled [class*="awsui_breadcrumbs"] was too broad —
 * on mobile the breadcrumbs container wraps the navigation-toggle too, so it
 * got opacity:0 along with the breadcrumb text.
 *
 * Fix: narrowed selector to :not([class*="awsui_navigation-toggle"]) and added
 * an explicit override to keep navigation-toggle at opacity:1 when scrolled.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const shellCss = readFileSync(
	resolve(REPO_ROOT, "src/layouts/shell/styles.css"),
	"utf-8",
);

describe("wave 70a — hamburger visibility on scroll", () => {
	it("body.cdn-scrolled breadcrumb selector excludes navigation-toggle via :not()", () => {
		// The selector must have :not([class*="awsui_navigation-toggle"]) to prevent
		// the hamburger from being hidden by the breadcrumb fade rule.
		expect(shellCss).toMatch(
			/body\.cdn-scrolled\s+\[class\*="awsui_breadcrumbs"\]:not\(\[class\*="awsui_navigation-toggle"\]\)/,
		);
	});

	it("the old broad selector body.cdn-scrolled [class*='awsui_breadcrumbs'] { opacity: 0 } is gone", () => {
		// The previous rule without the :not() guard must not exist
		// We check there is no direct selector without the :not clause
		const broadRule =
			/body\.cdn-scrolled\s+\[class\*="awsui_breadcrumbs"\]\s*\{[^}]*opacity:\s*0/;
		expect(shellCss).not.toMatch(broadRule);
	});

	it("navigation-toggle has an explicit opacity:1 override under cdn-scrolled", () => {
		// An explicit counter-rule ensures the hamburger can't be hidden
		// even if it's a descendant of a fading breadcrumbs container.
		expect(shellCss).toMatch(
			/body\.cdn-scrolled\s+\[class\*="awsui_navigation-toggle"\][^{]*\{[^}]*opacity:\s*1/,
		);
	});

	it("navigation-toggle counter-rule uses pointer-events: auto", () => {
		// Ensure clicks on the hamburger still work when scrolled
		expect(shellCss).toMatch(
			/body\.cdn-scrolled\s+\[class\*="awsui_navigation-toggle"\][^{]*\{[^}]*pointer-events:\s*auto/,
		);
	});

	it("the breadcrumb transition rule is still present for the non-scrolled base state", () => {
		// Base transition should still be set so un-scrolling animates back
		expect(shellCss).toMatch(
			/\[class\*="awsui_breadcrumbs"\]\s*\{[^}]*transition:[^}]*opacity[^}]*\}/,
		);
	});
});
