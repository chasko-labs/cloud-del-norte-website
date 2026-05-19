// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Wave 36b — FeedCardShell primitive tests.
 *
 * Locks the contract the rest of the wave 36b refactors depend on:
 *   1. The shell exposes the same h2 heading semantics that the original
 *      Cloudscape <Header variant="h2"> provided, via role="heading" +
 *      aria-level=2 on the marquee div.
 *   2. Children render inside the shell (the wrapping Cloudscape Container
 *      doesn't swallow content).
 *   3. The palette modifier class is applied to the wrapper so per-card
 *      hue differentiation actually paints.
 *   4. The local error boundary catches a throwing child and renders a
 *      fallback inside the same shell chrome (so a broken card doesn't
 *      blank the rest of the feed page).
 *   5. The CSS hooks the prefers-reduced-motion + scroll-pause stylesheets
 *      target are present in the rendered DOM.
 *
 * jsdom doesn't apply external CSS to the cascade, so #5 is asserted as a
 * structural contract: the .feed-card-shell + .feed-card-shell__marquee
 * class names exist on the rendered elements. If those drift the
 * stylesheets silently regress; the test fails first.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../../contexts/locale-context";
import FeedCardShell, { FeedCardShellErrorBoundary } from "../feed-card-shell";

function renderShell(
	ui: React.ReactElement,
	{ locale = "us" as "us" | "mx" } = {},
) {
	return render(<LocaleProvider locale={locale}>{ui}</LocaleProvider>);
}

describe("FeedCardShell", () => {
	it("renders headerText inside an element with role=heading and aria-level=2", () => {
		renderShell(
			<FeedCardShell headerText="Sample Header" palette="sage">
				<p>body</p>
			</FeedCardShell>,
		);

		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading).toBeInTheDocument();
		expect(heading).toHaveTextContent("Sample Header");
	});

	it("renders children inside the shell", () => {
		renderShell(
			<FeedCardShell headerText="With Body" palette="amber">
				<p data-testid="shell-body">body content here</p>
			</FeedCardShell>,
		);

		expect(screen.getByTestId("shell-body")).toBeInTheDocument();
		expect(screen.getByTestId("shell-body")).toHaveTextContent(
			"body content here",
		);
	});

	it("applies the palette modifier class to the wrapper", () => {
		const { container } = renderShell(
			<FeedCardShell headerText="Sage Card" palette="sage">
				<p>body</p>
			</FeedCardShell>,
		);

		const wrapper = container.querySelector(".feed-card-shell");
		expect(wrapper).not.toBeNull();
		expect(wrapper?.classList.contains("feed-card-shell--sage")).toBe(true);
		expect(wrapper?.getAttribute("data-feed-card-palette")).toBe("sage");
	});

	it("error boundary catches a throwing child and renders the locale fallback inside the same shell chrome", () => {
		const Boom = (): React.JSX.Element => {
			throw new Error("simulated wave 36b shell render failure");
		};

		// Suppress the boundary's diagnostic console.error + React's caught-
		// error log so the test stdout stays clean. The boundary's user-
		// facing fallback is what the assertions below validate.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// intentionally empty
		});

		try {
			const { container } = renderShell(
				<FeedCardShell headerText="Boom Card" palette="rose">
					<Boom />
				</FeedCardShell>,
			);

			// Same shell chrome (palette modifier still applied) so the empty
			// state anchors visually in the same slot.
			const wrapper = container.querySelector(".feed-card-shell");
			expect(wrapper).not.toBeNull();
			expect(wrapper?.classList.contains("feed-card-shell--rose")).toBe(true);

			// The marquee header still announces itself as h2.
			expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
				"Boom Card",
			);

			// Fallback message resolves through the rsvp.error.generic locale
			// key. en-US copy: "Something went wrong — we logged it. Try
			// again or RSVP on Meetup." — assert on the stable opening
			// phrase to insulate from minor copy edits.
			expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
		} finally {
			errorSpy.mockRestore();
		}
	});

	it("renders the structural class hooks that the scroll-pause + prefers-reduced-motion CSS targets", () => {
		const { container } = renderShell(
			<FeedCardShell headerText="Hooks Card" palette="violet">
				<p>body</p>
			</FeedCardShell>,
		);

		// .feed-card-shell is the perspective + preserve-3d + will-change
		// + contain target. The stylesheet's reduced-motion fallback also
		// targets this class to flatten perspective. If the class drifts,
		// the depth stack silently disables.
		const wrapper = container.querySelector(".feed-card-shell");
		expect(wrapper).not.toBeNull();

		// .feed-card-shell__marquee is the scroll-pause target inside the
		// body.cdn-scrolling rule + the marquee chrome itself. Same drift
		// concern as above.
		const marquee = container.querySelector(".feed-card-shell__marquee");
		expect(marquee).not.toBeNull();
		expect(marquee?.getAttribute("role")).toBe("heading");
		expect(marquee?.getAttribute("aria-level")).toBe("2");

		// The marquee text + actions slot classes — match what the shell
		// styles (and any future per-palette tweaks) target.
		expect(
			container.querySelector(".feed-card-shell__marquee-text"),
		).not.toBeNull();
	});

	it("renders the optional headerActions slot when provided", () => {
		const { container } = renderShell(
			<FeedCardShell
				headerText="With Actions"
				palette="gold"
				headerActions={<a href="https://example.test">All →</a>}
			>
				<p>body</p>
			</FeedCardShell>,
		);

		const actions = container.querySelector(
			".feed-card-shell__marquee-actions",
		);
		expect(actions).not.toBeNull();
		expect(actions?.textContent).toContain("All →");
	});

	it("FeedCardShellErrorBoundary fallback works when used directly with a throwing child", () => {
		const Boom = (): React.JSX.Element => {
			throw new Error("direct boundary test");
		};

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// intentionally empty — see comment in earlier suppression
		});

		try {
			const { container } = render(
				<FeedCardShellErrorBoundary
					headerText="Direct"
					palette="lavender"
					fallbackMessage="Direct fallback message"
				>
					<Boom />
				</FeedCardShellErrorBoundary>,
			);

			expect(container.querySelector(".feed-card-shell")).not.toBeNull();
			expect(
				container.querySelector(".feed-card-shell--lavender"),
			).not.toBeNull();
			expect(screen.getByText(/direct fallback message/i)).toBeInTheDocument();
		} finally {
			errorSpy.mockRestore();
		}
	});
});
