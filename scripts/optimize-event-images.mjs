#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Wave 37b — Re-encode every public/events/*.webp file at q=72 (effort=6)
// to drop first-paint image weight on the FeaturedEvent + UpcomingVirtualEvent
// cards. Bryan flagged featured-2026-06-03-dark.webp (~381 KB) as a long-load
// element; re-encoding the four banners typically saves 30–50% per file
// without a perceptible quality drop at the rendered ~600px max-width.
//
// Usage:
//   node scripts/optimize-event-images.mjs
//
// The script is idempotent: re-running it re-encodes the already-optimized
// outputs at the same quality. WebP re-encoding is generationally lossy, so
// avoid running it many times in a row — but a single re-run is safe and the
// script bails on any file where the new encoding is larger than the source
// (rare; happens if the source is already aggressively compressed).

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const EVENTS_DIR = join(REPO_ROOT, "public", "events");

const QUALITY = 72;
const EFFORT = 6;

/** Format a byte count as KB with one decimal. */
function fmtKb(bytes) {
	return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
	const entries = await readdir(EVENTS_DIR);
	const webpFiles = entries.filter((name) => name.endsWith(".webp")).sort();

	if (webpFiles.length === 0) {
		console.log(`No .webp files found in ${EVENTS_DIR}`);
		return;
	}

	console.log(
		`Re-encoding ${webpFiles.length} .webp file(s) in ${EVENTS_DIR} at quality=${QUALITY} effort=${EFFORT}\n`,
	);

	let totalBefore = 0;
	let totalAfter = 0;
	let kept = 0;
	let rewritten = 0;

	for (const name of webpFiles) {
		const fullPath = join(EVENTS_DIR, name);
		const before = await readFile(fullPath);
		const beforeBytes = before.length;
		totalBefore += beforeBytes;

		const after = await sharp(before)
			.webp({ quality: QUALITY, effort: EFFORT })
			.toBuffer();
		const afterBytes = after.length;

		// Bail if the re-encode is larger than the source: keep the original
		// bytes unchanged so we never make a file worse.
		if (afterBytes >= beforeBytes) {
			totalAfter += beforeBytes;
			kept += 1;
			console.log(
				`  ${name}: ${fmtKb(beforeBytes)} → ${fmtKb(afterBytes)} (kept original; re-encode was not smaller)`,
			);
			continue;
		}

		await writeFile(fullPath, after);
		totalAfter += afterBytes;
		rewritten += 1;
		const pct = (((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(1);
		console.log(
			`  ${name}: ${fmtKb(beforeBytes)} → ${fmtKb(afterBytes)} (-${pct}%)`,
		);
	}

	const totalPct = (
		((totalBefore - totalAfter) / Math.max(totalBefore, 1)) *
		100
	).toFixed(1);
	console.log(
		`\nTotal: ${fmtKb(totalBefore)} → ${fmtKb(totalAfter)} (-${totalPct}%) — rewritten ${rewritten}, kept ${kept}`,
	);
}

main().catch((err) => {
	console.error("optimize-event-images failed:", err);
	process.exitCode = 1;
});
