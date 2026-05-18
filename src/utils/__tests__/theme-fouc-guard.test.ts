import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// wave-25c FOUC guard: every real-app index.html in the repo must carry the
// inline theme-bootstrapping <script> in <head> so the awsui-dark-mode class
// is applied on <html> BEFORE React hydrates. Without it, dark-mode users see
// a white flash on first paint. Stubs that only meta-refresh elsewhere are
// exempt — they paint nothing.

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const MARKER = "cdn-theme-fouc-guard";
const REQUIRED_SNIPPETS = [
	"localStorage.getItem('awsaerospace-theme')",
	"awsui-dark-mode",
	"document.documentElement.style.colorScheme",
];

const SKIP_DIRS = new Set([
	"node_modules",
	"lib",
	"lib-auth",
	"lib-awsug",
	".git",
]);

function findIndexHtml(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry) || entry.startsWith("lib")) continue;
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			findIndexHtml(full, acc);
		} else if (entry === "index.html") {
			acc.push(full);
		}
	}
	return acc;
}

function isRedirectStub(html: string): boolean {
	// A stub has no <div id="root"> (or other render target like <canvas>) —
	// it only meta-refreshes to a canonical URL.
	return (
		html.includes('http-equiv="refresh"') &&
		!html.includes('id="root"') &&
		!html.includes("<canvas")
	);
}

describe("dark-mode FOUC guard (wave-25c)", () => {
	const allIndexHtml = findIndexHtml(REPO_ROOT);
	const realApps = allIndexHtml.filter((p) => {
		const html = readFileSync(p, "utf-8");
		return !isRedirectStub(html);
	});

	it("discovers at least 20 real-app index.html files", () => {
		expect(realApps.length).toBeGreaterThanOrEqual(20);
	});

	it.each(
		realApps.map((p) => [p.replace(`${REPO_ROOT}/`, "")]),
	)("%s contains the inline FOUC guard", (relPath) => {
		const html = readFileSync(join(REPO_ROOT, relPath), "utf-8");
		expect(html).toContain(MARKER);
		for (const snippet of REQUIRED_SNIPPETS) {
			expect(html).toContain(snippet);
		}
		// The guard must run before </head> closes — i.e. before <body>.
		const guardIdx = html.indexOf(MARKER);
		const headCloseIdx = html.indexOf("</head>");
		expect(guardIdx).toBeGreaterThan(-1);
		expect(headCloseIdx).toBeGreaterThan(guardIdx);
	});
});
