// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useEffect, useState } from "react";
import "./styles.css";

const CACHE_KEY = "cdn-weather-cache-v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FORECAST_URL =
	"https://api.open-meteo.com/v1/forecast?latitude=31.7619&longitude=-106.4850&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Denver";
const AQI_URL =
	"https://air-quality-api.open-meteo.com/v1/air-quality?latitude=31.7619&longitude=-106.4850&current=us_aqi,uv_index";

interface Forecast {
	current: {
		temperature_2m: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
		precipitation: number;
		weather_code: number;
	};
	daily: {
		time: string[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_probability_max: number[];
	};
}

interface AirQuality {
	current: {
		us_aqi: number | null;
		uv_index: number | null;
	};
}

interface CachedWeather {
	ts: number;
	forecast: Forecast | null;
	air: AirQuality | null;
}

const fToC = (f: number): number => Math.round((f - 32) * 5) / 9;

/** WMO weather code → tiny glyph + tone — keeps the card scannable */
function weatherGlyph(code: number): string {
	if (code === 0) return "☀";
	if (code <= 3) return "⛅";
	if (code <= 48) return "☁";
	if (code <= 67) return "🌧";
	if (code <= 77) return "❄";
	if (code <= 82) return "🌧";
	if (code >= 95) return "⛈";
	return "·";
}

/** Compass cardinal from a degree heading — 8-point */
function compass(deg: number): string {
	const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
	return dirs[Math.round(deg / 45) % 8];
}

/** AQI category — US EPA 6-tier, mapped to a single one-word label */
function aqiLabel(aqi: number | null): string {
	if (aqi == null) return "—";
	if (aqi <= 50) return "good";
	if (aqi <= 100) return "moderate";
	if (aqi <= 150) return "unhealthy*";
	if (aqi <= 200) return "unhealthy";
	if (aqi <= 300) return "very poor";
	return "hazardous";
}

function loadCache(): CachedWeather | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CachedWeather;
		if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
		return parsed;
	} catch {
		return null;
	}
}

function saveCache(data: CachedWeather): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(data));
	} catch {
		// quota exceeded / private mode — silently skip
	}
}

export default function Weather() {
	const [data, setData] = useState<CachedWeather | null>(() => loadCache());

	useEffect(() => {
		// already-fresh cache — don't refetch on mount
		const cached = loadCache();
		if (cached) {
			setData(cached);
			return;
		}
		let cancelled = false;
		void Promise.allSettled([
			fetch(FORECAST_URL).then((r) =>
				r.ok ? (r.json() as Promise<Forecast>) : null,
			),
			fetch(AQI_URL).then((r) =>
				r.ok ? (r.json() as Promise<AirQuality>) : null,
			),
		]).then((results) => {
			if (cancelled) return;
			const forecast =
				results[0].status === "fulfilled" ? results[0].value : null;
			const air = results[1].status === "fulfilled" ? results[1].value : null;
			const fresh: CachedWeather = { ts: Date.now(), forecast, air };
			saveCache(fresh);
			setData(fresh);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Bryan v0.0.0070: render NOTHING while data is loading. The placeholder
	// flashed on every cold load. Once data resolves the card fades in starting
	// with the cloud glyph + city header, then the body, then the tomorrow row
	// (CSS choreographs the cascade via animation-delay).
	if (!data?.forecast) return null;

	const f = data.forecast;
	const cur = f.current;
	const tomorrow = {
		hi: f.daily.temperature_2m_max[1],
		lo: f.daily.temperature_2m_min[1],
		precip: f.daily.precipitation_probability_max[1],
	};
	const air = data.air?.current ?? null;
	const tempF = Math.round(cur.temperature_2m);
	const tempC = Math.round(fToC(cur.temperature_2m));
	const tomorrowHiF = Math.round(tomorrow.hi);
	const tomorrowHiC = Math.round(fToC(tomorrow.hi));
	const tomorrowLoF = Math.round(tomorrow.lo);
	const tomorrowLoC = Math.round(fToC(tomorrow.lo));

	return (
		<aside className="cdn-weather" aria-label="el paso weather">
			<header className="cdn-weather__head">
				<span className="cdn-weather__city">el paso</span>
				<span className="cdn-weather__glyph" aria-hidden="true">
					{weatherGlyph(cur.weather_code)}
				</span>
			</header>

			<div className="cdn-weather__now">
				<div className="cdn-weather__temp">
					<span className="cdn-weather__temp-f">
						{tempF}
						<span className="cdn-weather__deg">°F</span>
					</span>
					<span className="cdn-weather__temp-rule" aria-hidden="true" />
					<span className="cdn-weather__temp-c">
						{tempC}
						<span className="cdn-weather__deg">°C</span>
					</span>
				</div>
				<dl className="cdn-weather__metrics">
					<div className="cdn-weather__metric">
						<dt>wind</dt>
						<dd>
							{Math.round(cur.wind_speed_10m)} mph{" "}
							{compass(cur.wind_direction_10m)}
						</dd>
					</div>
					{cur.precipitation > 0 ? (
						<div className="cdn-weather__metric">
							<dt>precip</dt>
							<dd>{cur.precipitation.toFixed(1)} mm</dd>
						</div>
					) : null}
					{air?.uv_index != null && air.uv_index > 0 ? (
						<div className="cdn-weather__metric">
							<dt>uv</dt>
							<dd>{air.uv_index.toFixed(1)}</dd>
						</div>
					) : null}
					{air?.us_aqi != null ? (
						<div className="cdn-weather__metric">
							<dt>aqi</dt>
							<dd>
								{air.us_aqi}{" "}
								<span className="cdn-weather__aqi-label">
									{aqiLabel(air.us_aqi)}
								</span>
							</dd>
						</div>
					) : null}
				</dl>
			</div>

			<footer className="cdn-weather__tomorrow">
				<span className="cdn-weather__tomorrow-label">tomorrow</span>
				<span className="cdn-weather__tomorrow-temps">
					<span className="cdn-weather__hi">
						{tomorrowHiF}°/{tomorrowHiC}°
					</span>
					<span className="cdn-weather__lo">
						{tomorrowLoF}°/{tomorrowLoC}°
					</span>
				</span>
				{/* reserve real estate for precip% always so the row doesn't reflow on
				    no-rain days; only render the value when probability > 0 */}
				<span className="cdn-weather__tomorrow-precip">
					{tomorrow.precip > 0 ? `${tomorrow.precip}%` : ""}
				</span>
			</footer>
		</aside>
	);
}
