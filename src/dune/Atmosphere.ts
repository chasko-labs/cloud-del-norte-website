// Atmosphere — directional sun + hemispheric fill + scene fog.
//
// Lambert in the dune fragment shader is what the eye actually reads (it
// uses the sunDir uniform, wobbled per frame). The DirectionalLight here is
// kept for any future material that DOESN'T sample sunDir directly; it stays
// at the constant SUN_DIR_WORLD-derived light vector. Fill light gives a
// warm cream ground-bounce so undersides don't go gray.
//
// Aerial-perspective haze lives in DuneMaterial as a horizonTint mix; that
// affects per-fragment dune body colour. The scene-fog here is separate —
// FOGMODE_EXP2 wraps everything (dunes, skybox sample range) in a soft
// distance-haze that rolls into the viewport edges. The LEFT edge of the
// dune mesh rounds short of the viewport border; without fog you see an
// awkward cream gap. With fog, the gap softens into the ambient haze.
//
// Fog colour pulls from the dune palette horizon stop (mixed by phase) and
// is gently tinted by the active station-primary CSS custom property. The
// CSS prop is read at low cadence (station change events), NEVER per frame.
// Per-frame work is just one Color3.set() that mixes pre-computed scratch
// triples — no allocations, no DOM reads.
//
// Sun-disc + halo are in Skybox.

import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import { type AnimationState, SUN_DIR_WORLD } from "./AnimationController.js";
import { mixPhaseColor } from "./dune-colors.js";

// Density tuned over a CAMERA_RADIUS_BASE=45 dune scene. Bumped 0.012 → 0.028
// in the White Sands pass so the fog is actually visible at noon — the prior
// veil was too soft to read against the cream dune body. 0.028 gives a clear
// haze gradient toward the viewport edges without washing the central crests.
// Pairs with HazeBackdrop's vertical alpha gradient quad which sells the
// horizon haze that scene fog alone can't deliver against a bounded mesh.
const FOG_DENSITY_BASE = 0.028;

// Station tint weight — fog colour is 85% palette-horizon, 15% station tint.
// Subtle; the goal is "the haze breathes with the player" not "the dunes
// turn purple when KEXP plays".
const STATION_TINT_WEIGHT = 0.15;

// Fallback station tint when no CSS custom prop is set yet (page load before
// the player mounts). Brand lavender [0xd7, 0xc7, 0xee] in 0..1 floats —
// matches --color-brand-lavender from the design tokens.
const FALLBACK_STATION_TINT: [number, number, number] = [0.843, 0.78, 0.933];

export class Atmosphere {
	private readonly sun: DirectionalLight;
	private readonly fill: HemisphericLight;
	private readonly scene: Scene;

	// Scratch triples — allocated once, mutated per-frame. Avoids GC churn in
	// the render loop.
	private readonly horizonScratch: [number, number, number] = [0, 0, 0];
	private readonly stationTint: [number, number, number] = [
		...FALLBACK_STATION_TINT,
	];

	constructor(scene: Scene) {
		this.scene = scene;

		// DirectionalLight direction is the LIGHT-TRAVEL vector — opposite the
		// "toward sun" sunDir we expose to shaders.
		this.sun = new DirectionalLight(
			"dune-sun",
			new Vector3(-SUN_DIR_WORLD.x, -SUN_DIR_WORLD.y, -SUN_DIR_WORLD.z),
			scene,
		);
		this.sun.intensity = 1.4;
		this.sun.diffuse = new Color3(1.0, 0.97, 0.88);
		this.sun.specular = new Color3(0, 0, 0);

		this.fill = new HemisphericLight("dune-fill", new Vector3(0, 1, 0), scene);
		this.fill.intensity = 0.45;
		this.fill.diffuse = new Color3(0.86, 0.88, 0.92);
		this.fill.groundColor = new Color3(0.97, 0.94, 0.88);

		// Scene fog setup. EXP2 chosen over LINEAR because the dune scene has
		// no fixed near/far plane in the player's mental model — EXP2's smooth
		// distance falloff reads as natural haze, not a stage-curtain wipe.
		scene.fogMode = Scene.FOGMODE_EXP2;
		scene.fogDensity = FOG_DENSITY_BASE;
		// Initial colour — midday horizon (palette default before update() runs).
		scene.fogColor = new Color3(0.91, 0.875, 0.792);

		// Pull station tint once at construction in case the player already
		// mounted before the scene did.
		this.refreshStationTint();
	}

	/**
	 * Read --station-primary-rgb from documentElement and cache it. Cheap
	 * (one getComputedStyle + one parse) but NOT cheap enough to do every
	 * frame — call from the station-change pathway instead. Idempotent;
	 * safe to call repeatedly. SSR-guarded.
	 */
	refreshStationTint(): void {
		if (typeof document === "undefined") return;
		try {
			const raw = getComputedStyle(document.documentElement)
				.getPropertyValue("--station-primary-rgb")
				.trim();
			if (!raw) {
				this.stationTint[0] = FALLBACK_STATION_TINT[0];
				this.stationTint[1] = FALLBACK_STATION_TINT[1];
				this.stationTint[2] = FALLBACK_STATION_TINT[2];
				return;
			}
			// CSS prop format from hexToRgbTuple is "r, g, b" (0..255 ints).
			const parts = raw.split(",").map((s) => Number.parseFloat(s.trim()));
			if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return;
			this.stationTint[0] = parts[0] / 255;
			this.stationTint[1] = parts[1] / 255;
			this.stationTint[2] = parts[2] / 255;
		} catch {
			// getComputedStyle throws in detached docs / pre-mount edge cases.
			// Silent fallback — keep the previously cached tint.
		}
	}

	/**
	 * Per-frame fog refresh. Mixes the dune-palette horizon stop (by current
	 * phase weights) with the cached station tint. Called from the scene's
	 * registerBeforeRender so fog colour drifts with timeOfDay just like the
	 * dune body shadow / peak colours do.
	 */
	update(animState: AnimationState): void {
		mixPhaseColor(
			this.horizonScratch,
			animState.phaseWeights,
			(p) => p.horizon,
		);
		const w = STATION_TINT_WEIGHT;
		const base = 1 - w;
		this.scene.fogColor.set(
			this.horizonScratch[0] * base + this.stationTint[0] * w,
			this.horizonScratch[1] * base + this.stationTint[1] * w,
			this.horizonScratch[2] * base + this.stationTint[2] * w,
		);
	}

	dispose(): void {
		this.sun.dispose();
		this.fill.dispose();
		// Scene fog mode is part of the scene; the scene itself is disposed by
		// the bootstrap so no explicit fog teardown needed.
	}
}
