import { afterEach, describe, expect, it, vi } from "vitest";

describe("FionaFrame mount origin resolution", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("uses VITE_FIONA_ORIGIN when set, ignoring window.location.origin", () => {
		vi.stubEnv("VITE_FIONA_ORIGIN", "https://clouddelnorte.org");
		vi.stubEnv("VITE_FIONA_SCRIPT_URL", undefined);
		vi.stubEnv("VITE_FIONA_ASSET_BASE", undefined);

		Object.defineProperty(window, "location", {
			value: { origin: "https://awsug.clouddelnorte.org" },
			writable: true,
		});

		const origin =
			(import.meta.env.VITE_FIONA_ORIGIN as string | undefined) ??
			window.location.origin;
		const src = `${origin}/liora-embed/liora-embed.js`;
		const base = `${origin}/liora`;

		expect(src).toBe("https://clouddelnorte.org/liora-embed/liora-embed.js");
		expect(base).toBe("https://clouddelnorte.org/liora");
	});

	it("falls back to window.location.origin when VITE_FIONA_ORIGIN is unset", () => {
		vi.stubEnv("VITE_FIONA_ORIGIN", undefined);
		Object.defineProperty(window, "location", {
			value: { origin: "https://clouddelnorte.org" },
			writable: true,
		});

		const origin =
			(import.meta.env.VITE_FIONA_ORIGIN as string | undefined) ??
			window.location.origin;

		expect(origin).toBe("https://clouddelnorte.org");
	});
});
