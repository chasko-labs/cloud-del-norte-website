// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamDef } from "../streams";
import { checkReachability } from "../streams-reachability";

const BASE: StreamDef = {
	key: "test",
	url: "https://example.com/stream",
	label: "test station",
	location: { city: "Nowhere", region: "Void", country: "Global" },
	colors: { primary: "#000", secondary: "#fff", accent: "#ccc" },
};

describe("checkReachability", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns skip-curated for curated streams without fetching", async () => {
		const stream = { ...BASE, curated: true } as StreamDef;
		const result = await checkReachability(stream);
		expect(result).toBe("skip-curated");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("returns fail for corsBlocked streams without fetching", async () => {
		const stream = { ...BASE, corsBlocked: true } as StreamDef;
		const result = await checkReachability(stream);
		expect(result).toBe("fail");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("returns ok when fetch resolves with type !== error", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({ type: "opaque" } as Response);
		const result = await checkReachability({ ...BASE, key: "reach-ok" });
		expect(result).toBe("ok");
	});

	it("returns fail when fetch resolves with type === error", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({ type: "error" } as Response);
		const result = await checkReachability({ ...BASE, key: "reach-err-type" });
		expect(result).toBe("fail");
	});

	it("returns fail when fetch throws (network error / timeout)", async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"));
		const result = await checkReachability({ ...BASE, key: "reach-throw" });
		expect(result).toBe("fail");
	});

	it("uses metaUrl over url when present", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({ type: "opaque" } as Response);
		const stream = {
			...BASE,
			key: "reach-meta",
			metaUrl: "https://meta.example.com/now",
		};
		await checkReachability(stream);
		expect(fetch).toHaveBeenCalledWith(
			"https://meta.example.com/now",
			expect.objectContaining({ method: "HEAD", mode: "no-cors" }),
		);
	});

	it("caches result and does not re-fetch within TTL", async () => {
		vi.mocked(fetch).mockResolvedValue({ type: "opaque" } as Response);
		const stream = { ...BASE, key: "reach-cache" };
		await checkReachability(stream);
		await checkReachability(stream);
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
