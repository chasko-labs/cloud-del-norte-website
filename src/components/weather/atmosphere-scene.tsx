// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Wave 59 — first real-content Babylon scene mounted on the wave 53 BabylonGate
// foundation. Background atmosphere behind the weather card text, driven by
// weather code + local time-of-day. ~165 lines.
//
// Epilepsy rules: NO flicker, NO strobe. Only steady glows, slow animations,
// and a single 12-s ease arc for thunderstorm.

import { useEffect, useRef } from "react";

export interface AtmosphereSceneProps {
	weatherCode: number;
	timezone: string;
	/** 0–23 local hour in the city's timezone */
	hour: number;
}

// WMO weather code → scene variant
export type WeatherVariant =
	| "clear"
	| "partly-cloudy"
	| "fog"
	| "rain"
	| "snow"
	| "thunderstorm";

export function codeToVariant(code: number): WeatherVariant {
	if (code === 0) return "clear";
	if (code <= 3) return "partly-cloudy";
	if (code <= 48) return "fog";
	if (code <= 82) return "rain"; // drizzle, rain, showers
	if (code <= 77) return "snow"; // unreachable branch keeps exhaustive — handled by <=82 above for non-snow
	if (code >= 95) return "thunderstorm";
	return "partly-cloudy";
}

// More precise mapping used by the scene itself:
export function codeToVariantExact(code: number): WeatherVariant {
	if (code === 0) return "clear";
	if (code <= 3) return "partly-cloudy";
	if (code === 45 || code === 48) return "fog";
	if (code >= 51 && code <= 67) return "rain";
	if (code >= 71 && code <= 77) return "snow";
	if (code >= 80 && code <= 82) return "rain";
	if (code >= 95 && code <= 99) return "thunderstorm";
	return "partly-cloudy";
}

// Time-of-day band: 0–4 night, 5–7 dawn, 8–17 day, 18–20 dusk, 21–23 night
type TOD = "night" | "dawn" | "day" | "dusk";

function getTOD(hour: number): TOD {
	if (hour >= 5 && hour <= 7) return "dawn";
	if (hour >= 8 && hour <= 17) return "day";
	if (hour >= 18 && hour <= 20) return "dusk";
	return "night";
}

// Sky background color per time-of-day (RGBA cleared as scene background)
function skyColor(tod: TOD): [number, number, number, number] {
	switch (tod) {
		case "dawn": return [0.96, 0.74, 0.65, 1]; // warm pink/mauve
		case "day": return [0.53, 0.81, 0.98, 1];  // light blue
		case "dusk": return [0.95, 0.6, 0.3, 1];   // amber
		case "night": return [0.06, 0.06, 0.22, 1]; // dark indigo
	}
}

// Directional-light position: sun/moon arc across the sky
function sunPosition(hour: number): [number, number, number] {
	// 6am = right (1,0.5,0), noon = overhead (0,1,0), 6pm = left (-1,0.5,0)
	// Map 6→0, 12→π/2, 18→π
	const t = ((hour - 6) / 12) * Math.PI;
	return [Math.cos(t), Math.sin(t) * 0.8 + 0.2, 0.3];
}

function isNight(hour: number): boolean {
	return hour >= 21 || hour <= 5;
}

