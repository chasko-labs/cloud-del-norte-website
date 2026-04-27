// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 3d pie overlay — lazy-loads babylon.js after first paint, animates segments
// rising over the existing cloudscape 2d piechart. cleanup on unmount disposes
// the engine to keep react 19 strict-mode double-mount idempotent.
//
// geometry: each segment is a compound mesh:
//   top cap   — ribbon from innerR to outerR at y = extrudeH
//   bottom cap — ribbon from innerR to outerR at y = 0
//   outer wall — ribbon along outerR from y=0 to y=extrudeH
//   inner wall — ribbon along innerR from y=0 to y=extrudeH
// all four surfaces share one material so depth reads as a single solid wedge.
// the camera is tilted (beta ~PI/3.5) so top + side faces are both visible.
import { useEffect, useRef } from "react";

export interface PieOverlayItem {
	title: string;
	value: number;
}

interface Props {
	items: PieOverlayItem[];
}

// segment palette — matches verifier observation order:
// servicenow lens (pink/magenta), games & 3d (orange-yellow),
// space & satellite (green-blue), artificial intelligence (blue-purple)
const SEGMENT_COLORS = ["#c94db5", "#e8a020", "#2e8fa3", "#6b5cdb"];

function scheduleIdle(fn: () => void): void {
	if ("requestIdleCallback" in window) {
		requestIdleCallback(fn, { timeout: 1500 });
	} else {
		setTimeout(fn, 1500);
	}
}

function hexToColor3(
	hex: string,
	Color3Ctor: new (r: number, g: number, b: number) => unknown,
): unknown {
	const v = hex.replace("#", "");
	const r = parseInt(v.substring(0, 2), 16) / 255;
	const g = parseInt(v.substring(2, 4), 16) / 255;
	const b = parseInt(v.substring(4, 6), 16) / 255;
	return new Color3Ctor(r, g, b);
}

