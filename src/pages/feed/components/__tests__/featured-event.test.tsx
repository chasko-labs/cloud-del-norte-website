// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthState } from "../../../../contexts/auth-context";
import { LocaleProvider } from "../../../../contexts/locale-context";
import FeaturedEvent from "../featured-event";

const signedOut: AuthState = {
	isAuthenticated: false,
	idToken: null,
	sub: null,
	email: null,
	name: null,
	groups: [],
	isModerator: false,
	signOut: () => {},
};

const signedIn: AuthState = { ...signedOut, isAuthenticated: true };

function renderWithLocale(locale: "us" | "mx", auth: AuthState = signedOut) {
	return render(
		<LocaleProvider locale={locale}>
			<AuthContext.Provider value={auth}>
				<FeaturedEvent />
			</AuthContext.Provider>
		</LocaleProvider>,
	);
}

describe("FeaturedEvent — Big Data Bowl", () => {
	it("renders the Bowl title linking to the Meetup event URL", () => {
		renderWithLocale("us");
		const link = screen.getByText(/Meta Muse Code \| NFL Big Data Bowl 2027/);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"https://www.meetup.com/awsugclouddelnorte/events/316669721/",
		);
	});

	it("renders the date in en-US format (September 29, 2026)", () => {
		renderWithLocale("us");
		expect(screen.getByText(/September 29, 2026/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format (septiembre)", () => {
		renderWithLocale("mx");
		expect(screen.getAllByText(/septiembre/i).length).toBeGreaterThan(0);
	});

	it("renders the sign-in CTA when signed out", () => {
		renderWithLocale("us", signedOut);
		const btn = screen.getByRole("link", {
			name: /Sign in to get the join link/i,
		});
		expect(btn).toHaveAttribute("href", "/signup/index.html");
	});

	it("renders the join CTA with the meet link when signed in", () => {
		renderWithLocale("us", signedIn);
		const btn = screen.getByRole("link", { name: /Join the meeting/i });
		expect(btn).toHaveAttribute(
			"href",
			"https://meet.clouddelnorte.org/sep292026",
		);
	});

	it("renders the Bowl description in en-US", () => {
		renderWithLocale("us");
		expect(screen.getByText(/Pair-programming session/i)).toBeInTheDocument();
	});

	it("renders the Bowl description in es-MX", () => {
		renderWithLocale("mx");
		expect(screen.getByText(/Sesión de pair-programming/i)).toBeInTheDocument();
	});

	it("renders the es-MX header (Próxima meetup)", () => {
		renderWithLocale("mx");
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
			/Próxima meetup/i,
		);
	});

	it("renders the online event location", () => {
		renderWithLocale("us");
		expect(screen.getByText(/Online meetup/i)).toBeInTheDocument();
	});

	it("renders the date-plate VFX wrapper", () => {
		const { container } = renderWithLocale("us");
		const plate = container.querySelector(".feed-featured-event__date-plate");
		expect(plate).not.toBeNull();
		expect(plate?.textContent).toMatch(/September 29, 2026/);
	});

	it("renders the layout wrapper with expected children", () => {
		const { container } = renderWithLocale("us");
		const layout = container.querySelector(".feed-featured-event__layout");
		expect(layout).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__title")).not.toBeNull();
		expect(layout?.querySelector(".feed-featured-event__date")).not.toBeNull();
		expect(
			layout?.querySelector(".feed-featured-event__description"),
		).not.toBeNull();
		expect(layout?.querySelector(".cdn-brand-btn-stack")).not.toBeNull();
	});

	it("renders the header as h2", () => {
		renderWithLocale("us");
		const header = screen.getByRole("heading", { level: 2 });
		expect(header).toHaveTextContent(/Next meetup/i);
	});

	it("renders the light/dark artwork pair with the locale alt text", () => {
		const { container } = renderWithLocale("us");
		const light = container.querySelector(
			".feed-featured-event__image--light",
		) as HTMLImageElement | null;
		const dark = container.querySelector(
			".feed-featured-event__image--dark",
		) as HTMLImageElement | null;
		expect(light?.getAttribute("src")).toBe(
			"/events/muse-big-data-bowl-light.svg",
		);
		expect(dark?.getAttribute("src")).toBe(
			"/events/muse-big-data-bowl-dark.svg",
		);
		expect(light?.getAttribute("alt")).toMatch(/Big Data Bowl/i);
		expect(dark?.getAttribute("alt")).toMatch(/Big Data Bowl/i);
	});

	it("adds is-loaded on image load (wave 37b fade-in contract — without it the image keeps opacity 0)", () => {
		const { container } = renderWithLocale("us");
		const light = container.querySelector(
			".feed-featured-event__image--light",
		) as HTMLImageElement | null;
		expect(light).not.toBeNull();
		if (!light) return;
		expect(light.classList.contains("is-loaded")).toBe(false);
		fireEvent.load(light);
		expect(light.classList.contains("is-loaded")).toBe(true);
	});

	it("keeps the dark variant when only the light image errors", () => {
		const { container } = renderWithLocale("us");
		const light = container.querySelector(
			".feed-featured-event__image--light",
		) as HTMLImageElement | null;
		expect(light).not.toBeNull();
		if (!light) return;
		fireEvent.error(light);
		expect(
			container.querySelector(".feed-featured-event__image--light"),
		).toBeNull();
		expect(
			container.querySelector(".feed-featured-event__image--dark"),
		).not.toBeNull();
	});
});
