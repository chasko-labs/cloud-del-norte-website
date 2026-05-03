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
		// ibero_909, concepto_radial, radio_udg_lagos
		expect(mxStations.length).toBe(3);
		for (const s of mxStations) {
			expect(s.location.country).toBe("México");
		}
	});
});
