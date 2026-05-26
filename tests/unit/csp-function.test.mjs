/**
 * Unit test for infra/cloudfront-functions/csp-main.js
 * Simulates CloudFront Function viewer-response events and asserts CSP header output.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const funcSrc = readFileSync(resolve(ROOT, "infra/cloudfront-functions/csp-main.js"), "utf-8");
const allowlistPath = resolve(ROOT, "infra/cloudfront-functions/csp-allowlist.json");
let allowlistJson;
try {
	allowlistJson = readFileSync(allowlistPath, "utf-8");
} catch {
	allowlistJson = JSON.stringify({
		"connect-src": ["https://api.kexp.org", "https://ipinfo.io"],
		"media-src": ["https://kexp.streamguys1.com"],
		"img-src": ["https://i.gravatar.com"],
		"frame-src": ["https://embed.twitch.tv", "https://www.youtube.com"],
		"script-src": ["https://cdn.babylonjs.com"],
		"font-src": ["https://fonts.gstatic.com"],
		"style-src": ["https://fonts.googleapis.com"],
	});
}

// Inject allowlist and evaluate
const injectedSrc = funcSrc.replace("var ALLOWLIST = {};", `var ALLOWLIST = ${allowlistJson};`);
const context = vm.createContext({});
vm.runInContext(injectedSrc, context);
const handler = context.handler;

describe("csp-main.js CloudFront Function", () => {
	it("sets content-security-policy header on response", () => {
		const event = { response: { headers: {}, statusCode: 200 } };
		const result = handler(event);
		expect(result.headers["content-security-policy"]).toBeTruthy();
		expect(result.headers["content-security-policy"].value.length).toBeGreaterThan(0);
	});

	it("includes default-src 'self'", () => {
		const event = { response: { headers: {} } };
		const result = handler(event);
		const csp = result.headers["content-security-policy"].value;
		expect(csp.startsWith("default-src 'self'")).toBe(true);
	});

	it("includes all CSP directives", () => {
		const event = { response: { headers: {} } };
		const result = handler(event);
		const csp = result.headers["content-security-policy"].value;
		for (const d of ["script-src", "script-src-elem", "style-src", "connect-src",
			"font-src", "img-src", "object-src", "frame-ancestors", "frame-src",
			"media-src", "worker-src"]) {
			expect(csp).toContain(d);
		}
	});

	it("includes allowlist origins in connect-src", () => {
		const event = { response: { headers: {} } };
		const result = handler(event);
		const csp = result.headers["content-security-policy"].value;
		const allowlist = JSON.parse(allowlistJson);
		for (const origin of allowlist["connect-src"]) {
			expect(csp).toContain(origin);
		}
	});

	it("preserves existing response headers", () => {
		const event = { response: { headers: { "x-custom": { value: "test" } } } };
		const result = handler(event);
		expect(result.headers["x-custom"].value).toBe("test");
		expect(result.headers["content-security-policy"]).toBeTruthy();
	});

	it("includes worker-src with blob: and babylonjs", () => {
		const event = { response: { headers: {} } };
		const result = handler(event);
		const csp = result.headers["content-security-policy"].value;
		expect(csp).toContain("worker-src 'self' blob: https://cdn.babylonjs.com");
	});
});
