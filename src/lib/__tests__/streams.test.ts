import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatLocation, STREAMS, type StreamLocation } from "../streams";

describe("formatLocation", () => {
	it("renders a US location as City, Region, Country", () => {
		const loc: StreamLocation = {
			city: "Las Cruces",
			region: "New Mexico",
			country: "USA",
		};
		expect(formatLocation(loc)).toBe("Las Cruces, New Mexico, USA");
	});

	it("preserves Spanish accents on México", () => {
		const loc: StreamLocation = {
			city: "Lagos de Moreno",
			region: "Jalisco",
			country: "México",
		};
		expect(formatLocation(loc)).toBe("Lagos de Moreno, Jalisco, México");
	});

	it("deduplicates the CDMX city/region pattern to city-only", () => {
		// Ciudad de México is both the city and the entidad federativa — the
		// helper returns only the city when city === region to avoid repetition
		const loc: StreamLocation = {
			city: "Ciudad de México",
			region: "Ciudad de México",
			country: "México",
		};
		expect(formatLocation(loc)).toBe("Ciudad de México");
	});
});

describe("STREAMS — location coverage", () => {
	it("every stream carries a location triple", () => {
		for (const s of STREAMS) {
			expect(s.location, `stream ${s.key} missing location`).toBeDefined();
			expect(s.location.city.length).toBeGreaterThan(0);
			expect(s.location.region.length).toBeGreaterThan(0);
			expect(s.location.country.length).toBeGreaterThan(0);
		}
	});

	it("Mexican stations use proper Spanish naming (México with accent)", () => {
		const mxStations = STREAMS.filter((s) => s.location.country === "México");
		// ibero_909, concepto_radial, radio_unam_961, radio_udg_lagos (hidden), onda_aws (AWS LATAM — distributed México)
		expect(mxStations.length).toBe(5);
		for (const s of mxStations) {
			expect(s.location.country).toBe("México");
		}
	});
});

describe("STREAMS — Wave 22 fixes", () => {
	it("onda_aws is curated", () => {
		const onda = STREAMS.find((s) => s.key === "onda_aws");
		expect(onda).toBeDefined();
		expect(onda?.curated).toBe(true);
	});

	it("radio_udg_lagos is hidden (dead Zeno mount)", () => {
		const lagos = STREAMS.find((s) => s.key === "radio_udg_lagos");
		expect(lagos).toBeDefined();
		expect(lagos?.hidden).toBe(true);
	});

	it("radio_udg_lagos has fallbackUrls for auto-recovery", () => {
		const lagos = STREAMS.find((s) => s.key === "radio_udg_lagos");
		expect(lagos?.fallbackUrls).toBeDefined();
		expect(lagos?.fallbackUrls?.length ?? 0).toBeGreaterThan(0);
	});

	it("visible Mexican stations are ibero_909, concepto_radial, and radio_unam_961", () => {
		const visibleMx = STREAMS.filter(
			(s) => s.location.country === "México" && !s.hidden,
		);
		// radio_udg_lagos is hidden; onda_aws is distributed/global with México country
		// ibero_909, concepto_radial, radio_unam_961, onda_aws (all visible)
		const keys = visibleMx.map((s) => s.key).sort();
		expect(keys).toContain("ibero_909");
		expect(keys).toContain("concepto_radial");
		expect(keys).toContain("radio_unam_961");
		expect(keys).toContain("onda_aws");
		expect(keys).not.toContain("radio_udg_lagos");
	});

	it("ibero_909 and concepto_radial remain (not removed)", () => {
		expect(STREAMS.find((s) => s.key === "ibero_909")).toBeDefined();
		expect(STREAMS.find((s) => s.key === "concepto_radial")).toBeDefined();
	});
});

describe("STREAMS — Wave 23 additions", () => {
	it("radio_unam_961 exists with correct location", () => {
		const unam = STREAMS.find((s) => s.key === "radio_unam_961");
		expect(unam).toBeDefined();
		expect(unam?.location.city).toBe("Ciudad de México");
		expect(unam?.location.country).toBe("México");
	});

	it("radio_unam_961 is not hidden and not curated (pending Bryan verification)", () => {
		const unam = STREAMS.find((s) => s.key === "radio_unam_961");
		expect(unam?.hidden).toBeUndefined();
		expect(unam?.curated).toBeUndefined();
	});

	it("radio_unam_961 has parseMeta and parseMetaRich functions", () => {
		const unam = STREAMS.find((s) => s.key === "radio_unam_961");
		expect(typeof unam?.parseMeta).toBe("function");
		expect(typeof unam?.parseMetaRich).toBe("function");
	});

	it("visible CDMX radio stations are exactly 3: ibero_909, concepto_radial, radio_unam_961", () => {
		const cdmxRadio = STREAMS.filter(
			(s) =>
				s.location.city === "Ciudad de México" &&
				s.type !== "podcast" &&
				!s.hidden,
		);
		expect(cdmxRadio.length).toBe(3);
		const keys = cdmxRadio.map((s) => s.key).sort();
		expect(keys).toContain("ibero_909");
		expect(keys).toContain("concepto_radial");
		expect(keys).toContain("radio_unam_961");
	});

	it("CSP main json includes tv.radiohosting.online in connect-src and media-src", () => {
		const __filename = fileURLToPath(import.meta.url);
		const __dir = dirname(__filename);
		const cspPath = join(
			__dir,
			"../../../infra/cloudfront-security-headers.main.json",
		);
		const csp = JSON.parse(readFileSync(cspPath, "utf8"));
		const policy: string =
			csp.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
		// connect-src contains the new host
		const connectSrc = policy.match(/connect-src ([^;]+)/)?.[1] ?? "";
		expect(connectSrc).toContain("https://tv.radiohosting.online:9484");
		// media-src contains the new host
		const mediaSrc = policy.match(/media-src ([^;]+)/)?.[1] ?? "";
		expect(mediaSrc).toContain("https://tv.radiohosting.online:9484");
	});
});
