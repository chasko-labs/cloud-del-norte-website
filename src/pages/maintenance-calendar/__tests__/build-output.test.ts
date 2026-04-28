import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../../..");
const LIB = join(ROOT, "lib");

describe("maintenance-calendar build output smoke test", () => {
	it("lib/ directory exists (build has run)", () => {
		expect(existsSync(LIB)).toBe(true);
	});

	it("maintenance-calendar/index.html exists in build output", () => {
		const indexPath = join(LIB, "maintenance-calendar", "index.html");
		expect(existsSync(indexPath)).toBe(true);
	});

	it("maintenance-calendar/index.html references a JS bundle", () => {
		const indexPath = join(LIB, "maintenance-calendar", "index.html");
		if (!existsSync(indexPath)) return;
		const content = readFileSync(indexPath, "utf8");
		expect(content).toMatch(/\.js/);
	});

	it("maintenance-calendar/index.html references a CSS bundle", () => {
		const indexPath = join(LIB, "maintenance-calendar", "index.html");
		if (!existsSync(indexPath)) return;
		const content = readFileSync(indexPath, "utf8");
		expect(content).toMatch(/\.css/);
	});

	it("home page still exists in build output (no regression)", () => {
		expect(existsSync(join(LIB, "home", "index.html"))).toBe(true);
	});

	it("meetings page still exists in build output (no regression)", () => {
		expect(existsSync(join(LIB, "meetings", "index.html"))).toBe(true);
	});
});
