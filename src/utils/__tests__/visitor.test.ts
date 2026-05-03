import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VISITOR_CACHE_KEY = "cdn.visitor.v2";

describe("visitor utility", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		vi.unstubAllGlobals();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("readCachedVisitor", () => {
		it("returns null when nothing cached", async () => {
			const { readCachedVisitor } = await import("../visitor");
			expect(readCachedVisitor()).toBeNull();
		});

		it("returns cached info when fresh", async () => {
			localStorage.setItem(
				VISITOR_CACHE_KEY,
				JSON.stringify({
					ts: Date.now(),
					data: {
						ip: "1.2.3.4",
						country: "MX",
						greeting: "Mexico",
						flag: "🇲🇽",
					},
				}),
			);
			const { readCachedVisitor } = await import("../visitor");
			const info = readCachedVisitor();
			expect(info?.country).toBe("MX");
			expect(info?.ip).toBe("1.2.3.4");
		});

		it("returns null when cache entry is expired (>24h old)", async () => {
			localStorage.setItem(
				VISITOR_CACHE_KEY,
				JSON.stringify({
					ts: Date.now() - 25 * 60 * 60 * 1000,
					data: {
						ip: "1.2.3.4",
						country: "MX",
						greeting: "Mexico",
						flag: "🇲🇽",
					},
				}),
			);
			const { readCachedVisitor } = await import("../visitor");
			expect(readCachedVisitor()).toBeNull();
		});

		it("returns null when cache entry is malformed JSON", async () => {
			localStorage.setItem(VISITOR_CACHE_KEY, "{not json");
			const { readCachedVisitor } = await import("../visitor");
			expect(readCachedVisitor()).toBeNull();
		});
	});

	describe("loadVisitorInfo", () => {
		it("returns cached info without fetching when fresh cache exists", async () => {
			localStorage.setItem(
				VISITOR_CACHE_KEY,
				JSON.stringify({
					ts: Date.now(),
					data: { ip: "1.2.3.4", country: "ES", greeting: "Spain", flag: "🇪🇸" },
				}),
			);
			const fetchSpy = vi.fn();
			vi.stubGlobal("fetch", fetchSpy);
			const { loadVisitorInfo } = await import("../visitor");
			const info = await loadVisitorInfo();
			expect(info?.country).toBe("ES");
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("fetches and caches when no cache exists", async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ ip: "5.6.7.8", country: "ar" }),
			});
			vi.stubGlobal("fetch", fetchSpy);
			const { loadVisitorInfo } = await import("../visitor");
			const info = await loadVisitorInfo();
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(info?.country).toBe("AR"); // uppercased
			expect(info?.ip).toBe("5.6.7.8");
			// cached
			const raw = localStorage.getItem(VISITOR_CACHE_KEY);
			expect(raw).not.toBeNull();
		});

		it("dedupes concurrent calls into a single fetch", async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ ip: "5.6.7.8", country: "MX" }),
			});
			vi.stubGlobal("fetch", fetchSpy);
			const { loadVisitorInfo } = await import("../visitor");
			const [a, b, c] = await Promise.all([
				loadVisitorInfo(),
				loadVisitorInfo(),
				loadVisitorInfo(),
			]);
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(a?.country).toBe("MX");
			expect(b?.country).toBe("MX");
			expect(c?.country).toBe("MX");
		});

		it("returns null on fetch failure", async () => {
			vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
			const { loadVisitorInfo } = await import("../visitor");
			expect(await loadVisitorInfo()).toBeNull();
		});

		it("returns null when response missing ip or country", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve({ ip: "1.2.3.4" }),
				}),
			);
			const { loadVisitorInfo } = await import("../visitor");
			expect(await loadVisitorInfo()).toBeNull();
		});
	});
});
