import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CITIES } from "../cities";
import Weather from "../index";

const city = CITIES[0];
const key = `cdn-weather-cache-v2-${city.key}`;

const freshCache = () =>
	JSON.stringify({
		ts: Date.now(),
		forecast: {
			current: {
				temperature_2m: 85,
				wind_speed_10m: 7,
				wind_direction_10m: 180,
				precipitation: 0,
				weather_code: 0,
			},
			daily: {
				time: ["2026-05-31", "2026-06-01"],
				temperature_2m_max: [90, 88],
				temperature_2m_min: [65, 63],
				precipitation_probability_max: [10, 20],
			},
		},
		air: { current: { us_aqi: 42, uv_index: 7 } },
	});

describe("Weather card — glassmorphic surface, no time-of-day sky canvas", () => {
	beforeEach(() => {
		localStorage.setItem(key, freshCache());
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("renders the city label when cache is fresh", () => {
		render(<Weather />);
		expect(screen.getByText(city.label)).toBeTruthy();
	});

	it("does NOT render a Babylon canvas element", () => {
		const { container } = render(<Weather />);
		expect(container.querySelector("canvas")).toBeNull();
	});
});
