import { render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/auth", () => ({
	handleCallback: vi.fn(),
}));

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

async function loadApp() {
	return (await import("../app")).default;
}

describe("/auth/callback app", () => {
	beforeEach(async () => {
		vi.resetModules();
		const { handleCallback } = await import("../../../../lib/auth");
		(handleCallback as ReturnType<typeof vi.fn>).mockReset();
	});

	it("on success calls handleCallback and redirects to returnTo", async () => {
		const replace = vi.fn();
		Object.defineProperty(window, "location", {
			value: { replace, href: "https://example.test/auth/callback?code=xyz" },
			writable: true,
		});

		const { handleCallback } = await import("../../../../lib/auth");
		(handleCallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			returnTo: "/meetings",
		});

		const App = await loadApp();
		render(<App />);

		await waitFor(() => {
			expect(handleCallback).toHaveBeenCalledTimes(1);
			expect(replace).toHaveBeenCalledWith("/meetings");
		});
	});

	it("defaults redirect to / when returnTo is empty", async () => {
		const replace = vi.fn();
		Object.defineProperty(window, "location", {
			value: { replace, href: "https://example.test/auth/callback?code=xyz" },
			writable: true,
		});
		const { handleCallback } = await import("../../../../lib/auth");
		(handleCallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			returnTo: "",
		});

		const App = await loadApp();
		render(<App />);
		await waitFor(() => {
			expect(replace).toHaveBeenCalledWith("/");
		});
	});

	it("renders error alert when handleCallback throws (no code)", async () => {
		const { handleCallback } = await import("../../../../lib/auth");
		(handleCallback as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("oidc callback missing code"),
		);
		const App = await loadApp();
		const { container } = render(<App />);
		await waitFor(() => {
			expect(container.textContent).toMatch(/sign-in failed/i);
			expect(container.textContent).toMatch(/missing code/i);
		});
	});

	it("renders error alert when token exchange fails (PKCE mismatch)", async () => {
		const { handleCallback } = await import("../../../../lib/auth");
		(handleCallback as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("oidc token exchange failed: 400"),
		);
		const App = await loadApp();
		const { container } = render(<App />);
		await waitFor(() => {
			expect(container.textContent).toMatch(/token exchange failed/i);
		});
	});
});
