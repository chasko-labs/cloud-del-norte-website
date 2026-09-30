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

describe("FeaturedEvent — SegurAWS Américas", () => {
	it("renders the SegurAWS title linking to the Meetup event URL", () => {
		renderWithLocale("us");
		const link = screen.getByText(/SegurAWS Américas/);
		expect(link.closest("a")).toHaveAttribute(
			"href",
			"https://www.meetup.com/clouddelnorte/events/316780248/",
		);
	});

	it("renders the date in en-US format (November 19, 2026)", () => {
		renderWithLocale("us");
		expect(screen.getByText(/November 19, 2026/)).toBeInTheDocument();
	});

	it("renders the date in es-MX format (noviembre)", () => {
		renderWithLocale("mx");
		expect(screen.getAllByText(/noviembre/i).length).toBeGreaterThan(0);
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
			"https://meet.clouddelnorte.org/seguraws-nov19",
		);
	});

	it("renders the SegurAWS description in en-US", () => {
		renderWithLocale("us");
		expect(screen.getByText(/Live hands-on lab/i)).toBeInTheDocument();
	});

	it("renders the SegurAWS description in es-MX", () => {
		renderWithLocale("mx");
		expect(screen.getByText(/Laboratorio práctico/i)).toBeInTheDocument();
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
		expect(plate?.textContent).toMatch(/November 19, 2026/);
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
		expect(light?.getAttribute("src")).toBe("/events/seguraws-nov19.webp");
		expect(dark?.getAttribute("src")).toBe("/events/seguraws-nov19.webp");
		expect(light?.getAttribute("alt")).toMatch(/SegurAWS/i);
		expect(dark?.getAttribute("alt")).toMatch(/SegurAWS/i);
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