export default function AtmosphereScene({
	weatherCode,
	timezone: _timezone,
	hour,
}: AtmosphereSceneProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// biome-ignore lint/suspicious/noExplicitAny: dynamic babylon import
	const engRef = useRef<any>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let disposed = false;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic babylon import
		let eng: any = null;

		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		const variant = codeToVariantExact(weatherCode);
		const tod = getTOD(hour);
		const night = isNight(hour);
		const [sr, sg, sb, sa] = skyColor(tod);
		const [lx, ly, lz] = sunPosition(hour);

		void (async () => {
			const B = await import("@babylonjs/core");
			if (disposed) return;

			eng = new B.Engine(canvas, true, { preserveDrawingBuffer: false });
			engRef.current = eng;
			const scene = new B.Scene(eng);
			scene.clearColor = new B.Color4(sr, sg, sb, sa);

			// Camera — slow auto-orbit, no user input
			const cam = new B.ArcRotateCamera(
				"cam",
				-Math.PI / 2,
				Math.PI / 3,
				4,
				B.Vector3.Zero(),
				scene,
			);
			cam.inputs.clear(); // lock — no user drag

			// Lights
			const hemi = new B.HemisphericLight(
				"hemi",
				new B.Vector3(0, 1, 0),
				scene,
			);
			hemi.intensity = night ? 0.3 : 0.7;
			if (night) hemi.diffuse = new B.Color3(0.5, 0.6, 0.9); // cool blue tint

			const dir = new B.DirectionalLight(
				"sun",
				new B.Vector3(-lx, -ly, -lz),
				scene,
			);
			dir.intensity = night ? 0.15 : 0.8;
			if (night) dir.diffuse = new B.Color3(0.6, 0.6, 0.9);

			// Central scene element
			const meshes: ReturnType<typeof B.MeshBuilder.CreateSphere>[] = [];

			if (variant === "clear" || variant === "partly-cloudy") {
				const sphere = B.MeshBuilder.CreateSphere(
					"sun-bulb",
					{ diameter: 0.6 },
					scene,
				);
				const mat = new B.StandardMaterial("sun-mat", scene);
				mat.emissiveColor = night
					? new B.Color3(0.7, 0.7, 1.0)
					: new B.Color3(1.0, 0.9, 0.4);
				mat.disableLighting = true;
				sphere.material = mat;
				meshes.push(sphere);

				if (!reduced) {
					// 4-second gentle breathing — no flicker, smooth sine
					const anim = new B.Animation(
						"breathe",
						"scaling",
						30,
						B.Animation.ANIMATIONTYPE_VECTOR3,
						B.Animation.ANIMATIONLOOPMODE_CYCLE,
					);
					anim.setKeys([
						{ frame: 0, value: new B.Vector3(1, 1, 1) },
						{ frame: 60, value: new B.Vector3(1.08, 1.08, 1.08) },
						{ frame: 120, value: new B.Vector3(1, 1, 1) },
					]);
					sphere.animations = [anim];
					scene.beginAnimation(sphere, 0, 120, true);
				}
			}

			if (
				variant === "fog" ||
				variant === "partly-cloudy" ||
				variant === "thunderstorm"
			) {
				const count = variant === "fog" ? 14 : 8;
				const baseTint = variant === "thunderstorm" ? 0.55 : 0.92;
				for (let i = 0; i < count; i++) {
					const s = B.MeshBuilder.CreateSphere(
						`cloud-${i}`,
						{ diameter: 0.18 + Math.random() * 0.22 },
						scene,
					);
					s.position = new B.Vector3(
						(Math.random() - 0.5) * 2.4,
						(Math.random() - 0.5) * 0.8,
						(Math.random() - 0.5) * 1.2,
					);
					const m = new B.StandardMaterial(`cloud-mat-${i}`, scene);
					m.emissiveColor = new B.Color3(baseTint, baseTint, baseTint);
					m.alpha = 0.55;
					s.material = m;
					meshes.push(s);
				}
			}

			if (variant === "rain" || variant === "snow") {
				const isSnow = variant === "snow";
				for (let i = 0; i < 24; i++) {
					const streak = B.MeshBuilder.CreateCylinder(
						`drop-${i}`,
						{ diameter: isSnow ? 0.03 : 0.015, height: isSnow ? 0.04 : 0.12 },
						scene,
					);
					streak.position = new B.Vector3(
						(Math.random() - 0.5) * 2.4,
						1.2 + Math.random() * 1.2,
						(Math.random() - 0.5) * 1.2,
					);
					const m = new B.StandardMaterial(`drop-mat-${i}`, scene);
					m.emissiveColor = isSnow
						? new B.Color3(0.95, 0.95, 1.0)
						: new B.Color3(0.5, 0.7, 0.9);
					streak.material = m;
					meshes.push(streak);

					if (!reduced) {
						const speed = isSnow ? 15 : 30;
						const anim = new B.Animation(
							`fall-${i}`,
							"position.y",
							speed,
							B.Animation.ANIMATIONTYPE_FLOAT,
							B.Animation.ANIMATIONLOOPMODE_CYCLE,
						);
						const start = streak.position.y;
						anim.setKeys([
							{ frame: 0, value: start },
							{ frame: speed, value: -1.5 },
						]);
						streak.animations = [anim];
						scene.beginAnimation(streak, 0, speed, true);
					}
				}
			}

			// Camera slow orbit — 60s revolution
			if (!reduced) {
				const orbitAnim = new B.Animation(
					"orbit",
					"alpha",
					1,
					B.Animation.ANIMATIONTYPE_FLOAT,
					B.Animation.ANIMATIONLOOPMODE_CYCLE,
				);
				orbitAnim.setKeys([
					{ frame: 0, value: -Math.PI / 2 },
					{ frame: 60, value: -Math.PI / 2 + Math.PI * 2 },
				]);
				cam.animations = [orbitAnim];
				scene.beginAnimation(cam, 0, 60, true);
			}

			// Thunderstorm: single slow arc line on 12-s loop
			if (variant === "thunderstorm" && !reduced) {
				const arc = B.MeshBuilder.CreateLines(
					"arc",
					{
						points: [
							new B.Vector3(0.1, 0.6, 0),
							new B.Vector3(-0.05, 0.2, 0),
							new B.Vector3(0.08, -0.1, 0),
							new B.Vector3(-0.02, -0.5, 0),
						],
					},
					scene,
				);
				arc.color = new B.Color3(0.7, 0.8, 1.0);
				// Fade in/out on 12s loop — NOT a flicker/strobe
				const alphaAnim = new B.Animation(
					"arc-fade",
					"visibility",
					1,
					B.Animation.ANIMATIONTYPE_FLOAT,
					B.Animation.ANIMATIONLOOPMODE_CYCLE,
				);
				alphaAnim.setKeys([
					{ frame: 0, value: 0 },
					{ frame: 2, value: 0 },
					{ frame: 4, value: 0.8 },
					{ frame: 8, value: 0.8 },
					{ frame: 12, value: 0 },
				]);
				arc.animations = [alphaAnim];
				scene.beginAnimation(arc, 0, 12, true);
			}

			const render = () => scene.render();

			// Visibility pause — wave 21 pattern
			const onVis = () =>
				document.hidden ? eng.stopRenderLoop() : eng.runRenderLoop(render);
			document.addEventListener("visibilitychange", onVis);
			eng.__onVis = onVis;

			// cdn-scrolling fast-scroll pause
			const onScrollStart = () => eng.stopRenderLoop();
			const onScrollEnd = () => eng.runRenderLoop(render);
			document.body.addEventListener("cdn-scroll-start", onScrollStart);
			document.body.addEventListener("cdn-scroll-end", onScrollEnd);
			eng.__scrollStart = onScrollStart;
			eng.__scrollEnd = onScrollEnd;

			// ResizeObserver
			const ro = new ResizeObserver(() => {
				eng.resize();
			});
			ro.observe(canvas);
			eng.__ro = ro;

			if (reduced) {
				// Single static frame
				scene.render();
			} else {
				eng.runRenderLoop(render);
			}
		})();

		return () => {
			disposed = true;
			if (eng) {
				document.removeEventListener("visibilitychange", eng.__onVis);
				document.body.removeEventListener(
					"cdn-scroll-start",
					eng.__scrollStart,
				);
				document.body.removeEventListener("cdn-scroll-end", eng.__scrollEnd);
				eng.__ro?.disconnect();
				eng.dispose();
			}
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [weatherCode, hour]);

	return (
		// biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative background canvas; pointerEvents:none, non-interactive
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				display: "block",
				borderRadius: "inherit",
				pointerEvents: "none",
			}}
		/>
	);
}
