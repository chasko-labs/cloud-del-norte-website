// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// scripts/feed-text.mjs
// Pure text helpers for the feed fetch pipeline (imported by
// scripts/fetch-feeds.mjs). Kept in a side-effect-free module so the
// behavior is unit-testable — fetch-feeds.mjs runs network I/O on import
// and cannot be imported by tests.

/** Strip HTML tags and trim whitespace from a string. */
export function stripHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
}

/** Decode common XML/HTML character entities in a string. */
export function decodeEntities(str) {
	return String(str)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&rsquo;/g, "’")
		.replace(/&lsquo;/g, "‘")
		.replace(/&ldquo;/g, "“")
		.replace(/&rdquo;/g, "”")
		.replace(/&ndash;/g, "–")
		.replace(/&mdash;/g, "—")
		.replace(/&hellip;/g, "…")
		.replace(/&nbsp;/g, " ")
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) =>
			String.fromCharCode(parseInt(h, 16)),
		);
}

/**
 * Normalize a raw feed description/summary into card excerpt text.
 * Strips tags first, then decodes entities: feeds that entity-encode
 * their descriptions (e.g. readysetcloud `I&rsquo;ve`) rendered raw
 * `&rsquo;` literals in the cards. Stripping first guarantees a decoded
 * `&lt;` can never become a live tag.
 */
export function excerptText(raw) {
	return decodeEntities(stripHtml(raw));
}
