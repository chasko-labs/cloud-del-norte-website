// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// 3D pie overlay — lazy-loads babylon.js after first paint, animates segments
// rising over the existing Cloudscape 2D PieChart. Cleanup on unmount disposes
// the engine to keep React 19 strict-mode double-mount idempotent.
import { useEffect, useRef } from "react";

export interface PieOverlayItem {
	title: string;
	value: number;
}

interface Props {
	items: PieOverlayItem[];
}

// hardcoded cloudscape default segment palette
// (games & 3d / ai / serverless / space — matches breakdown order)
const SEGMENT_COLORS = ["#0073bb", "#dd344c", "#107c10", "#ff9900"];

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
					{ CreateRibbon },
					{ StandardMaterial },
					{ Animation },
					{ AnimationGroup },
					{ CubicEase, EasingFunction },
					{ GlowLayer },
					{ Color3 },
					{ Vector3 },
				] = await Promise.all([
					import("@babylonjs/core/Engines/engine"),
					import("@babylonjs/core/scene"),
					import("@babylonjs/core/Cameras/arcRotateCamera"),
					import("@babylonjs/core/Lights/hemisphericLight"),
					import("@babylonjs/core/Meshes/Builders/ribbonBuilder"),
					import("@babylonjs/core/Materials/standardMaterial"),
					import("@babylonjs/core/Animations/animation"),
					import("@babylonjs/core/Animations/animationGroup"),
					import("@babylonjs/core/Animations/easing"),
					import("@babylonjs/core/Layers/glowLayer"),
					import("@babylonjs/core/Maths/math.color"),
					import("@babylonjs/core/Maths/math.vector"),
				]);
				if (cancelled) return;

				engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
				const scene = new Scene(engine);
				scene.clearColor = { r: 0, g: 0, b: 0, a: 0 } as never;

				const camera = new ArcRotateCamera(
					"cam",
					-Math.PI / 2,
					Math.PI / 3,
					4.5,
					new Vector3(0, 0, 0),
					scene,
				);
				camera.attachControl(canvas, false);
				camera.lowerBetaLimit = Math.PI / 6;
				camera.upperBetaLimit = Math.PI / 2.2;

				new HemisphericLight("light", new Vector3(0, 1, 0), scene);

				new GlowLayer("glow", scene, { mainTextureSamples: 2 });

				const total = items.reduce((s, it) => s + it.value, 0) || 1;
				const innerR = 0.4;
				const outerR = 1.0;
				const arcSteps = 24;
				let cursor = 0;

				const group = new AnimationGroup("riseGroup", scene);
				const ease = new CubicEase();
				ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

				items.forEach((seg, idx) => {
					const sweep = (seg.value / total) * Math.PI * 2;
					const a0 = cursor;
					const a1 = cursor + sweep;
					cursor = a1;

					const pathOuter: unknown[] = [];
					const pathInner: unknown[] = [];
					for (let s = 0; s <= arcSteps; s++) {
						const t = s / arcSteps;
						const a = a0 + (a1 - a0) * t;
						pathOuter.push(
							new Vector3(Math.cos(a) * outerR, 0, Math.sin(a) * outerR),
						);
						pathInner.push(
							new Vector3(Math.cos(a) * innerR, 0, Math.sin(a) * innerR),
						);
					}

					const mesh = CreateRibbon(
						`seg-${idx}`,
						{
							pathArray: [pathInner as never, pathOuter as never],
							sideOrientation: 2,
						},
						scene,
					);

					const mat = new StandardMaterial(`mat-${idx}`, scene);
					const color = hexToColor3(
						SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
						Color3 as never,
					);
					(mat as { diffuseColor: unknown }).diffuseColor = color;
					(mat as { emissiveColor: unknown }).emissiveColor = color;
					(mat as { specularColor: unknown }).specularColor = hexToColor3(
						"#222222",
						Color3 as never,
					);
					mesh.material = mat;

					mesh.position.y = 0;
					mesh.scaling.z = 0.2;

					const startFrame = idx * 8;
					const endFrame = startFrame + 36;

					const yAnim = new Animation(
						`y-${idx}`,
						"position.y",
						60,
						Animation.ANIMATIONTYPE_FLOAT,
						Animation.ANIMATIONLOOPMODE_CONSTANT,
					);
					yAnim.setKeys([
						{ frame: 0, value: 0 },
						{ frame: startFrame, value: 0 },
						{ frame: endFrame, value: 0.4 },
					]);
					yAnim.setEasingFunction(ease);

					const sAnim = new Animation(
						`s-${idx}`,
						"scaling.z",
						60,
						Animation.ANIMATIONTYPE_FLOAT,
						Animation.ANIMATIONLOOPMODE_CONSTANT,
					);
					sAnim.setKeys([
						{ frame: 0, value: 0.2 },
						{ frame: startFrame, value: 0.2 },
						{ frame: endFrame, value: 1 },
					]);
					sAnim.setEasingFunction(ease);

					group.addTargetedAnimation(yAnim, mesh);
					group.addTargetedAnimation(sAnim, mesh);
				});

				group.normalize(0, items.length * 8 + 36);
				group.play(false);

				engine.runRenderLoop(() => scene.render());

				const onResize = () => engine?.resize();
				window.addEventListener("resize", onResize);
				// store remover so cleanup can detach
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
