import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

vi.mock("../../../../lib/jitsi-token", async () => {
	const { BannedUserError } = await vi.importActual<{
		BannedUserError: typeof Error;
	}>("../../../../lib/jitsi-token");
	return {
		fetchJitsiToken: vi.fn(),
		BannedUserError,
	};
});

import JitsiEmbed from "../jitsi-embed";

interface FakeApi {
	listeners: Record<string, Array<() => void>>;
	addListener: (ev: string, fn: () => void) => void;
	dispose: () => void;
	__fire: (ev: string) => void;
}

function installFakeExternalApi(): {
	ctor: ReturnType<typeof vi.fn>;
	latest: () => FakeApi | null;
} {
	let latest: FakeApi | null = null;
	// Regular function (not arrow) so `new ctor(...)` treats its return value
	// as the constructed instance — vi.fn() warns and skips with arrow fns.
	const ctor = vi.fn(function FakeJitsiCtor(this: unknown) {
		const api: FakeApi = {
			listeners: {},
			addListener(ev, fn) {
				(api.listeners[ev] ??= []).push(fn);
			},
			dispose: vi.fn(),
			__fire(ev) {
				(api.listeners[ev] ?? []).forEach((fn) => fn());
			},
		};
		latest = api;
		return api;
	});
	(
		window as unknown as { JitsiMeetExternalAPI?: unknown }
	).JitsiMeetExternalAPI = ctor;
	return { ctor, latest: () => latest };
}

describe("JitsiEmbed", () => {
	beforeEach(async () => {
		// Remove any prior-loaded script tag between tests.
		document
			.querySelectorAll("script[data-cdn-jitsi]")
			.forEach((el) => el.parentNode?.removeChild(el));
		// Reset the single shared fetchJitsiToken mock queue without tearing down
		// the module (tearing down would desync the component's captured import).
		const { fetchJitsiToken } = await import("../../../../lib/jitsi-token");
		(fetchJitsiToken as ReturnType<typeof vi.fn>).mockReset();
	});

	afterEach(() => {
		delete (window as unknown as { JitsiMeetExternalAPI?: unknown })
			.JitsiMeetExternalAPI;
	});

	it("happy path: fetches token, instantiates API with roomName+jwt, reaches live", async () => {
		const { fetchJitsiToken } = await import("../../../../lib/jitsi-token");
		(fetchJitsiToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			token: "jwt-abc",
			domain: "meet.clouddelnorte.org",
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
		});

		const { ctor, latest } = installFakeExternalApi();
		const { container } = render(<JitsiEmbed roomName="room-42" />);

		await waitFor(() => {
			expect(fetchJitsiToken).toHaveBeenCalledTimes(1);
			expect(ctor).toHaveBeenCalledTimes(1);
		});

		const [domain, opts] = ctor.mock.calls[0];
		expect(domain).toBe("meet.clouddelnorte.org");
		expect(opts.roomName).toBe("room-42");
		expect(opts.jwt).toBe("jwt-abc");
		// parentNode is the host div — verify it is the one carrying our data-testid.
		expect((opts.parentNode as HTMLElement).getAttribute("data-testid")).toBe(
			"jitsi-iframe-host",
		);

		latest()?.__fire("videoConferenceJoined");
		await waitFor(() => {
			expect(container.textContent).not.toMatch(/connecting/i);
		});
	});

	it("fetchJitsiToken rejection → error alert, no API instantiated", async () => {
		const { fetchJitsiToken } = await import("../../../../lib/jitsi-token");
		(fetchJitsiToken as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("not authenticated"),
		);

		const { ctor } = installFakeExternalApi();
		const { container } = render(<JitsiEmbed roomName="room-x" />);

		await waitFor(() => {
			expect(container.textContent).toMatch(/cannot join meeting/i);
			expect(container.textContent).toMatch(/not authenticated/i);
		});
		expect(ctor).not.toHaveBeenCalled();
	});

	it("BannedUserError → branded error message", async () => {
		const mod = await import("../../../../lib/jitsi-token");
		(mod.fetchJitsiToken as ReturnType<typeof vi.fn>).mockRejectedValue(
			new mod.BannedUserError(),
		);
		installFakeExternalApi();
		const { container } = render(<JitsiEmbed roomName="room-y" />);
		await waitFor(() => {
			expect(container.textContent).toMatch(/banned/i);
		});
	});

	it("dispose() called on unmount", async () => {
		const { fetchJitsiToken } = await import("../../../../lib/jitsi-token");
		(fetchJitsiToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			token: "tok",
			domain: "meet.clouddelnorte.org",
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
		});
		const { ctor, latest } = installFakeExternalApi();
		const { unmount } = render(<JitsiEmbed roomName="room-z" />);
		await waitFor(() => expect(ctor).toHaveBeenCalled());
		const api = latest()!;
		unmount();
		expect(api.dispose).toHaveBeenCalled();
	});

	it("readyToClose event → onClose callback fires", async () => {
		const onClose = vi.fn();
		const { fetchJitsiToken } = await import("../../../../lib/jitsi-token");
		(fetchJitsiToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			token: "tok",
			domain: "meet.clouddelnorte.org",
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
		});
		const { ctor, latest } = installFakeExternalApi();
		render(<JitsiEmbed roomName="room-close" onClose={onClose} />);
		await waitFor(() => expect(ctor).toHaveBeenCalled());
		latest()!.__fire("readyToClose");
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
