import { renderDark, resetDarkState } from "./dark.js";
import { renderLight, resetLightState } from "./light.js";
import type { StarPoint } from "./static.js";

export function isDark(): boolean {
	return document.documentElement.classList.contains("awsui-dark-mode");
}

export function render(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	ts: number,
	beatFired: boolean,
	visualBins: Uint8Array,
	stationKey: string,
	lowPower: boolean,
	staticLightCanvas: OffscreenCanvas | null,
	staticDarkCanvas: OffscreenCanvas | null,
	starPositions: StarPoint[],
): void {
	if (isDark()) {
		renderDark(
			ctx,
			w,
			h,
			ts,
			beatFired,
			visualBins,
			stationKey,
			lowPower,
			staticDarkCanvas,
			starPositions,
		);
	} else {
		renderLight(
			ctx,
			w,
			h,
			ts,
			beatFired,
			visualBins,
			stationKey,
			lowPower,
			staticLightCanvas,
			starPositions,
		);
	}
}

export function resetRendererState(): void {
	resetDarkState();
	resetLightState();
}