export default function PieOverlay3D({ items }: Props) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		let cancelled = false;
		// engine is disposed in cleanup — typed loosely because babylon is
		// dynamically imported and module shapes are not in scope at compile time
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let engine: any = null;

		async function boot() {
			if (cancelled) return;
			const canvas = canvasRef.current;
			if (!canvas) return;
			if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
				console.warn(
					"[pie-3d-overlay] bail: canvas zero-size at boot",
					canvas.clientWidth,
					canvas.clientHeight,
				);
				return;
			}

			try {
				const [
					{ Engine },
					{ Scene },
					{ ArcRotateCamera },
					{ HemisphericLight },
					{ DirectionalLight },
					{ CreateRibbon },
					{ Mesh },
					{ StandardMaterial },
					{ Animation },
					{ AnimationGroup },
					{ CubicEase, EasingFunction },
					{ Color3 },
					{ Vector3 },
				] = await Promise.all([
					import("@babylonjs/core/Engines/engine"),
					import("@babylonjs/core/scene"),
					import("@babylonjs/core/Cameras/arcRotateCamera"),
					import("@babylonjs/core/Lights/hemisphericLight"),
					import("@babylonjs/core/Lights/directionalLight"),
					import("@babylonjs/core/Meshes/Builders/ribbonBuilder"),
					import("@babylonjs/core/Meshes/mesh"),
					import("@babylonjs/core/Materials/standardMaterial"),
					import("@babylonjs/core/Animations/animation"),
					import("@babylonjs/core/Animations/animationGroup"),
					import("@babylonjs/core/Animations/easing"),
					import("@babylonjs/core/Maths/math.color"),
					import("@babylonjs/core/Maths/math.vector"),
				]);
				if (cancelled) return;

				engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
				const scene = new Scene(engine);
				scene.clearColor = { r: 0, g: 0, b: 0, a: 0 } as never;

				// camera tilted to show top face + side extrusion simultaneously
				// alpha: -PI/2 faces front. beta: ~PI/3.5 (~51 deg from top) shows depth
				// radius 5.5 fits the 1029x348 canvas without clipping outer labels
				const camera = new ArcRotateCamera(
					"cam",
					-Math.PI / 2,
					Math.PI / 3.5,
					5.5,
					new Vector3(0, 0.15, 0),
					scene,
				);
				camera.attachControl(canvas, false);
				camera.lowerBetaLimit = Math.PI / 6;
				camera.upperBetaLimit = Math.PI / 2.2;

				// fill light — diffuse ambient so top faces read as colored
				const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(hemi as any).intensity = 0.55;

				// key directional light — rakes across the top-left so side walls
				// receive a shadow gradient that reads as depth
				const dir = new DirectionalLight(
					"key",
					new Vector3(-1.2, -2, -0.8),
					scene,
				);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(dir as any).intensity = 0.9;

				const total = items.reduce((s, it) => s + it.value, 0) || 1;
				const innerR = 0.42;
				const outerR = 1.0;
				const extrudeH = 0.32; // visible extrusion depth
				const arcSteps = 32; // smoother arcs
				let cursor = 0;

				const group = new AnimationGroup("riseGroup", scene);
				const ease = new CubicEase();
				ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

				items.forEach((seg, idx) => {
					const sweep = (seg.value / total) * Math.PI * 2;
					const a0 = cursor;
					const a1 = cursor + sweep;
					cursor = a1;

					// build arc sample arrays at outerR and innerR in the XZ plane
					// these are reused for all four surfaces of the extruded wedge
					const arcOuter: unknown[] = [];
					const arcInner: unknown[] = [];
					for (let s = 0; s <= arcSteps; s++) {
						const t = s / arcSteps;
						const a = a0 + (a1 - a0) * t;
						arcOuter.push(
							new Vector3(Math.cos(a) * outerR, 0, Math.sin(a) * outerR),
						);
						arcInner.push(
							new Vector3(Math.cos(a) * innerR, 0, Math.sin(a) * innerR),
						);
					}

					// top cap: ribbon at y = extrudeH, inner → outer (face up)
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const topOuter = (arcOuter as any[]).map(
						(v) => new Vector3(v.x, extrudeH, v.z),
					);
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const topInner = (arcInner as any[]).map(
						(v) => new Vector3(v.x, extrudeH, v.z),
					);
					const topCap = CreateRibbon(
						`top-${idx}`,
						{
							pathArray: [topInner as never, topOuter as never],
							sideOrientation: 2,
						},
						scene,
					);

					// bottom cap: ribbon at y = 0, inner → outer (face down, sideOrientation 1)
					const botCap = CreateRibbon(
						`bot-${idx}`,
						{
							pathArray: [arcInner as never, arcOuter as never],
							sideOrientation: 1,
						},
						scene,
					);

					// outer wall: ribbon along outerR from y=0 to y=extrudeH
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const outerWallBot = (arcOuter as any[]).map(
						(v) => new Vector3(v.x, 0, v.z),
					);
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const outerWallTop = (arcOuter as any[]).map(
						(v) => new Vector3(v.x, extrudeH, v.z),
					);
					const outerWall = CreateRibbon(
						`ow-${idx}`,
						{
							pathArray: [outerWallBot as never, outerWallTop as never],
							sideOrientation: 2,
						},
						scene,
					);

					// inner wall: ribbon along innerR from y=0 to y=extrudeH (faces inward)
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const innerWallBot = (arcInner as any[]).map(
						(v) => new Vector3(v.x, 0, v.z),
					);
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const innerWallTop = (arcInner as any[]).map(
						(v) => new Vector3(v.x, extrudeH, v.z),
					);
					const innerWall = CreateRibbon(
						`iw-${idx}`,
						{
							pathArray: [innerWallBot as never, innerWallTop as never],
							sideOrientation: 1,
						},
						scene,
					);

					// merge all surfaces under a single parent pivot so animation
					// moves the whole wedge as a unit
					const pivot = new Mesh(`seg-${idx}`, scene);
					topCap.parent = pivot;
					botCap.parent = pivot;
					outerWall.parent = pivot;
					innerWall.parent = pivot;

					// material — slightly brightened emissive so color reads through
					// the ambient hemi, specular kept tight to avoid blown highlights
					const mat = new StandardMaterial(`mat-${idx}`, scene);
					const baseColor = hexToColor3(
						SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
						Color3 as never,
					) as { r: number; g: number; b: number };

					// top face brighter, side walls inherit diffuse naturally via lighting
					(mat as { diffuseColor: unknown }).diffuseColor = baseColor;
					// subtle self-glow keeps segments visible against transparent bg
					(mat as { emissiveColor: unknown }).emissiveColor = hexToColor3(
						"#111111",
						Color3 as never,
					);
					(mat as { specularColor: unknown }).specularColor = hexToColor3(
						"#333333",
						Color3 as never,
					);
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(mat as any).specularPower = 32;

					topCap.material = mat;
					botCap.material = mat;
					outerWall.material = mat;
					innerWall.material = mat;

					// animate: pivot rises from y = -extrudeH to y = 0
					// stagger onset by segment index for a "blooming" effect
					pivot.position.y = -extrudeH;

					const startFrame = idx * 8;
					const endFrame = startFrame + 40;

					const yAnim = new Animation(
						`y-${idx}`,
						"position.y",
						60,
						Animation.ANIMATIONTYPE_FLOAT,
						Animation.ANIMATIONLOOPMODE_CONSTANT,
					);
					yAnim.setKeys([
						{ frame: 0, value: -extrudeH },
						{ frame: startFrame, value: -extrudeH },
						{ frame: endFrame, value: 0 },
					]);
					yAnim.setEasingFunction(ease);
					group.addTargetedAnimation(yAnim, pivot);
				});

				group.normalize(0, items.length * 8 + 40);
				group.play(false);

				engine.runRenderLoop(() => scene.render());

				const onResize = () => engine?.resize();
				window.addEventListener("resize", onResize);
				(engine as { __removeResize?: () => void }).__removeResize = () =>
					window.removeEventListener("resize", onResize);
			} catch (err) {
				console.warn("[pie-3d-overlay] bail: babylon load/init failed", err);
			}
		}

		function start() {
			if (cancelled) return;
			scheduleIdle(boot);
		}

		if (document.readyState === "complete") {
			start();
		} else {
			window.addEventListener("load", start, { once: true });
		}

		return () => {
			cancelled = true;
			if (engine) {
				try {
					(engine as { __removeResize?: () => void }).__removeResize?.();
					engine.dispose();
				} catch {
					// idempotent dispose under strict-mode double-invoke
				}
				engine = null;
			}
		};
	}, [items]);

	return (
		<canvas
			ref={canvasRef}
			data-testid="pie-3d-overlay"
			aria-hidden="true"
			tabIndex={-1}
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				background: "transparent",
			}}
		/>
	);
}
