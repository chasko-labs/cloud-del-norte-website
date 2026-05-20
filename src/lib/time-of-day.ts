// Shared time-of-day helpers used by:
//   - src/components/weather/atmosphere-scene.tsx (wave 59)
//   - src/components/footer/atmosphere-ribbon.tsx  (wave 60)

export type TOD = "night" | "dawn" | "day" | "dusk";

/** Band: 0–4 night, 5–7 dawn, 8–17 day, 18–20 dusk, 21–23 night */
export function getTOD(hour: number): TOD {
	if (hour >= 5 && hour <= 7) return "dawn";
	if (hour >= 8 && hour <= 17) return "day";
	if (hour >= 18 && hour <= 20) return "dusk";
	return "night";
}

/** Sky background as RGBA [0–1] components */
export function skyColor(tod: TOD): [number, number, number, number] {
	switch (tod) {
		case "dawn":
			return [0.96, 0.74, 0.65, 1];
		case "day":
			return [0.53, 0.81, 0.98, 1];
		case "dusk":
			return [0.95, 0.6, 0.3, 1];
		case "night":
			return [0.06, 0.06, 0.22, 1];
	}
}

export function isNight(hour: number): boolean {
	return hour >= 21 || hour <= 5;
}

/**
 * Maps hour (0–23) to a normalised X position in [0, 1] for the sun/moon disc.
 *
 * Convention (matches Bryan's spec):
 *   sunrise  (hour  6) → right edge  (x = 1)
 *   noon     (hour 12) → centre      (x = 0.5)
 *   sunset   (hour 18) → left edge   (x = 0)
 *
 * Night hours clamp to the extremes but keep traversal continuity:
 *   0–5   → 1 (off-screen right, pre-dawn)
 *   19–23 → 0 (off-screen left, post-dusk)
 */
export function sunHourToX(hour: number): number {
	if (hour <= 6) return 1;
	if (hour >= 18) return 0;
	// linear interpolation: 6 → 1, 18 → 0
	return 1 - (hour - 6) / 12;
}

/**
 * CSS gradient string for the ribbon background, derived from TOD.
 * Returns a linear-gradient value (no `background:` prefix).
 */
export function todGradient(tod: TOD): string {
	switch (tod) {
		case "dawn":
			return "linear-gradient(90deg, #2c1654 0%, #d4637a 40%, #f5b97b 70%, #fde9c3 100%)";
		case "day":
			return "linear-gradient(90deg, #87ceeb 0%, #d0eeff 50%, #87ceeb 100%)";
		case "dusk":
			return "linear-gradient(90deg, #f5b97b 0%, #e8684a 40%, #9b3a6d 70%, #2c1654 100%)";
		case "night":
			return "linear-gradient(90deg, #0a0a2e 0%, #1a1a4e 50%, #0a0a2e 100%)";
	}
}

/** Current El Paso local hour (0–23) */
export function elPasoHour(): number {
	return Number(
		new Date().toLocaleString("en-US", {
			timeZone: "America/Denver",
			hour: "numeric",
			hour12: false,
		}),
	);
}
