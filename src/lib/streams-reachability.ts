// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import type { StreamDef } from "./streams";

type ReachResult = "ok" | "fail" | "skip-curated";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
	result: ReachResult;
	ts: number;
}

const cache = new Map<string, CacheEntry>();

export async function checkReachability(
	stream: StreamDef,
): Promise<ReachResult> {
	// Curated stations are trusted — no probe needed
	if (stream.curated) return "skip-curated";
	// CORS-blocked feeds will always fail a browser fetch — mark dead immediately
	if (stream.corsBlocked) return "fail";

	const cached = cache.get(stream.key);
	if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;

	let result: ReachResult;
	try {
		const res = await fetch(stream.metaUrl ?? stream.url, {
			mode: "no-cors",
			method: "HEAD",
			signal: AbortSignal.timeout(2000),
		});
		result = res.type === "error" ? "fail" : "ok";
	} catch {
		result = "fail";
	}

	cache.set(stream.key, { result, ts: Date.now() });
	return result;
}
